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
        departments(name_th),
        manager_departments(department_id)
      `);
    if (staffErr) throw staffErr;

    // Merge data
    const users = staffData.map((staff: any) => {
      const authUser = authData.users.find(u => u.id === staff.id);
      
      const userData: any = {
        ...staff,
        email: authUser?.email || "-",
        last_login: authUser?.last_sign_in_at || null,
        created_at: authUser?.created_at || null,
      };

      // Strict Scope: Only expose manager_departments to manager role
      // to ensure Staff data/logic remains unchanged.
      if (staff.role !== 'manager') {
        delete userData.manager_departments;
      }
      
      return userData;
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
    const { email, password, full_name, department_id, department_ids, role, status } = body;

    if (!email || !full_name || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    if (password === undefined || password === null || password.trim() === "") {
      return NextResponse.json({ error: "Password cannot be empty" }, { status: 400 });
    }

    let finalPrimaryDeptId = department_id ? Number(department_id) : null;
    let finalDeptIds: number[] = [];

    if (role === "manager") {
      if (Array.isArray(department_ids) && department_ids.length > 0) {
        finalDeptIds = Array.from(new Set(department_ids.map(Number)));
        finalPrimaryDeptId = finalDeptIds[0];
      } else if (department_id) {
        finalDeptIds = [Number(department_id)];
        finalPrimaryDeptId = Number(department_id);
      } else {
        return NextResponse.json({ error: "Manager must have at least one department" }, { status: 400 });
      }
    }

    // 1. Create auth user
    const { data: newAuthUser, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (createAuthErr) {
      return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 400 });
    }

    const userId = newAuthUser.user.id;

    // 2. Create staff profile
    const { error: createStaffErr } = await supabaseAdmin
      .from("staff_users")
      .insert({
        id: userId,
        email,
        full_name,
        department_id: finalPrimaryDeptId,
        role,
        status: status || "active"
      });

    if (createStaffErr) {
      // Rollback auth user creation if staff profile fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: `Failed to create staff profile: ${createStaffErr.message}` }, { status: 500 });
    }

    // 2.5 Assign manager departments if role is manager
    if (role === "manager" && finalDeptIds.length > 0) {
      const deptInserts = finalDeptIds.map(dId => ({
        staff_user_id: userId,
        department_id: dId
      }));
      
      const { error: managerDeptsErr } = await supabaseAdmin
        .from("manager_departments")
        .insert(deptInserts);

      if (managerDeptsErr) {
        // Rollback
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: `Failed to assign manager departments: ${managerDeptsErr.message}` }, { status: 500 });
      }
    }

    // 3. Log action
    await logAuditAction(authResult.user!.id, "Create User", email, { role, department_id: finalPrimaryDeptId, department_ids: finalDeptIds, status });

    return NextResponse.json({ success: true, userId });
  } catch (error: any) {
    console.error("POST /settings/users error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
