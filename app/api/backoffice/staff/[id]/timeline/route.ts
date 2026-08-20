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

    // Process Operated Reports from logs
    const operatedReportsMap = new Map<string, any>();
    
    // Logs are already sorted by created_at desc, so the first time we see a report_id, it's the latest action by this staff
    for (const log of (timeline || [])) {
      if (!log.reports) continue; // Safety check
      
      if (!operatedReportsMap.has(log.report_id)) {
        // Find the actual current report data for this report_id
        // Since the inner join on reports gives us limited data in the logs query, we might need to fetch the full report data
        // But let's just collect the report_ids first
        operatedReportsMap.set(log.report_id, {
          latestAction: log.action,
          latestActionDate: log.created_at,
          reportId: log.report_id
        });
      }
    }

    const reportIds = Array.from(operatedReportsMap.keys());
    let operatedReports: any[] = [];

    if (reportIds.length > 0) {
      // Fetch the full report details for these distinct reports
      const { data: reportsData, error: reportsError } = await supabaseAdmin
        .from("reports")
        .select("id, public_id, title, status, created_at, updated_at, categories (department_id, name)")
        .in("id", reportIds);
        
      if (reportsError) throw reportsError;

      operatedReports = (reportsData || []).map((report: any) => {
        const opData = operatedReportsMap.get(report.id);
        return {
          ...report,
          latestActionByStaff: opData.latestAction,
          latestActionDateByStaff: opData.latestActionDate
        };
      });
      
      // Sort operatedReports by the staff's latest action date descending
      operatedReports.sort((a, b) => new Date(b.latestActionDateByStaff).getTime() - new Date(a.latestActionDateByStaff).getTime());
    }

    return NextResponse.json({
      timeline,
      operatedReports
    });

  } catch (error: any) {
    console.error("Staff Timeline Error:", error);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}
