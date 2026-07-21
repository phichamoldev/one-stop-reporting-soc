require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function test() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: users, error: err } = await supabaseAdmin.from('staff_users').select('*');
  console.log("Staff users:", users);
  
  const { data: profile } = await supabaseAdmin.from('staff_users').select('*').eq('id', '062cab22-9dcf-4e0d-adbc-f6e9cd823b52').maybeSingle();
  console.log("Profile query result:", profile);
}

test();
