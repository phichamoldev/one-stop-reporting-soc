require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function test() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Sign in
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@ku.th',
    password: 'password123' // assuming this is a real user, but we can't be sure
  });

  if (error) {
    console.log("Login Error:", error);
    return;
  }

  const token = data.session.access_token;
  console.log("Token:", token.substring(0, 20) + "...");

  // Validate token with admin client
  const { data: adminData, error: adminError } = await supabaseAdmin.auth.getUser(token);
  
  if (adminError) {
    console.log("Admin GetUser Error:", adminError);
  } else {
    console.log("Admin GetUser Success! User ID:", adminData.user.id);
  }
}

test();
