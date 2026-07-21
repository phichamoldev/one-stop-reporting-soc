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
  
  // Also check auth.users to see if admin@ku.th exists
  const { data: authUsers, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
  console.log("Auth users matching admin@ku.th:", authUsers?.users?.filter(u => u.email === 'admin@ku.th'));
}

test();
