/**
 * Automated Test Suite: DataSource Fail-Closed and Isolation Verification
 * 
 * Verifies:
 * 1. Localhost without REPORT_DATA_SOURCE throws Error (Fail-Closed, zero fallback to production).
 * 2. Localhost with REPORT_DATA_SOURCE=test maps strictly to test tables.
 * 3. Localhost with REPORT_DATA_SOURCE=production maps to production tables (when explicitly requested).
 * 4. Localhost with invalid/unknown or whitespace string is strictly rejected.
 * 5. Vercel Production environment (VERCEL_ENV=production) maps to production tables.
 * 6. Vercel Production environment with REPORT_DATA_SOURCE=test throws Fatal Safety Error.
 */

import { getReportDataSource } from '../src/lib/dataSource';

async function runDataSourceTestSuite() {
  console.log('================================================================================');
  console.log('RUNNING DATASOURCE FAIL-CLOSED & ISOLATION VERIFICATION SUITE');
  console.log('================================================================================\n');

  const origVercelEnv = process.env.VERCEL_ENV;
  const origReportDataSource = process.env.REPORT_DATA_SOURCE;

  let testCount = 0;
  let passCount = 0;

  try {
    // -------------------------------------------------------------------------
    // Test 1: Localhost without REPORT_DATA_SOURCE -> Fail-Closed
    // -------------------------------------------------------------------------
    testCount++;
    console.log('[Test 1] Localhost without REPORT_DATA_SOURCE -> Fail-Closed...');
    delete process.env.VERCEL_ENV;
    delete process.env.REPORT_DATA_SOURCE;

    let test1Passed = false;
    try {
      getReportDataSource();
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('FAIL-CLOSED SAFETY ERROR')) {
        test1Passed = true;
      } else {
        throw new Error(`Test 1 Failed: Unexpected error: ${err}`);
      }
    }
    if (!test1Passed) {
      throw new Error('Test 1 Failed: Localhost without REPORT_DATA_SOURCE must throw Error and not default to Production!');
    }
    console.log('  ✓ Verified: Non-production environment without REPORT_DATA_SOURCE throws Fail-Closed error.\n');
    passCount++;

    // -------------------------------------------------------------------------
    // Test 2: Localhost with whitespace REPORT_DATA_SOURCE -> Fail-Closed
    // -------------------------------------------------------------------------
    testCount++;
    console.log('[Test 2] Localhost with whitespace REPORT_DATA_SOURCE -> Fail-Closed...');
    process.env.REPORT_DATA_SOURCE = '   ';
    let test2Passed = false;
    try {
      getReportDataSource();
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('FAIL-CLOSED SAFETY ERROR')) {
        test2Passed = true;
      }
    }
    if (!test2Passed) {
      throw new Error('Test 2 Failed: Whitespace REPORT_DATA_SOURCE must be rejected!');
    }
    console.log('  ✓ Verified: Whitespace-only string rejected after trim.\n');
    passCount++;

    // -------------------------------------------------------------------------
    // Test 3: Localhost with REPORT_DATA_SOURCE=test -> Selects Test Tables
    // -------------------------------------------------------------------------
    testCount++;
    console.log('[Test 3] Localhost with REPORT_DATA_SOURCE=test -> Selects Test Tables...');
    process.env.REPORT_DATA_SOURCE = 'test';
    const testDs = getReportDataSource();
    if (
      !testDs.isTest ||
      testDs.isProduction ||
      testDs.source !== 'test' ||
      testDs.reportsTable !== 'test_reports' ||
      testDs.reportLogsTable !== 'test_report_logs' ||
      testDs.notificationLogsTable !== 'test_notification_logs' ||
      testDs.incidentGroupsTable !== 'test_incident_groups'
    ) {
      throw new Error(`Test 3 Failed: Table mapping mismatch: ${JSON.stringify(testDs)}`);
    }
    console.log('  ✓ Verified: Exactly mapped to test tables (test_reports, test_report_logs, test_notification_logs).\n');
    passCount++;

    // -------------------------------------------------------------------------
    // Test 4: Localhost with REPORT_DATA_SOURCE=production -> Explicitly Allowed
    // -------------------------------------------------------------------------
    testCount++;
    console.log('[Test 4] Localhost with REPORT_DATA_SOURCE=production -> Selects Production Tables...');
    process.env.REPORT_DATA_SOURCE = 'production';
    const prodLocalDs = getReportDataSource();
    if (
      prodLocalDs.isTest ||
      !prodLocalDs.isProduction ||
      prodLocalDs.source !== 'production' ||
      prodLocalDs.reportsTable !== 'reports' ||
      prodLocalDs.reportLogsTable !== 'report_logs' ||
      prodLocalDs.notificationLogsTable !== 'notification_logs' ||
      prodLocalDs.incidentGroupsTable !== 'incident_groups'
    ) {
      throw new Error(`Test 4 Failed: Production mapping mismatch: ${JSON.stringify(prodLocalDs)}`);
    }
    console.log('  ✓ Verified: Explicitly allowed production mapping when deliberately configured.\n');
    passCount++;

    // -------------------------------------------------------------------------
    // Test 5: Localhost with unknown/invalid value -> Rejected
    // -------------------------------------------------------------------------
    testCount++;
    console.log('[Test 5] Localhost with unknown/invalid value -> Rejected...');
    process.env.REPORT_DATA_SOURCE = 'staging_database';
    let test5Passed = false;
    try {
      getReportDataSource();
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('FAIL-CLOSED SAFETY ERROR') && err.message.includes('staging_database')) {
        test5Passed = true;
      }
    }
    if (!test5Passed) {
      throw new Error('Test 5 Failed: Invalid string was not rejected!');
    }
    console.log('  ✓ Verified: Unknown values fail-closed with descriptive error message.\n');
    passCount++;

    // -------------------------------------------------------------------------
    // Test 6: Vercel Production Environment -> Production Tables Selected
    // -------------------------------------------------------------------------
    testCount++;
    console.log('[Test 6] Vercel Production Environment (VERCEL_ENV=production) -> Production Tables Selected...');
    process.env.VERCEL_ENV = 'production';
    process.env.REPORT_DATA_SOURCE = 'production';
    const vercelProdDs = getReportDataSource();
    if (
      vercelProdDs.isTest ||
      !vercelProdDs.isProduction ||
      vercelProdDs.reportsTable !== 'reports' ||
      vercelProdDs.notificationLogsTable !== 'notification_logs'
    ) {
      throw new Error(`Test 6 Failed: Vercel production mapping error: ${JSON.stringify(vercelProdDs)}`);
    }
    console.log('  ✓ Verified: Production deployment automatically selects production schema.\n');
    passCount++;

    // -------------------------------------------------------------------------
    // Test 7: Vercel Production with REPORT_DATA_SOURCE=test -> Fatal Guard
    // -------------------------------------------------------------------------
    testCount++;
    console.log('[Test 7] Vercel Production with REPORT_DATA_SOURCE=test -> Fatal Safety Guard...');
    process.env.VERCEL_ENV = 'production';
    process.env.REPORT_DATA_SOURCE = 'test';
    let test7Passed = false;
    try {
      getReportDataSource();
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('FATAL PRODUCTION SAFETY ERROR')) {
        test7Passed = true;
      }
    }
    if (!test7Passed) {
      throw new Error('Test 7 Failed: Fatal Guard did not trigger on Vercel with test data source!');
    }
    console.log('  ✓ Verified: Production Safety Guard immediately terminates on misconfiguration.\n');
    passCount++;

    console.log('================================================================================');
    console.log(`ALL ${passCount}/${testCount} DATASOURCE SAFETY TESTS PASSED WITH 100% SUCCESS!`);
    console.log('================================================================================\n');

  } finally {
    // Restore original environment
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
}

runDataSourceTestSuite().catch((err) => {
  console.error('\n❌ DATASOURCE TEST SUITE FAILED:', err);
  process.exit(1);
});
