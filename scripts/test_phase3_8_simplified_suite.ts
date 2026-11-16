/**
 * PHASE 3.8 — SIMPLIFY LINE NOTIFICATION TO 2 TYPES ONLY TEST SUITE
 * 
 * Verifies:
 * 1. Only 2 active notification types: 'normal_alert' and 'periodic_update'.
 * 2. New Report 1 -> Immediate 'normal_alert' Flex Message.
 * 3. Normal alert contains NO related counts, NO cumulative counts, and NO update text.
 * 4. Additional reports in same incident cluster -> Suppressed immediately (no LINE sent).
 * 5. At 30 minutes with new reports -> 'periodic_update' Flex Message dispatched with total and delta.
 * 6. At 30 minutes with 0 new reports -> Window extended, NO LINE sent.
 * 7. Another distinct incident -> Independent 'normal_alert' Flex Message.
 * 8. Priority escalation in existing tracker updates DB but sends NO escalation LINE.
 * 9. 15-minute Normal Digest is disabled and sends NO LINE.
 * 10. URL Safety: No 'localhost' URLs in LINE action button.
 * 11. Security Isolation: Only verified TEST LINE group allowed on Localhost.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

process.env.REPORT_DATA_SOURCE = 'test';
process.env.NEXT_PUBLIC_REPORT_DATA_SOURCE = 'test';
process.env.LINE_NOTIFICATIONS_ENABLED = 'true';
process.env.LINE_NEW_REPORT_NOTIFICATIONS_ENABLED = 'true';

import { supabaseAdmin } from '../src/lib/supabase-admin';
import { getReportDataSource } from '../src/lib/dataSource';
import { processReportForEventNotification } from '../src/lib/eventNotificationService';
import { processDueEventUpdates, processDueNormalDigests } from '../src/lib/eventUpdateScheduler';
import { validateTestLineDestination, isLineEventAllowed, resolvePublicActionUrl } from '../src/lib/line';

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
  error?: string;
}

const testResults: TestResult[] = [];

function recordResult(id: string, name: string, passed: boolean, details: string, error?: string) {
  testResults.push({ id, name, passed, details, error });
  const icon = passed ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`${icon} ${id}: ${name}`);
  console.log(`       Details: ${details}`);
  if (error) {
    console.log(`       Error: ${error}`);
  }
}

async function runPhase38Suite() {
  const dataSource = getReportDataSource();
  const testGroupId = process.env.LINE_TEST_GROUP_ID;

  console.log(`\n===============================================================`);
  console.log(`PHASE 3.8 INTEGRATION TEST SUITE (Run ID: P38-${Date.now()})`);
  console.log(`Destination: ${testGroupId ? testGroupId.slice(0, 4) + '...' + testGroupId.slice(-4) : 'MISSING'}`);
  console.log(`Target Tables: ${dataSource.reportsTable}, ${dataSource.eventTrackersTable}`);
  console.log(`===============================================================\n`);

  if (!testGroupId) {
    console.error("CRITICAL: LINE_TEST_GROUP_ID is missing from environment. Aborting.");
    process.exit(1);
  }

  // Cleanup old test data
  await supabaseAdmin
    .from(dataSource.eventOutboxTable)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin
    .from(dataSource.eventReportsTable)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin
    .from(dataSource.eventTrackersTable)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  const runId = Math.floor(1000 + Math.random() * 9000);

  // ---------------------------------------------------------------------------
  // TC-01: New Report 1 -> Immediate Normal Alert (Flex Message)
  // ---------------------------------------------------------------------------
  let trackerAId: string | null = null;
  let trackerAEventCode: string | null = null;
  let report1PublicId: string | null = null;

  try {
    const { data: rep1, error: r1Err } = await supabaseAdmin
      .from(dataSource.reportsTable)
      .insert({
        public_id: `SOC-T-38-${runId}-001`,
        category_id: 2,
        subcategory_id: 4,
        description: `[P38 Fire Test] เกิดเหตุเพลิงไหม้ที่ห้องไฟฟ้า อาคาร 5 ชั้น 2 มีกลุ่มควันหนาแน่น`,
        location: `อาคาร 5 ชั้น 2`,
        priority: 'emergency',
        reporter_name: 'อาจารย์เวรประจำอาคาร 5',
        email: 'staff1@example.com',
        phone: '0812340001',
        status: 'pending',
        tracking_token: crypto.randomUUID(),
      })
      .select()
      .single();

    if (r1Err || !rep1) throw new Error(`Report 1 creation failed: ${r1Err?.message}`);
    report1PublicId = rep1.public_id;

    const notif1 = await processReportForEventNotification({
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
      targetGroupId: testGroupId,
      priorityReason: 'เพลิงไหม้กลุ่มควันหนาแน่น',
    });

    trackerAId = notif1.trackerId;
    trackerAEventCode = notif1.eventCode;

    const passed = notif1.action === 'normal_alert_sent' &&
                   Boolean(notif1.notifyResult?.success) &&
                   Boolean(notif1.outboxId);

    recordResult(
      'TC-01',
      'New Report Triggers Immediate Normal Alert (Flex Message)',
      passed,
      `Action=${notif1.action}, Tracker=${notif1.eventCode}, NotifySuccess=${notif1.notifyResult?.success}`
    );
  } catch (err: any) {
    recordResult('TC-01', 'New Report Triggers Immediate Normal Alert', false, 'Exception occurred', err.message);
  }

  // ---------------------------------------------------------------------------
  // TC-02: Normal Alert Constraint Verification (NO Related Counts Rendered)
  // ---------------------------------------------------------------------------
  try {
    const { data: outboxItem } = await supabaseAdmin
      .from(dataSource.eventOutboxTable)
      .select('*')
      .eq('tracker_id', trackerAId!)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    const payload = outboxItem?.payload as any;
    const hasNoTotalReportCount = payload?.totalReportCount === undefined;
    const hasNoNewReportCount = payload?.newReportCount === undefined;
    const isNormalAlert = payload?.notificationType === 'normal_alert';

    const passed = Boolean(outboxItem && hasNoTotalReportCount && hasNoNewReportCount && isNormalAlert);

    recordResult(
      'TC-02',
      'Normal Alert Payload Conformance (Zero Related/Cumulative Count)',
      passed,
      `notificationType=${payload?.notificationType}, totalReportCount=${payload?.totalReportCount ?? 'None'}, newReportCount=${payload?.newReportCount ?? 'None'}`
    );
  } catch (err: any) {
    recordResult('TC-02', 'Normal Alert Payload Conformance', false, 'Exception occurred', err.message);
  }

  // ---------------------------------------------------------------------------
  // TC-03: Additional Reports in Same Event -> Suppressed Immediately (No LINE)
  // ---------------------------------------------------------------------------
  try {
    let allSuppressed = true;
    for (let i = 2; i <= 6; i++) {
      const { data: repDup } = await supabaseAdmin
        .from(dataSource.reportsTable)
        .insert({
          public_id: `SOC-T-38-${runId}-00${i}`,
          category_id: 2,
          subcategory_id: 4,
          description: `[P38 Fire Duplicate #${i}] ได้กลิ่นควันไหม้รุนแรง อาคาร 5 ชั้น 2`,
          location: `อาคาร 5 ชั้น 2`,
          priority: 'emergency',
          reporter_name: `ผู้แจ้งคนที่ ${i}`,
          email: `staff${i}@example.com`,
          phone: `081234000${i}`,
          status: 'pending',
          tracking_token: crypto.randomUUID(),
        })
        .select()
        .single();

      const notifDup = await processReportForEventNotification({
        report: {
          id: repDup.id,
          public_id: repDup.public_id,
          category_id: repDup.category_id,
          subcategory_id: repDup.subcategory_id,
          location: repDup.location,
          description: repDup.description,
          priority: repDup.priority,
          reporter_name: repDup.reporter_name,
          created_at: repDup.created_at,
        },
        targetGroupId: testGroupId,
      });

      if (notifDup.action !== 'suppressed_duplicate' && notifDup.action !== 'suppressed_duplicate_emergency') {
        allSuppressed = false;
      }
    }

    const { data: trAfterDups } = await supabaseAdmin
      .from(dataSource.eventTrackersTable)
      .select('total_report_count, last_notified_count')
      .eq('id', trackerAId!)
      .single();

    const passed = allSuppressed && trAfterDups?.total_report_count === 6 && trAfterDups?.last_notified_count === 1;

    recordResult(
      'TC-03',
      'Additional Reports in Same Event Suppressed Without Immediate LINE Call',
      passed,
      `AllSuppressed=${allSuppressed}, TotalReportCount=${trAfterDups?.total_report_count}, LastNotifiedCount=${trAfterDups?.last_notified_count}`
    );
  } catch (err: any) {
    recordResult('TC-03', 'Additional Reports Suppression', false, 'Exception occurred', err.message);
  }

  // ---------------------------------------------------------------------------
  // TC-04: At 30 Minutes with New Reports -> Periodic Update Flex Message
  // ---------------------------------------------------------------------------
  try {
    // Fast forward tracker A timer to simulate 30 minutes elapsed
    const pastTime = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from(dataSource.eventTrackersTable)
      .update({
        next_update_at: pastTime,
        window_expires_at: pastTime,
      })
      .eq('id', trackerAId!);

    const schedulerRes = await processDueEventUpdates({
      trackerId: trackerAId!,
      asOfTime: new Date(),
    });

    const updateItem = schedulerRes.results.find(r => r.trackerId === trackerAId!);
    const passed = updateItem?.action === 'update_sent' &&
                   updateItem?.totalReportCount === 6 &&
                   updateItem?.newReportCount === 5;

    recordResult(
      'TC-04',
      'Periodic Update Alert at 30 Minutes with Accumulated New Reports',
      Boolean(passed),
      `Action=${updateItem?.action}, TotalReports=${updateItem?.totalReportCount}, Delta=+${updateItem?.newReportCount}`
    );
  } catch (err: any) {
    recordResult('TC-04', 'Periodic Update Alert at 30 Minutes', false, 'Exception occurred', err.message);
  }

  // ---------------------------------------------------------------------------
  // TC-05: At 30 Minutes with Zero New Reports -> NO LINE Sent
  // ---------------------------------------------------------------------------
  try {
    // Fast forward timer again without adding any new reports
    const pastTime2 = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from(dataSource.eventTrackersTable)
      .update({
        next_update_at: pastTime2,
        window_expires_at: pastTime2,
      })
      .eq('id', trackerAId!);

    const emptyWindowRes = await processDueEventUpdates({
      trackerId: trackerAId!,
      asOfTime: new Date(),
    });

    const emptyItem = emptyWindowRes.results.find(r => r.trackerId === trackerAId!);
    const passed = emptyItem?.action === 'window_extended_no_reports' &&
                   emptyItem?.newReportCount === 0;

    recordResult(
      'TC-05',
      'Zero New Reports at 30 Minutes -> Window Extended Without LINE Send',
      Boolean(passed),
      `Action=${emptyItem?.action}, NewReports=${emptyItem?.newReportCount}`
    );
  } catch (err: any) {
    recordResult('TC-05', 'Zero New Reports Window Extension', false, 'Exception occurred', err.message);
  }

  // ---------------------------------------------------------------------------
  // TC-06: Distinct Event -> Independent Normal Alert
  // ---------------------------------------------------------------------------
  let trackerBId: string | null = null;
  try {
    const { data: repB } = await supabaseAdmin
      .from(dataSource.reportsTable)
      .insert({
        public_id: `SOC-T-38-${runId}-050`,
        category_id: 3,
        subcategory_id: 5,
        description: `[P38 Distinct Incident] ลิฟต์อาคารกีฬา ชั้น 1 ประตูเปิดปิดติดขัด มีเสียงดัง`,
        location: `อาคารกีฬา ชั้น 1`,
        priority: 'normal',
        reporter_name: 'เจ้าหน้าที่ศูนย์กีฬา',
        email: 'sports@example.com',
        phone: '0812349999',
        status: 'pending',
        tracking_token: crypto.randomUUID(),
      })
      .select()
      .single();

    const notifB = await processReportForEventNotification({
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
      targetGroupId: testGroupId,
    });

    trackerBId = notifB.trackerId;
    const passed = notifB.action === 'normal_alert_sent' &&
                   Boolean(notifB.notifyResult?.success) &&
                   notifB.trackerId !== trackerAId;

    recordResult(
      'TC-06',
      'Distinct New Incident Creates Independent Tracker & Dispatches Normal Alert',
      passed,
      `Action=${notifB.action}, TrackerB=${notifB.eventCode}, DistinctFromA=${notifB.trackerId !== trackerAId}`
    );
  } catch (err: any) {
    recordResult('TC-06', 'Distinct Incident Isolation', false, 'Exception occurred', err.message);
  }

  // ---------------------------------------------------------------------------
  // TC-07: Emergency Report to Normal Tracker (Priority updated in DB, ZERO Escalation LINE sent)
  // ---------------------------------------------------------------------------
  try {
    const { data: repEsc } = await supabaseAdmin
      .from(dataSource.reportsTable)
      .insert({
        public_id: `SOC-T-38-${runId}-051`,
        category_id: 3,
        subcategory_id: 5,
        description: `[P38 Escalation Attempt] ลิฟต์อาคารกีฬา ชั้น 1 ค้างกะทันหัน มีคนติดอยู่ข้างใน หายใจไม่ออก`,
        location: `อาคารกีฬา ชั้น 1`,
        priority: 'emergency',
        reporter_name: 'ช่างเทคนิคอาคารกีฬา',
        email: 'sports_tech@example.com',
        phone: '0812348888',
        status: 'pending',
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
      targetGroupId: testGroupId,
    });

    const { data: trBCheck } = await supabaseAdmin
      .from(dataSource.eventTrackersTable)
      .select('priority, total_report_count')
      .eq('id', trackerBId!)
      .single();

    const { count: escOutboxCount } = await supabaseAdmin
      .from(dataSource.eventOutboxTable)
      .select('*', { count: 'exact', head: true })
      .eq('tracker_id', trackerBId!)
      .eq('notification_type', 'escalation_alert');

    const passed = notifEsc.action === 'suppressed_duplicate' &&
                   trBCheck?.priority === 'emergency' &&
                   trBCheck?.total_report_count === 2 &&
                   (escOutboxCount === null || escOutboxCount === 0);

    recordResult(
      'TC-07',
      'Emergency Report in Normal Incident (Priority Updated in DB, ZERO Escalation LINE Alert)',
      passed,
      `Action=${notifEsc.action}, UpdatedPriority=${trBCheck?.priority}, TotalReports=${trBCheck?.total_report_count}, EscalationLineCount=${escOutboxCount || 0}`
    );
  } catch (err: any) {
    recordResult('TC-07', 'Emergency Escalation Suppression Check', false, 'Exception occurred', err.message);
  }

  // ---------------------------------------------------------------------------
  // TC-08: Deprecated Notification Types Disabled (No Escalation / No 15m Digest)
  // ---------------------------------------------------------------------------
  try {
    const escPolicy = isLineEventAllowed('escalation_alert');
    const digestPolicy = isLineEventAllowed('digest');
    const normalAlertPolicy = isLineEventAllowed('normal_alert');
    const periodicUpdatePolicy = isLineEventAllowed('periodic_update');

    // Also call processDueNormalDigests to verify it does not dispatch LINE
    const digestWorkerRes = await processDueNormalDigests({ trackerId: trackerBId! });

    const passed = escPolicy.allowed === false &&
                   digestPolicy.allowed === false &&
                   normalAlertPolicy.allowed === true &&
                   periodicUpdatePolicy.allowed === true &&
                   digestWorkerRes.processedCount === 0;

    recordResult(
      'TC-08',
      'Deprecated Notification Types Strictly Disabled (Escalation & 15m Digest)',
      passed,
      `EscalationAllowed=${escPolicy.allowed}, DigestAllowed=${digestPolicy.allowed}, NormalAlertAllowed=${normalAlertPolicy.allowed}, PeriodicUpdateAllowed=${periodicUpdatePolicy.allowed}`
    );
  } catch (err: any) {
    recordResult('TC-08', 'Deprecated Notification Types Check', false, 'Exception occurred', err.message);
  }

  // ---------------------------------------------------------------------------
  // TC-09: Action URL Sanity Guard (Never Send Localhost to LINE)
  // ---------------------------------------------------------------------------
  try {
    const localhostUrl = resolvePublicActionUrl('http://localhost:3000/report/SOC-1234');
    const localhostIncidents = resolvePublicActionUrl('http://localhost:3000/backoffice/incidents');
    const defaultUrl = resolvePublicActionUrl(null, '/report/SOC-TEST');

    const passed = !localhostUrl.includes('localhost') &&
                   !localhostIncidents.includes('localhost') &&
                   !defaultUrl.includes('localhost') &&
                   localhostUrl.startsWith('https://supportsoc.vercel.app');

    recordResult(
      'TC-09',
      'Action URL Sanity Guard (Strictly No Localhost in LINE URI)',
      passed,
      `ResolvedReportUrl=${localhostUrl}, ResolvedIncidentsUrl=${localhostIncidents}`
    );
  } catch (err: any) {
    recordResult('TC-09', 'Action URL Sanity Guard', false, 'Exception occurred', err.message);
  }

  // ---------------------------------------------------------------------------
  // TC-10: Localhost Destination Security Isolation
  // ---------------------------------------------------------------------------
  try {
    const verifiedCheck = validateTestLineDestination(testGroupId, true);
    const unverifiedCheck = validateTestLineDestination('C_UNKNOWN_PROD_GROUP', true);
    const prodEnvTestLeakCheck = validateTestLineDestination(testGroupId, false);

    const passed = verifiedCheck.isValid === true &&
                   unverifiedCheck.isValid === false &&
                   prodEnvTestLeakCheck.isValid === false;

    recordResult(
      'TC-10',
      'Destination Security Guard (Strict Test Group Isolation)',
      passed,
      `VerifiedTestGroupValid=${verifiedCheck.isValid}, UnknownRejected=${!unverifiedCheck.isValid}, ProdEnvTestGroupRejected=${!prodEnvTestLeakCheck.isValid}`
    );
  } catch (err: any) {
    recordResult('TC-10', 'Destination Security Guard', false, 'Exception occurred', err.message);
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  const totalPassed = testResults.filter(t => t.passed).length;
  console.log(`\n===============================================================`);
  console.log(`PHASE 3.8 TEST SUMMARY: ${totalPassed}/${testResults.length} PASS (${testResults.length - totalPassed} failed)`);
  console.log(`===============================================================\n`);

  if (totalPassed < testResults.length) {
    process.exit(1);
  }
}

runPhase38Suite().catch(err => {
  console.error("Test Suite execution failed:", err);
  process.exit(1);
});
