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

    // Process query params
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "5", 10);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const offset = (page - 1) * limit;

    // Fetch Completed Reports for this user
    // Requirements: completed_by = staffId, status = 'completed', ordered by completed_at DESC
    
    // Query count
    const { count, error: countError } = await supabaseAdmin
      .from("reports")
      .select("*", { count: "exact", head: true })
      .eq("completed_by", staffId)
      .eq("status", "completed");

    if (countError) {
      throw countError;
    }

    // Query data
    const { data: history, error: historyError } = await supabaseAdmin
      .from("reports")
      .select("id, public_id, title, completed_at, admin_remark")
      .eq("completed_by", staffId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (historyError) {
      throw historyError;
    }

    return NextResponse.json({
      history: history || [],
      total: count || 0,
      page,
      limit,
      hasMore: (count || 0) > offset + limit
    });

  } catch (error: any) {
    console.error("Staff History Error:", error);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}