import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function inspectIncident() {
  console.log("=== CHECKING INC-T-00010 IN TEST_INCIDENT_GROUPS ===");
  const { data: testGroup } = await supabase
    .from('test_incident_groups')
    .select('*')
    .eq('group_code', 'INC-T-00010');
  console.log("testGroup:", testGroup);

  if (testGroup && testGroup.length > 0) {
    const groupId = testGroup[0].id;
    console.log("GroupId:", groupId);

    const { data: members, error: mErr } = await supabase
      .from('test_incident_group_members')
      .select('*')
      .eq('group_id', groupId);
    console.log("members:", members, "mErr:", mErr);

    if (members && members.length > 0) {
      const repIds = members.map((m: any) => m.report_id);
      console.log("Member report_ids:", repIds);

      const { data: reps, error: rErr } = await supabase
        .from('test_reports')
        .select('id, public_id, category_id, subcategory_id, location, description, status, priority, created_at')
        .in('id', repIds);
      console.log("Member test_reports:", reps, "rErr:", rErr);
    }

    const { data: history, error: hErr } = await supabase
      .from('test_incident_group_history')
      .select('*')
      .eq('group_id', groupId);
    console.log("history:", history, "hErr:", hErr);
  }

  console.log("\n=== QUERYING REPORTS WHERE PUBLIC_ID IN SOC-T-00020, SOC-T-00256, SOC-T-00255 ===");
  const pids = ['SOC-T-00020', 'SOC-T-00256', 'SOC-T-00255'];
  const { data: tr, error: trErr } = await supabase
    .from('test_reports')
    .select('id, public_id, category_id, subcategory_id, location, description, status, priority, created_at')
    .in('public_id', pids);
  console.log("test_reports with pids:", tr, "error:", trErr);

  // Check if those reports belong to any group in test_incident_group_members
  if (tr && tr.length > 0) {
    const trIds = tr.map((r: any) => r.id);
    const { data: trMemberships } = await supabase
      .from('test_incident_group_members')
      .select('*, test_incident_groups(id, group_code, title, status)')
      .in('report_id', trIds);
    console.log("trMemberships:", JSON.stringify(trMemberships, null, 2));
  }

  // Check prod reports as well
  const { data: pr } = await supabase
    .from('reports')
    .select('id, public_id, category_id, subcategory_id, location, description, status, priority, created_at')
    .in('public_id', pids);
  console.log("prod reports with pids:", pr);

  // Check test_reports with similar public_id
  const { data: otherTr } = await supabase
    .from('test_reports')
    .select('public_id, location, description')
    .ilike('public_id', 'SOC-T-000%')
    .limit(20);
  console.log("Sample test_reports with SOC-T-000*:", otherTr);
}

inspectIncident().catch(console.error);
