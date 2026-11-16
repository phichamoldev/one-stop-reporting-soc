import { createClient } from '@supabase/supabase-js';

const localClient = createClient(
  'http://127.0.0.1:54321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
);

async function testLogin() {
  console.log("Testing signInWithPassword on local Supabase with Password123!...");
  const { data, error } = await localClient.auth.signInWithPassword({
    email: 'admin_p3@soc.test',
    password: 'Password123!',
  });
  console.log("Login result:", { user: data.user?.email, userId: data.user?.id, token: data.session?.access_token?.slice(0, 20), error: error?.message });
}

testLogin();
