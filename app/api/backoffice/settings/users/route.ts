import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// Helper to verify super_admin access
export async function verifySuperAdmin(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return { error: "Missing authorization header", status: 401 };

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  
  if (authError || !user) return { error: "Unauthorized", status: 401 };

  const { data: staffProfile } = await supabaseAdmin
    .from("staff_users")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!staffProfile || staffProfile.role !== "super_admin") {
    return { error: "Forbidden: Super Admin access required", status: 403 };
  }

  return { user, staffProfile };
}

// Log audit action helper
export async function logAuditAction(userId: string, action: string, target: string, details: any) {
  await supabaseAdmin.from("audit_logs").insert({
    user_id: userId,
    action,
    target,
    details
  });
}

export async function GET(req: Request) {
  try {
    const authResult = await verifySuperAdmin(req);
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // Get all users from auth
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
    if (authErr) throw authErr;

    // Get all staff profiles
    const { data: staffData, error: staffErr } = await supabaseAdmin
      .from("staff_users")
      .select(`
        id,
        full_name,
        role,
        department_id,
        status,
        departments(name_th)
      `);
    if (staffErr) throw staffErr;

    // Merge data
    const users = staffData.map((staff: any) => {
      const authUser = authData.users.find(u => u.id === staff.id);
      return {
        ...staff,
        email: authUser?.email || "-",
        last_login: authUser?.last_sign_in_at || null,
        created_at: authUser?.created_at || null,
      };
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error("GET /settings/users error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await verifySuperAdmin(req);
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json();
    const { email, password, full_name, department_id, role, status } = body;

    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Create auth user
    const { data: newAuthUser, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (createAuthErr) {
      return NextResponse.json({ error: createAuthErr.message }, { status: 400 });
    }

    const userId = newAuthUser.user.id;

    // 2. Create staff profile
    const { error: createStaffErr } = await supabaseAdmin
      .from("staff_users")
      .insert({
        id: userId,
        email,
        full_name,
        department_id: department_id || null,
        role,
        status: status || "active"
      });

    if (createStaffErr) {
      // Rollback auth user creation if staff profile fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: `Failed to create staff profile: ${createStaffErr.message}` }, { status: 500 });
    }

    // 3. Log action
    await logAuditAction(authResult.user!.id, "Create User", email, { role, department_id, status });

    return NextResponse.json({ success: true, userId });
  } catch (error: any) {
    console.error("POST /settings/users error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
