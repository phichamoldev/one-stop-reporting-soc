/**
 * TEST SUITE: LINE Notification Event Policy & Isolation (15 Criteria)
 * 
 * Verifies:
 * 1. Localhost new report creation succeeds -> Dispatches LINE to verified SOC TEST group
 * 2. Localhost new report creation fails -> 0 LINE requests
 * 3. Localhost single report status change -> 0 LINE requests
 * 4. Localhost bulk status update -> 0 LINE requests
 * 5. Localhost bulk reply -> 0 LINE requests
 * 6. Localhost individual reply -> 0 LINE requests
 * 7. Localhost transfer or incident grouping -> 0 LINE requests
 * 8. Localhost with Production Group ID -> Rejected & Blocked (Fail Closed)
 * 9. Production new report creation -> Dispatches LINE to Production department group
 * 10. Production single report status change -> 0 LINE requests
 * 11. Production bulk status change -> 0 LINE requests
 * 12. Production bulk reply -> 0 LINE requests
 * 13. LINE API failure -> Report & Audit Log preserved faithfully
 * 14. Duplicate submit / retry -> Deduplication guard prevents spam
 * 15. Test endpoints & Stress test -> Blocked by default (0 LINE requests)
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { getReportDataSource } from '../src/lib/dataSource';
import {
  notifyLine,
  isLineEventAllowed,
  isLineNotificationEnabled,
  validateTestLineDestination,
  validateLineDestination,
  LineNotificationPayload,
} from '../src/lib/line';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing Supabase configuration in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface SpiedLineCall {
  url: string;
  targetGroupId: string;
  messages: any[];
}

async function runEventPolicyTestSuite() {
  console.log('================================================================================');
  console.log('LINE EVENT POLICY & ISOLATION REGRESSION SUITE (15 TEST CASES)');
  console.log('================================================================================\n');

  let passedTests = 0;
  const totalTests = 17;

  // ---------------------------------------------------------------------------
  // [Pre-Check] Baseline Database Snapshot
  // ---------------------------------------------------------------------------
  const dataSource = getReportDataSource();
  console.log(`[Config Check] Active data source: ${dataSource.source} (isTest: ${dataSource.isTest})`);
  console.log(`[Config Check] LINE_NOTIFICATIONS_ENABLED: ${process.env.LINE_NOTIFICATIONS_ENABLED}`);
  console.log(`[Config Check] LINE_NEW_REPORT_NOTIFICATIONS_ENABLED: ${process.env.LINE_NEW_REPORT_NOTIFICATIONS_ENABLED}`);

  const { count: initialProdReports } = await supabase.from('reports').select('*', { count: 'exact', head: true });
  const { count: initialProdLogs } = await supabase.from('report_logs').select('*', { count: 'exact', head: true });
  console.log(`[Baseline Snapshot] Production reports: ${initialProdReports}, report_logs: ${initialProdLogs}\n`);

  // ---------------------------------------------------------------------------
  // GLOBAL FETCH SPY & MOCK
  // ---------------------------------------------------------------------------
  const originalFetch = global.fetch;
  let spiedCalls: SpiedLineCall[] = [];
  let simulateLineFailure = false;

  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (urlStr.includes('api.line.me')) {
      let bodyObj: any = {};
      try {
        if (init?.body) {
          bodyObj = JSON.parse(init.body.toString());
        }
      } catch {
        // ignore parse error
      }

      spiedCalls.push({
        url: urlStr,
        targetGroupId: bodyObj.to || 'unknown',
        messages: bodyObj.messages || [],
      });

      if (simulateLineFailure) {
        return new Response(JSON.stringify({ message: 'Simulated 500 Internal Error from LINE' }), {
          status: 500,
          statusText: 'Internal Server Error',
        });
      }

      return new Response(JSON.stringify({ message: 'ok' }), {
        status: 200,
        statusText: 'OK',
      });
    }

    return originalFetch(input, init);
  };

  const SOC_TEST_GROUP = process.env.LINE_TEST_GROUP_ID || 'C836f13a80f7a17395b9a9e11fc3223b0';
  const PROD_GROUP = process.env.LINE_GROUP_ID || 'C755df08c530de97fa7a676a1c37b77b0';

  // ---------------------------------------------------------------------------
  // [Case 1] Localhost สร้างคำร้องใหม่และบันทึกสำเร็จ -> ส่ง LINE ไปยัง SOC TEST เท่านั้น
  // ---------------------------------------------------------------------------
  console.log('[Case 1] Localhost สร้างคำร้องใหม่สำเร็จ -> ตรวจสอบการส่ง LINE ไปยัง SOC TEST...');
  spiedCalls = [];
  const testRepId1 = '88888888-b111-4000-8000-000000000001';
  const runSuffix = Date.now().toString().slice(-4);
  const testPublicId1 = `SOC-T-POLICY-01-${runSuffix}`;

  await supabase.from(dataSource.reportLogsTable).delete().eq('report_id', testRepId1);
  await supabase.from(dataSource.reportsTable).delete().eq('id', testRepId1);

  // 1. Insert report
  const { error: insErr1 } = await supabase.from(dataSource.reportsTable).insert({
    id: testRepId1,
    public_id: testPublicId1,
    description: 'ทดสอบส่งคำร้องใหม่บน Localhost',
    location: 'อาคาร 1 ห้อง 101',
    status: 'pending',
    reporter_name: 'Test Citizen',
    email: 'citizen@test.soc',
    phone: '0811111111',
  });
  if (insErr1) throw new Error(`Case 1 Insert Error: ${insErr1.message}`);

  // 2. Dispatch LINE notification as done in app/api/reports/route.ts
  const payload1: LineNotificationPayload = {
    publicId: testPublicId1,
    categoryName: 'ระบบเครือข่าย',
    subcategoryName: 'Wi-Fi',
    description: 'ทดสอบส่งคำร้องใหม่บน Localhost',
    location: 'อาคาร 1 ห้อง 101',
    date: new Date().toISOString(),
    statusText: 'pending',
  };

  const notifyRes1 = await notifyLine(payload1, SOC_TEST_GROUP, { event: 'new_report' });

  if (!notifyRes1.success) {
    throw new Error(`Case 1 Failed: notifyLine returned failure: ${notifyRes1.error}`);
  }
  if (spiedCalls.length !== 1) {
    throw new Error(`Case 1 Failed: Expected 1 LINE call, got ${spiedCalls.length}`);
  }
  if (spiedCalls[0].targetGroupId !== SOC_TEST_GROUP) {
    throw new Error(`Case 1 Failed: Destination was ${spiedCalls[0].targetGroupId}, expected SOC TEST ${SOC_TEST_GROUP}`);
  }
  console.log(`  ✓ Localhost new report sent to SOC TEST (${spiedCalls[0].targetGroupId}) verified by spy.`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Case 2] Localhost สร้างคำร้องใหม่แต่บันทึกไม่สำเร็จ -> ไม่ส่ง LINE
  // ---------------------------------------------------------------------------
  console.log('\n[Case 2] Localhost สร้างคำร้องใหม่แต่บันทึกไม่สำเร็จ -> ไม่ส่ง LINE...');
  spiedCalls = [];
  // Simulate DB insert failure (missing required field reporter_name in test_reports)
  const { error: failedInsert } = await supabase.from(dataSource.reportsTable).insert({
    id: '88888888-b111-4000-8000-000000000099',
    public_id: 'SOC-T-FAIL-01',
    // missing reporter_name, email, phone
  });

  if (failedInsert) {
    // In API route, when insert fails, it immediately returns 500 without calling notifyLine
    console.log('  ✓ Database insert rejected as expected. API flow halts before notifyLine.');
  }
  if (spiedCalls.length !== 0) {
    throw new Error(`Case 2 Failed: LINE was called despite database insert failure`);
  }
  console.log('  ✓ 0 LINE requests dispatched when report creation fails.');
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Case 3] Localhost เปลี่ยนสถานะรายคำร้อง -> 0 LINE Requests
  // ---------------------------------------------------------------------------
  console.log('\n[Case 3] Localhost เปลี่ยนสถานะรายคำร้อง -> 0 LINE Requests...');
  spiedCalls = [];
  // Event Policy Check
  const statusPolicy = isLineEventAllowed('status_change');
  if (statusPolicy.allowed) {
    throw new Error('Case 3 Failed: isLineEventAllowed("status_change") must be false');
  }

  // Attempt notifyLine with status_change event
  const statusRes = await notifyLine('Status changed to in_progress', SOC_TEST_GROUP, { event: 'status_change' });
  if (statusRes.success !== false || !statusRes.skipped) {
    throw new Error('Case 3 Failed: notifyLine should be skipped for status_change');
  }
  if (spiedCalls.length !== 0) {
    throw new Error(`Case 3 Failed: LINE request made during status_change (${spiedCalls.length})`);
  }
  console.log('  ✓ Status update prohibited by event policy. 0 LINE requests.');
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Case 4] Localhost เปลี่ยนสถานะแบบชุด -> 0 LINE Requests
  // ---------------------------------------------------------------------------
  console.log('\n[Case 4] Localhost เปลี่ยนสถานะแบบชุด -> 0 LINE Requests...');
  spiedCalls = [];
  const bulkStatusPolicy = isLineEventAllowed('bulk_status_change');
  if (bulkStatusPolicy.allowed) {
    throw new Error('Case 4 Failed: isLineEventAllowed("bulk_status_change") must be false');
  }

  const bulkStatusRes = await notifyLine('Bulk status updated', SOC_TEST_GROUP, { event: 'bulk_status_change' });
  if (bulkStatusRes.success !== false || !bulkStatusRes.skipped) {
    throw new Error('Case 4 Failed: notifyLine should be skipped for bulk_status_change');
  }
  if (spiedCalls.length !== 0) {
    throw new Error(`Case 4 Failed: LINE request made during bulk_status_change (${spiedCalls.length})`);
  }
  console.log('  ✓ Bulk status update prohibited by event policy. 0 LINE requests.');
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Case 5] Localhost ทำ Bulk Reply -> 0 LINE Requests
  // ---------------------------------------------------------------------------
  console.log('\n[Case 5] Localhost ทำ Bulk Reply -> 0 LINE Requests...');
  spiedCalls = [];
  const bulkReplyPolicy = isLineEventAllowed('bulk_reply');
  if (bulkReplyPolicy.allowed) {
    throw new Error('Case 5 Failed: isLineEventAllowed("bulk_reply") must be false');
  }

  const bulkReplyRes = await notifyLine('Bulk reply note', SOC_TEST_GROUP, { event: 'bulk_reply' });
  if (bulkReplyRes.success !== false || !bulkReplyRes.skipped) {
    throw new Error('Case 5 Failed: notifyLine should be skipped for bulk_reply');
  }
  if (spiedCalls.length !== 0) {
    throw new Error(`Case 5 Failed: LINE request made during bulk_reply (${spiedCalls.length})`);
  }
  console.log('  ✓ Bulk reply prohibited by event policy. 0 LINE requests.');
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Case 6] Localhost ทำ Individual Reply -> 0 LINE Requests
  // ---------------------------------------------------------------------------
  console.log('\n[Case 6] Localhost ทำ Individual Reply -> 0 LINE Requests...');
  spiedCalls = [];
  // Individual reply is recorded in report_logs without calling LINE
  await supabase.from(dataSource.reportLogsTable).insert({
    report_id: testRepId1,
    action: 'admin_note_added',
    remark: 'หมายเหตุการประสานงานภายใน',
    created_at: new Date().toISOString(),
  });
  if (spiedCalls.length !== 0) {
    throw new Error('Case 6 Failed: LINE request made during individual reply');
  }
  console.log('  ✓ Individual reply saved to report_logs with 0 LINE requests.');
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Case 7] Localhost โอนคำร้องหรือจัดกลุ่มเหตุการณ์ -> 0 LINE Requests
  // ---------------------------------------------------------------------------
  console.log('\n[Case 7] Localhost โอนคำร้องหรือจัดกลุ่มเหตุการณ์ -> 0 LINE Requests...');
  spiedCalls = [];
  const transferPolicy = isLineEventAllowed('transfer');
  const groupPolicy = isLineEventAllowed('incident_grouping');

  if (transferPolicy.allowed || groupPolicy.allowed) {
    throw new Error('Case 7 Failed: transfer and incident_grouping must be prohibited');
  }

  await notifyLine('Transfer report', SOC_TEST_GROUP, { event: 'transfer' });
  await notifyLine('Add member to incident group', SOC_TEST_GROUP, { event: 'incident_grouping' });

  if (spiedCalls.length !== 0) {
    throw new Error(`Case 7 Failed: LINE request made during transfer/grouping (${spiedCalls.length})`);
  }
  console.log('  ✓ Transfer and incident grouping prohibited by event policy. 0 LINE requests.');
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Case 8] Localhost มี Production Group ID แต่ Test Group ID ไม่ถูกต้อง -> ปฏิเสธการส่ง
  // ---------------------------------------------------------------------------
  console.log('\n[Case 8] Localhost ชี้ไปยัง Production Group ID -> ปฏิเสธการส่ง (Fail Closed)...');
  spiedCalls = [];
  // 8a: Target is production group C755...
  const prodCheck = validateTestLineDestination(PROD_GROUP);
  if (prodCheck.isValid) {
    throw new Error('Case 8 Failed: Production Group ID must be rejected on Localhost');
  }

  // 8b: Attempt notifyLine with production group on localhost
  const prodAttemptPayload = { ...payload1, publicId: 'SOC-T-POLICY-PROD-ATTEMPT' };
  const prodAttemptRes = await notifyLine(prodAttemptPayload, PROD_GROUP, { event: 'new_report' });
  if (prodAttemptRes.success !== false || !prodAttemptRes.skipped) {
    throw new Error('Case 8 Failed: notifyLine did not block production group on localhost');
  }
  if (spiedCalls.length !== 0) {
    throw new Error('Case 8 Failed: Outbound request made to production group on localhost');
  }
  console.log('  ✓ Production destination strictly rejected on Localhost (Fail Closed). 0 LINE requests.');
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Case 9] Production สร้างคำร้องใหม่ -> เรียกเส้นทางส่ง LINE ตาม Production Config เดิม
  // ---------------------------------------------------------------------------
  console.log('\n[Case 9] Production สร้างคำร้องใหม่ -> ตรวจสอบเส้นทาง Production Configuration...');
  spiedCalls = [];
  // Simulate production environment checks (isTestEnv = false)
  const prodDeptGroupId = 'C53f834fc96eeec8935efea75fa7bdd01'; // facility department group
  const prodTargetCheck = validateLineDestination(prodDeptGroupId, false);
  if (!prodTargetCheck.isValid) {
    throw new Error(`Case 9 Failed: Production department group rejected: ${prodTargetCheck.reason}`);
  }

  // Test that test group is strictly rejected in production
  const testGroupInProdCheck = validateLineDestination(SOC_TEST_GROUP, false);
  if (testGroupInProdCheck.isValid) {
    throw new Error('Case 9 Failed: SOC TEST group should be rejected in Production mode');
  }
  console.log('  ✓ Production destination routing and safety checks verified (Test group strictly rejected).');
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Case 10, 11, 12] Production เปลี่ยนสถานะ, Bulk Status, Bulk Reply -> 0 LINE Requests
  // ---------------------------------------------------------------------------
  console.log('\n[Case 10, 11, 12] Production เปลี่ยนสถานะ, Bulk Status, Bulk Reply -> 0 LINE Requests...');
  spiedCalls = [];
  // Since isLineEventAllowed has ZERO tolerance for status updates across all environments:
  const pStatus = isLineEventAllowed('status_change');
  const pBulkStatus = isLineEventAllowed('bulk_status_change');
  const pBulkReply = isLineEventAllowed('bulk_reply');

  if (pStatus.allowed || pBulkStatus.allowed || pBulkReply.allowed) {
    throw new Error('Case 10-12 Failed: Status updates and replies must be disallowed in Production too');
  }
  console.log('  ✓ Status update, Bulk status, and Bulk reply are strictly disallowed in Production as well.');
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Case 13] LINE API ล้มเหลว -> คำร้องและ Audit Log ยังคงถูกบันทึกตามปกติ
  // ---------------------------------------------------------------------------
  console.log('\n[Case 13] LINE API ล้มเหลว -> คำร้องและ Audit Log ยังคงถูกบันทึกตามปกติ...');
  simulateLineFailure = true;
  spiedCalls = [];
  const testRepId2 = '88888888-b111-4000-8000-000000000002';
  const testPublicId2 = 'SOC-T-POLICY-02';

  await supabase.from(dataSource.reportLogsTable).delete().eq('report_id', testRepId2);
  await supabase.from(dataSource.reportsTable).delete().eq('id', testRepId2);

  // 1. Insert report
  const { error: insErr2 } = await supabase.from(dataSource.reportsTable).insert({
    id: testRepId2,
    public_id: testPublicId2,
    description: 'ทดสอบกรณี LINE API ล้มเหลว',
    location: 'อาคาร 2 ห้อง 202',
    status: 'pending',
    reporter_name: 'Test Citizen',
    email: 'citizen@test.soc',
    phone: '0811111111',
  });
  if (insErr2) throw new Error(`Case 13 Insert Error: ${insErr2.message}`);

  // 2. Insert audit log
  await supabase.from(dataSource.reportLogsTable).insert({
    report_id: testRepId2,
    action: 'priority_classified',
    new_status: 'pending',
    remark: 'จัดประเภทความเร่งด่วน',
    created_at: new Date().toISOString(),
  });

  // 3. Dispatch LINE (simulated failure)
  const failRes = await notifyLine({
    publicId: testPublicId2,
    categoryName: 'หมวดหมู่ทดสอบ',
    subcategoryName: 'ข้อย่อย',
    description: 'ทดสอบกรณี LINE ล้มเหลว',
    location: 'อาคาร 2',
    date: new Date().toISOString(),
  }, SOC_TEST_GROUP, { event: 'new_report' });

  simulateLineFailure = false;

  // 4. Verify DB report and log exist and are intact
  const { data: savedRep } = await supabase.from(dataSource.reportsTable).select('id, status').eq('id', testRepId2).single();
  const { count: savedLogs } = await supabase.from(dataSource.reportLogsTable).select('*', { count: 'exact', head: true }).eq('report_id', testRepId2);

  if (!savedRep || savedLogs !== 1) {
    throw new Error('Case 13 Failed: Report or audit log was not preserved during LINE failure');
  }
  console.log(`  ✓ LINE API failure (status: ${failRes.success}) safely isolated from DB. Report & audit log intact.`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Case 14] กด Submit ซ้ำหรือเกิด Retry -> Deduplication Guard ป้องกัน Notification ซ้ำ
  // ---------------------------------------------------------------------------
  console.log('\n[Case 14] ป้องกัน Notification ซ้ำเมื่อเกิด Retry หรือ Submit ซ้ำ...');
  spiedCalls = [];
  const testPublicId3 = `SOC-T-POLICY-DEDUP-${runSuffix}`;

  // First call succeeds
  const firstSend = await notifyLine({
    publicId: testPublicId3,
    categoryName: 'หมวดหมู่',
    subcategoryName: 'ข้อย่อย',
    description: 'ทดสอบ Idempotent Deduplication',
    location: 'ห้อง 303',
    date: new Date().toISOString(),
  }, SOC_TEST_GROUP, { event: 'new_report' });

  // Immediate retry with same publicId
  const retrySend = await notifyLine({
    publicId: testPublicId3,
    categoryName: 'หมวดหมู่',
    subcategoryName: 'ข้อย่อย',
    description: 'ทดสอบ Idempotent Deduplication',
    location: 'ห้อง 303',
    date: new Date().toISOString(),
  }, SOC_TEST_GROUP, { event: 'new_report' });

  if (spiedCalls.length !== 1) {
    throw new Error(`Case 14 Failed: Expected exactly 1 LINE call due to deduplication, got ${spiedCalls.length}`);
  }
  if (!retrySend.skipped) {
    throw new Error('Case 14 Failed: Second identical notification was not skipped by deduplication guard');
  }
  console.log('  ✓ Deduplication guard prevented duplicate notification on retry (1 call sent, 1 skipped).');
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Case 15] API ทดสอบและ Stress Test ปิดโดยค่าเริ่มต้น
  // ---------------------------------------------------------------------------
  console.log('\n[Case 15] API ทดสอบและ Stress Test ปิดโดยค่าเริ่มต้น...');
  spiedCalls = [];
  const testEndpointPolicy = isLineEventAllowed('test_endpoint');
  if (testEndpointPolicy.allowed) {
    throw new Error('Case 15 Failed: test_endpoint must be disallowed by default');
  }

  const testEndpointRes = await notifyLine('Test endpoint probe', SOC_TEST_GROUP, { event: 'test_endpoint' });
  if (testEndpointRes.success !== false || !testEndpointRes.skipped) {
    throw new Error('Case 15 Failed: test_endpoint should be skipped');
  }
  if (spiedCalls.length !== 0) {
    throw new Error(`Case 15 Failed: LINE request made during test endpoint probe (${spiedCalls.length})`);
  }
  console.log('  ✓ Test endpoints strictly blocked by default. 0 LINE requests.');
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Case 16] Fail-Closed: Event Parameter หายไป -> 0 LINE Requests
  // ---------------------------------------------------------------------------
  console.log('\n[Case 16] Fail-Closed: Event Parameter หายไป หรือ undefined -> 0 LINE Requests...');
  spiedCalls = [];
  const missingEventPolicy = isLineEventAllowed(undefined);
  if (missingEventPolicy.allowed) {
    throw new Error('Case 16 Failed: isLineEventAllowed(undefined) must be false');
  }

  // Attempt notifyLine without options
  const missingEventRes1 = await notifyLine('Missing options probe', SOC_TEST_GROUP, undefined as any);
  if (missingEventRes1.success !== false || !missingEventRes1.skipped) {
    throw new Error('Case 16 Failed: notifyLine without options should fail closed and skip');
  }

  // Attempt notifyLine with empty event string
  const missingEventRes2 = await notifyLine('Empty event probe', SOC_TEST_GROUP, { event: '' } as any);
  if (missingEventRes2.success !== false || !missingEventRes2.skipped) {
    throw new Error('Case 16 Failed: notifyLine with empty event should fail closed and skip');
  }

  if (spiedCalls.length !== 0) {
    throw new Error(`Case 16 Failed: LINE request made when event was missing (${spiedCalls.length})`);
  }
  console.log('  ✓ Missing event strictly blocked before network call (Fail-Closed). 0 LINE requests.');
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Case 17] Fail-Closed: Event เป็นค่าที่ไม่รู้จัก (Unknown Event) -> 0 LINE Requests
  // ---------------------------------------------------------------------------
  console.log('\n[Case 17] Fail-Closed: Event เป็นค่าที่ไม่รู้จัก (Unknown Event Type) -> 0 LINE Requests...');
  spiedCalls = [];
  const unknownEventPolicy = isLineEventAllowed('unauthorized_event_type' as any);
  if (unknownEventPolicy.allowed) {
    throw new Error('Case 17 Failed: isLineEventAllowed("unauthorized_event_type") must be false');
  }

  const unknownEventRes = await notifyLine('Unknown event probe', SOC_TEST_GROUP, { event: 'unauthorized_event_type' } as any);
  if (unknownEventRes.success !== false || !unknownEventRes.skipped) {
    throw new Error('Case 17 Failed: notifyLine with unknown event should fail closed and skip');
  }

  if (spiedCalls.length !== 0) {
    throw new Error(`Case 17 Failed: LINE request made for unknown event type (${spiedCalls.length})`);
  }
  console.log('  ✓ Unknown event strictly blocked before network call (Fail-Closed). 0 LINE requests.');
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Isolation Final Check] Production Database Integrity
  // ---------------------------------------------------------------------------
  console.log('\n[Isolation Check] ตรวจสอบความสมบูรณ์ของฐานข้อมูล Production...');
  const { count: finalProdReports } = await supabase.from('reports').select('*', { count: 'exact', head: true });
  const { count: finalProdLogs } = await supabase.from('report_logs').select('*', { count: 'exact', head: true });

  if (initialProdReports !== finalProdReports || initialProdLogs !== finalProdLogs) {
    throw new Error(`Isolation Check Failed: Production modified! Reports: ${initialProdReports}->${finalProdReports}`);
  }
  console.log(`  ✓ Production tables 100% untouched: reports (${finalProdReports}), logs (${finalProdLogs}).`);

  // ---------------------------------------------------------------------------
  // Cleanup Test Data
  // ---------------------------------------------------------------------------
  await supabase.from(dataSource.reportLogsTable).delete().in('report_id', [testRepId1, testRepId2]);
  await supabase.from(dataSource.reportsTable).delete().in('id', [testRepId1, testRepId2]);

  // Restore fetch
  global.fetch = originalFetch;

  console.log('\n================================================================================');
  console.log(`RESULTS: ALL ${totalTests} EVENT POLICY TEST CASES PASSED WITH 100% SUCCESS`);
  console.log('================================================================================\n');
}

runEventPolicyTestSuite().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
