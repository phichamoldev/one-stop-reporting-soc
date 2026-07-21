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

  // 1. Create a dummy user
  const email = `test_${Date.now()}@example.com`;
  const password = 'testpassword123';
  
  const { data: user, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (createError) {
    console.log("Create user error:", createError);
    return;
  }
  
  console.log("Created user:", user.user.id);

  // 2. Sign in with the dummy user to get a token
  const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInError) {
    console.log("Sign in error:", signInError);
    return;
  }

  const token = sessionData.session.access_token;
  console.log("Got token:", token.substring(0, 20) + "...");

  // 3. Test supabaseAdmin.auth.getUser(token)
  const { data: adminData, error: adminError } = await supabaseAdmin.auth.getUser(token);
  
  if (adminError) {
    console.log("Admin GetUser Error:", adminError);
  } else {
    console.log("Admin GetUser Success! User ID:", adminData.user.id);
  }

  // 4. Cleanup
  await supabaseAdmin.auth.admin.deleteUser(user.user.id);
  console.log("Cleaned up user.");
}

test();
