import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getReportDataSource } from "@/lib/dataSource";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type NotificationStatus = 'queued' | 'sent' | 'failed' | 'skipped' | 'blocked';


export interface NotificationLogEntry {
  id?: string;
  event_type: string;
  report_id?: string | null;
  public_id?: string | null;
  destination: string;
  environment: 'test' | 'production';
  status: NotificationStatus;
  attempt_count: number;
  error_code?: string | null;
  error_message?: string | null;
  idempotency_key?: string | null;
  created_at?: string;
  attempted_at?: string;
  sent_at?: string | null;
}

export interface IdempotencyLeaseParams {
  idempotencyKey: string;
  eventType: string;
  reportId?: string | null;
  publicId?: string | null;
  destination: string;
  environment?: 'test' | 'production';
  leaseTtlMs?: number; // default 30000 (30 seconds)
}

export interface IdempotencyLeaseResult {
  acquired: boolean;
  status: 'acquired' | 'already_sent' | 'in_flight' | 'uncertain_delivery' | 'failed';
  logId?: string;
  reason?: string;
  isFallback?: boolean;
}

// Lazy Supabase Admin Client to prevent import-time crashes if env vars are loaded asynchronously
function getAdminClient(): SupabaseClient | null {
  return supabaseAdmin;
}

/**
 * Mask destination to avoid exposing raw identifiers unnecessarily
 * e.g. "C836f13a80f7a17395b9a9e11fc3223b0" -> "C836...23b0"
 */
export function maskDestination(destination: string | null | undefined): string {
  if (!destination) return "UNRESOLVED";
  const clean = destination.trim();
  if (clean.length <= 8) return clean;
  return `${clean.substring(0, 4)}...${clean.substring(clean.length - 4)}`;
}

/**
 * Filter out sensitive tokens, authorization headers, and secrets from error messages
 */
export function sanitizeErrorMessage(error: string | Error | unknown): string | null {
  if (!error) return null;
  let text = typeof error === 'string' ? error : error instanceof Error ? error.message : JSON.stringify(error);

  // Strip Bearer tokens
  text = text.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]');
  // Strip LINE channel access token patterns
  text = text.replace(/[a-zA-Z0-9+/]{40,}={0,2}/g, '[REDACTED_SECRET]');
  // Strip password patterns
  text = text.replace(/(password|secret|key)=([^&\s]+)/gi, '$1=[REDACTED]');

  return text.slice(0, 500); // Bounded size
}

// In-memory fallback ring buffer (up to 500 records) to ensure zero log loss
// even before database migrations are applied or during transient DB hiccups
const inMemoryLogs: NotificationLogEntry[] = [];
const MAX_IN_MEMORY_LOGS = 500;

// Local in-memory lock and cache (fast path + fallback for serverless instances)
const localInFlightKeys = new Set<string>();
const localSentCache = new Map<string, number>();

/**
 * Distributed Database-backed Idempotency Lock Lease Acquisition
 * 
 * Rules:
 * 1. Checks in-memory fast lock to catch immediate concurrent requests on the same instance.
 * 2. Checks recent sent cache (5-minute TTL) on the same instance.
 * 3. If DB available, attempts atomic insert into notification logs table with status='queued'.
 * 4. If duplicate key conflict:
 *    - Existing status is 'sent' -> Idempotent skip (Already sent).
 *    - Existing status is 'queued' & within 30s lease -> Concurrent in-flight on another instance (Deduplicated).
 *    - Existing status is 'queued' & expired (> 30s) -> Stale lease / crashed process.
 *      Delivery state is uncertain; transitions record to 'failed' (UNCERTAIN_DELIVERY) and suppresses retry to avoid duplicate push.
 * 5. If DB table is unavailable or throws, gracefully falls back to in-memory guard without crashing.
 */
export async function acquireNotificationLease(
  params: IdempotencyLeaseParams
): Promise<IdempotencyLeaseResult> {
  const { idempotencyKey, eventType, reportId, publicId, destination } = params;
  const now = Date.now();
  const leaseTtl = params.leaseTtlMs || 30000;

  // 1. Fast in-memory in-flight lock check (Synchronously acquired to guarantee zero race condition within process)
  if (localInFlightKeys.has(idempotencyKey)) {
    return {
      acquired: false,
      status: 'in_flight',
      reason: 'Concurrent notification in progress (deduplicated)',
    };
  }

  // 2. Fast in-memory 5-minute sent cache check
  const lastSent = localSentCache.get(idempotencyKey) || (publicId ? localSentCache.get(publicId) : undefined);
  if (lastSent && now - lastSent < 300000) {
    return {
      acquired: false,
      status: 'already_sent',
      reason: 'Already notified recently (idempotent)',
    };
  }

  // Synchronously claim local in-flight lock before any asynchronous operations
  localInFlightKeys.add(idempotencyKey);

  // 3. Database-backed distributed atomic reservation
  const admin = getAdminClient();
  if (admin) {
    try {
      const dataSource = getReportDataSource();
      const leaseId = crypto.randomUUID();
      const nowIso = new Date().toISOString();
      const env = params.environment || (dataSource.isTest ? 'test' : 'production');

      const { error: insErr } = await admin
        .from(dataSource.notificationLogsTable)
        .insert({
          id: leaseId,
          event_type: eventType,
          report_id: reportId || null,
          public_id: publicId || null,
          destination: maskDestination(destination),
          environment: env,
          status: 'queued',
          attempt_count: 0,
          idempotency_key: idempotencyKey,
          attempted_at: nowIso,
        });

      if (!insErr) {
        // Atomic insert succeeded -> Lock lease acquired
        localInFlightKeys.add(idempotencyKey);
        return {
          acquired: true,
          status: 'acquired',
          logId: leaseId,
        };
      }

      // Handle duplicate conflict (Postgres code 23505 unique violation or equivalent)
      const isUniqueConflict =
        insErr.code === '23505' ||
        insErr.message?.toLowerCase().includes('unique') ||
        insErr.message?.toLowerCase().includes('duplicate');

      if (isUniqueConflict) {
        localInFlightKeys.delete(idempotencyKey);
        const { data: existing } = await admin
          .from(dataSource.notificationLogsTable)
          .select('*')
          .eq('idempotency_key', idempotencyKey)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing) {
          if (existing.status === 'sent') {
            localSentCache.set(idempotencyKey, Date.now());
            return {
              acquired: false,
              status: 'already_sent',
              reason: 'Already notified recently (idempotent)',
              logId: existing.id,
            };
          }

          if (existing.status === 'queued') {
            const attemptedTime = new Date(existing.attempted_at || existing.created_at).getTime();
            const isExpired = Date.now() - attemptedTime >= leaseTtl;

            if (!isExpired) {
              return {
                acquired: false,
                status: 'in_flight',
                reason: 'Concurrent notification in progress across instances (deduplicated)',
                logId: existing.id,
              };
            }

            // Stale lease: Process crashed or died while in flight.
            // Delivery is uncertain -> mark failed & suppress blind retry to prevent duplicate LINE push.
            await admin
              .from(dataSource.notificationLogsTable)
              .update({
                status: 'failed',
                error_code: 'UNCERTAIN_DELIVERY',
                error_message: 'Previous process abandoned or crashed while sending (retry suppressed to prevent duplication)',
              })
              .eq('id', existing.id);

            return {
              acquired: false,
              status: 'uncertain_delivery',
              reason: 'Previous in-flight dispatch abandoned; retry suppressed to prevent duplication',
              logId: existing.id,
            };
          }

          // If previously failed/blocked/skipped
          return {
            acquired: false,
            status: 'failed',
            reason: `Existing notification record in status ${existing.status} (${existing.error_code || 'no error code'})`,
            logId: existing.id,
          };
        }
      }
    } catch {
      // Gracefully fall through to in-memory fallback
    }
  }

  // 4. In-memory fallback
  localInFlightKeys.add(idempotencyKey);
  return {
    acquired: true,
    status: 'acquired',
    isFallback: true,
  };
}

/**
 * Releases local in-flight lock for an idempotency key
 */
export function releaseNotificationLease(idempotencyKey: string | null | undefined): void {
  if (idempotencyKey) {
    localInFlightKeys.delete(idempotencyKey);
  }
}

/**
 * Records a notification audit log entry to database and fallback buffer
 */
export async function recordNotificationLog(
  entry: Omit<NotificationLogEntry, 'id' | 'created_at'>
): Promise<NotificationLogEntry> {
  const dataSource = getReportDataSource();
  const now = new Date().toISOString();

  const record: NotificationLogEntry = {
    id: crypto.randomUUID(),
    event_type: entry.event_type,
    report_id: entry.report_id || null,
    public_id: entry.public_id || null,
    destination: maskDestination(entry.destination),
    environment: entry.environment || (dataSource.isTest ? 'test' : 'production'),
    status: entry.status,
    attempt_count: entry.attempt_count || 1,
    error_code: entry.error_code || null,
    error_message: sanitizeErrorMessage(entry.error_message),
    idempotency_key: entry.idempotency_key || null,
    created_at: now,
    attempted_at: entry.attempted_at || now,
    sent_at: entry.sent_at || (entry.status === 'sent' ? now : null),
  };

  // Update in-memory sent cache if sent
  if (record.status === 'sent') {
    if (record.idempotency_key) {
      localSentCache.set(record.idempotency_key, Date.now());
    }
    if (record.public_id) {
      localSentCache.set(record.public_id, Date.now());
    }
  }

  // 1. Always record in in-memory ring buffer
  inMemoryLogs.unshift(record);
  if (inMemoryLogs.length > MAX_IN_MEMORY_LOGS) {
    inMemoryLogs.pop();
  }

  // 2. Structured console log for observability without leaking secrets
  console.log(
    `[NotificationLog] [${record.environment.toUpperCase()}] [${record.status.toUpperCase()}] ` +
    `event=${record.event_type} publicId=${record.public_id || '-'} dest=${record.destination} ` +
    `attempts=${record.attempt_count}${record.error_code ? ` code=${record.error_code}` : ''}`
  );

  // 3. Persist to database table (test_notification_logs or notification_logs)
  const admin = getAdminClient();
  if (admin) {
    try {
      // If updating an existing lease row by idempotency_key
      if (record.idempotency_key) {
        const { data: updated, error: updErr } = await admin
          .from(dataSource.notificationLogsTable)
          .update({
            status: record.status,
            attempt_count: record.attempt_count,
            error_code: record.error_code,
            error_message: record.error_message,
            sent_at: record.sent_at,
          })
          .eq('idempotency_key', record.idempotency_key)
          .select('id');

        if (!updErr && updated && updated.length > 0) {
          record.id = updated[0].id;
          return record;
        }
      }

      // Otherwise insert new record
      const { error } = await admin
        .from(dataSource.notificationLogsTable)
        .insert({
          id: record.id,
          event_type: record.event_type,
          report_id: record.report_id,
          public_id: record.public_id,
          destination: record.destination,
          environment: record.environment,
          status: record.status,
          attempt_count: record.attempt_count,
          error_code: record.error_code,
          error_message: record.error_message,
          idempotency_key: record.idempotency_key,
          attempted_at: record.attempted_at,
          sent_at: record.sent_at,
        });

      if (error) {
        // Table may not yet be migrated in remote DB — log notice without throwing
        console.warn(
          `[NotificationLog] Notice: Database insert to ${dataSource.notificationLogsTable} skipped or unavailable: ${error.message}`
        );
      }
    } catch (dbErr) {
      console.warn(`[NotificationLog] Warning: Unable to write to ${dataSource.notificationLogsTable}:`, dbErr);
    }
  }

  return record;
}

/**
 * Retrieve recent notification logs for testing and observability
 */
export async function getRecentNotificationLogs(filters?: {
  limit?: number;
  publicId?: string;
  status?: NotificationStatus;
  eventType?: string;
}): Promise<NotificationLogEntry[]> {
  const dataSource = getReportDataSource();
  const limit = filters?.limit || 50;
  const admin = getAdminClient();

  // Attempt database query first if client available
  if (admin) {
    try {
      let query = admin
        .from(dataSource.notificationLogsTable)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (filters?.publicId) {
        query = query.eq('public_id', filters.publicId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.eventType) {
        query = query.eq('event_type', filters.eventType);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data as NotificationLogEntry[];
      }
    } catch {
      // Fallback to in-memory logs
    }
  }

  // Fallback to in-memory logs
  return inMemoryLogs
    .filter((log) => {
      if (filters?.publicId && log.public_id !== filters.publicId) return false;
      if (filters?.status && log.status !== filters.status) return false;
      if (filters?.eventType && log.event_type !== filters.eventType) return false;
      return true;
    })
    .slice(0, limit);
}

/**
 * Clear in-memory notification logs and cache (for automated test isolation)
 */
export function clearNotificationLogsForTesting(): void {
  inMemoryLogs.length = 0;
  localInFlightKeys.clear();
  localSentCache.clear();
}
