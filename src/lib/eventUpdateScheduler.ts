/**
 * Incident-Based LINE Notification Update Scheduler & Worker Service
 * 
 * Implements Phase 3.7 Periodic 30-Minute Update Alert Lifecycle:
 * 1. Claims due emergency trackers atomically (via test_claim_next_incident_update / test_claim_tracker_incident_update).
 * 2. Uses PostgreSQL FOR UPDATE SKIP LOCKED to guarantee zero multi-worker collisions.
 * 3. Checks if new reports were received during the 30-minute window.
 *    - If NO new reports: Skips LINE notification entirely (No empty updates). Extends window by 30 mins.
 *    - If YES new reports: Dispatches formatted update alert with exact cumulative total & delta count.
 * 4. Completes outbox job and updates tracker snapshot & next due window atomically.
 * 5. Supports clock injection (asOfTime) for high-speed automated regression testing.
 * 6. Supports worker crash recovery via bounded lease timeouts (zero stuck jobs).
 */

import { supabaseAdmin } from './supabase-admin';
import { getReportDataSource } from './dataSource';
import { notifyLine, LineNotificationPayload, resolvePublicActionUrl } from './line';

export interface ProcessUpdatesOptions {
  workerId?: string;
  asOfTime?: Date;
  trackerId?: string;
  maxItems?: number;
}

export interface IncidentUpdateProcessResult {
  processedCount: number;
  results: Array<{
    action: 'update_sent' | 'window_extended_no_reports' | 'failed' | 'uncertain_delivery' | 'none_due';
    trackerId?: string;
    eventCode?: string;
    outboxId?: string;
    idempotencyKey?: string;
    totalReportCount?: number;
    newReportCount?: number;
    previousNotifiedCount?: number;
    error?: string;
  }>;
}

/**
 * Processes due incident updates atomically
 */
export async function processDueIncidentUpdates(
  options: ProcessUpdatesOptions = {}
): Promise<IncidentUpdateProcessResult> {
  const dataSource = getReportDataSource();
  const workerId = options.workerId || `worker_${Math.random().toString(36).slice(2, 8)}`;
  const asOfTime = options.asOfTime || new Date();
  const asOfTimeIso = asOfTime.toISOString();
  const maxItems = options.maxItems || 10;

  const results: IncidentUpdateProcessResult['results'] = [];
  let processedCount = 0;

  for (let i = 0; i < maxItems; i++) {
    // 1. Claim next due tracker (or specific tracker if provided)
    let claimRes: any = null;

    if (options.trackerId) {
      const { data, error } = await supabaseAdmin.rpc(dataSource.claimIncidentUpdateRpc, {
        p_tracker_id: options.trackerId,
        p_worker_id: workerId,
        p_lease_seconds: 30,
        p_as_of_time: asOfTimeIso,
      });
      if (error) {
        console.error(`[EventUpdateScheduler] RPC ${dataSource.claimIncidentUpdateRpc} error:`, error);
        break;
      }
      claimRes = data;
    } else {
      const { data, error } = await supabaseAdmin.rpc(dataSource.claimNextIncidentUpdateRpc, {
        p_worker_id: workerId,
        p_lease_seconds: 30,
        p_as_of_time: asOfTimeIso,
      });
      if (error) {
        console.error(`[EventUpdateScheduler] RPC ${dataSource.claimNextIncidentUpdateRpc} error:`, error);
        break;
      }
      claimRes = data;
    }

    if (!claimRes || !claimRes.success) {
      // No more trackers due
      break;
    }

    processedCount++;

    // 2. Case: Window extended without new reports (No LINE alert sent)
    if (claimRes.action === 'window_extended_no_reports') {
      console.log(`[EventUpdateScheduler] Tracker ${claimRes.event_code} had 0 new reports. Window extended 30m without LINE call.`);
      results.push({
        action: 'window_extended_no_reports',
        trackerId: claimRes.tracker_id,
        eventCode: claimRes.event_code,
        newReportCount: 0,
      });
      if (options.trackerId) break;
      continue;
    }

    // 3. Case: Update Job Created -> Dispatch to LINE as Flex Message
    if (claimRes.action === 'update_job_created' && claimRes.outbox_id) {
      const updatedAtFormatted = asOfTime.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) + " น.";
      
      const updatePayload: LineNotificationPayload = {
        publicId: claimRes.event_code,
        categoryName: "อัปเดตเหตุการณ์",
        subcategoryName: claimRes.title || "เหตุการณ์ที่ได้รับแจ้ง",
        description: claimRes.title || "เหตุการณ์ที่ได้รับแจ้ง",
        location: claimRes.location || "-",
        date: updatedAtFormatted,
        statusText: "in_progress",
        priority: "emergency",
        notificationType: "periodic_update",
        eventCode: claimRes.event_code,
        totalReportCount: claimRes.total_report_count,
        newReportCount: claimRes.new_report_count,
        customActionUrl: resolvePublicActionUrl(null, '/backoffice/incidents'),
        customActionLabel: "ดูรายละเอียดเหตุการณ์",
      };

      console.log(`[EventUpdateScheduler] Dispatching Periodic Update Alert Flex Message for ${claimRes.event_code} (Total: ${claimRes.total_report_count}, Delta: +${claimRes.new_report_count})...`);

      const notifyRes = await notifyLine(updatePayload, claimRes.destination, {
        event: 'periodic_update',
        idempotencyKey: claimRes.idempotency_key,
      });

      let completeStatus = 'sent';
      let errorCode: string | null = null;
      let errorMessage: string | null = null;

      if (!notifyRes.success) {
        const isUncertain = notifyRes.error?.includes('TIMEOUT') || notifyRes.error?.includes('UNCERTAIN');
        completeStatus = isUncertain ? 'uncertain_delivery' : 'failed';
        errorCode = isUncertain ? 'UNCERTAIN_DELIVERY' : 'LINE_PUSH_FAILED';
        errorMessage = notifyRes.error || 'Push delivery failed';
      }

      // Complete atomic outbox & tracker update in PostgreSQL
      await supabaseAdmin.rpc(dataSource.completeIncidentUpdateRpc, {
        p_outbox_id: claimRes.outbox_id,
        p_status: completeStatus,
        p_error_code: errorCode,
        p_error_message: errorMessage,
        p_as_of_time: asOfTimeIso,
      });

      results.push({
        action: completeStatus === 'sent' ? 'update_sent' : (completeStatus as any),
        trackerId: claimRes.tracker_id,
        eventCode: claimRes.event_code,
        outboxId: claimRes.outbox_id,
        idempotencyKey: claimRes.idempotency_key,
        totalReportCount: claimRes.total_report_count,
        newReportCount: claimRes.new_report_count,
        previousNotifiedCount: claimRes.previous_notified_count,
        error: errorMessage || undefined,
      });

      if (options.trackerId) break;
    }
  }

  return {
    processedCount,
    results,
  };
}

export interface NormalDigestProcessResult {
  processedCount: number;
  results: Array<{
    action: string;
    trackerId?: string;
    eventCode?: string;
    snapshottedCount?: number;
    totalCount?: number;
    notifySuccess?: boolean;
  }>;
}

/**
 * Phase 3.8: Normal 15-minute digest is disabled.
 * All initial reports send normal_alert immediately, and all subsequent reports
 * in that incident are accumulated for the 30-minute periodic update.
 */
export async function processDueNormalDigests(
  _options: { trackerId?: string; workerId?: string; asOfTime?: Date } = {}
): Promise<NormalDigestProcessResult> {
  console.log("[EventUpdateScheduler] Normal 15-minute digest is disabled in Phase 3.8 (Only normal_alert and periodic_update are active).");
  return { processedCount: 0, results: [] };
}

/**
 * Standalone worker loop supporting graceful shutdown and crash resilience
 */
export function startIncidentUpdateWorker(options: {
  pollIntervalMs?: number;
  workerId?: string;
  onCycleComplete?: (result: IncidentUpdateProcessResult) => void;
}) {
  const pollIntervalMs = options.pollIntervalMs || 10000;
  const workerId = options.workerId || `worker_${process.pid}_${Math.random().toString(36).slice(2, 6)}`;
  let isRunning = true;
  let timer: NodeJS.Timeout | null = null;

  console.log(`[EventUpdateWorker] Started background worker ${workerId} (Poll: ${pollIntervalMs}ms)`);

  const runCycle = async () => {
    if (!isRunning) return;
    try {
      const res = await processDueIncidentUpdates({ workerId });
      if (options.onCycleComplete) {
        options.onCycleComplete(res);
      }
    } catch (err) {
      console.error(`[EventUpdateWorker] Cycle error:`, err);
    } finally {
      if (isRunning) {
        timer = setTimeout(runCycle, pollIntervalMs);
      }
    }
  };

  runCycle();

  return {
    stop: () => {
      isRunning = false;
      if (timer) clearTimeout(timer);
      console.log(`[EventUpdateWorker] Stopped worker ${workerId}`);
    },
    workerId,
  };
}

export const processDueEventUpdates = processDueIncidentUpdates;


