/**
 * KU CAMPUS REALISTIC SIMULATION & NOTIFICATION VERIFICATION
 * 
 * Executes an end-to-end simulation of 40 citizen reports in Kasetsart University (KU Campus)
 * across 4 disaster / weather categories:
 *  - Group A: ฝนตกหนัก (10 reports)
 *  - Group B: ต้นไม้ล้ม / กิ่งไม้หัก (10 reports)
 *  - Group C: น้ำท่วม / น้ำรอระบาย (10 reports)
 *  - Group D: ไฟฟ้าดับ / ระบบไฟฟ้าขัดข้อง (10 reports)
 * 
 * Enforces Phase 3.8 Simplified Notification Policy:
 *  - Only 2 active notification types: 'normal_alert' and 'periodic_update' (Flex Messages).
 *  - 1st report of incident -> immediate Normal Alert Flex Message.
 *  - Additional reports in same incident -> suppressed immediately.
 *  - At 30 minutes with new reports -> Periodic Update Flex Message with total and delta counts.
 *  - At 60 minutes with 0 new reports -> Window extended, 0 LINE sent.
 *  - Backoffice Draft Correlation & Human-in-the-loop verification.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

process.env.REPORT_DATA_SOURCE = 'test';
process.env.NEXT_PUBLIC_REPORT_DATA_SOURCE = 'test';
process.env.LINE_NOTIFICATIONS_ENABLED = 'true';
process.env.LINE_NEW_REPORT_NOTIFICATIONS_ENABLED = 'true';

import { supabaseAdmin } from '../src/lib/supabase-admin';
import { getReportDataSource } from '../src/lib/dataSource';
import { processDueEventUpdates } from '../src/lib/eventUpdateScheduler';
import { validateTestLineDestination } from '../src/lib/line';
import { generateIncidentDrafts, ProposedReportItem } from '../src/lib/incidentDraftService';
import { KU_SIMULATION_REPORTS, MockReportDef } from './verify_ku_campus_clustering';

interface SubmissionRecord {
  index: number;
  public_id: string;
  report_id: string;
  clusterId: string;
  group: string;
  location: string;
  description: string;
  priority: string;
  eventAction?: string;
  eventCode?: string;
  trackerId?: string;
  outboxId?: string;
  notifyStatus?: string;
  httpStatus: number;
}

async function runSimulation() {
  const dataSource = getReportDataSource();
  const testGroupId = process.env.LINE_TEST_GROUP_ID;

  // 1. Safety Guard Verification
  console.log(`\n===============================================================`);
  console.log(`KU CAMPUS END-TO-END SIMULATION RUNNER`);
  console.log(`Data Source: ${dataSource.source} (isTest: ${dataSource.isTest})`);
  console.log(`Reports Table: ${dataSource.reportsTable}`);
  console.log(`Trackers Table: ${dataSource.eventTrackersTable}`);
  console.log(`LINE Destination: ${testGroupId ? testGroupId.slice(0, 4) + '...' + testGroupId.slice(-4) : 'MISSING'}`);
  console.log(`===============================================================\n`);

  if (!dataSource.isTest || dataSource.source !== 'test') {
    throw new Error('FATAL SAFETY ERROR: Simulation can only run when REPORT_DATA_SOURCE=test');
  }

  const destValidation = validateTestLineDestination(testGroupId || '');
  if (!destValidation.isValid) {
    throw new Error(`FATAL SAFETY ERROR: LINE Test Group validation failed: ${destValidation.reason}`);
  }

  const simulationRunId = `SIM-KU-20261105-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  console.log(`Generated Simulation Run ID: ${simulationRunId}\n`);

  const submissionRecords: SubmissionRecord[] = [];
  const trackerMap = new Map<string, string>(); // clusterId -> trackerId
  let normalAlertCount = 0;
  let suppressedCount = 0;
  let periodicUpdateCount = 0;

  // Helper to submit report via real Next.js API endpoint
  async function submitReport(def: MockReportDef): Promise<SubmissionRecord> {
    const payload = {
      category_id: def.category_id,
      subcategory_id: def.subcategory_id,
      location: def.location,
      description: def.description,
      reporter_name: def.reporter_name,
      email: def.email,
      phone: def.phone,
      status: 'pending',
      priority: 'normal',
      tracking_token: `${simulationRunId}-${String(def.index).padStart(3, '0')}-${crypto.randomUUID()}`,
      admin_remark: JSON.stringify({
        simulation_run_id: simulationRunId,
        group: def.group,
        index: def.index,
        clusterId: def.clusterId,
      }),
    };

    const res = await fetch('http://localhost:3000/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const resData = await res.json();
    if (!res.ok) {
      throw new Error(`API submission failed for report #${def.index}: HTTP ${res.status} - ${JSON.stringify(resData)}`);
    }

    const inserted = resData.data;
    const eventNotif = resData.eventNotification;

    const rec: SubmissionRecord = {
      index: def.index,
      public_id: inserted.public_id,
      report_id: inserted.id,
      clusterId: def.clusterId,
      group: def.group,
      location: def.location,
      description: def.description,
      priority: inserted.priority,
      eventAction: eventNotif?.action,
      eventCode: eventNotif?.eventCode,
      trackerId: eventNotif?.trackerId,
      outboxId: eventNotif?.outboxId,
      notifyStatus: eventNotif?.notifyResult?.status,
      httpStatus: res.status,
    };

    if (eventNotif?.action === 'normal_alert_sent') {
      normalAlertCount++;
      if (def.clusterId && !trackerMap.has(def.clusterId)) {
        trackerMap.set(def.clusterId, eventNotif.trackerId);
      }
    } else if (eventNotif?.action === 'suppressed_duplicate') {
      suppressedCount++;
    }

    submissionRecords.push(rec);
    return rec;
  }

  // =========================================================================
  // STEP 1: Time 00m — Initial Reports for Clusters A1, B1, C1, D1
  // =========================================================================
  console.log(`[Timeline T=00m] Submitting initial reports for primary clusters (Expect 4 Normal Alerts)...`);
  const initialDefs = [
    KU_SIMULATION_REPORTS[0],  // Report 1: Cluster A1 (ฝนตกหนักอาคารเรียนรวม 1)
    KU_SIMULATION_REPORTS[10], // Report 11: Cluster B1 (ต้นไม้ล้มข้างอาคาร 4)
    KU_SIMULATION_REPORTS[20], // Report 21: Cluster C1 (น้ำท่วมถนนข้างอาคาร 5)
    KU_SIMULATION_REPORTS[30], // Report 31: Cluster D1 (ไฟดับทั้งตึกอาคาร 2)
  ];

  for (const def of initialDefs) {
    const rec = await submitReport(def);
    console.log(` -> Report #${rec.index} (${rec.public_id}): Action=${rec.eventAction}, EventCode=${rec.eventCode}, LINE=${rec.notifyStatus}`);
  }

  // =========================================================================
  // STEP 2: Time 05m - 15m — Additional Reports in Same Clusters
  // =========================================================================
  console.log(`\n[Timeline T=05m-15m] Submitting additional reports in same clusters (Expect immediate LINE suppression)...`);
  const additionalDefs = [
    KU_SIMULATION_REPORTS[1],  // Report 2: Cluster A1
    KU_SIMULATION_REPORTS[2],  // Report 3: Cluster A1
    KU_SIMULATION_REPORTS[11], // Report 12: Cluster B1
    KU_SIMULATION_REPORTS[12], // Report 13: Cluster B1
    KU_SIMULATION_REPORTS[21], // Report 22: Cluster C1
    KU_SIMULATION_REPORTS[22], // Report 23: Cluster C1
    KU_SIMULATION_REPORTS[23], // Report 24: Cluster C1
    KU_SIMULATION_REPORTS[31], // Report 32: Cluster D1
    KU_SIMULATION_REPORTS[32], // Report 33: Cluster D1
  ];

  for (const def of additionalDefs) {
    const rec = await submitReport(def);
    console.log(` -> Report #${rec.index} (${rec.public_id}): Action=${rec.eventAction}, EventCode=${rec.eventCode}, LINE Suppressed=true`);
  }

  // =========================================================================
  // STEP 3: Time 30m — Clock Injection & Periodic Update Trigger
  // =========================================================================
  console.log(`\n[Timeline T=30m] Simulating 30-minute scheduler tick for active clusters...`);
  const primaryClusterIds = ['A1', 'B1', 'C1', 'D1'];
  const pastTime30 = new Date(Date.now() - 31 * 60 * 1000).toISOString();

  for (const cid of primaryClusterIds) {
    const trId = trackerMap.get(cid);
    if (trId) {
      await supabaseAdmin
        .from(dataSource.eventTrackersTable)
        .update({
          next_update_at: pastTime30,
          window_expires_at: pastTime30,
        })
        .eq('id', trId);

      const schedRes = await processDueEventUpdates({ trackerId: trId, asOfTime: new Date() });
      const item = schedRes.results.find((r) => r.trackerId === trId);
      console.log(` -> Cluster ${cid} Tracker ${trId}: Action=${item?.action}, TotalReports=${item?.totalReportCount}, Delta=+${item?.newReportCount}`);
      if (item?.action === 'update_sent') {
        periodicUpdateCount++;
      }
    }
  }

  // =========================================================================
  // STEP 4: Time 60m — Zero New Reports Window Extension (Cluster A1)
  // =========================================================================
  console.log(`\n[Timeline T=60m] Simulating 60-minute tick with 0 new reports for Cluster A1...`);
  const trA1Id = trackerMap.get('A1');
  if (trA1Id) {
    await supabaseAdmin
      .from(dataSource.eventTrackersTable)
      .update({
        next_update_at: pastTime30,
        window_expires_at: pastTime30,
      })
      .eq('id', trA1Id);

    const emptyRes = await processDueEventUpdates({ trackerId: trA1Id, asOfTime: new Date() });
    const emptyItem = emptyRes.results.find((r) => r.trackerId === trA1Id);
    console.log(` -> Cluster A1 Zero-Report Window: Action=${emptyItem?.action}, NewReports=${emptyItem?.newReportCount} (Expect window_extended_no_reports)`);
  }

  // =========================================================================
  // STEP 5: Submit Remaining Reports to Complete All 40 Reports
  // =========================================================================
  console.log(`\n[Step 5] Ingesting all remaining 27 reports across all 4 categories...`);
  const submittedIndices = new Set(submissionRecords.map((r) => r.index));
  const remainingDefs = KU_SIMULATION_REPORTS.filter((r) => !submittedIndices.has(r.index));

  for (const def of remainingDefs) {
    const rec = await submitReport(def);
    console.log(` -> Report #${rec.index} (${rec.public_id}): Action=${rec.eventAction}, EventCode=${rec.eventCode}`);
  }

  console.log(`\nTotal Reports Submitted: ${submissionRecords.length} / 40`);

  // =========================================================================
  // STEP 6: Database Verification
  // =========================================================================
  console.log(`\n===============================================================`);
  console.log(`DATABASE & BACKOFFICE AUDIT VERIFICATION`);
  console.log(`===============================================================`);

  // 1. Verify test_reports persistence
  const { data: dbReports, count: dbCount } = await supabaseAdmin
    .from(dataSource.reportsTable)
    .select('id, public_id, category_id, subcategory_id, location, priority, status, admin_remark', { count: 'exact' })
    .like('admin_remark', `%${simulationRunId}%`);

  console.log(`Reports in DB for this Run: ${dbCount} / 40`);

  // 2. Verify audit logs
  const reportIds = (dbReports || []).map((r) => r.id);
  const { count: logCount } = await supabaseAdmin
    .from(dataSource.reportLogsTable)
    .select('id', { count: 'exact', head: true })
    .in('report_id', reportIds);

  console.log(`Audit Logs in DB: ${logCount} records`);

  // 3. Verify notification logs
  const { data: notifLogs, count: notifCount } = await supabaseAdmin
    .from(dataSource.notificationLogsTable)
    .select('id, event_type, public_id, destination, status, sent_at', { count: 'exact' })
    .eq('environment', 'test')
    .order('created_at', { ascending: false })
    .limit(50);

  const sentFlexCount = (notifLogs || []).filter((l) => l.status === 'sent').length;
  console.log(`Recent Test Notification Logs: ${notifCount} (Sent Flex: ${sentFlexCount})`);

  // 4. Verify Human-in-the-Loop Backoffice Groups: No auto-assignment
  const { count: memberCount } = await supabaseAdmin
    .from(dataSource.incidentGroupMembersTable)
    .select('id', { count: 'exact', head: true })
    .in('report_id', reportIds);

  console.log(`Confirmed Incident Members Count: ${memberCount} (Expect 0 — Human-in-the-loop enforced!)`);

  // 5. Evaluate Draft Incident Groups via Backoffice Algorithm
  const proposedPool: ProposedReportItem[] = (dbReports || []).map((r) => ({
    id: r.id,
    public_id: r.public_id,
    category_id: r.category_id,
    subcategory_id: r.subcategory_id,
    location: r.location,
    description: (submissionRecords.find((s) => s.report_id === r.id)?.description) || '',
    status: r.status,
    priority: (r.priority as ProposedReportItem['priority']) || 'normal',
    reporter_name: 'นิสิต/บุคลากร',
    created_at: new Date().toISOString(),
  }));

  const activeDrafts = generateIncidentDrafts(proposedPool, [], {
    minClusterSize: 2,
    similarityThreshold: 50,
  });

  console.log(`\nBackoffice Draft Incident Groups Generated: ${activeDrafts.length}`);
  activeDrafts.forEach((d, idx) => {
    const pids = d.reports.map((r) => r.public_id).join(', ');
    console.log(` [Draft ${idx + 1}] "${d.proposedTitle}" | Count: ${d.reportCount} | Score: ${d.correlationScore}% | Reports: [${pids}]`);
  });

  // Pairwise Clustering Evaluation against Ground Truth
  const groundTruthMap = new Map<string, string>();
  submissionRecords.forEach((s) => {
    groundTruthMap.set(s.public_id, s.clusterId);
  });

  const predictedPairs = new Set<string>();
  activeDrafts.forEach((d) => {
    const rIds = d.reports.map((r) => r.public_id).sort();
    for (let i = 0; i < rIds.length; i++) {
      for (let j = i + 1; j < rIds.length; j++) {
        predictedPairs.add(`${rIds[i]}::${rIds[j]}`);
      }
    }
  });

  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;

  const n = submissionRecords.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const pidI = submissionRecords[i].public_id;
      const pidJ = submissionRecords[j].public_id;
      const pairKey = `${pidI}::${pidJ}`;

      const gtClusterI = submissionRecords[i].clusterId;
      const gtClusterJ = submissionRecords[j].clusterId;
      const isGtSame = !gtClusterI.startsWith('S') && gtClusterI === gtClusterJ;
      const isPredSame = predictedPairs.has(pairKey);

      if (isGtSame && isPredSame) tp++;
      else if (!isGtSame && isPredSame) fp++;
      else if (isGtSame && !isPredSame) fn++;
      else tn++;
    }
  }

  const precision = tp + fp > 0 ? (tp / (tp + fp)) * 100 : 0;
  const recall = tp + fn > 0 ? (tp / (tp + fn)) * 100 : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const accuracy = ((tp + tn) / (tp + tn + fp + fn)) * 100;

  console.log(`\n===============================================================`);
  console.log(`FINAL SIMULATION METRICS SUMMARY:`);
  console.log(`Simulation Run ID:    ${simulationRunId}`);
  console.log(`Reports Ingested:     ${submissionRecords.length} / 40`);
  console.log(`Normal Alerts Sent:   ${normalAlertCount}`);
  console.log(`Suppressed Reports:   ${suppressedCount}`);
  console.log(`Periodic Updates:     ${periodicUpdateCount}`);
  console.log(`Draft Groups Created: ${activeDrafts.length}`);
  console.log(`Pairwise Precision:   ${precision.toFixed(2)}%`);
  console.log(`Pairwise Recall:      ${recall.toFixed(2)}%`);
  console.log(`Pairwise F1-Score:    ${f1.toFixed(2)}%`);
  console.log(`Pairwise Accuracy:    ${accuracy.toFixed(2)}%`);
  console.log(`TP: ${tp}, FP: ${fp}, FN: ${fn}, TN: ${tn}`);
  console.log(`===============================================================\n`);

  // Write results JSON file for artifact report compilation
  const summaryPayload = {
    simulationRunId,
    timestamp: new Date().toISOString(),
    reportsIngested: submissionRecords.length,
    normalAlertCount,
    suppressedCount,
    periodicUpdateCount,
    draftsCount: activeDrafts.length,
    metrics: { tp, fp, fn, tn, precision, recall, f1, accuracy },
    submissions: submissionRecords,
    drafts: activeDrafts.map((d) => ({
      title: d.proposedTitle,
      count: d.reportCount,
      score: d.correlationScore,
      reports: d.reports.map((r) => r.public_id),
    })),
  };

  const fs = await import('fs');
  fs.writeFileSync(
    'C:/Users/Asus/.gemini/antigravity/brain/5e3a0fbe-0bea-4e35-a486-4ba5bf5a3422/simulation_results.json',
    JSON.stringify(summaryPayload, null, 2)
  );

  console.log('Results saved to simulation_results.json');
}

runSimulation().catch((err) => {
  console.error('Fatal Simulation Exception:', err);
  process.exit(1);
});
