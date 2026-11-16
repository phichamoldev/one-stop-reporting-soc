import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { detectIncidentContradiction, extractSystemEntity, extractSpatialAnchor } from '../src/lib/similarityDetector';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function auditAllGroups() {
  const { data: groups } = await supabase
    .from('test_incident_groups')
    .select('id, group_code, title, category_id, status, created_at')
    .order('created_at', { ascending: false });

  console.log(`Auditing ${groups?.length} test incident groups...`);

  for (const g of groups || []) {
    const { data: members } = await supabase
      .from('test_incident_group_members')
      .select('*, test_reports(id, public_id, location, description, category_id, subcategory_id, created_at)')
      .eq('group_id', g.id);

    console.log(`\nGroup ${g.group_code} ("${g.title}") - Members: ${members?.length || 0}`);
    const repList = (members || []).map((m: any) => m.test_reports).filter(Boolean);

    let foundContradictionInGroup = false;
    for (let i = 0; i < repList.length; i++) {
      for (let j = i + 1; j < repList.length; j++) {
        const repA = repList[i];
        const repB = repList[j];
        const contra = detectIncidentContradiction(repA, repB);
        if (contra.isContradiction) {
          foundContradictionInGroup = true;
          console.log(`  ❌ CONTRADICTION BETWEEN ${repA.public_id} AND ${repB.public_id}:`);
          console.log(`     A: [${repA.location}] ${repA.description}`);
          console.log(`     B: [${repB.location}] ${repB.description}`);
          console.log(`     Reasons: ${contra.reasons.join(', ')}`);
        }
      }
    }
    if (!foundContradictionInGroup) {
      console.log(`  ✅ All ${repList.length} members are compatible.`);
    }
  }
}

auditAllGroups().catch(console.error);
