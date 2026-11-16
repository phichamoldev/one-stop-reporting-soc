import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const localClient = createClient(
  'http://127.0.0.1:54321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
);

const remoteClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function inspect() {
  console.log("=== LOCAL DB (127.0.0.1:54321) ===");
  const { data: locStaff, error: locStaffErr } = await localClient.from('staff_users').select('id, full_name, role, status');
  console.log("Local staff_users count:", locStaff?.length, "error:", locStaffErr?.message);
  console.log("Local staff sample:", locStaff?.slice(0, 5));

  const { data: locAuth, error: locAuthErr } = await localClient.auth.admin.listUsers();
  console.log("Local auth.users count:", locAuth?.users?.length, "error:", locAuthErr?.message);
  console.log("Local auth emails:", locAuth?.users?.map(u => ({ id: u.id, email: u.email })));

  console.log("\n=== REMOTE DB ===");
  const { data: remStaff, error: remStaffErr } = await remoteClient.from('staff_users').select('id, full_name, role, status');
  console.log("Remote staff_users count:", remStaff?.length, "error:", remStaffErr?.message);
  console.log("Remote staff sample:", remStaff?.slice(0, 5));

  const { data: remAuth, error: remAuthErr } = await remoteClient.auth.admin.listUsers();
  console.log("Remote auth.users count:", remAuth?.users?.length, "error:", remAuthErr?.message);
  console.log("Remote auth emails:", remAuth?.users?.map(u => ({ id: u.id, email: u.email })));
}

inspect();

