import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../src/lib/supabase-admin";

async function main() {
  const localClient = createClient(
    "http://127.0.0.1:54321",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
  );

  const { data: authData, error: authError } = await localClient.auth.signInWithPassword({
    email: "admin_p3@soc.test",
    password: "Password123!",
  });

  if (authError || !authData.session) {
    console.error("Sign in failed:", authError);
    return;
  }

  console.log("Logged in user id:", authData.session.user.id);
  const token = authData.session.access_token;

  // Test admin getUser
  const { data: { user }, error: verifyError } = await supabaseAdmin.auth.getUser(token);
  if (verifyError || !user) {
    console.error("Verification failed:", verifyError);
    return;
  }
  console.log("Verified user id via supabaseAdmin:", user.id);

  // Test staff_users lookup
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("staff_users")
    .select("id, full_name, role, status, department_id")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Profile lookup error:", profileError);
    return;
  }

  console.log("Profile found:", profile);
}

main().catch(console.error);
