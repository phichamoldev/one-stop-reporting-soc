require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function test() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const email = `test_${Date.now()}@example.com`;
  const password = 'testpassword123';
  
  const { data: user } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  const { data: sessionData } = await supabase.auth.signInWithPassword({ email, password });

  const token = sessionData.session.access_token;
  console.log("Got token length:", token.length);

  // Test Vercel API
  const res = await fetch('https://supportsoc.vercel.app/api/staff/profile', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  console.log("Vercel Status:", res.status);
  console.log("Vercel Response:", await res.json());

  await supabaseAdmin.auth.admin.deleteUser(user.user.id);
}

test();
