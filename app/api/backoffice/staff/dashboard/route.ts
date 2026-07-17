import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createClient } from "@supabase/supabase-js";
import { getAccessibleDepartmentIds } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Verify token
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify staff profile
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

    // 1. Fetch Staff Users with Departments
    let staffQuery = supabaseAdmin
      .from("staff_users")
      .select(`
        id,
        full_name,
        email,
        role,
        is_active,
        created_at,
        departments (
          id,
          name_th
        )
      `)
      .order("created_at", { ascending: false });

    // 2. Fetch Reports workloads
    let reportsQuery = supabaseAdmin
      .from("reports")
      .select("id, status, assigned_to");
      
    // Enforce permissions
    const accessibleDeptIds = await getAccessibleDepartmentIds(user.id, profile as any, supabaseAdmin);

    let filterOptions = { departments: [] as string[] };
    let allAllowedIds: string[] = [];

    if (accessibleDeptIds.length === 1 && accessibleDeptIds[0] === -1) {
      return NextResponse.json({ error: "คุณไม่มีสิทธิ์เข้าถึงข้อมูล", code: "NO_PERMISSION" }, { status: 403 });
    }

    if (accessibleDeptIds.length > 0) {
      const { data: deptData } = await supabaseAdmin
         .from("departments")
         .select("name_th")
         .in("id", accessibleDeptIds);
      filterOptions.departments = deptData ? deptData.map(d => d.name_th).filter(Boolean) : [];

      // Find managers of these departments
      const { data: mgrData } = await supabaseAdmin
        .from("manager_departments")
        .select("staff_user_id")
        .in("department_id", accessibleDeptIds);
      
      const mgrIds = mgrData ? mgrData.map(m => m.staff_user_id) : [];
      
      // Find staff in these departments
      const { data: staffIdsByDept } = await supabaseAdmin
        .from("staff_users")
        .select("id")
        .in("department_id", accessibleDeptIds);
        
      const staffIds = staffIdsByDept ? staffIdsByDept.map(s => s.id) : [];
      
      allAllowedIds = Array.from(new Set([...mgrIds, ...staffIds, user.id]));

      staffQuery = staffQuery.in("id", allAllowedIds);
      
      const { data: catData } = await supabaseAdmin
        .from("categories")
        .select("id")
        .in("department_id", accessibleDeptIds);
        
      const catIds = catData ? catData.map(c => c.id) : [];
      if (catIds.length > 0) {
        reportsQuery = reportsQuery.in("category_id", catIds);
      } else {
        reportsQuery = reportsQuery.in("category_id", [0]);
      }
    } else {
      const { data: deptData } = await supabaseAdmin.from("departments").select("name_th");
      filterOptions.departments = deptData ? deptData.map(d => d.name_th).filter(Boolean) : [];
    }

    const { data: staffUsers, error: staffError } = await staffQuery;

    if (staffError) {
      throw staffError;
    }

    const { data: reports, error: reportsError } = await reportsQuery;

    if (reportsError) {
      throw reportsError;
    }

    // 3. Fetch Recent Activities (Logs)
    let logsQuery = supabaseAdmin
      .from("report_logs")
      .select(`
        id,
        report_id,
        user_id,
        action,
        old_status,
        new_status,
        remark,
        created_at,
        staff_users (
          full_name
        ),
        reports!inner (
          public_id,
          category_id
        )
      `)
      .order("created_at", { ascending: false })
      .limit(20);

    if (accessibleDeptIds.length > 0) {
      const { data: catData } = await supabaseAdmin
        .from("categories")
        .select("id")
        .in("department_id", accessibleDeptIds);
        
      const catIds = catData ? catData.map(c => c.id) : [];
      if (catIds.length > 0) {
        logsQuery = logsQuery.in("reports.category_id", catIds);
      } else {
        logsQuery = logsQuery.in("reports.category_id", [0]);
      }
      
      // Also strictly show only actions performed by staff in these departments (excludes Admin actions)
      if (allAllowedIds.length > 0) {
        logsQuery = logsQuery.in("user_id", allAllowedIds);
      }
    }

    const { data: recentLogs, error: logsError } = await logsQuery;

    if (logsError) {
      throw logsError;
    }

    // Process data for KPIs and Workloads
    let kpis = {
      total: 0,
      staff: 0,
      manager: 0,
      admin: 0
    };

    const staffStats: Record<string, any> = {};

    staffUsers?.forEach((staff: any) => {
      kpis.total++;
      if (staff.role === "staff") kpis.staff++;
      if (staff.role === "manager") kpis.manager++;
      if (staff.role === "admin" || staff.role === "super_admin") kpis.admin++;

      staffStats[staff.id] = {
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        cancelled: 0,
        rejected: 0,
        completionRate: 0
      };
    });

    reports?.forEach((report: any) => {
      if (report.assigned_to && staffStats[report.assigned_to]) {
        const stats = staffStats[report.assigned_to];
        stats.total++;
        if (report.status === "pending") stats.pending++;
        if (report.status === "in_progress") stats.inProgress++;
        if (report.status === "completed") stats.completed++;
        if (report.status === "cancelled") stats.cancelled++;
        if (report.status === "rejected") stats.rejected++;
      }
    });

    // Calculate Completion Rate
    Object.keys(staffStats).forEach((staffId) => {
      const stats = staffStats[staffId];
      if (stats.total > 0) {
        stats.completionRate = Math.round((stats.completed / stats.total) * 100);
      }
    });

    // Merge staff data with stats
    const staffWithStats = staffUsers?.map((staff: any) => ({
      ...staff,
      stats: staffStats[staff.id] || {
        total: 0, pending: 0, inProgress: 0, completed: 0, cancelled: 0, rejected: 0, completionRate: 0
      }
    }));

    return NextResponse.json({
      kpis,
      staff: staffWithStats,
      recentLogs,
      filterOptions
    });

  } catch (error: any) {
    console.error("Dashboard Staff Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
