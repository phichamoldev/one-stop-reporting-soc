import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function inspectMembersOfInc10() {
  const { data: testGroup } = await supabase
    .from('test_incident_groups')
    .select('*')
    .eq('group_code', 'INC-T-00010')
    .single();

  console.log("=== GROUP INC-T-00010 ===");
  console.log(testGroup);

  const { data: members } = await supabase
    .from('test_incident_group_members')
    .select('*, test_reports(id, public_id, location, description, category_id, subcategory_id, created_at)')
    .eq('group_id', testGroup.id);

  console.log(`\n=== MEMBERS OF INC-T-00010 (${members?.length} members) ===`);
  members?.forEach((m: any, idx: number) => {
    console.log(`\nMember #${idx + 1}:`);
    console.log(`  Report Public ID: ${m.test_reports?.public_id}`);
    console.log(`  Location:         ${m.test_reports?.location}`);
    console.log(`  Description:      ${m.test_reports?.description}`);
    console.log(`  Category ID:      ${m.test_reports?.category_id}, Subcategory ID: ${m.test_reports?.subcategory_id}`);
    console.log(`  Added At:         ${m.added_at}`);
    console.log(`  Added By:         ${m.added_by}`);
    console.log(`  Notes:            ${m.notes}`);
  });

  const { data: history } = await supabase
    .from('test_incident_group_history')
    .select('*')
    .eq('group_id', testGroup.id)
    .order('created_at', { ascending: true });

  console.log(`\n=== HISTORY OF INC-T-00010 (${history?.length} entries) ===`);
  history?.forEach((h: any, idx: number) => {
    console.log(`\nHistory Entry #${idx + 1}:`);
    console.log(`  Action:     ${h.action}`);
    console.log(`  Actor Name: ${h.actor_name}`);
    console.log(`  Report ID:  ${h.report_id}`);
    console.log(`  Details:    `, h.details);
    console.log(`  Created At: ${h.created_at}`);
  });
}

inspectMembersOfInc10().catch(console.error);
