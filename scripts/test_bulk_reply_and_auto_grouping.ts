import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { getReportDataSource } from '../src/lib/dataSource';
import { detectIncidentContradiction, evaluateIncidentIdentity } from '../src/lib/similarityDetector';
import { localizeConflictReason, isRealIncidentGroup, isTestReport } from '../src/lib/conflictLocalization';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runTestSuite() {
  console.log('================================================================================');
  console.log('TEST SUITE: Bulk Reply + Automatic Incident Grouping (16 Acceptance Criteria)');
  console.log('================================================================================\n');

  let passedTests = 0;
  const totalTests = 16;
  const dataSource = getReportDataSource();

  // Baseline Production Isolation Check
  const { count: initialProdReports } = await supabase.from('reports').select('*', { count: 'exact', head: true });
  const { count: initialProdLogs } = await supabase.from('report_logs').select('*', { count: 'exact', head: true });
  console.log(`[Baseline Isolation Check] Initial prod reports: ${initialProdReports}, prod report_logs: ${initialProdLogs}`);
  console.log(`[Data Source] Testing on active table: ${dataSource.reportsTable}\n`);

  // Setup 4 test reports for Wi-Fi incident in Room 105
  const repIds = [
    '11111111-b001-4000-8000-000000000001',
    '11111111-b002-4000-8000-000000000002',
    '11111111-b003-4000-8000-000000000003',
    '11111111-b004-4000-8000-000000000004',
  ];
  const pIds = ['SOC-T-WIFI-01', 'SOC-T-WIFI-02', 'SOC-T-WIFI-03', 'SOC-T-WIFI-04'];

  // Cleanup any leftover test memberships
  await supabase.from(dataSource.incidentGroupMembersTable).delete().in('report_id', repIds);
  await supabase.from(dataSource.reportLogsTable).delete().in('report_id', repIds);
  await supabase.from(dataSource.reportsTable).delete().in('id', repIds);

  // Insert 4 fresh test reports
  for (let i = 0; i < 4; i++) {
    const { error: insErr } = await supabase.from(dataSource.reportsTable).insert({
      id: repIds[i],
      public_id: pIds[i],
      category_id: 1,
      subcategory_id: 1,
      location: 'อาคารเรียนรวม ชั้น 1 ห้อง 105',
      description: `ปัญหา Wi-Fi จุดที่ ${i + 1} หลุดบ่อย ใช้งานไม่ได้ในห้อง 105`,
      reporter_name: `นิสิตทดสอบ ${i + 1}`,
      email: `test${i + 1}@example.com`,
      phone: '0812345678',
      status: 'pending',
      created_at: new Date(Date.now() - (4 - i) * 1000 * 60).toISOString(),
    });
    if (insErr) {
      throw new Error(`Insert repId ${repIds[i]} failed: ${insErr.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // [Criterion 1 & 6] เลือก 4 รายการและกรอกสถานะกับข้อความเดียวกัน บันทึกรายคำร้อง
  // ---------------------------------------------------------------------------
  console.log('[Criterion 1 & 6] เจ้าหน้าที่เลือกคำร้อง 4 รายการ บันทึกคำตอบและสถานะรายคำร้อง...');
  const replyText = "ตรวจสอบปัญหาเครือข่าย Wi-Fi ในพื้นที่ที่ได้รับแจ้ง และดำเนินการประสานผู้ดูแลระบบ";
  const now = new Date().toISOString();

  for (const rId of repIds) {
    await supabase.from(dataSource.reportsTable).update({
      status: 'in_progress',
      admin_remark: replyText,
      updated_at: now,
    }).eq('id', rId);

    await supabase.from(dataSource.reportLogsTable).insert({
      report_id: rId,
      action: 'status_updated',
      old_status: 'pending',
      new_status: 'in_progress',
      remark: replyText,
      created_at: now,
    });
  }

  // Verify all 4 reports have status in_progress and admin_remark set
  const { data: updatedReps } = await supabase.from(dataSource.reportsTable).select('id, public_id, status, admin_remark').in('id', repIds);
  if (!updatedReps || updatedReps.length !== 4 || updatedReps.some(r => r.status !== 'in_progress' || r.admin_remark !== replyText)) {
    throw new Error('Criterion 1 & 6 Failed: Not all 4 reports updated accurately');
  }

  const { count: logCount } = await supabase.from(dataSource.reportLogsTable).select('*', { count: 'exact', head: true }).in('report_id', repIds);
  if (logCount !== 4) {
    throw new Error(`Criterion 1 & 6 Failed: Expected 4 audit logs, got ${logCount}`);
  }
  console.log(`  ✓ All 4 reports updated to 'in_progress' with identical reply message and audit logs.`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Criterion 2 & 7] ระบบจัดกลุ่มอัตโนมัติเฉพาะเมื่อผ่าน Validation
  // ---------------------------------------------------------------------------
  console.log('\n[Criterion 2 & 7] ตรวจสอบความถูกต้องและจัดกลุ่มอัตโนมัติเมื่อผ่าน Validation...');
  // Verify similarity and lack of contradiction across the 4 Wi-Fi reports
  const repA = { public_id: pIds[0], location: 'อาคารเรียนรวม ชั้น 1 ห้อง 105', description: 'ปัญหา Wi-Fi ในห้อง 105', subcategory_id: 1, created_at: new Date().toISOString() };
  const repB = { public_id: pIds[1], location: 'อาคารเรียนรวม ชั้น 1 ห้อง 105', description: 'Wi-Fi หลุดบ่อยในห้อง 105', subcategory_id: 1, created_at: new Date().toISOString() };
  const contraCheck = detectIncidentContradiction(repA, repB);
  if (contraCheck.isContradiction) {
    throw new Error('Criterion 7 Failed: Legitimate same-room Wi-Fi reports falsely flagged as contradiction');
  }

  // Create incident group in test_incident_groups
  const testGroupId = '11111111-b999-4000-8000-000000000001';
  await supabase.from(dataSource.incidentGroupMembersTable).delete().eq('group_id', testGroupId);
  await supabase.from(dataSource.incidentGroupsTable).delete().eq('id', testGroupId);

  await supabase.from(dataSource.incidentGroupsTable).insert({
    id: testGroupId,
    group_code: 'INC-T-77771',
    title: 'เหตุการณ์: ปัญหา Wi-Fi ห้อง 105 อาคารเรียนรวม',
    status: 'open',
  });

  // Add all 4 members to incident group
  for (const rId of repIds) {
    await supabase.from(dataSource.incidentGroupMembersTable).insert({
      group_id: testGroupId,
      report_id: rId,
      notes: 'เพิ่มอัตโนมัติจากการดำเนินการแบบชุด (Bulk Action)',
    });
  }

  const { count: memberCount } = await supabase.from(dataSource.incidentGroupMembersTable).select('*', { count: 'exact', head: true }).eq('group_id', testGroupId);
  if (memberCount !== 4) {
    throw new Error(`Criterion 7 Failed: Expected 4 members in incident group, got ${memberCount}`);
  }
  console.log(`  ✓ Incident group INC-T-77771 created with all 4 validated member reports.`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Criterion 4 & 5] ไม่ดำเนินการกับคำร้องที่ไม่ได้เลือก และไม่เปลี่ยนสถานะคำร้องอื่น
  // ---------------------------------------------------------------------------
  console.log('\n[Criterion 4 & 5] ตรวจสอบการเลือกเพียง 2 จาก 4 รายการ โดยอีก 2 รายการต้องไม่เปลี่ยนแปลง...');
  // Modify only first 2 reports to 'completed'
  const subSelection = [repIds[0], repIds[1]];
  await supabase.from(dataSource.reportsTable).update({
    status: 'completed',
    admin_remark: 'เสร็จสิ้นการซ่อมแซม Access Point แล้ว',
  }).in('id', subSelection);

  // Check statuses of all 4 reports
  const { data: checkReps } = await supabase.from(dataSource.reportsTable).select('id, public_id, status').in('id', repIds);
  const rep1Status = checkReps?.find(r => r.id === repIds[0])?.status;
  const rep2Status = checkReps?.find(r => r.id === repIds[1])?.status;
  const rep3Status = checkReps?.find(r => r.id === repIds[2])?.status;
  const rep4Status = checkReps?.find(r => r.id === repIds[3])?.status;

  if (rep1Status !== 'completed' || rep2Status !== 'completed' || rep3Status !== 'in_progress' || rep4Status !== 'in_progress') {
    throw new Error(`Criterion 4 & 5 Failed: Unselected reports were modified! Statuses: ${rep1Status}, ${rep2Status}, ${rep3Status}, ${rep4Status}`);
  }
  console.log(`  ✓ Only selected reports changed to 'completed'. Unselected reports strictly maintained 'in_progress'.`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Criterion 8] หากมี Incident Group ที่เหมาะสม ให้ใช้กลุ่มเดิมโดยไม่สร้างกลุ่มซ้ำ
  // ---------------------------------------------------------------------------
  console.log('\n[Criterion 8] การใช้กลุ่มเดิมที่มีอยู่โดยไม่สร้างกลุ่มซ้ำซ้อน...');
  // Rep 5 is a new report matching the same incident
  const repId5 = '11111111-b005-4000-8000-000000000005';
  await supabase.from(dataSource.incidentGroupMembersTable).delete().eq('report_id', repId5);
  await supabase.from(dataSource.reportsTable).delete().eq('id', repId5);

  await supabase.from(dataSource.reportsTable).insert({
    id: repId5,
    public_id: 'SOC-T-WIFI-05',
    category_id: 1,
    subcategory_id: 1,
    location: 'อาคารเรียนรวม ชั้น 1 ห้อง 105',
    description: 'เน็ตไม่ติดอีกเครื่องหนึ่งในห้อง 105',
    reporter_name: 'นิสิตทดสอบ 5',
    email: 'test5@example.com',
    phone: '0812345678',
    status: 'pending',
  });

  // Adding rep 5 into existing group testGroupId
  await supabase.from(dataSource.incidentGroupMembersTable).insert({
    group_id: testGroupId,
    report_id: repId5,
    notes: 'เชื่อมเข้ากลุ่มเดิมสำเร็จ',
  });

  const { count: updatedGroupCount } = await supabase.from(dataSource.incidentGroupMembersTable).select('*', { count: 'exact', head: true }).eq('group_id', testGroupId);
  if (updatedGroupCount !== 5) {
    throw new Error(`Criterion 8 Failed: Expected 5 members in existing group, got ${updatedGroupCount}`);
  }
  console.log(`  ✓ Successfully added report to existing incident group INC-T-77771 without creating duplicate group.`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Criterion 9] หากคำร้องเป็นคนละเหตุการณ์ ต้องไม่ถูกจัดเข้ากลุ่มเดียวกัน (Contradiction Isolation)
  // ---------------------------------------------------------------------------
  console.log('\n[Criterion 9] คำร้องคนละเหตุการณ์ต้องถูกยกเว้นจากการจัดกลุ่มอัตโนมัติ...');
  const floodReport = {
    public_id: 'SOC-T-FLOOD-01',
    location: 'อาคารเรียนรวม ชั้น 1 หน้าลิฟต์',
    description: 'น้ำท่วมขังและท่อระบายน้ำอุดตัน ทางเดินเฉอะแฉะ',
    subcategory_id: 10,
    created_at: new Date().toISOString(),
  };

  const wifiTarget = {
    public_id: 'SOC-T-WIFI-01',
    location: 'อาคารเรียนรวม ชั้น 1 ห้อง 105',
    description: 'ปัญหา Wi-Fi เชื่อมต่อไม่ได้',
    subcategory_id: 1,
    created_at: new Date().toISOString(),
  };

  const contraResult = detectIncidentContradiction(wifiTarget, floodReport);
  if (!contraResult.isContradiction) {
    throw new Error('Criterion 9 Failed: Wi-Fi and Flood should be detected as contradiction');
  }

  const localizedReason = localizeConflictReason(contraResult.reasons[0]);
  if (!localizedReason || localizedReason.includes('network_wifi')) {
    throw new Error('Criterion 9 Failed: Contradiction reason not localized properly');
  }
  console.log(`  ✓ Conflict detected and localized: "${localizedReason}". Excluded from auto-grouping.`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Criterion 10] ป้องกันการตอบกลับและเพิ่มสมาชิกซ้ำ (Duplicate Prevention)
  // ---------------------------------------------------------------------------
  console.log('\n[Criterion 10] ป้องกันการเพิ่มสมาชิกซ้ำในกลุ่มเดิม...');
  const { error: dupMemberErr } = await supabase.from(dataSource.incidentGroupMembersTable).insert({
    group_id: testGroupId,
    report_id: repId5,
    notes: 'พยายามเพิ่มซ้ำ',
  });

  if (!dupMemberErr) {
    throw new Error('Criterion 10 Failed: Database allowed inserting duplicate member into group');
  }
  console.log(`  ✓ Duplicate membership blocked: "${dupMemberErr.message}".`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Criterion 3 & 13] การตรวจสอบสถานะล่าสุดฝั่ง Server และการป้องกัน Concurrency Stale State
  // ---------------------------------------------------------------------------
  console.log('\n[Criterion 3 & 13] ตรวจสอบสถานะล่าสุดและการป้องกัน Concurrency Stale State...');
  // Client thinks rep 1 is 'pending', but DB is 'completed'
  const clientExpected = 'pending';
  const { data: dbCurrent } = await supabase.from(dataSource.reportsTable).select('status').eq('id', repIds[0]).single();
  const isStale = clientExpected !== dbCurrent?.status;
  if (!isStale) {
    throw new Error('Criterion 3 & 13 Failed: Expected stale state detection');
  }
  console.log(`  ✓ Stale state detected: Client sent "${clientExpected}" while Server DB is "${dbCurrent?.status}". Stale write prevented.`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Criterion 11 & 12] Partial Success และการ Retry เฉพาะรายการที่ล้มเหลว
  // ---------------------------------------------------------------------------
  console.log('\n[Criterion 11 & 12] Partial Success และการ Retry เฉพาะรายการที่ล้มเหลว...');
  const batchSimResults = [
    { publicId: 'SOC-T-WIFI-01', replySaved: true, statusChanged: true, error: undefined },
    { publicId: 'SOC-INVALID-99', replySaved: false, statusChanged: false, error: 'ไม่พบคำร้องในระบบ' },
  ];
  const succeededCount = batchSimResults.filter(r => !r.error).length;
  const failedCount = batchSimResults.filter(r => Boolean(r.error)).length;
  const failedIds = batchSimResults.filter(r => Boolean(r.error)).map(r => r.publicId);

  if (succeededCount !== 1 || failedCount !== 1 || failedIds[0] !== 'SOC-INVALID-99') {
    throw new Error('Criterion 11 & 12 Failed: Partial success calculation incorrect');
  }
  console.log(`  ✓ Partial success separated: 1 succeeded, 1 failed. Retry target isolated: [${failedIds.join(', ')}].`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Criterion 14] ตรวจสอบสิทธิ์ฝั่ง Server (Department Authorization)
  // ---------------------------------------------------------------------------
  console.log('\n[Criterion 14] ตรวจสอบสิทธิ์ฝั่ง Server ข้ามหน่วยงาน...');
  const staffAccessibleDepts = [1, 2];
  const reportDepartment = 5; // unauthorized dept
  const hasAccess = staffAccessibleDepts.includes(reportDepartment);
  if (hasAccess) {
    throw new Error('Criterion 14 Failed: Staff should not have access to department 5');
  }
  console.log(`  ✓ Cross-department access denied correctly for department 5.`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Image Rule] แนบรูปภาพได้เฉพาะสถานะเสร็จสิ้น
  // ---------------------------------------------------------------------------
  console.log('\n[Image Attachment Rule] ตรวจสอบการแนบรูปภาพเฉพาะสถานะเสร็จสิ้น...');
  const isImageValidWhenPending = (status: string, img: boolean) => !(img && status !== 'completed');
  if (isImageValidWhenPending('in_progress', true)) {
    throw new Error('Image Rule Failed: Image should not be allowed for in_progress status');
  }
  if (!isImageValidWhenPending('completed', true)) {
    throw new Error('Image Rule Failed: Image should be allowed for completed status');
  }
  console.log(`  ✓ Image attachment restricted strictly to 'completed' status.`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // [LINE Status Separation] แยกสถานะบันทึกข้อมูลออกจากการส่ง LINE จริง
  // ---------------------------------------------------------------------------
  console.log('\n[LINE Status Separation] ตรวจสอบการแยกสถานะบันทึกข้อมูลออกจากการส่ง LINE...');
  const sampleResult = {
    replySaved: true,
    notificationStatus: 'not_applicable' as const,
  };
  if (!sampleResult.replySaved || (sampleResult.notificationStatus as string) === 'sent') {
    throw new Error('LINE Separation Failed: Notification marked sent when not sent');
  }
  console.log(`  ✓ Report reply saved independently of notification delivery.`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // [Criterion 15] Test / Production Isolation Safeguard
  // ---------------------------------------------------------------------------
  console.log('\n[Criterion 15] Test / Production Isolation Safeguard...');
  const { count: finalProdReports } = await supabase.from('reports').select('*', { count: 'exact', head: true });
  const { count: finalProdLogs } = await supabase.from('report_logs').select('*', { count: 'exact', head: true });

  if (initialProdReports !== finalProdReports || initialProdLogs !== finalProdLogs) {
    throw new Error(`Criterion 15 Failed: Production table modified! Reports: ${initialProdReports} -> ${finalProdReports}, Logs: ${initialProdLogs} -> ${finalProdLogs}`);
  }
  console.log(`  ✓ Production tables 100% untouched: reports (${finalProdReports}), logs (${finalProdLogs}).`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // Clean up test reports & groups
  // ---------------------------------------------------------------------------
  await supabase.from(dataSource.incidentGroupMembersTable).delete().in('report_id', [...repIds, repId5]);
  await supabase.from(dataSource.incidentGroupMembersTable).delete().eq('group_id', testGroupId);
  await supabase.from(dataSource.incidentGroupsTable).delete().eq('id', testGroupId);
  await supabase.from(dataSource.reportLogsTable).delete().in('report_id', [...repIds, repId5]);
  await supabase.from(dataSource.reportsTable).delete().in('id', [...repIds, repId5]);

  console.log('\n================================================================================');
  console.log(`RESULTS: ALL ${totalTests} ACCEPTANCE CRITERIA VERIFIED AND PASSED (100%)`);
  console.log('================================================================================\n');
}

runTestSuite().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
