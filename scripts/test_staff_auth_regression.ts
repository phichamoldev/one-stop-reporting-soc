import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

async function main() {
  console.log("=== STARTING STAFF AUTH REGRESSION TESTS ===");
  const authClient = createClient(LOCAL_URL, LOCAL_ANON_KEY);
  const adminClient = createClient(LOCAL_URL, LOCAL_SERVICE_KEY);

  // 1. Test Active Staff (Super Admin)
  console.log("\n[TEST 1] Logging in as active super_admin: admin_p3@soc.test...");
  const { data: adminLogin, error: adminErr } = await authClient.auth.signInWithPassword({
    email: "admin_p3@soc.test",
    password: "Password123!",
  });
  if (adminErr || !adminLogin.session) {
    throw new Error(`Failed to sign in as admin_p3: ${adminErr?.message}`);
  }
  const adminToken = adminLogin.session.access_token;

  const adminProfileRes = await fetch("http://localhost:3000/api/staff/profile", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminProfileData = await adminProfileRes.json();
  console.log(`Response Status: ${adminProfileRes.status}`);
  console.log(`Profile:`, adminProfileData);
  if (adminProfileRes.status !== 200 || adminProfileData.profile.role !== "super_admin") {
    throw new Error("TEST 1 FAILED: Expected 200 OK with role super_admin");
  }
  console.log("--> TEST 1 PASSED: Active super_admin returned 200 OK with correct profile");

  // 2. Test Suspended Staff
  console.log("\n[TEST 2] Logging in as suspended staff: suspended_p3@soc.test...");
  const { data: suspLogin, error: suspErr } = await authClient.auth.signInWithPassword({
    email: "suspended_p3@soc.test",
    password: "Password123!",
  });
  if (suspErr || !suspLogin.session) {
    throw new Error(`Failed to sign in as suspended_p3: ${suspErr?.message}`);
  }
  const suspToken = suspLogin.session.access_token;

  const suspProfileRes = await fetch("http://localhost:3000/api/staff/profile", {
    headers: { Authorization: `Bearer ${suspToken}` },
  });
  const suspProfileData = await suspProfileRes.json();
  console.log(`Response Status: ${suspProfileRes.status}`);
  console.log(`Response Data:`, suspProfileData);
  if (suspProfileRes.status !== 403 || suspProfileData.code !== "ACCOUNT_SUSPENDED") {
    throw new Error("TEST 2 FAILED: Expected 403 Forbidden with ACCOUNT_SUSPENDED");
  }
  console.log("--> TEST 2 PASSED: Suspended staff rejected with 403 ACCOUNT_SUSPENDED");

  // 3. Test User Not In staff_users (Regular citizen / orphan auth user)
  console.log("\n[TEST 3] Creating temporary citizen user without staff record...");
  const citizenEmail = `citizen_${Date.now()}@example.com`;
  const { data: citizenAuth, error: citizenCreateErr } = await adminClient.auth.admin.createUser({
    email: citizenEmail,
    password: "Password123!",
    email_confirm: true,
  });
  if (citizenCreateErr || !citizenAuth.user) {
    throw new Error(`Failed to create citizen: ${citizenCreateErr?.message}`);
  }

  const { data: citizenLogin } = await authClient.auth.signInWithPassword({
    email: citizenEmail,
    password: "Password123!",
  });
  const citizenToken = citizenLogin!.session!.access_token;

  const citizenProfileRes = await fetch("http://localhost:3000/api/staff/profile", {
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  const citizenProfileData = await citizenProfileRes.json();
  console.log(`Response Status: ${citizenProfileRes.status}`);
  console.log(`Response Data:`, citizenProfileData);
  if (citizenProfileRes.status !== 404 || citizenProfileData.code !== "STAFF_NOT_FOUND") {
    throw new Error("TEST 3 FAILED: Expected 404 Not Found with STAFF_NOT_FOUND");
  }
  console.log("--> TEST 3 PASSED: Non-staff user rejected with 404 STAFF_NOT_FOUND");

  // Cleanup citizen user
  await adminClient.auth.admin.deleteUser(citizenAuth.user.id);

  // 4. Test Missing Token
  console.log("\n[TEST 4] Calling profile route with missing token...");
  const noTokenRes = await fetch("http://localhost:3000/api/staff/profile");
  console.log(`Response Status: ${noTokenRes.status}`);
  if (noTokenRes.status !== 401) {
    throw new Error("TEST 4 FAILED: Expected 401 Unauthorized");
  }
  console.log("--> TEST 4 PASSED: Missing token rejected with 401");

  console.log("\n==========================================");
  console.log("ALL 4 STAFF AUTH REGRESSION TESTS PASSED!");
  console.log("==========================================");
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});

