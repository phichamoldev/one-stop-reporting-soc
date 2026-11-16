process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
process.env.REPORT_DATA_SOURCE = 'test';
process.env.LINE_NOTIFICATIONS_ENABLED = 'false';

import { createClient } from '@supabase/supabase-js';

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export async function setupTestUsers() {
  const users = [
    { email: 'admin_p3@soc.test', password: 'Password123!', role: 'super_admin', dept: null, status: 'active', name: 'Super Admin P3' },
    { email: 'manager_p3@soc.test', password: 'Password123!', role: 'manager', dept: 1, status: 'active', name: 'Manager P3' },
    { email: 'staff1_p3@soc.test', password: 'Password123!', role: 'staff', dept: 1, status: 'active', name: 'Staff Dept 1 P3' },
    { email: 'staff2_p3@soc.test', password: 'Password123!', role: 'staff', dept: 2, status: 'active', name: 'Staff Dept 2 P3' },
    { email: 'suspended_p3@soc.test', password: 'Password123!', role: 'staff', dept: 1, status: 'suspended', name: 'Suspended Staff P3' },
  ];

  const tokens: Record<string, { userId: string; token: string }> = {};

  for (const u of users) {
    // Delete if existing
    const { data: existingList } = await admin.auth.admin.listUsers();
    const existing = existingList?.users?.find(x => x.email === u.email);
    if (existing) {
      await admin.auth.admin.deleteUser(existing.id);
    }

    // Create auth user
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    if (createErr || !newUser?.user) {
      throw new Error(`Failed to create auth user ${u.email}: ${createErr?.message}`);
    }

    const userId = newUser.user.id;

    // Create staff_user with id = userId
    const { error: staffErr } = await admin.from('staff_users').insert({
      id: userId,
      email: u.email,
      full_name: u.name,
      department_id: u.dept,
      role: u.role,
      status: u.status,
    });
    if (staffErr) {
      throw new Error(`Failed to create staff_user for ${u.email}: ${staffErr.message}`);
    }

    // If manager, insert into manager_departments for depts 1 and 2
    if (u.role === 'manager') {
      await admin.from('manager_departments').insert([
        { staff_user_id: userId, department_id: 1 },
        { staff_user_id: userId, department_id: 2 },
      ]);
    }

    // Sign in to get access token
    const { data: sessionData, error: signErr } = await anon.auth.signInWithPassword({
      email: u.email,
      password: u.password,
    });
    if (signErr || !sessionData?.session?.access_token) {
      throw new Error(`Failed to sign in ${u.email}: ${signErr?.message}`);
    }

    tokens[u.email] = {
      userId,
      token: sessionData.session.access_token,
    };
  }

  console.log('Successfully set up test users and acquired tokens:');
  for (const [k, v] of Object.entries(tokens)) {
    console.log(`  - ${k}: userId=${v.userId}, token=${v.token.slice(0, 15)}...`);
  }
  return tokens;
}

if (require.main === module) {
  setupTestUsers().catch(console.error);
}

