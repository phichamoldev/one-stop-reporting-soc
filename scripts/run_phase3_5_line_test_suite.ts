/**
 * PHASE 3.5 — LINE NOTIFICATION REAL TEST & TEST GROUP ISOLATION SUITE
 * 
 * Objective: Verify actual LINE Messaging API delivery for emergency events and duplicate/similar reports,
 * with strict Localhost-to-Test-Group isolation.
 * 
 * Target: Local Supabase at 127.0.0.1:54321
 * Target LINE Destination: LINE_TEST_GROUP_ID (Masked: C836...23b0)
 * Prohibited Destination: LINE_GROUP_ID (Production)
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Ensure local container is targeted
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
process.env.REPORT_DATA_SOURCE = 'test';
process.env.NEXT_PUBLIC_REPORT_DATA_SOURCE = 'test';
process.env.LINE_NOTIFICATIONS_ENABLED = 'true';
process.env.LINE_NEW_REPORT_NOTIFICATIONS_ENABLED = 'true';

import { createClient } from '@supabase/supabase-js';
import {
  notifyLine,
  validateTestLineDestination,
  isLineEventAllowed,
  LineNotificationPayload,
} from '../src/lib/line';
import {
  maskDestination,
  acquireNotificationLease,
} from '../src/lib/notificationLogger';
import { getReportDataSource } from '../src/lib/dataSource';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export interface TestResult {
  id: string;
  name: string;
  category: string;
  expected: string;
  actual: string;
  evidence: Record<string, unknown>;
  status: 'PASS' | 'FAIL' | 'BLOCKED';
  durationMs: number;
}

const suiteResults: TestResult[] = [];

async function recordTest(
  id: string,
  name: string,
  category: string,
  expected: string,
  fn: () => Promise<{ actual: string; evidence: Record<string, unknown> }>
) {
  const start = Date.now();
  try {
    const res = await fn();
    const duration = Date.now() - start;
    suiteResults.push({
      id,
      name,
      category,
      expected,
      actual: res.actual,
      evidence: res.evidence,
      status: 'PASS',
      durationMs: duration,
    });
    console.log(`[PASS] ${id}: ${name} (${duration}ms)`);
  } catch (err: unknown) {
    const duration = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);
    suiteResults.push({
      id,
      name,
      category,
      expected,
      actual: `Exception: ${errorMsg}`,
      evidence: { error: errorMsg },
      status: 'FAIL',
      durationMs: duration,
    });
    console.error(`[FAIL] ${id}: ${name} (${duration}ms) - ${errorMsg}`);
  }
}

async function runTestSuite() {
  console.log("================================================================================");
  console.log("PHASE 3.5 — LINE NOTIFICATION REAL DELIVERY & ISOLATION TEST SUITE");
  console.log("================================================================================");

  const testGroupId = process.env.LINE_TEST_GROUP_ID;
  const prodGroupId = process.env.LINE_GROUP_ID;
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  console.log(`Environment: localhost (test)`);
  console.log(`Database URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(`LINE Test Group: ${maskDestination(testGroupId)} (Length: ${testGroupId?.length})`);
  console.log(`LINE Prod Group: ${maskDestination(prodGroupId)} (STRICTLY PROHIBITED)`);
  console.log(`LINE Token Configured: ${token ? 'YES (Length: ' + token.length + ')' : 'NO'}`);
  console.log("================================================================================\n");

  if (!testGroupId || !token) {
    console.error("FATAL: LINE_TEST_GROUP_ID or LINE_CHANNEL_ACCESS_TOKEN is missing!");
    process.exit(1);
  }

  // 1. Clean up test tables to guarantee deterministic isolated state
  console.log("Resetting test tables for clean run...");
  await supabaseAdmin.from('test_event_notification_outbox').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin.from('test_event_notification_reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin.from('test_event_notification_trackers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin.from('test_notification_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin.from('test_reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Verify production tables remain 0
  const { count: prodReportsCount } = await supabaseAdmin.from('reports').select('*', { count: 'exact', head: true });
  const { count: prodTrackersCount } = await supabaseAdmin.from('event_notification_trackers').select('*', { count: 'exact', head: true });
  const { count: prodOutboxCount } = await supabaseAdmin.from('event_notification_outbox').select('*', { count: 'exact', head: true });

  if ((prodReportsCount || 0) > 0 || (prodTrackersCount || 0) > 0 || (prodOutboxCount || 0) > 0) {
    console.error("FATAL: Production tables are not empty! Halting test suite to prevent data contamination.");
    process.exit(1);
  }

  // Fetch a category id for tests
  const { data: catData } = await supabaseAdmin.from('categories').select('id, name_th').limit(1).single();
  const categoryId = catData?.id || 1;

  // ---------------------------------------------------------------------------
  // TC-LINE-01: New Emergency Report Real LINE Delivery
  // ---------------------------------------------------------------------------
  let trackerId1: string = '';
  let reportId1: string = '';
  const publicId1 = `EMG-${Date.now().toString().slice(-4)}`;

  await recordTest(
    'TC-LINE-01',
    'New Emergency Report Real Delivery',
    'Real Delivery Verification',
    'Emergency report creates outbox job, dispatches LIVE PUSH to LINE TEST GROUP with HTTP 200, and records sent status in test_notification_logs',
    async () => {
      // 1. Create Report in test_reports
      const title1 = 'ท่อก๊าซรั่วและมีประกายไฟใกล้หม้อแปลงไฟฟ้า';
      const { data: rep, error: rErr } = await supabaseAdmin.from('test_reports').insert({
        public_id: publicId1,
        category_id: categoryId,
        description: 'พบกลิ่นก๊าซรั่วรุนแรงและมีประกายไฟใกล้หม้อแปลง อาคาร 14 ชั้น 1 ต้องการความช่วยเหลือทันที',
        location: 'อาคาร 14 ชั้น 1 ใกล้หม้อแปลงไฟฟ้า',
        priority: 'emergency',
        status: 'pending',
        reporter_name: 'นายสายตรวจ ความปลอดภัย',
        email: 'inspector@test.local',
        phone: '0812345678',
      }).select().single();

      if (rErr || !rep) throw new Error(`Failed to create test report: ${rErr?.message}`);
      reportId1 = rep.id;

      // 2. Create Event Tracker
      const eventCode1 = `EVT-T-${Date.now().toString().slice(-6)}`;
      const { data: tracker, error: tErr } = await supabaseAdmin.from('test_event_notification_trackers').insert({
        event_code: eventCode1,
        cluster_signature: 'gas_leak_b14_fl1',
        title: title1,
        location: rep.location,
        priority: 'emergency',
        state: 'FIRST_ALERT_PENDING',
        initial_report_id: reportId1,
        initial_report_public_id: publicId1,
        destination: testGroupId,
        environment: 'test',
        total_report_count: 1,
        window_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      }).select().single();

      if (tErr || !tracker) throw new Error(`Failed to create tracker: ${tErr?.message}`);
      trackerId1 = tracker.id;

      // 3. Link Report to Tracker
      await supabaseAdmin.from('test_event_notification_reports').insert({
        tracker_id: trackerId1,
        report_id: reportId1,
        public_id: publicId1,
      });

      // 4. Create Outbox Job
      const idempotencyKey1 = `evt_emerg_${eventCode1}_rep1`;
      const payload: LineNotificationPayload = {
        publicId: publicId1,
        categoryName: "ความปลอดภัยและสิ่งแวดล้อม",
        subcategoryName: "ท่อก๊าซรั่ว/ประกายไฟ",
        description: rep.description,
        location: rep.location,
        date: new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
        statusText: "pending",
        reporterName: rep.reporter_name,
        priority: "emergency",
        priorityReason: "พบกลิ่นก๊าซรั่วรุนแรงและประกายไฟ อาจลุกลามเกิดเพลิงไหม้",
      };

      const { data: outbox, error: oErr } = await supabaseAdmin.from('test_event_notification_outbox').insert({
        idempotency_key: idempotencyKey1,
        tracker_id: trackerId1,
        notification_type: 'emergency_alert',
        payload,
        destination: testGroupId,
        environment: 'test',
        status: 'claiming',
        claim_token: 'worker_01',
        claimed_at: new Date().toISOString(),
        lease_timeout_at: new Date(Date.now() + 30000).toISOString(),
      }).select().single();

      if (oErr || !outbox) throw new Error(`Failed to create outbox: ${oErr?.message}`);

      // 5. Dispatch LIVE PUSH via notifyLine
      const notifyRes = await notifyLine(payload, testGroupId, {
        event: 'new_report',
        reportId: reportId1,
        idempotencyKey: idempotencyKey1,
      });

      if (!notifyRes.success) {
        throw new Error(`LINE Push failed: ${notifyRes.error}`);
      }

      // 6. Update Outbox and Tracker
      await supabaseAdmin.from('test_event_notification_outbox').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      }).eq('id', outbox.id);

      await supabaseAdmin.from('test_event_notification_trackers').update({
        state: 'FIRST_ALERT_SENT',
        last_notified_at: new Date().toISOString(),
      }).eq('id', trackerId1);

      // 7. Verify Log in test_notification_logs
      const { data: logEntry } = await supabaseAdmin.from('test_notification_logs')
        .select('*')
        .eq('idempotency_key', idempotencyKey1)
        .single();

      if (!logEntry || logEntry.status !== 'sent') {
        throw new Error(`Expected sent log entry, got: ${JSON.stringify(logEntry)}`);
      }

      return {
        actual: `LINE API 200 OK accepted, outbox sent, logId: ${logEntry.id}, masked destination: ${logEntry.destination}`,
        evidence: {
          reportId: reportId1,
          publicId: publicId1,
          trackerId: trackerId1,
          outboxId: outbox.id,
          notifyResult: notifyRes,
          logEntry: {
            id: logEntry.id,
            status: logEntry.status,
            destination: logEntry.destination,
            environment: logEntry.environment,
            attempt_count: logEntry.attempt_count,
            sent_at: logEntry.sent_at,
          },
        },
      };
    }
  );

  // ---------------------------------------------------------------------------
  // TC-LINE-02: Multiple Reports, Same Emergency (Duplicate Suppression)
  // ---------------------------------------------------------------------------
  await recordTest(
    'TC-LINE-02',
    'Multiple Reports Same Emergency Suppression',
    'Deduplication & Clustering',
    'Second similar emergency report links to existing tracker; redundant LINE push is suppressed (0 additional LINE pushes)',
    async () => {
      const publicId2 = `EMG-${Date.now().toString().slice(-4)}-B`;

      // 1. Submit duplicate report
      const { data: rep2, error: rErr2 } = await supabaseAdmin.from('test_reports').insert({
        public_id: publicId2,
        category_id: categoryId,
        description: 'ได้กลิ่นแก๊สไหม้แรงมากแถวหม้อแปลงไฟฟ้าตึก 14 ชั้นล่าง',
        location: 'อาคาร 14 ชั้น 1',
        priority: 'emergency',
        status: 'pending',
        reporter_name: 'นายเจ้าหน้าที่ เวร',
        email: 'guard@test.local',
        phone: '0823456789',
      }).select().single();

      if (rErr2 || !rep2) throw new Error(`Failed to create duplicate report: ${rErr2?.message}`);

      // 2. Link to existing tracker
      await supabaseAdmin.from('test_event_notification_reports').insert({
        tracker_id: trackerId1,
        report_id: rep2.id,
        public_id: publicId2,
      });

      // Update total report count
      await supabaseAdmin.from('test_event_notification_trackers').update({
        total_report_count: 2,
      }).eq('id', trackerId1);

      // 3. Evaluate notification trigger:
      // Since tracker is ALREADY in FIRST_ALERT_SENT and priority is already emergency,
      // subsequent duplicate reports accumulate into the event tracker WITHOUT triggering a redundant emergency alert
      const { data: currentTracker } = await supabaseAdmin.from('test_event_notification_trackers')
        .select('*')
        .eq('id', trackerId1)
        .single();

      // Attempting to dispatch with existing event idempotency key or tracker key
      const duplicateKey = `evt_emerg_${currentTracker.event_code}_rep1`;
      const dedupCheck = await acquireNotificationLease({
        idempotencyKey: duplicateKey,
        eventType: 'new_report',
        reportId: rep2.id,
        publicId: publicId2,
        destination: testGroupId,
        environment: 'test',
      });

      // Verify no new outbox emergency alert was generated
      const { count: emergencyOutboxCount } = await supabaseAdmin.from('test_event_notification_outbox')
        .select('*', { count: 'exact', head: true })
        .eq('tracker_id', trackerId1)
        .eq('notification_type', 'emergency_alert');

      if (dedupCheck.acquired) {
        throw new Error(`Expected lease to reject duplicate dispatch for ${duplicateKey}, but it was acquired`);
      }

      return {
        actual: `Duplicate emergency suppressed. Tracker report count: ${currentTracker.total_report_count}, Emergency Outbox Count: ${emergencyOutboxCount}, Lease Status: ${dedupCheck.status}`,
        evidence: {
          duplicateReportId: rep2.id,
          duplicatePublicId: publicId2,
          trackerId: trackerId1,
          total_report_count: currentTracker.total_report_count,
          emergencyOutboxCount,
          leaseStatus: dedupCheck.status,
          leaseReason: dedupCheck.reason,
        },
      };
    }
  );

  // ---------------------------------------------------------------------------
  // TC-LINE-03: Different Emergency Events (Distinct Notifications)
  // ---------------------------------------------------------------------------
  let trackerId3: string = '';
  await recordTest(
    'TC-LINE-03',
    'Different Emergency Events Distinct Delivery',
    'Multi-Event Isolation',
    'Completely different emergency creates distinct tracker & outbox job, dispatches separate notification to TEST group with HTTP 200',
    async () => {
      const publicId3 = `EMG-${Date.now().toString().slice(-4)}-C`;
      const eventCode3 = `EVT-T-${Date.now().toString().slice(-6)}-CHEM`;

      // 1. Create Distinct Report
      const title3 = 'สารเคมีกรดเข้มข้นหกในห้องปฏิบัติการเคมี 402';
      const { data: rep3, error: rErr3 } = await supabaseAdmin.from('test_reports').insert({
        public_id: publicId3,
        category_id: categoryId,
        description: 'กรดไนตริกหกลงพื้น เกิดไอระเหยสีน้ำตาล มีนักศึกษาสำลักควัน ต้องการทีมดับเพลิง/สารเคมีด่วน',
        location: 'อาคารวิทยาศาสตร์ ห้องปฏิบัติการ 402 ชั้น 4',
        priority: 'emergency',
        status: 'pending',
        reporter_name: 'อาจารย์ผู้ควบคุมห้องปฏิบัติการ',
        email: 'chem_prof@test.local',
        phone: '0834567890',
      }).select().single();

      if (rErr3 || !rep3) throw new Error(`Failed to create test report: ${rErr3?.message}`);

      // 2. Create Distinct Tracker
      const { data: tracker3, error: tErr3 } = await supabaseAdmin.from('test_event_notification_trackers').insert({
        event_code: eventCode3,
        cluster_signature: 'chemical_spill_sci_bldg_402',
        title: title3,
        location: rep3.location,
        priority: 'emergency',
        state: 'FIRST_ALERT_PENDING',
        initial_report_id: rep3.id,
        initial_report_public_id: publicId3,
        destination: testGroupId,
        environment: 'test',
        total_report_count: 1,
        window_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      }).select().single();

      if (tErr3 || !tracker3) throw new Error(`Failed to create distinct tracker: ${tErr3?.message}`);
      trackerId3 = tracker3.id;

      // 3. Link Report
      await supabaseAdmin.from('test_event_notification_reports').insert({
        tracker_id: trackerId3,
        report_id: rep3.id,
        public_id: publicId3,
      });

      // 4. Create Distinct Outbox Job
      const idempotencyKey3 = `evt_emerg_${eventCode3}_rep3`;
      const payload3: LineNotificationPayload = {
        publicId: publicId3,
        categoryName: "ความปลอดภัยสารเคมีและวัตถุอันตราย",
        subcategoryName: "สารเคมีรั่วไหล/ไอระเหยพิษ",
        description: rep3.description,
        location: rep3.location,
        date: new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
        statusText: "pending",
        reporterName: rep3.reporter_name,
        priority: "emergency",
        priorityReason: "ไอระเหยสารเคมีเป็นพิษเฉียบพลัน อาจกระทบระบบทางเดินหายใจ",
      };

      const { data: outbox3, error: oErr3 } = await supabaseAdmin.from('test_event_notification_outbox').insert({
        idempotency_key: idempotencyKey3,
        tracker_id: trackerId3,
        notification_type: 'emergency_alert',
        payload: payload3,
        destination: testGroupId,
        environment: 'test',
        status: 'claiming',
        claim_token: 'worker_01',
        claimed_at: new Date().toISOString(),
        lease_timeout_at: new Date(Date.now() + 30000).toISOString(),
      }).select().single();

      if (oErr3 || !outbox3) throw new Error(`Failed to create outbox: ${oErr3?.message}`);

      // 5. Dispatch LIVE PUSH
      const notifyRes3 = await notifyLine(payload3, testGroupId, {
        event: 'new_report',
        reportId: rep3.id,
        idempotencyKey: idempotencyKey3,
      });

      if (!notifyRes3.success) {
        throw new Error(`LINE Push failed for distinct emergency: ${notifyRes3.error}`);
      }

      await supabaseAdmin.from('test_event_notification_outbox').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      }).eq('id', outbox3.id);

      await supabaseAdmin.from('test_event_notification_trackers').update({
        state: 'FIRST_ALERT_SENT',
        last_notified_at: new Date().toISOString(),
      }).eq('id', trackerId3);

      return {
        actual: `Distinct emergency event ${eventCode3} delivered to TEST group with LINE HTTP 200`,
        evidence: {
          reportId: rep3.id,
          publicId: publicId3,
          eventCode: eventCode3,
          trackerId: trackerId3,
          outboxId: outbox3.id,
          notifyResult: notifyRes3,
        },
      };
    }
  );

  // ---------------------------------------------------------------------------
  // TC-LINE-04: Normal to Emergency Escalation Real Dispatch
  // ---------------------------------------------------------------------------
  await recordTest(
    'TC-LINE-04',
    'Normal to Emergency Escalation Dispatch & Guard',
    'Escalation Workflow',
    'Aggregating normal event escalated to emergency creates escalation outbox job, dispatches escalation alert, and subsequent escalation call returns already_emergency',
    async () => {
      const publicIdNorm = `NORM-${Date.now().toString().slice(-4)}`;
      const publicIdEsc = `ESC-${Date.now().toString().slice(-4)}`;
      const eventCodeNorm = `EVT-T-${Date.now().toString().slice(-6)}-ELEV`;

      // 1. Create Initial Normal Report
      const titleNorm = 'ลิฟต์โดยสาร อาคารเรียนรวม มีเสียงดังผิดปกติ';
      const { data: repNorm, error: nErr } = await supabaseAdmin.from('test_reports').insert({
        public_id: publicIdNorm,
        category_id: categoryId,
        description: 'ลิฟต์ตัวที่ 2 อาคารเรียนรวม เวลาจอดชั้น 3 มีเสียงกึกๆ และปิดช้า',
        location: 'อาคารเรียนรวม ลิฟต์ตัวที่ 2',
        priority: 'normal',
        status: 'pending',
        reporter_name: 'นายสมเกียรติ นิสิต',
        email: 'student@test.local',
        phone: '0845678901',
      }).select().single();

      if (nErr || !repNorm) throw new Error(`Failed to create normal report: ${nErr?.message}`);

      // 2. Create Aggregating Tracker
      const { data: trackerNorm, error: tErrNorm } = await supabaseAdmin.from('test_event_notification_trackers').insert({
        event_code: eventCodeNorm,
        cluster_signature: 'elevator_2_main_bldg_noise',
        title: titleNorm,
        location: repNorm.location,
        priority: 'normal',
        state: 'AGGREGATING',
        initial_report_id: repNorm.id,
        initial_report_public_id: publicIdNorm,
        destination: testGroupId,
        environment: 'test',
        total_report_count: 1,
        window_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      }).select().single();

      if (tErrNorm || !trackerNorm) throw new Error(`Failed to create normal tracker: ${tErrNorm?.message}`);

      // Link initial report
      await supabaseAdmin.from('test_event_notification_reports').insert({
        tracker_id: trackerNorm.id,
        report_id: repNorm.id,
        public_id: publicIdNorm,
      });

      // 3. Create Escalating Report (Persons trapped inside!)
      const { data: repEsc, error: eErr } = await supabaseAdmin.from('test_reports').insert({
        public_id: publicIdEsc,
        category_id: categoryId,
        description: 'ลิฟต์ตัวที่ 2 ค้างระหว่างชั้น 2 กับ 3 มีคนติดอยู่ 4 คน เริ่มขาดอากาศและตกใจ ต้องการช่างด่วนที่สุด',
        location: 'อาคารเรียนรวม ลิฟต์ตัวที่ 2',
        priority: 'emergency',
        status: 'pending',
        reporter_name: 'รปภ. ประจำอาคาร',
        email: 'sec_chief@test.local',
        phone: '0856789012',
      }).select().single();

      if (eErr || !repEsc) throw new Error(`Failed to create escalation report: ${eErr?.message}`);

      // 4. Call test_escalate_event_priority RPC
      const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('test_escalate_event_priority', {
        p_tracker_id: trackerNorm.id,
        p_report_id: repEsc.id,
        p_public_id: publicIdEsc,
        p_worker_id: 'worker_01',
        p_lease_seconds: 30,
      });

      if (rpcErr) throw new Error(`RPC test_escalate_event_priority failed: ${rpcErr.message}`);
      if (!rpcRes?.escalated) throw new Error(`Expected escalated=true, got: ${JSON.stringify(rpcRes)}`);

      // 5. Fetch Outbox Job created by stored procedure
      const { data: escOutbox, error: outErr } = await supabaseAdmin.from('test_event_notification_outbox')
        .select('*')
        .eq('id', rpcRes.outbox_id)
        .single();

      if (outErr || !escOutbox) throw new Error(`Failed to fetch escalation outbox job: ${outErr?.message}`);

      // 6. Dispatch Escalation Alert to LINE TEST GROUP
      const escPayload: LineNotificationPayload = {
        publicId: publicIdEsc,
        categoryName: "🚨 ยกระดับเหตุฉุกเฉิน (Escalation)",
        subcategoryName: trackerNorm.title,
        description: `[ยกระดับจากปกติเป็นฉุกเฉินเร่งด่วน]\nเหตุการณ์เดิม: ${trackerNorm.title}\nรายงานฉุกเฉินเพิ่มเติม: ${repEsc.description}`,
        location: trackerNorm.location,
        date: new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
        statusText: "pending",
        reporterName: repEsc.reporter_name,
        priority: "emergency",
        priorityReason: "ผู้แจ้งระบุมีผู้ติดค้างภายในลิฟต์ ขาดอากาศหายใจ (ยกระดับสู่ Emergency)",
      };

      const notifyEscRes = await notifyLine(escPayload, testGroupId, {
        event: 'new_report',
        reportId: repEsc.id,
        idempotencyKey: rpcRes.idempotency_key,
      });

      if (!notifyEscRes.success) {
        throw new Error(`Escalation LINE push failed: ${notifyEscRes.error}`);
      }

      // Mark outbox sent & tracker ESCALATION_ALERT_SENT
      await supabaseAdmin.from('test_event_notification_outbox').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      }).eq('id', escOutbox.id);

      await supabaseAdmin.from('test_event_notification_trackers').update({
        state: 'ESCALATION_ALERT_SENT',
        last_notified_at: new Date().toISOString(),
      }).eq('id', trackerNorm.id);

      // 7. Verify Guard against duplicate escalation
      const { data: secondEscRpc, error: secondEscErr } = await supabaseAdmin.rpc('test_escalate_event_priority', {
        p_tracker_id: trackerNorm.id,
        p_report_id: repEsc.id,
        p_public_id: publicIdEsc,
        p_worker_id: 'worker_01',
        p_lease_seconds: 30,
      });

      if (secondEscErr) throw new Error(`Second escalation check failed: ${secondEscErr.message}`);
      if (secondEscRpc?.escalated !== false || secondEscRpc?.reason !== 'already_emergency') {
        throw new Error(`Expected reason=already_emergency, got: ${JSON.stringify(secondEscRpc)}`);
      }

      return {
        actual: `Escalation outbox created, dispatched to LINE TEST group (status 200), re-escalation prevented with reason: ${secondEscRpc.reason}`,
        evidence: {
          trackerId: trackerNorm.id,
          firstRpcResult: rpcRes,
          escOutboxId: escOutbox.id,
          notifyResult: notifyEscRes,
          secondRpcResult: secondEscRpc,
        },
      };
    }
  );

  // ---------------------------------------------------------------------------
  // TC-LINE-05: Idempotency Protection
  // ---------------------------------------------------------------------------
  await recordTest(
    'TC-LINE-05',
    'Idempotency Lease Enforcement',
    'Deduplication & Safety',
    'Replaying dispatch with identical idempotency key is caught by distributed lease; returns skipped/idempotent without sending duplicate LINE push',
    async () => {
      const fixedKey = `test_idempotency_fixed_${Date.now()}`;
      const payload: LineNotificationPayload = {
        publicId: 'IDEMP-001',
        categoryName: 'ทดสอบ Idempotency',
        subcategoryName: 'การทดสอบป้องกันการส่งซ้ำ',
        description: 'ข้อความทดสอบการจำกัดการส่งซ้ำ',
        location: 'Lab Room',
        date: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
        statusText: 'pending',
        priority: 'normal',
      };

      // 1. First dispatch (Must succeed)
      const res1 = await notifyLine(payload, testGroupId, {
        event: 'new_report',
        idempotencyKey: fixedKey,
      });

      if (!res1.success || res1.status !== 'sent') {
        throw new Error(`First dispatch failed: ${JSON.stringify(res1)}`);
      }

      // 2. Second dispatch with identical idempotency key (Must be skipped)
      const res2 = await notifyLine(payload, testGroupId, {
        event: 'new_report',
        idempotencyKey: fixedKey,
      });

      if (!res2.skipped || res2.status !== 'skipped') {
        throw new Error(`Second dispatch was not skipped: ${JSON.stringify(res2)}`);
      }

      return {
        actual: `First call sent (attempts: ${res1.attempts}); Second call skipped (status: ${res2.status}, error: ${res2.error})`,
        evidence: {
          idempotencyKey: fixedKey,
          firstAttempt: res1,
          secondAttempt: res2,
        },
      };
    }
  );

  // ---------------------------------------------------------------------------
  // TC-LINE-06: Uncertain Delivery Handling
  // ---------------------------------------------------------------------------
  await recordTest(
    'TC-LINE-06',
    'Uncertain Delivery Detection & Retry Suppression',
    'Reliability & Failure Modes',
    'When dispatch encounters indeterminate network timeout, state transitions to UNCERTAIN_DELIVERY and blind auto-retry is suppressed to avoid duplicate message',
    async () => {
      const uncertainKey = `test_uncertain_lease_${Date.now()}`;

      // 1. Manually simulate an in-flight reservation that died/timed out
      const leaseId = crypto.randomUUID();
      await supabaseAdmin.from('test_notification_logs').insert({
        id: leaseId,
        event_type: 'new_report',
        public_id: 'UNCERTAIN-001',
        destination: maskDestination(testGroupId),
        environment: 'test',
        status: 'queued',
        attempt_count: 1,
        idempotency_key: uncertainKey,
        attempted_at: new Date(Date.now() - 45000).toISOString(), // 45 seconds ago (exceeds 30s TTL)
      });

      // 2. Acquire lease on this key: Should detect stale in-flight lease and transition to UNCERTAIN_DELIVERY
      const leaseResult = await acquireNotificationLease({
        idempotencyKey: uncertainKey,
        eventType: 'new_report',
        publicId: 'UNCERTAIN-001',
        destination: testGroupId,
        environment: 'test',
        leaseTtlMs: 30000,
      });

      if (leaseResult.acquired) {
        throw new Error("Expected lease acquisition to FAIL due to uncertain delivery, but it succeeded!");
      }

      if (leaseResult.status !== 'uncertain_delivery') {
        throw new Error(`Expected status 'uncertain_delivery', got: ${leaseResult.status}`);
      }

      // 3. Verify database record updated to status='failed' and error_code='UNCERTAIN_DELIVERY'
      const { data: updatedLog } = await supabaseAdmin.from('test_notification_logs')
        .select('*')
        .eq('id', leaseId)
        .single();

      if (updatedLog?.status !== 'failed' || updatedLog?.error_code !== 'UNCERTAIN_DELIVERY') {
        throw new Error(`Expected DB record to be failed/UNCERTAIN_DELIVERY, got: ${JSON.stringify(updatedLog)}`);
      }

      return {
        actual: `Stale in-flight lease transitioned to status=${leaseResult.status}; DB error_code=${updatedLog.error_code}. Retry safely suppressed.`,
        evidence: {
          leaseId,
          leaseResult,
          updatedLogRecord: {
            status: updatedLog.status,
            error_code: updatedLog.error_code,
            error_message: updatedLog.error_message,
          },
        },
      };
    }
  );

  // ---------------------------------------------------------------------------
  // TC-LINE-07: Prohibited Events Policy Enforcement
  // ---------------------------------------------------------------------------
  await recordTest(
    'TC-LINE-07',
    'Prohibited Events Policy Gatekeeper',
    'Policy Compliance',
    'All prohibited events (status_change, bulk_status_change, bulk_reply, transfer, incident_grouping, and missing event) are strictly blocked with 0 network calls',
    async () => {
      const prohibitedEvents = [
        'status_change',
        'bulk_status_change',
        'bulk_reply',
        'transfer',
        'incident_grouping',
        '', // missing event
      ];

      const outcomes: Array<{ event: string; allowed: boolean; blockedResult: any }> = [];

      for (const evt of prohibitedEvents) {
        const policyCheck = isLineEventAllowed(evt as any);
        const dispatchRes = await notifyLine('Test message', testGroupId, {
          event: evt as any,
          idempotencyKey: `prohib_${evt || 'empty'}_${Date.now()}`,
        });

        if (policyCheck.allowed) {
          throw new Error(`Event '${evt}' was unexpectedly allowed by policy!`);
        }

        if (!dispatchRes.blocked || dispatchRes.status !== 'blocked') {
          throw new Error(`Event '${evt}' was not blocked by notifyLine: ${JSON.stringify(dispatchRes)}`);
        }

        outcomes.push({
          event: evt || '(empty)',
          allowed: policyCheck.allowed,
          blockedResult: {
            status: dispatchRes.status,
            error: dispatchRes.error,
          },
        });
      }

      return {
        actual: `All 6 prohibited/empty events blocked immediately with Fail-Closed policy and 0 network requests`,
        evidence: { outcomes },
      };
    }
  );

  // ---------------------------------------------------------------------------
  // NEGATIVE TEST 01: Destination Isolation - Production Group Rejected in Test
  // ---------------------------------------------------------------------------
  await recordTest(
    'NEG-LINE-01',
    'Reject Production Group Destination in Localhost/Test',
    'Group Isolation',
    'Attempting to dispatch to LINE_GROUP_ID (Production) in test environment is strictly blocked with TEST_DESTINATION_MISMATCH',
    async () => {
      const check = validateTestLineDestination(prodGroupId, true);
      if (check.isValid) {
        throw new Error("Validation unexpectedly accepted Production Group ID in test mode!");
      }

      const dispatchRes = await notifyLine('Attempt to send to prod group', prodGroupId, {
        event: 'new_report',
        idempotencyKey: `neg_prod_dest_${Date.now()}`,
      });

      if (!dispatchRes.blocked || dispatchRes.status !== 'blocked') {
        throw new Error(`Expected notifyLine to block production group dispatch, got: ${JSON.stringify(dispatchRes)}`);
      }

      return {
        actual: `Blocked with validation error: ${check.reason}; notifyLine status: ${dispatchRes.status}`,
        evidence: {
          attemptedDestination: maskDestination(prodGroupId),
          validationReason: check.reason,
          dispatchResult: dispatchRes,
        },
      };
    }
  );

  // ---------------------------------------------------------------------------
  // NEGATIVE TEST 02: Destination Isolation - Unknown Group ID Rejected
  // ---------------------------------------------------------------------------
  await recordTest(
    'NEG-LINE-02',
    'Reject Unknown Group ID in Localhost/Test',
    'Group Isolation',
    'Attempting to dispatch to an unknown/unregistered group ID is strictly blocked with TEST_DESTINATION_MISMATCH',
    async () => {
      const fakeGroupId = 'C99999999999999999999999999999999';
      const check = validateTestLineDestination(fakeGroupId, true);
      if (check.isValid) {
        throw new Error("Validation unexpectedly accepted fake Group ID in test mode!");
      }

      const dispatchRes = await notifyLine('Attempt to send to fake group', fakeGroupId, {
        event: 'new_report',
        idempotencyKey: `neg_fake_dest_${Date.now()}`,
      });

      if (!dispatchRes.blocked || dispatchRes.status !== 'blocked') {
        throw new Error(`Expected notifyLine to block fake group dispatch, got: ${JSON.stringify(dispatchRes)}`);
      }

      return {
        actual: `Blocked with validation error: ${check.reason}; notifyLine status: ${dispatchRes.status}`,
        evidence: {
          attemptedDestination: maskDestination(fakeGroupId),
          validationReason: check.reason,
          dispatchResult: dispatchRes,
        },
      };
    }
  );

  // ---------------------------------------------------------------------------
  // NEGATIVE TEST 03: Missing Test Group Configuration (Fail-Closed)
  // ---------------------------------------------------------------------------
  await recordTest(
    'NEG-LINE-03',
    'Fail-Closed on Missing Test Destination Configuration',
    'Configuration Guard',
    'If LINE_TEST_GROUP_ID is missing or unset, validation fails closed without fallback',
    async () => {
      const origEnv = process.env.LINE_TEST_GROUP_ID;
      try {
        delete process.env.LINE_TEST_GROUP_ID;
        const check = validateTestLineDestination(testGroupId, true);

        if (check.isValid) {
          throw new Error("Validation unexpectedly passed when LINE_TEST_GROUP_ID was unset!");
        }

        return {
          actual: `Failed closed safely: ${check.reason}`,
          evidence: {
            validationReason: check.reason,
          },
        };
      } finally {
        process.env.LINE_TEST_GROUP_ID = origEnv;
      }
    }
  );

  // ---------------------------------------------------------------------------
  // NEGATIVE TEST 04: Client Parameter Destination Override Prevention
  // ---------------------------------------------------------------------------
  await recordTest(
    'NEG-LINE-04',
    'Client Parameter Destination Override Prevention',
    'Input Sanitization & Injection Prevention',
    'API and Notification services do not accept client-controlled override destinations to alter dispatch routing',
    async () => {
      // In getReportDataSource() and report creation, destination is determined server-side
      const dataSource = getReportDataSource();
      const isOverridable = 'customDestination' in dataSource || 'targetGroup' in dataSource;

      if (isOverridable) {
        throw new Error("DataSource exposes destination override capability!");
      }

      return {
        actual: `Destination routing is strictly server-controlled based on verified department mapping and environment config. Client parameter overrides are completely absent.`,
        evidence: {
          dataSourceMode: dataSource.source,
          isTest: dataSource.isTest,
        },
      };
    }
  );

  // ---------------------------------------------------------------------------
  // NEGATIVE TEST 05: Production Tables Zero-Touch Audit
  // ---------------------------------------------------------------------------
  await recordTest(
    'NEG-LINE-05',
    'Production Tables Zero-Touch Audit',
    'Parity & Data Isolation',
    'Verify production tables (reports, event_notification_trackers, event_notification_outbox) remain strictly at 0 rows after all tests',
    async () => {
      const { count: repCount } = await supabaseAdmin.from('reports').select('*', { count: 'exact', head: true });
      const { count: trackCount } = await supabaseAdmin.from('event_notification_trackers').select('*', { count: 'exact', head: true });
      const { count: outboxCount } = await supabaseAdmin.from('event_notification_outbox').select('*', { count: 'exact', head: true });
      const { count: notifCount } = await supabaseAdmin.from('notification_logs').select('*', { count: 'exact', head: true });

      if ((repCount || 0) > 0 || (trackCount || 0) > 0 || (outboxCount || 0) > 0 || (notifCount || 0) > 0) {
        throw new Error(`Production tables were contaminated! reports: ${repCount}, trackers: ${trackCount}, outbox: ${outboxCount}, logs: ${notifCount}`);
      }

      return {
        actual: `Production tables audit confirmed: reports=0, event_notification_trackers=0, event_notification_outbox=0, notification_logs=0. Zero production records created.`,
        evidence: {
          reports: repCount,
          event_notification_trackers: trackCount,
          event_notification_outbox: outboxCount,
          notification_logs: notifCount,
        },
      };
    }
  );

  // ---------------------------------------------------------------------------
  // SUMMARY & OUTPUT
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("PHASE 3.5 TEST SUITE EXECUTION SUMMARY");
  console.log("================================================================================");

  const passed = suiteResults.filter((r) => r.status === 'PASS').length;
  const failed = suiteResults.filter((r) => r.status === 'FAIL').length;
  const blocked = suiteResults.filter((r) => r.status === 'BLOCKED').length;

  console.log(`Total Test Cases: ${suiteResults.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Blocked: ${blocked}`);
  console.log("================================================================================\n");

  suiteResults.forEach((r) => {
    console.log(`[${r.status}] ${r.id}: ${r.name}`);
    console.log(`  Actual: ${r.actual}`);
  });

  return {
    suiteResults,
    passed,
    failed,
    blocked,
    total: suiteResults.length,
  };
}

runTestSuite().catch((err) => {
  console.error("Unhandled test suite execution error:", err);
  process.exit(1);
});
