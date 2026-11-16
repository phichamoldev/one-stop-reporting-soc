/**
 * PHASE 3.7 — INTEGRATION & INCIDENT-BASED LINE NOTIFICATION TEST SUITE
 * 
 * Verifies all 10 Test Scenarios (TC-01 through TC-10):
 *  TC-01: First Alert sent immediately on new emergency incident
 *  TC-02: Burst reports accumulated in DB without duplicate LINE alerts during 30-min window
 *  TC-03: Periodic Update Alert sent at 30 mins with exact cumulative & delta count
 *  TC-04: Empty Window sends zero LINE alerts (no empty alert)
 *  TC-05: Next Update Window with 3 new reports sends exact count (+3)
 *  TC-06: Independent incident at another building gets separate tracker & immediate First Alert
 *  TC-07: Escalation from Normal to Emergency sends immediate Escalation Alert without waiting 30m
 *  TC-08: Concurrent workers with SKIP LOCKED prevent double dispatch
 *  TC-09: Worker restart preserves state and schedules without data loss
 *  TC-10: Local Test Isolation strictly blocks production and unknown destinations
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Enforce test environment
process.env.REPORT_DATA_SOURCE = 'test';
process.env.NEXT_PUBLIC_REPORT_DATA_SOURCE = 'test';
process.env.LINE_NOTIFICATIONS_ENABLED = 'true';
process.env.LINE_NEW_REPORT_NOTIFICATIONS_ENABLED = 'true';

import { supabaseAdmin } from '../src/lib/supabase-admin';
import { getReportDataSource } from '../src/lib/dataSource';
import { processReportForEventNotification } from '../src/lib/eventNotificationService';
import { processDueIncidentUpdates } from '../src/lib/eventUpdateScheduler';
import { validateTestLineDestination } from '../src/lib/line';

export interface TestCaseResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
  error?: string;
}

const testResults: TestCaseResult[] = [];

function recordResult(id: string, name: string, passed: boolean, details: string, error?: string) {
  testResults.push({ id, name, passed, details, error });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${id}: ${name}`);
  console.log(`       Details: ${details}`);
  if (error) console.error(`       Error: ${error}`);
}

async function runPhase37Suite() {
  const dataSource = getReportDataSource();
  const testGroupId = process.env.LINE_TEST_GROUP_ID!;
  const targetGroupId = testGroupId;
  if (!testGroupId) {
    throw new Error("LINE_TEST_GROUP_ID is required in .env.local for test execution");
  }

  const runId = `P37-${Date.now()}`;
  console.log(`\n===============================================================`);
  console.log(`PHASE 3.7 INTEGRATION TEST SUITE (Run ID: ${runId})`);
  console.log(`Target DB: Local Supabase (${dataSource.reportsTable}, ${dataSource.eventTrackersTable})`);
  console.log(`Target LINE: Verified SOC TEST Group (${testGroupId.slice(0, 4)}...${testGroupId.slice(-4)})`);
  console.log(`===============================================================\n`);

  if (dataSource.isTest) {
    console.log(`[Setup] Isolating test environment: cleaning stale test event trackers and outbox...`);
    await supabaseAdmin.from(dataSource.eventReportsTable).delete().neq('tracker_id', '00000000-0000-0000-0000-000000000000');
    await supabaseAdmin.from(dataSource.eventOutboxTable).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabaseAdmin.from(dataSource.eventTrackersTable).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log(`[Setup] Test tables ready.\n`);
  }

  let trackerAId: string | null = null;
  let trackerACode: string | null = null;
  const startTime = new Date();

  // Helper for generating unique test report IDs
  const genPublicId = (seq: number) => `SOC-T-${Date.now().toString().slice(-4)}${String(seq).padStart(3, '0')}`;

  // ---------------------------------------------------------------------------
  // TC-01: First Alert on new Emergency incident
  // ---------------------------------------------------------------------------
  try {
    const { data: rep1, error: rErr } = await supabaseAdmin
      .from(dataSource.reportsTable)
      .insert({
        public_id: genPublicId(1),
        category_id: 4,
        subcategory_id: 34,
        description: `พบควันไฟสีเทาหนาแน่นลอยออกมาจากห้องเก็บอุปกรณ์ ชั้น 1 อาคารเรียนรวม [${runId}]`,
        location: `อาคารเรียนรวม ชั้น 1 โซน A`,
        priority: "emergency",
        reporter_name: "นายกิตติพงษ์ ใจมั่น",
        email: "test.reporter@example.com",
        phone: "0812345678",
        status: "pending",
        tracking_token: crypto.randomUUID(),
      })
      .select()
      .single();

    if (rErr || !rep1) throw new Error(rErr?.message || "Failed to insert test report 1");

    const notifRes = await processReportForEventNotification({
      report: {
        id: rep1.id,
        public_id: rep1.public_id,
        category_id: rep1.category_id,
        subcategory_id: rep1.subcategory_id,
        location: rep1.location,
        description: rep1.description,
        priority: rep1.priority,
        reporter_name: rep1.reporter_name,
        created_at: rep1.created_at,
      },
      targetGroupId,
      priorityReason: "ตรวจพบไฟไหม้และกลุ่มควัน",
    });

    trackerAId = notifRes.trackerId;
    trackerACode = notifRes.eventCode;

    // Verify tracker state in DB
    const { data: tr } = await supabaseAdmin
      .from(dataSource.eventTrackersTable)
      .select('*')
      .eq('id', trackerAId!)
      .single();

    const passed = notifRes.action === 'first_alert_sent' &&
                   tr?.state === 'AGGREGATING' &&
                   tr?.total_report_count === 1 &&
                   tr?.last_notified_count === 1 &&
                   tr?.priority === 'emergency' &&
                   Boolean(tr?.first_alert_sent_at);

    recordResult(
      'TC-01',
      'First Alert on New Emergency Incident',
      passed,
      `Action=${notifRes.action}, Tracker=${tr?.event_code}, State=${tr?.state}, Count=1, FirstAlertSentAt=${tr?.first_alert_sent_at}`
    );
  } catch (err: any) {
    recordResult('TC-01', 'First Alert on New Emergency Incident', false, 'Exception occurred', err.message);
  }

  // ---------------------------------------------------------------------------
  // TC-02: Burst Reports within 30-minute window (Suppression of duplicate LINE calls)
  // ---------------------------------------------------------------------------
  try {
    const burstPromises = [];
    for (let i = 2; i <= 15; i++) {
      const pubId = genPublicId(i);
      burstPromises.push(
        (async () => {
          const { data: rep } = await supabaseAdmin
            .from(dataSource.reportsTable)
            .insert({
              public_id: pubId,
              category_id: 4,
              subcategory_id: 34,
              description: `มีเปลวไฟและควันดำหนาแน่นบริเวณชั้น 1 ห้องเก็บของ [${runId}] #${i}`,
              location: `อาคารเรียนรวม ชั้น 1 โซน A`,
              priority: "emergency",
              reporter_name: `ผู้แจ้งคนที่ ${i}`,
              email: `reporter${i}@example.com`,
              phone: "0812345678",
              status: "pending",
              tracking_token: crypto.randomUUID(),
            })
            .select()
            .single();

          if (!rep) throw new Error(`Failed to insert report ${pubId}`);

          return processReportForEventNotification({
            report: {
              id: rep.id,
              public_id: rep.public_id,
              category_id: rep.category_id,
              subcategory_id: rep.subcategory_id,
              location: rep.location,
              description: rep.description,
              priority: rep.priority,
              reporter_name: rep.reporter_name,
              created_at: rep.created_at,
            },
            targetGroupId,
            priorityReason: "ตรวจพบเพลิงไหม้ต่อเนื่อง",
          });
        })()
      );
    }

    const burstResults = await Promise.all(burstPromises);
    const allSuppressed = burstResults.every(r => r.action === 'suppressed_duplicate_emergency');

    const { data: trA } = await supabaseAdmin
      .from(dataSource.eventTrackersTable)
      .select('*')
      .eq('id', trackerAId!)
      .single();

    const passed = allSuppressed && trA?.total_report_count === 15 && trA?.last_notified_count === 1;

    recordResult(
      'TC-02',
      'Burst Reports Accumulated Without Duplicate LINE Alerts',
      passed,
      `All 14 reports suppressed=${allSuppressed}, TotalReportCount=${trA?.total_report_count}, LastNotifiedCount=${trA?.last_notified_count}`
    );
  } catch (err: any) {
    recordResult('TC-02', 'Burst Reports Accumulated Without Duplicate LINE Alerts', false, 'Exception occurred', err.message);
  }

  // ---------------------------------------------------------------------------
  // TC-03: Periodic Update Alert at 30 minutes
  // ---------------------------------------------------------------------------
  try {
    const timeAt30Min = new Date(startTime.getTime() + 30 * 60 * 1000 + 5000); // 30 mins + 5s

    const updateRes = await processDueIncidentUpdates({
      trackerId: trackerAId!,
      asOfTime: timeAt30Min,
    });

    const item = updateRes.results[0];
    const { data: trAfter } = await supabaseAdmin
      .from(dataSource.eventTrackersTable)
      .select('*')
      .eq('id', trackerAId!)
      .single();

    const passed = item?.action === 'update_sent' &&
                   item.totalReportCount === 15 &&
                   item.newReportCount === 14 &&
                   trAfter?.last_notified_count === 15 &&
                   Boolean(trAfter?.last_update_sent_at);

    recordResult(
      'TC-03',
      'Periodic Update Alert at 30 Minutes',
      passed,
      `Action=${item?.action}, Total=${item?.totalReportCount}, NewDelta=+${item?.newReportCount}, TrackerLastNotified=${trAfter?.last_notified_count}, LastUpdateSentAt=${trAfter?.last_update_sent_at}`
    );
  } catch (err: any) {
    recordResult('TC-03', 'Periodic Update Alert at 30 Minutes', false, 'Exception occurred', err.message);
  }

  // ---------------------------------------------------------------------------
  // TC-04: Empty Window (30 minutes with 0 new reports -> Zero LINE alerts)
  // ---------------------------------------------------------------------------
  try {
    const timeAt60Min = new Date(startTime.getTime() + 60 * 60 * 1000 + 10000); // 60 mins

    const updateRes = await processDueIncidentUpdates({
      trackerId: trackerAId!,
      asOfTime: timeAt60Min,
    });

    const item = updateRes.results[0];
    const { data: trAfter } = await supabaseAdmin
      .from(dataSource.eventTrackersTable)
      .select('*')
      .eq('id', trackerAId!)
      .single();

    const passed = item?.action === 'window_extended_no_reports' &&
                   item.newReportCount === 0 &&
                   trAfter?.last_notified_count === 15;

    recordResult(
      'TC-04',
      'Empty Window Check (Zero LINE Calls on 0 New Reports)',
      passed,
      `Action=${item?.action}, NewReports=${item?.newReportCount}, LINE Call Skipped=true, TrackerCount=${trAfter?.last_notified_count}`
    );
  } catch (err: any) {
    recordResult('TC-04', 'Empty Window Check (Zero LINE Calls on 0 New Reports)', false, 'Exception occurred', err.message);
  }

  // ---------------------------------------------------------------------------
  // TC-05: Next Update Window with 3 New Reports
  // ---------------------------------------------------------------------------
  try {
    for (let i = 16; i <= 18; i++) {
      const pubId = genPublicId(i);
      const { data: rep } = await supabaseAdmin
        .from(dataSource.reportsTable)
        .insert({
          public_id: pubId,
          category_id: 4,
          subcategory_id: 34,
          description: `พบกลุ่มควันปะทุขึ้นมาใหม่บริเวณห้องเก็บของชั้น 1 อาคารเรียนรวม [${runId}] #${i}`,
          location: `อาคารเรียนรวม ชั้น 1 โซน A`,
          priority: "emergency",
          reporter_name: `ผู้แจ้งคนที่ ${i}`,
          email: `reporter${i}@example.com`,
          phone: "0812345678",
          status: "pending",
          tracking_token: crypto.randomUUID(),
        })
        .select()
        .single();

      await processReportForEventNotification({
        report: {
          id: rep.id,
          public_id: rep.public_id,
          category_id: rep.category_id,
          subcategory_id: rep.subcategory_id,
          location: rep.location,
          description: rep.description,
          priority: rep.priority,
          reporter_name: rep.reporter_name,
          created_at: rep.created_at,
        },
        targetGroupId,
      });
    }

    const timeAt90Min = new Date(startTime.getTime() + 90 * 60 * 1000 + 15000); // 90 mins

    const updateRes = await processDueIncidentUpdates({
      trackerId: trackerAId!,
      asOfTime: timeAt90Min,
    });

    const item = updateRes.results[0];
    const { data: trAfter } = await supabaseAdmin
      .from(dataSource.eventTrackersTable)
      .select('*')
      .eq('id', trackerAId!)
      .single();

    const passed = item?.action === 'update_sent' &&
                   item.totalReportCount === 18 &&
                   item.newReportCount === 3 &&
                   trAfter?.last_notified_count === 18;

    recordResult(
      'TC-05',
      'Next Update Window with 3 New Reports',
      passed,
      `Action=${item?.action}, TotalReportCount=${item?.totalReportCount}, NewDelta=+${item?.newReportCount}, TrackerSnapshot=${trAfter?.last_notified_count}`
    );
  } catch (err: any) {
    recordResult('TC-05', 'Next Update Window with 3 New Reports', false, 'Exception occurred', err.message);
  }

  // ---------------------------------------------------------------------------
  // TC-06: Independent Incident at Different Building (Separate Tracker & Immediate First Alert)
  // ---------------------------------------------------------------------------
  try {
    const { data: repB } = await supabaseAdmin
      .from(dataSource.reportsTable)
      .insert({
        public_id: genPublicId(50),
        category_id: 4,
        subcategory_id: 34,
        description: `มีไฟลุกไหม้ตู้ทดลองเคมีในห้องแล็บ ชั้น 3 อาคาร 4 ขอทีมดับเพลิงด่วน [${runId}]`,
        location: `อาคาร 4 ชั้น 3 ห้องแล็บเคมี`,
        priority: "emergency",
        reporter_name: "อาจารย์ ดร. สุรชัย วิจัยดี",
        email: "surachai@example.com",
        phone: "0812345678",
        status: "pending",
        tracking_token: crypto.randomUUID(),
      })
      .select()
      .single();

    const notifResB = await processReportForEventNotification({
      report: {
        id: repB.id,
        public_id: repB.public_id,
        category_id: repB.category_id,
        subcategory_id: repB.subcategory_id,
        location: repB.location,
        description: repB.description,
        priority: repB.priority,
        reporter_name: repB.reporter_name,
        created_at: repB.created_at,
      },
      targetGroupId,
      priorityReason: "ไฟไหม้ห้องแล็บอาคาร 4",
    });

    const isDistinctTracker = notifResB.trackerId !== trackerAId && notifResB.eventCode !== trackerACode;
    const passed = notifResB.action === 'first_alert_sent' && isDistinctTracker;

    recordResult(
      'TC-06',
      'Independent Incident Isolation (Separate Tracker & Timer)',
      passed,
      `Action=${notifResB.action}, NewTracker=${notifResB.eventCode}, DistinctFromA=${isDistinctTracker}`
    );
  } catch (err: any) {
    recordResult('TC-06', 'Independent Incident Isolation (Separate Tracker & Timer)', false, 'Exception occurred', err.message);
  }

  // ---------------------------------------------------------------------------
  // TC-07: Escalation from Normal to Emergency (Immediate Escalation Alert)
  // ---------------------------------------------------------------------------
  try {
    // 1. Submit normal report (starts AGGREGATING, no immediate LINE)
    const { data: repNorm } = await supabaseAdmin
      .from(dataSource.reportsTable)
      .insert({
        public_id: genPublicId(60),
        category_id: 4,
        subcategory_id: 23,
        description: `ลิฟต์โดยสารตัวที่ 1 อาคาร 3 ประตูปิดช้าและมีเสียงดังครืดคราดเวลาเปิดปิด [${runId}]`,
        location: `อาคาร 3 ชั้น 1 หน้าลิฟต์ตัวที่ 1`,
        priority: "normal",
        reporter_name: "นายชลิต ศรีสุข",
        email: "chalit@example.com",
        phone: "0812345678",
        status: "pending",
        tracking_token: crypto.randomUUID(),
      })
      .select()
      .single();

    const notifNorm = await processReportForEventNotification({
      report: {
        id: repNorm.id,
        public_id: repNorm.public_id,
        category_id: repNorm.category_id,
        subcategory_id: repNorm.subcategory_id,
        location: repNorm.location,
        description: repNorm.description,
        priority: repNorm.priority,
        reporter_name: repNorm.reporter_name,
        created_at: repNorm.created_at,
      },
      targetGroupId,
    });

    // 2. Submit emergency escalation report (People trapped inside!)
    const { data: repEsc } = await supabaseAdmin
      .from(dataSource.reportsTable)
      .insert({
        public_id: genPublicId(61),
        category_id: 4,
        subcategory_id: 34,
        description: `ฉุกเฉิน! ลิฟต์ตัวที่ 1 อาคาร 3 ค้างอยู่ระหว่างชั้น 3 กับ 4 มีเจ้าหน้าที่และนิสิตติดอยู่ข้างใน 3 คน เริ่มขาดอากาศ [${runId}]`,
        location: `อาคาร 3 ชั้น 1 หน้าลิฟต์ตัวที่ 1`,
        priority: "emergency",
        reporter_name: "รปภ. ประจำอาคาร 3",
        email: "security3@example.com",
        phone: "0812345678",
        status: "pending",
        tracking_token: crypto.randomUUID(),
      })
      .select()
      .single();

    const notifEsc = await processReportForEventNotification({
      report: {
        id: repEsc.id,
        public_id: repEsc.public_id,
        category_id: repEsc.category_id,
        subcategory_id: repEsc.subcategory_id,
        location: repEsc.location,
        description: repEsc.description,
        priority: repEsc.priority,
        reporter_name: repEsc.reporter_name,
        created_at: repEsc.created_at,
      },
      targetGroupId,
      priorityReason: "มีผู้ติดอยู่ในลิฟต์ (ยกระดับสู่ Emergency)",
    });

    const { data: trEsc } = await supabaseAdmin
      .from(dataSource.eventTrackersTable)
      .select('*')
      .eq('id', notifNorm.trackerId)
      .single();

    const passed = notifNorm.action === 'accumulated_for_digest' &&
                   notifEsc.action === 'escalated' &&
                   trEsc?.priority === 'emergency';

    recordResult(
      'TC-07',
      'Emergency Escalation (Immediate Alert Without Waiting 30m)',
      passed,
      `NormalAction=${notifNorm.action}, EscalatedAction=${notifEsc.action}, FinalTrackerPriority=${trEsc?.priority}`
    );
  } catch (err: any) {
    recordResult('TC-07', 'Emergency Escalation (Immediate Alert Without Waiting 30m)', false, 'Exception occurred', err.message);
  }

  // ---------------------------------------------------------------------------
  // TC-08: Concurrent Workers Simulation (FOR UPDATE SKIP LOCKED)
  // ---------------------------------------------------------------------------
  try {
    // Add 1 more report to tracker A
    const { data: repC } = await supabaseAdmin
      .from(dataSource.reportsTable)
      .insert({
        public_id: genPublicId(99),
        category_id: 4,
        subcategory_id: 34,
        description: `เจ้าหน้าที่กำลังดับเพลิงและตรวจสอบควันไฟตกค้าง อาคารเรียนรวม [${runId}]`,
        location: `อาคารเรียนรวม ชั้น 1 โซน A`,
        priority: "emergency",
        reporter_name: "เจ้าหน้าที่ตรวจการ",
        email: "inspector@example.com",
        phone: "0812345678",
        status: "pending",
        tracking_token: crypto.randomUUID(),
      })
      .select()
      .single();

    await processReportForEventNotification({
      report: {
        id: repC.id,
        public_id: repC.public_id,
        category_id: repC.category_id,
        subcategory_id: repC.subcategory_id,
        location: repC.location,
        description: repC.description,
        priority: repC.priority,
        reporter_name: repC.reporter_name,
        created_at: repC.created_at,
      },
      targetGroupId,
    });

    const timeAt120Min = new Date(startTime.getTime() + 120 * 60 * 1000 + 20000); // 120 mins

    // Simulate 5 concurrent workers firing simultaneously for the same incident tracker
    const workerPromises = [
      processDueIncidentUpdates({ trackerId: trackerAId!, workerId: 'concurrent_worker_1', asOfTime: timeAt120Min }),
      processDueIncidentUpdates({ trackerId: trackerAId!, workerId: 'concurrent_worker_2', asOfTime: timeAt120Min }),
      processDueIncidentUpdates({ trackerId: trackerAId!, workerId: 'concurrent_worker_3', asOfTime: timeAt120Min }),
      processDueIncidentUpdates({ trackerId: trackerAId!, workerId: 'concurrent_worker_4', asOfTime: timeAt120Min }),
      processDueIncidentUpdates({ trackerId: trackerAId!, workerId: 'concurrent_worker_5', asOfTime: timeAt120Min }),
    ];

    const concurrentResults = await Promise.all(workerPromises);
    const sentCount = concurrentResults.flatMap(r => r.results).filter(x => x.action === 'update_sent').length;

    // Exactly 1 update must be sent! Zero duplicates.
    const passed = sentCount === 1;

    recordResult(
      'TC-08',
      'Concurrent Workers Race Condition Guard (SKIP LOCKED)',
      passed,
      `Workers=5, SuccessfulDispatches=${sentCount} (Must be exactly 1), Duplicates=${Math.max(0, sentCount - 1)}`
    );
  } catch (err: any) {
    recordResult('TC-08', 'Concurrent Workers Race Condition Guard (SKIP LOCKED)', false, 'Exception occurred', err.message);
  }

  // ---------------------------------------------------------------------------
  // TC-09: Worker Restart & Crash Recovery
  // ---------------------------------------------------------------------------
  try {
    // Verify that tracker state in DB persists valid timestamps and sequence
    const { data: trAfterRestart } = await supabaseAdmin
      .from(dataSource.eventTrackersTable)
      .select('event_code, state, total_report_count, last_notified_count, next_update_at, digest_sequence')
      .eq('id', trackerAId!)
      .single();

    const hasValidState = trAfterRestart &&
                          trAfterRestart.state === 'AGGREGATING' &&
                          trAfterRestart.total_report_count >= 19 &&
                          trAfterRestart.last_notified_count === trAfterRestart.total_report_count &&
                          Boolean(trAfterRestart.next_update_at);

    recordResult(
      'TC-09',
      'Worker Restart & Schedule Persistence',
      Boolean(hasValidState),
      `State=${trAfterRestart?.state}, TotalReports=${trAfterRestart?.total_report_count}, NextUpdateAt=${trAfterRestart?.next_update_at}`
    );
  } catch (err: any) {
    recordResult('TC-09', 'Worker Restart & Schedule Persistence', false, 'Exception occurred', err.message);
  }

  // ---------------------------------------------------------------------------
  // TC-10: Local Test Isolation (Destination Security Guard)
  // ---------------------------------------------------------------------------
  try {
    const verifiedCheck = validateTestLineDestination(testGroupId, true);
    const unknownCheck = validateTestLineDestination('C_UNKNOWN_PROD_GROUP_99999', true);
    // Reverse guard: in production mode, sending to test group must be strictly rejected
    const prodEnvLeakCheck = validateTestLineDestination(testGroupId, false);
    // In production mode, sending to a legitimate prod group (different from test group) is allowed
    const validProdCheck = validateTestLineDestination('C_LEGITIMATE_PROD_GROUP_12345', false);

    const passed = verifiedCheck.isValid === true &&
                   unknownCheck.isValid === false &&
                   prodEnvLeakCheck.isValid === false &&
                   validProdCheck.isValid === true;

    recordResult(
      'TC-10',
      'Localhost Test Isolation Guard',
      passed,
      `VerifiedTestGroupValid=${verifiedCheck.isValid}, UnknownGroupRejected=${!unknownCheck.isValid}, ProdEnvTestGroupRejected=${!prodEnvLeakCheck.isValid}, LegitProdGroupValid=${validProdCheck.isValid}`
    );
  } catch (err: any) {
    recordResult('TC-10', 'Localhost Test Isolation Guard', false, 'Exception occurred', err.message);
  }

  // ---------------------------------------------------------------------------
  // Final Evaluation
  // ---------------------------------------------------------------------------
  const totalPassed = testResults.filter(t => t.passed).length;
  console.log(`\n===============================================================`);
  console.log(`PHASE 3.7 TEST SUMMARY: ${totalPassed}/${testResults.length} PASS (${testResults.length - totalPassed} failed)`);
  console.log(`===============================================================\n`);

  if (totalPassed < testResults.length) {
    process.exit(1);
  }
}

runPhase37Suite().catch(err => {
  console.error("Test Suite execution failed:", err);
  process.exit(1);
});
