import { createClient } from '@supabase/supabase-js';

const localClient = createClient(
  'http://127.0.0.1:54321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
);

async function testStaffAuth() {
  console.log("Authenticating staff admin_p3@soc.test...");
  const { data, error } = await localClient.auth.signInWithPassword({
    email: 'admin_p3@soc.test',
    password: 'Password123!',
  });

  if (error || !data.session) {
    throw new Error("Staff auth failed: " + error?.message);
  }

  console.log("Staff auth OK! Token:", data.session.access_token.slice(0, 25));
  return data.session.access_token;
}

testStaffAuth().catch(console.error);

