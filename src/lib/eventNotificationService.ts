/**
 * Transactional Event Notification & Outbox Dispatcher Service
 * 
 * Implements Phase 3.5 & Phase 3.6 Event-Based Notification Architecture:
 * 1. Semantic signature clustering & Event Tracker linkage.
 * 2. Transactional Outbox record generation for emergency alerts and escalations.
 * 3. Outbound LINE Messaging API dispatch from Outbox.
 * 4. Duplicate notification suppression for repetitive reports in the same incident cluster.
 * 5. 15-minute Digest window preservation for normal/non-emergency reports.
 * 6. Test/Production isolated data routing.
 */

import { supabaseAdmin } from './supabase-admin';
import { getReportDataSource } from './dataSource';
import { notifyLine, LineNotificationPayload } from './line';
import { extractSpatialAnchor, extractSystemEntity } from './similarityDetector';

export interface EventNotificationProcessResult {
  trackerId: string;
  eventCode: string;
  action:
    | 'normal_alert_sent'
    | 'first_alert_sent'
    | 'suppressed_duplicate'
    | 'suppressed_duplicate_emergency'
    | 'escalated'
    | 'accumulated_for_digest';
  outboxId?: string;
  notifyResult?: {
    success: boolean;
    error?: string;
    status?: string;
  };
}

/**
 * Computes a normalized cluster signature based on domain entity and spatial landmark
 */
export function computeClusterSignature(report: {
  category_id?: number | null;
  subcategory_id?: number | null;
  location?: string | null;
  description?: string | null;
}): string {
  const desc = report.description || '';
  const loc = report.location || '';
  const entity = extractSystemEntity(desc, loc, report.subcategory_id || null);
  const anchor = extractSpatialAnchor(loc, desc);

  // Normalize building / landmark identifier
  let landmarkSlug = 'general';
  if (anchor.landmark) {
    landmarkSlug = anchor.landmark
      .toLowerCase()
      .replace(/[\s\-_]+/g, '_')
      .replace(/[^\w\u0E00-\u0E7F]/g, '');
  } else if (loc) {
    const bldgMatch = loc.match(/อาคาร\s*(\d+|[A-Za-z0-9\u0E00-\u0E7F]+)/);
    if (bldgMatch) {
      landmarkSlug = `bldg_${bldgMatch[1]}`;
    }
  }

  // Detect specific high-risk incident types for precise signature clustering
  let riskType: string = entity;
  if (/ผู้บาดเจ็บ|คนเจ็บ|หมดสติ|เลือดออก|ปฐมพยาบาล|กู้ชีพ|บาดเจ็บสาหัส|ล้มหมดสติ/i.test(desc)) {
    riskType = 'injury_medical_emergency';
  } else if (/ไฟไหม้|เพลิงไหม้|ควัน|เปลวไฟ|กลิ่นไหม้|ประกายไฟ|แสงเพลิง|ลัดวงจร|ไฟลุก|ดับเพลิง|ไหม้/i.test(desc)) {
    riskType = 'fire_incident';
  } else if (/ก๊าซ|แก๊ส|สารเคมี/i.test(desc)) {
    riskType = 'gas_chemical_leak';
  } else if (/ลิฟต์/i.test(desc)) {
    riskType = 'elevator_service';
  }

  return `${riskType}_${landmarkSlug}`;
}

/**
 * Processes a newly persisted report through the Event Notification & Outbox pipeline
 */
export async function processReportForEventNotification(params: {
  report: {
    id: string;
    public_id: string;
    category_id?: number | null;
    subcategory_id?: number | null;
    category_name?: string;
    subcategory_name?: string;
    location?: string | null;
    description?: string | null;
    priority?: string | null;
    reporter_name?: string | null;
    created_at?: string;
  };
  priorityReason?: string;
  targetGroupId: string;
}): Promise<EventNotificationProcessResult> {
  const { report, priorityReason, targetGroupId } = params;
  const dataSource = getReportDataSource();
  const isEmergency = report.priority === 'emergency';
  const clusterSignature = computeClusterSignature(report);

  // 1. Search for an active, non-closed Event Tracker with matching cluster signature
  const { data: existingTrackers } = await supabaseAdmin
    .from(dataSource.eventTrackersTable)
    .select('*')
    .eq('cluster_signature', clusterSignature)
    .neq('state', 'CLOSED')
    .order('created_at', { ascending: false })
    .limit(1);

  const activeTracker = existingTrackers?.[0];

  // ---------------------------------------------------------------------------
  // Case A: Existing Active Tracker Found
  // ---------------------------------------------------------------------------
  if (activeTracker) {
    // 1. Link report to tracker
    await supabaseAdmin
      .from(dataSource.eventReportsTable)
      .insert({
        tracker_id: activeTracker.id,
        report_id: report.id,
        public_id: report.public_id,
      });

    // 2. If newly arrived report is emergency and tracker was not emergency, update priority in DB
    // Phase 3.8 Policy: Do NOT send separate escalation alert to LINE.
    if (isEmergency && activeTracker.priority !== 'emergency') {
      console.log(`[EventNotification] Escalating tracker ${activeTracker.event_code} priority to emergency in DB (No separate LINE escalation alert in Phase 3.8)...`);
      await supabaseAdmin
        .from(dataSource.eventTrackersTable)
        .update({
          priority: 'emergency',
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeTracker.id);
    }

    // 3. Update total report count from real records in event_notification_reports
    const { count } = await supabaseAdmin
      .from(dataSource.eventReportsTable)
      .select('*', { count: 'exact', head: true })
      .eq('tracker_id', activeTracker.id);

    const actualTotal = count || ((activeTracker.total_report_count || 1) + 1);

    await supabaseAdmin
      .from(dataSource.eventTrackersTable)
      .update({
        total_report_count: actualTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', activeTracker.id);

    console.log(`[EventNotification] Additional report ${report.public_id} joined tracker ${activeTracker.event_code}. LINE alert suppressed (Count: ${actualTotal})`);

    // In Phase 3.8: Never send immediate LINE alert for additional reports in the same event.
    // They are aggregated and dispatched during the 30-minute periodic update.
    return {
      trackerId: activeTracker.id,
      eventCode: activeTracker.event_code,
      action: 'suppressed_duplicate',
    };
  }

  // ---------------------------------------------------------------------------
  // Case B: New Event Tracker Creation (Initial report -> Normal Alert)
  // ---------------------------------------------------------------------------
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const eventPrefix = dataSource.isTest ? 'EVT-T' : 'EVT';
  const eventCode = `${eventPrefix}-${dateStr}-${randSuffix}`;

  // Formulate clear, realistic incident title from content matching Backoffice Drafts format
  let incidentTitle = report.subcategory_name || 'เหตุการณ์ที่ได้รับแจ้ง';
  if (report.location && report.location !== '-') {
    incidentTitle = `${incidentTitle}: ${report.location}`;
  } else if (report.description) {
    const cleanDesc = report.description.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, ' ').trim();
    const words = cleanDesc.split(/\s+/).slice(0, 4).join(' ');
    incidentTitle = `${incidentTitle}: ${words || 'หลายรายการ'}`;
  }

  // Phase 3.8: Universal 30-minute periodic update window
  const windowMinutes = 30;
  const nowIso = new Date().toISOString();
  const windowExpiresAt = new Date(Date.now() + windowMinutes * 60 * 1000).toISOString();

  const { data: newTracker, error: trErr } = await supabaseAdmin
    .from(dataSource.eventTrackersTable)
    .insert({
      event_code: eventCode,
      cluster_signature: clusterSignature,
      title: incidentTitle.slice(0, 200),
      location: report.location || '-',
      priority: report.priority || 'normal',
      state: 'AGGREGATING',
      initial_report_id: report.id,
      initial_report_public_id: report.public_id,
      category_id: report.category_id || null,
      destination: targetGroupId,
      environment: dataSource.isTest ? 'test' : 'production',
      total_report_count: 1,
      last_notified_count: 1,
      window_started_at: nowIso,
      window_expires_at: windowExpiresAt,
      next_update_at: windowExpiresAt,
      first_alert_sent_at: nowIso,
      last_notified_at: nowIso,
    })
    .select()
    .single();

  if (trErr || !newTracker) {
    throw new Error(`Failed to create event notification tracker: ${trErr?.message}`);
  }

  // Link report to new tracker (Initial report assigned sequence 1)
  await supabaseAdmin
    .from(dataSource.eventReportsTable)
    .insert({
      tracker_id: newTracker.id,
      report_id: report.id,
      public_id: report.public_id,
      digest_sequence: 1,
    });

  // Create Transactional Outbox Job & Dispatch Normal Alert immediately
  const idempotencyKey = `evt_norm_${newTracker.event_code}_rep1`;
  const createdAtFormatted = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) + " น.";

  // Phase 3.8 Policy: Normal alert must NOT show related counts, cumulative counts, or update text
  const payload: LineNotificationPayload = {
    publicId: report.public_id,
    categoryName: report.category_name || "ระบบแจ้งเหตุ ONE STOP SERVICE",
    subcategoryName: report.subcategory_name || newTracker.title,
    description: report.description || '-',
    location: report.location || '-',
    date: createdAtFormatted,
    statusText: "pending",
    reporterName: report.reporter_name || '-',
    priority: (report.priority as any) || "normal",
    priorityReason: priorityReason || (isEmergency ? "ตรวจพบลักษณะเหตุฉุกเฉินเร่งด่วน" : undefined),
    notificationType: "normal_alert",
    eventCode: newTracker.event_code,
  };

  const { data: outboxJob, error: outErr } = await supabaseAdmin
    .from(dataSource.eventOutboxTable)
    .insert({
      idempotency_key: idempotencyKey,
      tracker_id: newTracker.id,
      notification_type: 'first_alert',
      payload: payload,
      destination: targetGroupId,
      environment: dataSource.isTest ? 'test' : 'production',
      status: 'claiming',
      claim_token: 'api_worker',
      claimed_at: nowIso,
      lease_timeout_at: new Date(Date.now() + 30000).toISOString(),
    })
    .select()
    .single();

  if (outErr || !outboxJob) {
    console.error(`[EventNotification] Failed to create outbox job:`, outErr);
  }

  // Dispatch LIVE PUSH to verified LINE TEST Group as Flex Message (normal_alert)
  const notifyRes = await notifyLine(payload, targetGroupId, {
    event: 'normal_alert',
    reportId: report.id,
    idempotencyKey,
  });

  if (notifyRes.success && outboxJob) {
    const sentTimeIso = new Date().toISOString();
    const nextDueIso = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from(dataSource.eventOutboxTable)
      .update({ status: 'sent', sent_at: sentTimeIso })
      .eq('id', outboxJob.id);

    await supabaseAdmin
      .from(dataSource.eventTrackersTable)
      .update({
        state: 'AGGREGATING',
        first_alert_sent_at: sentTimeIso,
        last_notified_at: sentTimeIso,
        last_notified_count: 1,
        window_expires_at: nextDueIso,
        next_update_at: nextDueIso,
        updated_at: sentTimeIso,
      })
      .eq('id', newTracker.id);
  } else if (!notifyRes.success && outboxJob) {
    const isUncertain = notifyRes.error?.includes('TIMEOUT') || notifyRes.error?.includes('UNCERTAIN');
    await supabaseAdmin
      .from(dataSource.eventOutboxTable)
      .update({
        status: isUncertain ? 'uncertain_delivery' : 'failed',
        error_code: isUncertain ? 'UNCERTAIN_DELIVERY' : 'LINE_PUSH_FAILED',
        error_message: notifyRes.error || 'Push delivery failed',
      })
      .eq('id', outboxJob.id);
  }

  return {
    trackerId: newTracker.id,
    eventCode: newTracker.event_code,
    action: 'normal_alert_sent',
    outboxId: outboxJob?.id,
    notifyResult: notifyRes,
  };
}
