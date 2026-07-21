import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAccessibleDepartmentIds } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Verify token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staffId = id;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("staff_users")
      .select("role, department_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (profile.role === "staff") {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    if (profile.role === "manager") {
      const accessibleDeptIds = await getAccessibleDepartmentIds(user.id, profile as any, supabaseAdmin);
      
      const { data: targetStaff, error: targetStaffError } = await supabaseAdmin
        .from("staff_users")
        .select("department_id")
        .eq("id", staffId)
        .maybeSingle();

      if (targetStaffError || !targetStaff) {
        return NextResponse.json({ error: "Staff not found" }, { status: 404 });
      }

      if (!targetStaff.department_id || !accessibleDeptIds.includes(targetStaff.department_id)) {
        return NextResponse.json({ error: "Access Denied" }, { status: 403 });
      }
    }

    // Fetch Timeline Activities (Logs) for this user
    const { data: timeline, error: logsError } = await supabaseAdmin
      .from("report_logs")
      .select(`
        id,
        report_id,
        action,
        old_status,
        new_status,
        remark,
        created_at,
        reports (
          public_id,
          title
        )
      `)
      .eq("user_id", staffId)
      .order("created_at", { ascending: false });

    if (logsError) {
      throw logsError;
    }

    return NextResponse.json({
      timeline
    });

  } catch (error: any) {
    console.error("Staff Timeline Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
