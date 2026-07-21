require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function test() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Check policies on staff_users
  const { data, error } = await supabaseAdmin.rpc('get_policies_for_table', { table_name: 'staff_users' }).catch(() => ({data: null}));
  if (data) console.log(data);
  else {
    // try to query pg_policies
    const { data: policies } = await supabaseAdmin.from('pg_policies').select('*').eq('tablename', 'staff_users').catch(()=>({data:[]}));
    console.log("Policies:", policies);
  }
}

test();
