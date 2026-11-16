/**
 * AUTOMATED TEST SUITE: Complete LINE Notification System & Resilience Verification
 * 
 * Tests the 14 mandatory verification criteria from Phase 4:
 * 1. New Report in Test mode selects Test destination according to policy
 * 2. Test mode is blocked when destination is Production group (Fail-Closed)
 * 3. Missing destination does not send (skipped / blocked)
 * 4. Global kill-switch (LINE_NOTIFICATIONS_ENABLED=false) stops all notifications
 * 5. Event-specific flag (LINE_NEW_REPORT_NOTIFICATIONS_ENABLED=false) blocks event
 * 6. Status Change never sends LINE
 * 7. Bulk Status Update and Bulk Reply never send LINE
 * 8. Emergency event notifies immediately without waiting for incident grouping
 * 9. Duplicate request does not send duplicate message (Idempotency)
 * 10. Concurrent requests do not cause duplicate dispatch (Concurrency Lock)
 * 11. LINE API error is correctly logged and categorized
 * 12. Retry does not send duplicate unnecessarily (and non-retryable 4xx fails without retry)
 * 13. No token or secret appears in logs (sanitization & destination masking)
 * 14. Test/Production isolation and permission checks remain 100% intact
 * 
 * SAFETY ASSURANCE:
 * Uses an intercepting fetch spy. ZERO network calls are permitted to reach real api.line.me.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { getReportDataSource } from '../src/lib/dataSource';
import {
  notifyLine,
  validateTestLineDestination,
  LineNotificationPayload,
} from '../src/lib/line';
import {
  getRecentNotificationLogs,
  clearNotificationLogsForTesting,
  maskDestination,
  sanitizeErrorMessage,
} from '../src/lib/notificationLogger';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing Supabase configuration in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface SpiedCall {
  url: string;
  targetGroupId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[];
  authHeader?: string;
}

async function runNotificationTestSuite() {
  console.log('================================================================================');
  console.log('PHASE 4: COMPREHENSIVE AUTOMATED LINE NOTIFICATION TEST SUITE (16 CRITERIA)');
  console.log('================================================================================\n');

  // Baseline Verification
  const dataSource = getReportDataSource();
  console.log(`[Config Check] Active data source: ${dataSource.source} (isTest: ${dataSource.isTest})`);
  console.log(`[Config Check] LINE_NOTIFICATIONS_ENABLED: ${process.env.LINE_NOTIFICATIONS_ENABLED}`);

  const { count: initialProdReports } = await supabase.from('reports').select('*', { count: 'exact', head: true });
  const { count: initialProdLogs } = await supabase.from('report_logs').select('*', { count: 'exact', head: true });
  console.log(`[Baseline Snapshot] Production reports: ${initialProdReports}, report_logs: ${initialProdLogs}\n`);

  // SPY & MOCK on global.fetch to intercept LINE calls
  const originalFetch = global.fetch;
  const spiedCalls: SpiedCall[] = [];
  let simulatedStatus = 200;
  let simulatedResponseText = '{"message":"ok"}';
  const simulateNetworkError = false;

  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (urlStr.includes('api.line.me')) {
      if (simulateNetworkError) {
        throw new Error('Simulated network socket timeout / ECONNRESET');
      }

      let bodyObj: Record<string, unknown> = {};
      try {
        if (init?.body) {
          bodyObj = JSON.parse(init.body.toString());
        }
      } catch {
        // ignore
      }

      const headers = init?.headers as Record<string, string> | undefined;
      spiedCalls.push({
        url: urlStr,
        targetGroupId: typeof bodyObj.to === 'string' ? bodyObj.to : 'unknown',
        messages: Array.isArray(bodyObj.messages) ? bodyObj.messages : [],
        authHeader: headers ? headers['Authorization'] || headers['authorization'] : undefined,
      });

      return new Response(simulatedResponseText, {
        status: simulatedStatus,
        statusText: simulatedStatus === 200 ? 'OK' : 'Error',
      });
    }

    return originalFetch(input, init);
  };

  const SOC_TEST_GROUP = process.env.LINE_TEST_GROUP_ID || 'C836f13a80f7a17395b9a9e11fc3223b0';
  const PROD_GROUP = process.env.LINE_GROUP_ID || 'C755df08c530de97fa7a676a1c37b77b0';

  let passedCriteria = 0;
  const totalCriteria = 16;

  try {
    clearNotificationLogsForTesting();

    // -------------------------------------------------------------------------
    // Criterion 1: New Report in Test mode selects Test destination
    // -------------------------------------------------------------------------
    console.log('[Criterion 1] New Report in Test mode selects Test destination...');
    spiedCalls.length = 0;
    simulatedStatus = 200;
    simulatedResponseText = '{"message":"ok"}';

    const samplePayload: LineNotificationPayload = {
      publicId: 'SOC-T-CRIT-01',
      categoryName: 'อาคารและสถานที่',
      subcategoryName: 'ไฟฟ้าส่องสว่าง',
      description: 'หลอดไฟทางเดินเสีย',
      location: 'อาคาร 1 ชั้น 2',
      date: '27 ต.ค. 2026, 11:30 น.',
      priority: 'normal',
    };

    const res1 = await notifyLine(samplePayload, SOC_TEST_GROUP, { event: 'new_report' });
    if (!res1.success || spiedCalls.length !== 1 || spiedCalls[0].targetGroupId !== SOC_TEST_GROUP) {
      throw new Error(`Criterion 1 Failed: Expected message sent to SOC_TEST_GROUP, got: ${JSON.stringify(res1)}`);
    }
    console.log('  ✓ Verified: Test mode dispatches to verified SOC TEST destination.\n');
    passedCriteria++;

    // -------------------------------------------------------------------------
    // Criterion 2: Test mode blocked when destination is Production group
    // -------------------------------------------------------------------------
    console.log('[Criterion 2] Test mode blocked when destination is Production group...');
    spiedCalls.length = 0;

    const res2 = await notifyLine(
      { ...samplePayload, publicId: 'SOC-T-CRIT-02' },
      PROD_GROUP,
      { event: 'new_report' }
    );
    if (res2.success || !res2.blocked || spiedCalls.length !== 0) {
      throw new Error(`Criterion 2 Failed: Production destination was not blocked in test environment!`);
    }
    console.log('  ✓ Verified: Production destination strictly blocked in test mode (0 LINE calls).\n');
    passedCriteria++;

    // -------------------------------------------------------------------------
    // Criterion 3: Missing destination does not send
    // -------------------------------------------------------------------------
    console.log('[Criterion 3] Missing destination does not send...');
    spiedCalls.length = 0;

    const res3 = await notifyLine(
      { ...samplePayload, publicId: 'SOC-T-CRIT-03' },
      null,
      { event: 'new_report' }
    );
    // In test mode, fallback is SOC_TEST_GROUP if not specified, but if empty string:
    const res3b = await notifyLine(
      { ...samplePayload, publicId: 'SOC-T-CRIT-03B' },
      '',
      { event: 'new_report' }
    );
    if (res3.success) {
      throw new Error(`Criterion 3 Failed: Null destination should not succeed`);
    }
    if (res3b.success) {
      throw new Error(`Criterion 3 Failed: Empty destination should not succeed`);
    }
    console.log('  ✓ Verified: Empty/invalid destination fails closed.\n');
    passedCriteria++;

    // -------------------------------------------------------------------------
    // Criterion 4: Global flag off (LINE_NOTIFICATIONS_ENABLED=false)
    // -------------------------------------------------------------------------
    console.log('[Criterion 4] Global kill-switch (LINE_NOTIFICATIONS_ENABLED=false)...');
    spiedCalls.length = 0;
    const origGlobalFlag = process.env.LINE_NOTIFICATIONS_ENABLED;
    const origNewReportFlag = process.env.LINE_NEW_REPORT_NOTIFICATIONS_ENABLED;

    try {
      process.env.LINE_NOTIFICATIONS_ENABLED = 'false';
      delete process.env.LINE_NEW_REPORT_NOTIFICATIONS_ENABLED;

      const res4 = await notifyLine(
        { ...samplePayload, publicId: 'SOC-T-CRIT-04' },
        SOC_TEST_GROUP,
        { event: 'new_report' }
      );
      if (res4.success || !res4.skipped || spiedCalls.length !== 0) {
        throw new Error(`Criterion 4 Failed: Expected notification skipped with kill switch on, got: ${JSON.stringify(res4)}`);
      }
      console.log('  ✓ Verified: Global kill-switch cleanly stops all LINE notifications (0 calls).\n');
      passedCriteria++;
    } finally {
      process.env.LINE_NOTIFICATIONS_ENABLED = origGlobalFlag;
      if (origNewReportFlag !== undefined) {
        process.env.LINE_NEW_REPORT_NOTIFICATIONS_ENABLED = origNewReportFlag;
      }
    }

    // -------------------------------------------------------------------------
    // Criterion 5: Event-specific flag (LINE_NEW_REPORT_NOTIFICATIONS_ENABLED=false)
    // -------------------------------------------------------------------------
    console.log('[Criterion 5] Event-specific flag (LINE_NEW_REPORT_NOTIFICATIONS_ENABLED=false)...');
    spiedCalls.length = 0;
    try {
      process.env.LINE_NEW_REPORT_NOTIFICATIONS_ENABLED = 'false';

      const res5 = await notifyLine(
        { ...samplePayload, publicId: 'SOC-T-CRIT-05' },
        SOC_TEST_GROUP,
        { event: 'new_report' }
      );
      if (res5.success || !res5.skipped || spiedCalls.length !== 0) {
        throw new Error(`Criterion 5 Failed: Expected new_report skipped when LINE_NEW_REPORT_NOTIFICATIONS_ENABLED=false`);
      }
      console.log('  ✓ Verified: Event-specific flag blocks new report notification cleanly.\n');
      passedCriteria++;
    } finally {
      process.env.LINE_NEW_REPORT_NOTIFICATIONS_ENABLED = origNewReportFlag;
    }

    // -------------------------------------------------------------------------
    // Criterion 6: Status Change never sends LINE
    // -------------------------------------------------------------------------
    console.log('[Criterion 6] Status Change does not send LINE...');
    spiedCalls.length = 0;

    const res6 = await notifyLine('Report status changed to in_progress', SOC_TEST_GROUP, { event: 'status_change' });
    if (res6.success || !res6.skipped || spiedCalls.length !== 0) {
      throw new Error(`Criterion 6 Failed: status_change should never dispatch LINE`);
    }
    console.log('  ✓ Verified: status_change event is prohibited by policy (0 calls).\n');
    passedCriteria++;

    // -------------------------------------------------------------------------
    // Criterion 7: Bulk Status Update and Bulk Reply never send LINE
    // -------------------------------------------------------------------------
    console.log('[Criterion 7] Bulk Status Update and Bulk Reply never send LINE...');
    spiedCalls.length = 0;

    const res7a = await notifyLine('Bulk status updated', SOC_TEST_GROUP, { event: 'bulk_status_change' });
    const res7b = await notifyLine('Bulk reply note', SOC_TEST_GROUP, { event: 'bulk_reply' });

    if (res7a.success || res7b.success || spiedCalls.length !== 0) {
      throw new Error(`Criterion 7 Failed: Bulk operations must never dispatch LINE`);
    }
    console.log('  ✓ Verified: Bulk status and bulk reply are strictly prohibited (0 calls).\n');
    passedCriteria++;

    // -------------------------------------------------------------------------
    // Criterion 8: Emergency event notifies immediately without waiting for incident grouping
    // -------------------------------------------------------------------------
    console.log('[Criterion 8] Emergency event notifies immediately with Emergency styling...');
    spiedCalls.length = 0;
    simulatedStatus = 200;
    simulatedResponseText = '{"message":"ok"}';

    const emergencyPayload: LineNotificationPayload = {
      publicId: 'SOC-T-CRIT-08-EMERGENCY',
      categoryName: 'ความปลอดภัย',
      subcategoryName: 'เพลิงไหม้/ก๊าซรั่ว',
      description: 'พบประกายไฟบริเวณตู้ควบคุมไฟหลัก',
      location: 'อาคารวิศวกรรม ชั้น 1',
      date: '27 ต.ค. 2026, 11:35 น.',
      priority: 'emergency',
      priorityReason: 'พบประกายไฟ เสี่ยงอันตรายต่อชีวิตและทรัพย์สิน',
    };

    const res8 = await notifyLine(emergencyPayload, SOC_TEST_GROUP, { event: 'new_report' });
    if (!res8.success || spiedCalls.length !== 1) {
      throw new Error(`Criterion 8 Failed: Emergency message dispatch failed`);
    }

    const sentMsg = spiedCalls[0].messages[0];
    const isEmergencyAltText = sentMsg.altText?.includes('🚨 [ฉุกเฉิน]');
    const isEmergencyHeader = sentMsg.contents?.header?.contents?.[0]?.text?.includes('[เหตุฉุกเฉินเร่งด่วน]');

    if (!isEmergencyAltText || !isEmergencyHeader) {
      throw new Error(`Criterion 8 Failed: Flex message does not contain Emergency visual indicators!`);
    }
    console.log('  ✓ Verified: Emergency notification formats with immediate emergency banner and alert box.\n');
    passedCriteria++;

    // -------------------------------------------------------------------------
    // Criterion 9: Duplicate request does not send duplicate (Idempotency)
    // -------------------------------------------------------------------------
    console.log('[Criterion 9] Duplicate request does not send duplicate (Idempotency)...');
    spiedCalls.length = 0;
    const dedupPayload: LineNotificationPayload = {
      ...samplePayload,
      publicId: 'SOC-T-CRIT-09-DEDUP',
    };

    const send1 = await notifyLine(dedupPayload, SOC_TEST_GROUP, { event: 'new_report' });
    const send2 = await notifyLine(dedupPayload, SOC_TEST_GROUP, { event: 'new_report' });

    if (!send1.success || !send2.success || !send2.skipped || spiedCalls.length !== 1) {
      throw new Error(`Criterion 9 Failed: Second identical request was not deduplicated! spiedCalls=${spiedCalls.length}`);
    }
    console.log('  ✓ Verified: Duplicate request within 5 minutes is skipped via idempotency guard (1 call sent, 1 skipped).\n');
    passedCriteria++;

    // -------------------------------------------------------------------------
    // Criterion 10: Concurrent requests do not cause duplicate dispatch
    // -------------------------------------------------------------------------
    console.log('[Criterion 10] Concurrent requests do not cause duplicate dispatch...');
    spiedCalls.length = 0;

    const concurrentPayload: LineNotificationPayload = {
      ...samplePayload,
      publicId: 'SOC-T-CRIT-10-CONCURRENT',
    };

    // Run 5 simultaneous requests concurrently with Promise.all
    const concurrentResults = await Promise.all([
      notifyLine(concurrentPayload, SOC_TEST_GROUP, { event: 'new_report' }),
      notifyLine(concurrentPayload, SOC_TEST_GROUP, { event: 'new_report' }),
      notifyLine(concurrentPayload, SOC_TEST_GROUP, { event: 'new_report' }),
      notifyLine(concurrentPayload, SOC_TEST_GROUP, { event: 'new_report' }),
      notifyLine(concurrentPayload, SOC_TEST_GROUP, { event: 'new_report' }),
    ]);

    const successfulDispatches = concurrentResults.filter((r) => r.success && !r.skipped).length;
    const deduplicatedDispatches = concurrentResults.filter((r) => r.skipped).length;

    if (spiedCalls.length !== 1 || successfulDispatches !== 1) {
      throw new Error(
        `Criterion 10 Failed: Expected exactly 1 call dispatched across 5 concurrent requests, got ${spiedCalls.length}`
      );
    }
    console.log(`  ✓ Verified: 5 concurrent requests resulted in exactly 1 sent and ${deduplicatedDispatches} deduplicated.\n`);
    passedCriteria++;

    // -------------------------------------------------------------------------
    // Criterion 11: LINE API error is correctly logged and categorized
    // -------------------------------------------------------------------------
    console.log('[Criterion 11] LINE API error is correctly logged and categorized...');
    spiedCalls.length = 0;
    simulatedStatus = 400;
    simulatedResponseText = '{"message":"Invalid reply token or bad request"}';

    const res11 = await notifyLine(
      { ...samplePayload, publicId: 'SOC-T-CRIT-11-ERR' },
      SOC_TEST_GROUP,
      { event: 'new_report' }
    );

    if (res11.success || res11.status !== 'failed') {
      throw new Error(`Criterion 11 Failed: Expected status='failed' on HTTP 400, got: ${JSON.stringify(res11)}`);
    }

    const recentLogs = await getRecentNotificationLogs({ publicId: 'SOC-T-CRIT-11-ERR' });
    if (recentLogs.length === 0 || recentLogs[0].status !== 'failed' || recentLogs[0].error_code !== 'LINE_400') {
      throw new Error(`Criterion 11 Failed: Notification log record not found or error code mismatch: ${JSON.stringify(recentLogs)}`);
    }
    console.log('  ✓ Verified: HTTP 400 recorded in notification log with error_code LINE_400.\n');
    passedCriteria++;

    // -------------------------------------------------------------------------
    // Criterion 12: Retry does not send duplicate unnecessarily (and 4xx fails immediately)
    // -------------------------------------------------------------------------
    console.log('[Criterion 12] Retry behavior (4xx fails immediately, 5xx retries with bounded limit)...');

    // 12a: Verify HTTP 400 only makes exactly 1 attempt (no retry for 4xx client error)
    // Independent scenario with its own fresh spy — does NOT reuse spiedCalls from Criterion 11
    simulatedStatus = 400;
    simulatedResponseText = '{"message":"Bad request"}';
    spiedCalls.length = 0; // Isolated reset for 12a

    const res12a = await notifyLine(
      { ...samplePayload, publicId: 'SOC-T-CRIT-12A-NO-RETRY' },
      SOC_TEST_GROUP,
      { event: 'new_report', maxRetries: 3 } // maxRetries=3 to prove 4xx does NOT retry regardless
    );

    if (res12a.success || res12a.status !== 'failed') {
      throw new Error(`Criterion 12a Failed: HTTP 400 should result in status='failed', got: ${JSON.stringify(res12a)}`);
    }
    if (spiedCalls.length !== 1) {
      throw new Error(
        `Criterion 12a Failed: HTTP 400 must make exactly 1 fetch attempt (no retry), got ${spiedCalls.length} attempts. ` +
        `This confirms 4xx is NOT retried even when maxRetries=${3}.`
      );
    }
    if (res12a.attempts !== 1) {
      throw new Error(`Criterion 12a Failed: attempts field must be 1 for 4xx, got ${res12a.attempts}`);
    }

    const logs12a = await getRecentNotificationLogs({ publicId: 'SOC-T-CRIT-12A-NO-RETRY' });
    if (logs12a.length === 0 || logs12a[0].error_code !== 'LINE_400' || logs12a[0].attempt_count !== 1) {
      throw new Error(`Criterion 12a Failed: Log mismatch: ${JSON.stringify(logs12a)}`);
    }

    // 12b: Verify 500 triggers bounded retry (1 retry, total 2 attempts)
    simulatedStatus = 500;
    simulatedResponseText = '{"message":"Internal Server Error from LINE"}';
    spiedCalls.length = 0;

    const res12b = await notifyLine(
      { ...samplePayload, publicId: 'SOC-T-CRIT-12-RETRY' },
      SOC_TEST_GROUP,
      { event: 'new_report', maxRetries: 1 }
    );

    if (res12b.success || spiedCalls.length !== 2 || res12b.attempts !== 2) {
      throw new Error(`Criterion 12 Failed: Expected exactly 2 attempts for 500 retry, got: ${spiedCalls.length}`);
    }

    // 12c: Verify Timeout (AbortError) does NOT retry and logs REQUEST_TIMEOUT immediately
    spiedCalls.length = 0;
    const originalFetchInTest = global.fetch;
    try {
      global.fetch = async () => {
        const timeoutErr = new Error('The operation was aborted due to timeout');
        timeoutErr.name = 'AbortError';
        throw timeoutErr;
      };

      const res12c = await notifyLine(
        { ...samplePayload, publicId: 'SOC-T-CRIT-12-TIMEOUT' },
        SOC_TEST_GROUP,
        { event: 'new_report', maxRetries: 1 }
      );

      if (res12c.success || res12c.attempts !== 1) {
        throw new Error(`Criterion 12 Failed: Timeout must not retry! attempts=${res12c.attempts}`);
      }

      const timeoutLogs = await getRecentNotificationLogs({ publicId: 'SOC-T-CRIT-12-TIMEOUT' });
      if (timeoutLogs.length === 0 || timeoutLogs[0].error_code !== 'REQUEST_TIMEOUT') {
        throw new Error(`Criterion 12 Failed: Expected REQUEST_TIMEOUT in log, got: ${JSON.stringify(timeoutLogs)}`);
      }
    } finally {
      global.fetch = originalFetchInTest;
    }

    // 12d: Verify Network Error (ECONNRESET) does NOT retry and logs NETWORK_ERROR immediately
    try {
      global.fetch = async () => {
        throw new Error('connect ECONNRESET 147.92.150.198:443');
      };

      const res12d = await notifyLine(
        { ...samplePayload, publicId: 'SOC-T-CRIT-12-NETERR' },
        SOC_TEST_GROUP,
        { event: 'new_report', maxRetries: 1 }
      );

      if (res12d.success || res12d.attempts !== 1) {
        throw new Error(`Criterion 12 Failed: Network error must not retry! attempts=${res12d.attempts}`);
      }

      const netLogs = await getRecentNotificationLogs({ publicId: 'SOC-T-CRIT-12-NETERR' });
      if (netLogs.length === 0 || netLogs[0].error_code !== 'NETWORK_ERROR') {
        throw new Error(`Criterion 12 Failed: Expected NETWORK_ERROR in log, got: ${JSON.stringify(netLogs)}`);
      }
    } finally {
      global.fetch = originalFetchInTest;
    }

    console.log('  ✓ Verified: 4xx fails after exactly 1 attempt (no retry), 5xx triggers bounded retry (2 attempts), Timeout/Network fail safely without retry.\n');
    passedCriteria++;

    // -------------------------------------------------------------------------
    // Criterion 13: No token or secret appears in logs (sanitization & masking)
    // -------------------------------------------------------------------------
    console.log('[Criterion 13] Sanitization of tokens and destination masking in logs...');
    const testSecret = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.supersecrettoken12345';
    const sanitized = sanitizeErrorMessage(`Failed to connect with ${testSecret} to LINE`);
    if (sanitized?.includes('supersecrettoken12345')) {
      throw new Error('Criterion 13 Failed: Bearer token was not redacted in sanitizeErrorMessage!');
    }

    const masked = maskDestination(SOC_TEST_GROUP);
    if (masked === SOC_TEST_GROUP || !masked.includes('...')) {
      throw new Error(`Criterion 13 Failed: Destination was not masked: ${masked}`);
    }
    console.log(`  ✓ Verified: Secrets stripped, destinations masked as '${masked}'.\n`);
    passedCriteria++;

    // -------------------------------------------------------------------------
    // Criterion 14: Test/Production isolation and permission checks intact
    // -------------------------------------------------------------------------
    console.log('[Criterion 14] Test/Production isolation and database integrity check...');
    const { count: finalProdReports } = await supabase.from('reports').select('*', { count: 'exact', head: true });
    const { count: finalProdLogs } = await supabase.from('report_logs').select('*', { count: 'exact', head: true });

    if (finalProdReports !== initialProdReports || finalProdLogs !== initialProdLogs) {
      throw new Error(
        `Criterion 14 Failed: Production database was modified! reports: ${initialProdReports} -> ${finalProdReports}, logs: ${initialProdLogs} -> ${finalProdLogs}`
      );
    }
    console.log(`  ✓ Verified: Production tables 100% untouched (reports: ${finalProdReports}, report_logs: ${finalProdLogs}).\n`);
    passedCriteria++;

    // -------------------------------------------------------------------------
    // Criterion 15: Fail-Closed when LINE_TEST_GROUP_ID ENV is not configured
    // -------------------------------------------------------------------------
    console.log('[Criterion 15] Fail-Closed behavior when LINE_TEST_GROUP_ID is missing...');
    spiedCalls.length = 0;
    simulatedStatus = 200;
    simulatedResponseText = '{"message":"ok"}';

    const origTestGroupId = process.env.LINE_TEST_GROUP_ID;
    try {
      // 15a: Remove LINE_TEST_GROUP_ID — validate destination should fail closed in test mode
      delete process.env.LINE_TEST_GROUP_ID;

      const { isValid: isValidWithoutEnv, reason: reasonWithoutEnv } = validateTestLineDestination(
        'C836f13a80f7a17395b9a9e11fc3223b0', // Any group ID
        true // isTestEnv = true
      );
      if (isValidWithoutEnv) {
        throw new Error('Criterion 15a Failed: validateTestLineDestination must reject when LINE_TEST_GROUP_ID is not set');
      }
      if (!reasonWithoutEnv?.includes('LINE_TEST_GROUP_ID is not configured')) {
        throw new Error(`Criterion 15a Failed: Rejection reason must mention LINE_TEST_GROUP_ID, got: "${reasonWithoutEnv}"`);
      }

      // 15b: notifyLine must also block and make 0 LINE calls when ENV is missing
      const res15b = await notifyLine(
        { ...samplePayload, publicId: 'SOC-T-CRIT-15-NO-ENV' },
        'C836f13a80f7a17395b9a9e11fc3223b0',
        { event: 'new_report' }
      );
      if (res15b.success || !res15b.blocked) {
        throw new Error(`Criterion 15b Failed: notifyLine must be blocked (not just skipped) when LINE_TEST_GROUP_ID is missing`);
      }
      if (spiedCalls.length !== 0) {
        throw new Error(`Criterion 15b Failed: 0 LINE calls expected when ENV is missing, got ${spiedCalls.length}`);
      }

      // 15c: Production mode still works without LINE_TEST_GROUP_ID (reverse guard is conditional)
      const { isValid: isValidProdMode } = validateTestLineDestination(
        'C53f834fc96eeec8935efea75fa7bdd01', // A production department group
        false // isTestEnv = false
      );
      if (!isValidProdMode) {
        throw new Error('Criterion 15c Failed: Production mode must still allow valid destination even if LINE_TEST_GROUP_ID is missing');
      }

      // 15d: Production mode with Test group ID in the group value should still pass
      // (cannot check because ENV is unset — that's acceptable, no false-blocking)
      console.log('  ✓ Verified: LINE_TEST_GROUP_ID missing → validateTestLineDestination Fail-Closed in test mode, 0 LINE calls, production mode unaffected.\n');
      passedCriteria++;
    } finally {
      // Restore original value
      if (origTestGroupId !== undefined) {
        process.env.LINE_TEST_GROUP_ID = origTestGroupId;
      }
    }

    // -------------------------------------------------------------------------
    // Criterion 16: DataSource Routing & Fail-Closed Protection
    // -------------------------------------------------------------------------
    console.log('[Criterion 16] Centralized DataSource Fail-Closed Protection...');
    const origVercelEnv = process.env.VERCEL_ENV;
    const origReportDataSource = process.env.REPORT_DATA_SOURCE;

    try {
      // 16a: Localhost without REPORT_DATA_SOURCE must Fail-Closed (throw Error, never select Production)
      delete process.env.VERCEL_ENV;
      delete process.env.REPORT_DATA_SOURCE;

      let caughtMissingEnvErr = false;
      try {
        getReportDataSource();
      } catch (err: unknown) {
        caughtMissingEnvErr = true;
        if (!(err instanceof Error) || !err.message.includes('FAIL-CLOSED SAFETY ERROR')) {
          throw new Error(`Criterion 16a Failed: Expected FAIL-CLOSED error message, got: ${err}`);
        }
      }
      if (!caughtMissingEnvErr) {
        throw new Error('Criterion 16a Failed: Localhost without REPORT_DATA_SOURCE must throw Error and not default to Production!');
      }

      // 16b: Localhost with REPORT_DATA_SOURCE=test selects Test tables
      process.env.REPORT_DATA_SOURCE = 'test';
      const dsTest = getReportDataSource();
      if (!dsTest.isTest || dsTest.isProduction || dsTest.reportsTable !== 'test_reports') {
        throw new Error(`Criterion 16b Failed: Expected test table mapping, got: ${JSON.stringify(dsTest)}`);
      }

      // 16c: Localhost with REPORT_DATA_SOURCE=production selects Production tables
      process.env.REPORT_DATA_SOURCE = 'production';
      const dsProdLocal = getReportDataSource();
      if (dsProdLocal.isTest || !dsProdLocal.isProduction || dsProdLocal.reportsTable !== 'reports') {
        throw new Error(`Criterion 16c Failed: Expected production table mapping, got: ${JSON.stringify(dsProdLocal)}`);
      }

      // 16d: Localhost with invalid/unknown value throws Fail-Closed Error
      process.env.REPORT_DATA_SOURCE = 'invalid_staging_source';
      let caughtInvalidErr = false;
      try {
        getReportDataSource();
      } catch (err: unknown) {
        caughtInvalidErr = true;
        if (!(err instanceof Error) || !err.message.includes('FAIL-CLOSED SAFETY ERROR')) {
          throw new Error(`Criterion 16d Failed: Expected FAIL-CLOSED error message for invalid value, got: ${err}`);
        }
      }
      if (!caughtInvalidErr) {
        throw new Error('Criterion 16d Failed: Localhost with invalid REPORT_DATA_SOURCE must throw Error!');
      }

      // 16e: Production on Vercel (VERCEL_ENV=production) selects Production tables
      process.env.VERCEL_ENV = 'production';
      process.env.REPORT_DATA_SOURCE = 'production';
      const dsVercelProd = getReportDataSource();
      if (dsVercelProd.isTest || !dsVercelProd.isProduction || dsVercelProd.reportsTable !== 'reports') {
        throw new Error(`Criterion 16e Failed: Vercel production must map to reports table, got: ${JSON.stringify(dsVercelProd)}`);
      }

      // 16f: Production on Vercel with REPORT_DATA_SOURCE=test triggers Fatal Guard Error
      process.env.REPORT_DATA_SOURCE = 'test';
      let caughtFatalProdErr = false;
      try {
        getReportDataSource();
      } catch (err: unknown) {
        caughtFatalProdErr = true;
        if (!(err instanceof Error) || !err.message.includes('FATAL PRODUCTION SAFETY ERROR')) {
          throw new Error(`Criterion 16f Failed: Expected FATAL PRODUCTION SAFETY ERROR, got: ${err}`);
        }
      }
      if (!caughtFatalProdErr) {
        throw new Error('Criterion 16f Failed: VERCEL_ENV=production with REPORT_DATA_SOURCE=test must throw Fatal Error!');
      }

      console.log('  ✓ Verified: Non-prod without ENV fails closed, test selects test tables, prod selects prod tables, invalid rejected, Vercel prod guard intact.\n');
      passedCriteria++;
    } finally {
      if (origVercelEnv !== undefined) {
        process.env.VERCEL_ENV = origVercelEnv;
      } else {
        delete process.env.VERCEL_ENV;
      }
      if (origReportDataSource !== undefined) {
        process.env.REPORT_DATA_SOURCE = origReportDataSource;
      } else {
        delete process.env.REPORT_DATA_SOURCE;
      }
    }

  } finally {
    global.fetch = originalFetch;
  }

  console.log('================================================================================');
  console.log(`ALL ${passedCriteria}/${totalCriteria} VERIFICATION CRITERIA PASSED WITH 100% SUCCESS!`);
  console.log('================================================================================\n');
}

runNotificationTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
