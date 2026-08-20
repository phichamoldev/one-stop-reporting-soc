import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
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
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
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
        ),
        manager_departments (
          departments (
            id,
            name_th
          )
        )
      `)
      .order("created_at", { ascending: false });

    // 2. Fetch Report Logs for workloads
    let logsForWorkloadQuery = supabaseAdmin
      .from("report_logs")
      .select("report_id, user_id, new_status, created_at")
      .order("created_at", { ascending: false });
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
        // Unfortunately we can't easily filter report_logs by category directly in the query 
        // without an inner join, but since we are doing data processing we will fetch all 
        // logs for allowed userIds first.
        logsForWorkloadQuery = logsForWorkloadQuery.in("user_id", allAllowedIds);
      } else {
        logsForWorkloadQuery = logsForWorkloadQuery.in("user_id", [-1]); // No categories allowed
      }
    } else {
      const { data: deptData } = await supabaseAdmin.from("departments").select("name_th");
      filterOptions.departments = deptData ? deptData.map(d => d.name_th).filter(Boolean) : [];
    }

    const { data: staffUsers, error: staffError } = await staffQuery;

    if (staffError) {
      throw staffError;
    }

    const { data: reportLogsData, error: logsWorkloadError } = await logsForWorkloadQuery;

    if (logsWorkloadError) {
      throw logsWorkloadError;
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
      totalStaff: 0,
      totalOperations: 0,
      pending: 0,
      inProgress: 0,
      completed: 0
    };

    const staffStats: Record<string, any> = {};

    staffUsers?.forEach((staff: any) => {
      kpis.totalStaff++;

      staffStats[staff.id] = {
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        rejected: 0,
        completionRate: 0,
        // Internal sets to keep track of distinct report_ids
        _reportsTotal: new Set(),
        _reportsPending: new Set(),
        _reportsInProgress: new Set(),
        _reportsCompleted: new Set(),
        _reportsRejected: new Set(),
      };
    });

    reportLogsData?.forEach((log: any) => {
      if (log.user_id && staffStats[log.user_id]) {
        const stats = staffStats[log.user_id];
        
        stats._reportsTotal.add(log.report_id);
        
        if (log.new_status === "pending" || log.new_status === "received") {
          stats._reportsPending.add(log.report_id);
        }
        if (log.new_status === "in_progress") {
          stats._reportsInProgress.add(log.report_id);
        }
        if (log.new_status === "completed") {
          stats._reportsCompleted.add(log.report_id);
        }
        if (log.new_status === "rejected" || log.new_status === "cancelled") {
          stats._reportsRejected.add(log.report_id);
        }
      }
    });

    // We also need global distinct counts for KPIs among allowed staff
    const globalTotal = new Set();
    const globalPending = new Set();
    const globalInProgress = new Set();
    const globalCompleted = new Set();

    Object.keys(staffStats).forEach((staffId) => {
      const stats = staffStats[staffId];
      
      stats.total = stats._reportsTotal.size;
      stats.pending = stats._reportsPending.size;
      stats.inProgress = stats._reportsInProgress.size;
      stats.completed = stats._reportsCompleted.size;
      stats.rejected = stats._reportsRejected.size;
      
      // Calculate Completion Rate
      if (stats.total > 0) {
        stats.completionRate = Math.round((stats.completed / stats.total) * 100);
      }
      
      // Add to global sets
      stats._reportsTotal.forEach((id: string) => globalTotal.add(id));
      stats._reportsPending.forEach((id: string) => globalPending.add(id));
      stats._reportsInProgress.forEach((id: string) => globalInProgress.add(id));
      stats._reportsCompleted.forEach((id: string) => globalCompleted.add(id));

      // Delete the sets so they are not sent to client
      delete stats._reportsTotal;
      delete stats._reportsPending;
      delete stats._reportsInProgress;
      delete stats._reportsCompleted;
      delete stats._reportsRejected;
    });

    kpis.totalOperations = globalTotal.size;
    kpis.pending = globalPending.size;
    kpis.inProgress = globalInProgress.size;
    kpis.completed = globalCompleted.size;

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
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}
