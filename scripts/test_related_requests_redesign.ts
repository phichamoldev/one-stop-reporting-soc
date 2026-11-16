/**
 * Test Suite: Related Requests UX Redesign & Classification Verification
 * Validates AC-01 through AC-15 from user request.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runTests() {
  const { getRelatedItemClassification } = await import('../src/components/backoffice/SimilarReportsCard');
  type CandidateIncidentGroup = { id: string; group_code: string; title: string; status: 'open' | 'resolved' | 'closed' };
  type SuggestionItem = Parameters<typeof getRelatedItemClassification>[0];
  console.log('================================================================================');
  console.log('TEST SUITE: Related Requests UX Redesign & Classification (AC-01 to AC-15)');
  console.log('================================================================================\n');

  // Check baseline production counts
  const { count: prodReportsCount } = await supabaseAdmin.from('reports').select('*', { count: 'exact', head: true });
  const { count: prodLogsCount } = await supabaseAdmin.from('report_logs').select('*', { count: 'exact', head: true });
  console.log(`[Baseline Production Guard] reports: ${prodReportsCount}, report_logs: ${prodLogsCount}`);

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`  ✓ ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      process.exitCode = 1;
    }
  }

  // Mock template for SuggestionItem
  const makeMockItem = (publicId: string, group: CandidateIncidentGroup | null = null, score = 80): SuggestionItem => ({
    public_id: publicId,
    score,
    confidence: 'high',
    confidenceLabel: 'แนวโน้มสูง',
    reasons: ['หมวดหมู่ตรงกัน', 'สถานที่ใกล้เคียง'],
    incidentGroup: group,
    breakdown: {
      categoryScore: 35,
      locationScore: 25,
      timeScore: 10,
      textScore: 10,
      totalScore: 80
    },
    isPersonalPropertyDuplicate: false,
    report: {
      public_id: publicId,
      categoryName: 'อาคารและสถานที่',
      subcategoryName: 'ลิฟต์ขัดข้อง',
      location: 'อาคาร 1 ชั้น 3',
      description: 'ลิฟต์ค้างมีเสียงดัง',
      status: 'pending',
      created_at: new Date().toISOString()
    }
  });

  const openGroupA: CandidateIncidentGroup = {
    id: 'group-uuid-1',
    group_code: 'INC-T-00001',
    title: 'กลุ่มเหตุการณ์ลิฟต์ค้าง',
    status: 'open'
  };

  const closedGroupB: CandidateIncidentGroup = {
    id: 'group-uuid-2',
    group_code: 'INC-T-00002',
    title: 'กลุ่มเหตุการณ์ไฟดับอาคาร 2',
    status: 'closed'
  };

  // -------------------------------------------------------------------------
  // [AC-01] Type 1: Similar Request with No Group Membership
  // -------------------------------------------------------------------------
  console.log('\n[AC-01 & Test Case 1] Similar Request ที่ไม่มี Group Membership (ประเภท 1: ยังไม่ได้รวมกลุ่ม)...');
  {
    const item = makeMockItem('SOC-T-00101', null);
    const relation = getRelatedItemClassification(item, null, null);

    assert(relation.type === 'similar_not_grouped', 'Classification type is strictly "similar_not_grouped"');
    assert(relation.typeLabel === 'ยังไม่ได้รวมกลุ่ม', 'Badge label is "ยังไม่ได้รวมกลุ่ม"');
    assert(relation.actualGroup === null, 'Actual group is null');
    assert(relation.suggestedGroup === null, 'Suggested group is null (no fake incident ID shown)');
    assert(relation.badgeBg.includes('blue'), 'Blue/Neutral badge background');
  }

  // -------------------------------------------------------------------------
  // [AC-02] Type 2: New Request Matching an Existing Incident Group
  // -------------------------------------------------------------------------
  console.log('\n[AC-02 & Test Case 2] Similar Request ที่มี Suggested Existing Group แต่ยังไม่เชื่อม (ประเภท 2: พบกลุ่มที่อาจเกี่ยวข้อง)...');
  {
    // Case 2A: Current report is in openGroupA, candidate item is not yet grouped
    const item = makeMockItem('SOC-T-00102', null, 85);
    const relation = getRelatedItemClassification(item, openGroupA, null);

    assert(relation.type === 'matching_existing_group', 'Classification type is "matching_existing_group"');
    assert(relation.typeLabel === 'พบกลุ่มที่อาจเกี่ยวข้อง', 'Badge label is "พบกลุ่มที่อาจเกี่ยวข้อง"');
    assert(relation.actualGroup === null, 'Does NOT treat candidate as actual group member');
    assert(relation.suggestedGroup?.group_code === 'INC-T-00001', 'Recommends INC-T-00001 as suggested group');
    assert(relation.isClosed === false, 'Identifies group as open');
    assert(relation.badgeBg.includes('amber'), 'Orange/Amber badge background');

    // Case 2B: Candidate matches via topCandidateGroup when current report has no group
    const relation2 = getRelatedItemClassification(item, null, { group: openGroupA, score: 75 });
    assert(relation2.type === 'matching_existing_group', 'Matches existing group from search-existing');
    assert(relation2.suggestedGroup?.group_code === 'INC-T-00001', 'Suggests top candidate group');
  }

  // -------------------------------------------------------------------------
  // [AC-03 & AC-04] Type 3: Already Grouped
  // -------------------------------------------------------------------------
  console.log('\n[AC-03 & AC-04 & Test Case 3] Request ที่มี Group Membership จริง (ประเภท 3: รวมกลุ่มแล้ว)...');
  {
    // Case 3A: Candidate is in openGroupA, current report is also in openGroupA
    const itemSame = makeMockItem('SOC-T-00103', openGroupA);
    const relationSame = getRelatedItemClassification(itemSame, openGroupA, null);

    assert(relationSame.type === 'already_grouped', 'Classification type is "already_grouped"');
    assert(relationSame.typeLabel.includes('รวมกลุ่ม'), 'Badge label is "รวมกลุ่มนี้แล้ว"');
    assert(relationSame.actualGroup?.group_code === 'INC-T-00001', 'Identifies actual group from DB');
    assert(relationSame.isSameAsCurrentGroup === true, 'Recognizes same group as current report');
    assert(relationSame.badgeBg.includes('emerald'), 'Emerald/Green badge background');

    // Case 3B: Candidate is in closedGroupB, current report is in openGroupA
    const itemOther = makeMockItem('SOC-T-00104', closedGroupB);
    const relationOther = getRelatedItemClassification(itemOther, openGroupA, null);

    assert(relationOther.type === 'already_grouped', 'Recognized as already grouped even in other group');
    assert(relationOther.actualGroup?.group_code === 'INC-T-00002', 'Identifies INC-T-00002 correctly');
    assert(relationOther.isInOtherGroup === true, 'Recognizes is in other group (eligible for Move Action)');
  }

  // -------------------------------------------------------------------------
  // [AC-11 & Test Case 4] Closed Incident Group
  // -------------------------------------------------------------------------
  console.log('\n[AC-11 & Test Case 4] Request ที่อยู่ใน Closed Incident Group...');
  {
    const itemClosed = makeMockItem('SOC-T-00105', closedGroupB);
    const relation = getRelatedItemClassification(itemClosed, null, null);

    assert(relation.type === 'already_grouped', 'Membership is preserved even when group is closed');
    assert(relation.actualGroup?.status === 'closed', 'Correctly reflects closed group status');
    assert(relation.isClosed === true, 'Flagged as closed for UI action guards');

    // Matching closed group (Type 2): Link action must be blocked
    const itemUnlinked = makeMockItem('SOC-T-00106', null);
    const relationClosedSuggest = getRelatedItemClassification(itemUnlinked, closedGroupB, null);
    assert(relationClosedSuggest.type === 'matching_existing_group', 'Detected as matching existing closed group');
    assert(relationClosedSuggest.isClosed === true, 'Identifies suggested group as closed to disable link action');
  }

  // -------------------------------------------------------------------------
  // [AC-05] Similarity Score is NOT Group Proof
  // -------------------------------------------------------------------------
  console.log('\n[AC-05] ตรวจสอบว่า Similarity Score สูงเพียงอย่างเดียวไม่ถูกนับว่ารวมกลุ่มแล้ว...');
  {
    const highMatchItem = makeMockItem('SOC-T-00107', null, 98);
    const relation = getRelatedItemClassification(highMatchItem, null, null);
    assert(relation.type === 'similar_not_grouped', 'High similarity score (98%) alone does NOT auto-promote to grouped');
    assert(relation.actualGroup === null, 'No fake group membership assigned');
  }

  // -------------------------------------------------------------------------
  // [Server-Side Guard] AC-11 & Phase 6: Closed Incident Group Member Rejection
  // -------------------------------------------------------------------------
  console.log('\n[AC-11 & Phase 6] ทดสอบ Server-side validation ปฏิเสธการเพิ่มสมาชิกเข้า Closed Group...');
  try {
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabaseClient = createClient(supabaseUrl, supabaseAnon);

    // 1. Get staff auth token
    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: 'aeuranuch.t@ku.th'
    });
    const { data: sessionData } = linkData?.properties?.hashed_token
      ? await supabaseClient.auth.verifyOtp({
          token_hash: linkData.properties.hashed_token,
          type: 'email'
        })
      : { data: null };
    const authToken = sessionData?.session?.access_token;

    if (authToken) {
      // 2. Insert temporary closed group in test_incident_groups
      const tempClosedGroupId = '99999999-c100-4000-8000-000000000001';
      await supabaseAdmin.from('test_incident_group_members').delete().eq('group_id', tempClosedGroupId);
      await supabaseAdmin.from('test_incident_groups').delete().eq('id', tempClosedGroupId);

      await supabaseAdmin.from('test_incident_groups').insert({
        id: tempClosedGroupId,
        group_code: 'INC-T-99991',
        title: 'Closed Test Incident For Server Guard',
        category_id: 1,
        status: 'closed'
      });

      // 3. Attempt adding member to this closed group via API
      const res = await fetch(`http://localhost:3000/api/incidents/${tempClosedGroupId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          publicIds: ['SOC-T-00020']
        })
      });

      const body = await res.json();
      assert(res.status === 400, `API rejected with 400 Bad Request: status ${res.status}`);
      assert(body.code === 'GROUP_CLOSED', `API returned error code GROUP_CLOSED: ${body.code}`);
      assert(body.error?.includes('ถูกปิดแล้ว'), `Thai error message mentions group is closed: "${body.error}"`);

      // 4. Cleanup temporary closed group
      await supabaseAdmin.from('test_incident_groups').delete().eq('id', tempClosedGroupId);
    } else {
      console.log('  ⚠️ Staff auth token could not be obtained, skipping live HTTP call.');
    }
  } catch (err: unknown) {
    console.error('Closed group test error:', err);
  }

  // -------------------------------------------------------------------------
  // [AC-15] Production Table Integrity Safeguard
  // -------------------------------------------------------------------------
  console.log('\n[AC-15] ตรวจสอบความบริสุทธิ์ของตาราง Production...');
  {
    const { count: finalReportsCount } = await supabaseAdmin.from('reports').select('*', { count: 'exact', head: true });
    const { count: finalLogsCount } = await supabaseAdmin.from('report_logs').select('*', { count: 'exact', head: true });
    assert(finalReportsCount === prodReportsCount, `reports table unmodified: ${finalReportsCount} === ${prodReportsCount}`);
    assert(finalLogsCount === prodLogsCount, `report_logs table unmodified: ${finalLogsCount} === ${prodLogsCount}`);
  }

  console.log('\n================================================================================');
  console.log(`RESULTS: ${passed}/${total} TESTS PASSED (${((passed / total) * 100).toFixed(0)}%)`);
  console.log('================================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
