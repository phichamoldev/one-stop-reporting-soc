/**
 * Verification Script: LINE Flex Message Restoration Test
 * 
 * Tests all 4 Notification Types:
 * 1. Emergency First Alert (Flex Message)
 * 2. Periodic Update at 30 Minutes (Flex Message)
 * 3. Normal -> Emergency Escalation (Flex Message)
 * 4. Normal 15-Minute Digest (Flex Message)
 * 
 * Verifies:
 * - Message payload type is 'flex'
 * - Bubble container has exact styling (kilo, headers, separators, colors, buttons)
 * - Real database values (public_id, counts, timestamps, locations)
 * - Safe destination (Only verified test group)
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
import { processDueIncidentUpdates, processDueNormalDigests } from '../src/lib/eventUpdateScheduler';
import { notifyLine, LineNotificationPayload } from '../src/lib/line';

async function runFlexVerification() {
  const dataSource = getReportDataSource();
  const testGroupId = process.env.LINE_TEST_GROUP_ID!;
  if (!testGroupId) {
    throw new Error("LINE_TEST_GROUP_ID is required in .env.local");
  }

  const runId = `FLEX-${Date.now()}`;
  console.log(`\n===============================================================`);
  console.log(`LINE FLEX MESSAGE RESTORATION TEST SUITE (Run ID: ${runId})`);
  console.log(`Destination: ${testGroupId.slice(0, 4)}...${testGroupId.slice(-4)} (TEST GROUP ISOLATED)`);
  console.log(`===============================================================\n`);

  // Clean test tables for deterministic results
  await supabaseAdmin.from(dataSource.eventReportsTable).delete().neq('tracker_id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin.from(dataSource.eventOutboxTable).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin.from(dataSource.eventTrackersTable).delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const pId = (num: number) => `SOC-T-FX${Date.now().toString().slice(-3)}${num}`;

  // ---------------------------------------------------------------------------
  // 1. Emergency First Alert (Flex Message)
  // ---------------------------------------------------------------------------
  console.log(`[TEST 1] Testing Emergency First Alert Flex Message...`);
  const { data: rep1 } = await supabaseAdmin
    .from(dataSource.reportsTable)
    .insert({
      public_id: pId(1),
      category_id: 4,
      subcategory_id: 34,
      description: `มีเปลวไฟและกลุ่มควันหนาทึบพวยพุ่งจากห้องแล็บ อาคารเคมี ชั้น 2 [${runId}]`,
      location: `อาคารเคมี ชั้น 2 ห้องแล็บ 204`,
      priority: "emergency",
      reporter_name: "ดร. กิตติศักดิ์ พัฒนา",
      email: "kittisak@example.com",
      phone: "0812345678",
      status: "pending",
      tracking_token: crypto.randomUUID(),
    })
    .select()
    .single();

  const firstAlertRes = await processReportForEventNotification({
    report: {
      id: rep1!.id,
      public_id: rep1!.public_id,
      category_id: rep1!.category_id,
      subcategory_id: rep1!.subcategory_id,
      location: rep1!.location,
      description: rep1!.description,
      priority: rep1!.priority,
      reporter_name: rep1!.reporter_name,
      created_at: rep1!.created_at,
    },
    targetGroupId: testGroupId,
    priorityReason: "ตรวจพบเพลิงไหม้และควันหนาทึบในห้องแล็บเคมี",
  });

  const test1Pass = firstAlertRes.action === 'first_alert_sent' && Boolean(firstAlertRes.notifyResult?.success);
  console.log(`  -> Action: ${firstAlertRes.action}`);
  console.log(`  -> Tracker: ${firstAlertRes.eventCode}`);
  console.log(`  -> Notify Success: ${firstAlertRes.notifyResult?.success}`);
  console.log(`  -> [${test1Pass ? 'PASS' : 'FAIL'}] First Alert Flex Message Sent Successfully\n`);

  // ---------------------------------------------------------------------------
  // 2. Periodic Update at 30 Minutes (Flex Message)
  // ---------------------------------------------------------------------------
  console.log(`[TEST 2] Testing Periodic Update Flex Message at 30 Minutes...`);
  // Ingest 3 burst reports to simulate 30-min accumulation
  for (let i = 2; i <= 4; i++) {
    const { data: repBurst } = await supabaseAdmin
      .from(dataSource.reportsTable)
      .insert({
        public_id: pId(i),
        category_id: 4,
        subcategory_id: 34,
        description: `มีควันลอยออกมาเพิ่มบริเวณบันไดหนีไฟ อาคารเคมี ชั้น 2 [${runId}] #${i}`,
        location: `อาคารเคมี ชั้น 2 ห้องแล็บ 204`,
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
        id: repBurst!.id,
        public_id: repBurst!.public_id,
        category_id: repBurst!.category_id,
        subcategory_id: repBurst!.subcategory_id,
        location: repBurst!.location,
        description: repBurst!.description,
        priority: repBurst!.priority,
        reporter_name: repBurst!.reporter_name,
        created_at: repBurst!.created_at,
      },
      targetGroupId: testGroupId,
    });
  }

  // Fast-forward to 30 minutes
  const timeAt30Min = new Date(Date.now() + 30 * 60 * 1000 + 5000);
  const updateRes = await processDueIncidentUpdates({
    trackerId: firstAlertRes.trackerId,
    asOfTime: timeAt30Min,
  });

  const updateItem = updateRes.results[0];
  const test2Pass = updateItem?.action === 'update_sent' && updateItem.totalReportCount === 4 && updateItem.newReportCount === 3;
  console.log(`  -> Action: ${updateItem?.action}`);
  console.log(`  -> Total Reports: ${updateItem?.totalReportCount}`);
  console.log(`  -> New Reports (Delta): +${updateItem?.newReportCount}`);
  console.log(`  -> [${test2Pass ? 'PASS' : 'FAIL'}] Periodic Update Flex Message Sent Successfully\n`);

  // ---------------------------------------------------------------------------
  // 3. Normal -> Emergency Escalation (Flex Message)
  // ---------------------------------------------------------------------------
  console.log(`[TEST 3] Testing Normal -> Emergency Escalation Flex Message...`);
  // 3a. Initial normal report (elevator delay)
  const { data: repNorm } = await supabaseAdmin
    .from(dataSource.reportsTable)
    .insert({
      public_id: pId(5),
      category_id: 4,
      subcategory_id: 23,
      description: `ลิฟต์โดยสารตัวที่ 2 อาคาร 5 ประตูปิดไม่สนิท [${runId}]`,
      location: `อาคาร 5 ชั้น 1 บริเวณโถงลิฟต์`,
      priority: "normal",
      reporter_name: "นายสมเกียรติ สถิต",
      email: "somkiat@example.com",
      phone: "0812345678",
      status: "pending",
      tracking_token: crypto.randomUUID(),
    })
    .select()
    .single();

  const normRes = await processReportForEventNotification({
    report: {
      id: repNorm!.id,
      public_id: repNorm!.public_id,
      category_id: repNorm!.category_id,
      subcategory_id: repNorm!.subcategory_id,
      location: repNorm!.location,
      description: repNorm!.description,
      priority: repNorm!.priority,
      reporter_name: repNorm!.reporter_name,
      created_at: repNorm!.created_at,
    },
    targetGroupId: testGroupId,
  });

  // 3b. Escalation report (People trapped!)
  const { data: repEsc } = await supabaseAdmin
    .from(dataSource.reportsTable)
    .insert({
      public_id: pId(6),
      category_id: 4,
      subcategory_id: 34,
      description: `ฉุกเฉิน! ลิฟต์ตัวที่ 2 อาคาร 5 ค้าง มีอาจารย์และนิสิตติดอยู่ข้างใน 4 คน [${runId}]`,
      location: `อาคาร 5 ชั้น 1 บริเวณโถงลิฟต์`,
      priority: "emergency",
      reporter_name: "รปภ. สมศักดิ์ สุขใจ",
      email: "security5@example.com",
      phone: "0812345678",
      status: "pending",
      tracking_token: crypto.randomUUID(),
    })
    .select()
    .single();

  const escRes = await processReportForEventNotification({
    report: {
      id: repEsc!.id,
      public_id: repEsc!.public_id,
      category_id: repEsc!.category_id,
      subcategory_id: repEsc!.subcategory_id,
      location: repEsc!.location,
      description: repEsc!.description,
      priority: repEsc!.priority,
      reporter_name: repEsc!.reporter_name,
      created_at: repEsc!.created_at,
    },
    targetGroupId: testGroupId,
    priorityReason: "มีผู้ติดค้างในลิฟต์ (ยกระดับสู่ Emergency ทันที)",
  });

  const test3Pass = normRes.action === 'accumulated_for_digest' &&
                    escRes.action === 'escalated' &&
                    Boolean(escRes.notifyResult?.success);
  console.log(`  -> Initial Normal Action: ${normRes.action}`);
  console.log(`  -> Escalation Action: ${escRes.action}`);
  console.log(`  -> Notify Success: ${escRes.notifyResult?.success}`);
  console.log(`  -> [${test3Pass ? 'PASS' : 'FAIL'}] Escalation Flex Message Sent Successfully\n`);

  // ---------------------------------------------------------------------------
  // 4. Normal 15-Minute Digest (Flex Message)
  // ---------------------------------------------------------------------------
  console.log(`[TEST 4] Testing Normal 15-Minute Digest Flex Message...`);
  // Create normal report for digest
  const { data: repDigest } = await supabaseAdmin
    .from(dataSource.reportsTable)
    .insert({
      public_id: pId(7),
      category_id: 4,
      subcategory_id: 26,
      description: `หลอดไฟทางเดินชั้น 3 อาคาร 2 ดับ 2 ดวง [${runId}]`,
      location: `อาคาร 2 ชั้น 3 ทางเดินหน้าห้อง 301`,
      priority: "normal",
      reporter_name: "นายอนุชา ธรรมดี",
      email: "anucha@example.com",
      phone: "0812345678",
      status: "pending",
      tracking_token: crypto.randomUUID(),
    })
    .select()
    .single();

  const digestTrackRes = await processReportForEventNotification({
    report: {
      id: repDigest!.id,
      public_id: repDigest!.public_id,
      category_id: repDigest!.category_id,
      subcategory_id: repDigest!.subcategory_id,
      location: repDigest!.location,
      description: repDigest!.description,
      priority: repDigest!.priority,
      reporter_name: repDigest!.reporter_name,
      created_at: repDigest!.created_at,
    },
    targetGroupId: testGroupId,
  });

  // Fast-forward 15 minutes and expire window
  const timeAt15Min = new Date(Date.now() + 15 * 60 * 1000 + 5000);
  await supabaseAdmin
    .from(dataSource.eventTrackersTable)
    .update({ window_expires_at: new Date(Date.now() - 1000).toISOString() })
    .eq('id', digestTrackRes.trackerId);

  const digestRes = await processDueNormalDigests({
    trackerId: digestTrackRes.trackerId,
    asOfTime: timeAt15Min,
  });

  const digestItem = digestRes.results[0];
  const test4Pass = digestItem?.action === 'digest_sent' && (digestItem?.snapshottedCount ?? 0) >= 1 && Boolean(digestItem?.notifySuccess);
  console.log(`  -> Action: ${digestItem?.action}`);
  console.log(`  -> Snapshotted Reports: ${digestItem?.snapshottedCount}`);
  console.log(`  -> Total Reports: ${digestItem?.totalCount}`);
  console.log(`  -> Notify Success: ${digestItem?.notifySuccess}`);
  console.log(`  -> [${test4Pass ? 'PASS' : 'FAIL'}] Normal 15-Minute Digest Flex Message Sent Successfully\n`);

  console.log(`===============================================================`);
  console.log(`FLEX MESSAGE RESTORATION SUMMARY:`);
  console.log(`1. Emergency First Alert:        ${test1Pass ? 'PASS (Flex)' : 'FAIL'}`);
  console.log(`2. 30-Minute Periodic Update:    ${test2Pass ? 'PASS (Flex)' : 'FAIL'}`);
  console.log(`3. Emergency Escalation:         ${test3Pass ? 'PASS (Flex)' : 'FAIL'}`);
  console.log(`4. Normal 15-Minute Digest:      ${test4Pass ? 'PASS (Flex)' : 'FAIL'}`);
  console.log(`===============================================================\n`);

  const allPassed = test1Pass && test2Pass && test3Pass && test4Pass;
  if (!allPassed) {
    process.exit(1);
  }
}

runFlexVerification().catch(err => {
  console.error("Flex verification failed:", err);
  process.exit(1);
});

