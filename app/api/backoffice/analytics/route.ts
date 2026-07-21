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
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("staff_users")
      .select("role, department_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Staff profile not found" }, { status: 403 });
    }

    const { role } = profile;
    
    // RBAC: staff cannot access analytics
    if (role === "staff") {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const dateRange = searchParams.get("dateRange");
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const deptId = searchParams.get("department");

    let query = supabaseAdmin
      .from("reports")
      .select(`
        *,
        categories (
          id, name_th, department_id,
          departments (
            id, name_th
          )
        ),
        subcategories (
          id, name_th
        )
      `)
      .order("created_at", { ascending: true }); // Ascending to help with longest open

    // Get authorized departments
    const accessibleDeptIds = await getAccessibleDepartmentIds(user.id, profile, supabaseAdmin);

    if (accessibleDeptIds.length === 1 && accessibleDeptIds[0] === -1) {
      return NextResponse.json({ error: "คุณไม่มีสิทธิ์เข้าถึงข้อมูล", code: "NO_PERMISSION" }, { status: 403 });
    }

    // If the frontend requests a specific department, enforce that it's within the accessible set
    let deptIdsToQuery: number[] = [];
    
    if (deptId && deptId !== "all") {
       const requestedDept = parseInt(deptId, 10);
       if (accessibleDeptIds.length === 0 || accessibleDeptIds.includes(requestedDept)) {
          deptIdsToQuery = [requestedDept];
       } else {
          deptIdsToQuery = [-1]; // Fallback to no access if they try to access an unauthorized dept
       }
    } else {
       deptIdsToQuery = accessibleDeptIds;
    }

    if (deptIdsToQuery.length > 0) {
      const { data: catData } = await supabaseAdmin
        .from("categories")
        .select("id")
        .in("department_id", deptIdsToQuery);
        
      const catIds = catData ? catData.map(c => c.id) : [];
      if (catIds.length > 0) {
        query = query.in("category_id", catIds);
      } else {
        query = query.in("category_id", [0]);
      }
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (category && category !== "all") {
      query = query.eq("category_id", parseInt(category, 10));
    }

    if (dateRange && dateRange !== "all") {
      const now = new Date();
      let startDate = new Date();
      
      if (dateRange === "today") {
        startDate.setHours(0, 0, 0, 0);
      } else if (dateRange === "7days") {
        startDate.setDate(now.getDate() - 7);
      } else if (dateRange === "30days") {
        startDate.setDate(now.getDate() - 30);
      } else if (dateRange === "90days") {
        startDate.setDate(now.getDate() - 90);
      } else if (dateRange === "year") {
        startDate.setFullYear(now.getFullYear() - 1);
      }
      
      query = query.gte("created_at", startDate.toISOString());
    }

    // Since this is analytics, we need all matching records to compute stats accurately.
    // In production with millions of rows, we'd use RPC/Views. 
    // Here we assume it's small enough to fetch, or we limit to a high number like 5000.
    query = query.limit(5000);

    const { data: reports, error: reportsError } = await query;

    if (reportsError) {
      return NextResponse.json({ error: reportsError.message }, { status: 500 });
    }

    const now = new Date();
    const todayStr = new Date();
    todayStr.setHours(0, 0, 0, 0);

    // --- KPIs ---
    let completedCount = 0;
    let totalCompletionTimeDays = 0;
    let overdueCount = 0; // > 7 days and not completed
    
    reports.forEach(r => {
      const created = new Date(r.created_at);
      if (r.status === "completed") {
        completedCount++;
        const updated = new Date(r.updated_at || r.created_at);
        totalCompletionTimeDays += (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      } else if (r.status !== "cancelled") {
        // Open
        const daysOpen = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        if (daysOpen > 7) overdueCount++;
      }
    });

    const kpis = {
      total: reports.length,
      todayNew: reports.filter(r => new Date(r.created_at) >= todayStr).length,
      inProgress: reports.filter(r => r.status === "in_progress").length,
      completed: completedCount,
      avgCompletionTimeDays: completedCount > 0 ? Number((totalCompletionTimeDays / completedCount).toFixed(1)) : 0,
      overdueCount
    };

    // --- Top 10 Problems (by subcategory) ---
    const problemCounts: Record<string, number> = {};
    reports.forEach(r => {
      const prob = r.subcategories?.name_th || "อื่นๆ";
      problemCounts[prob] = (problemCounts[prob] || 0) + 1;
    });
    const topProblems = Object.entries(problemCounts)
      .map(([problem, count]) => ({ problem, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((item, index) => ({ rank: index + 1, ...item }));

    // --- Longest Open Reports ---
    const openReports = reports
      .filter(r => r.status !== "completed" && r.status !== "cancelled")
      .map(r => {
        const daysOpen = Math.floor((now.getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24));
        return {
          publicId: r.public_id,
          category: r.categories?.name_th || "ไม่ระบุ",
          subject: r.title,
          daysOpen,
          status: r.status,
          createdAt: r.created_at
        };
      })
      .sort((a, b) => b.daysOpen - a.daysOpen)
      .slice(0, 10);

    // --- Category Analytics ---
    const categoryCounts: Record<string, number> = {};
    reports.forEach(r => {
      const cat = r.categories?.name_th || "อื่นๆ";
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    const categoryAnalytics = Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // --- Department Performance ---
    const deptStats: Record<string, { total: number, inProgress: number, completed: number, timeDays: number }> = {};
    reports.forEach(r => {
      const dept = r.categories?.departments?.name_th || "ไม่ระบุ";
      if (!deptStats[dept]) {
        deptStats[dept] = { total: 0, inProgress: 0, completed: 0, timeDays: 0 };
      }
      deptStats[dept].total++;
      if (r.status === "in_progress") deptStats[dept].inProgress++;
      if (r.status === "completed") {
        deptStats[dept].completed++;
        const created = new Date(r.created_at);
        const updated = new Date(r.updated_at || r.created_at);
        deptStats[dept].timeDays += (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      }
    });

    const departmentPerformance = Object.entries(deptStats)
      .map(([name, stats]) => ({
        name,
        total: stats.total,
        inProgress: stats.inProgress,
        completed: stats.completed,
        avgTimeDays: stats.completed > 0 ? Number((stats.timeDays / stats.completed).toFixed(1)) : 0
      }))
      .sort((a, b) => b.total - a.total);

    // --- Monthly Trend (Last 12 Months) ---
    const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const trendCounts: Record<string, number> = {};
    
    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;
      trendCounts[key] = 0;
    }

    reports.forEach(r => {
      const d = new Date(r.created_at);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;
      if (trendCounts[key] !== undefined) {
        trendCounts[key]++;
      }
    });

    const monthlyTrend = Object.entries(trendCounts).map(([month, count]) => ({ month, count }));

    // --- Peak Hours ---
    const hourBuckets = [
      { range: "00:00 - 08:00 น.", count: 0 },
      { range: "08:00 - 10:00 น.", count: 0 },
      { range: "10:00 - 12:00 น.", count: 0 },
      { range: "12:00 - 14:00 น.", count: 0 },
      { range: "14:00 - 16:00 น.", count: 0 },
      { range: "16:00 - 18:00 น.", count: 0 },
      { range: "18:00 - 24:00 น.", count: 0 }
    ];

    reports.forEach(r => {
      const hour = new Date(r.created_at).getHours();
      if (hour < 8) hourBuckets[0].count++;
      else if (hour < 10) hourBuckets[1].count++;
      else if (hour < 12) hourBuckets[2].count++;
      else if (hour < 14) hourBuckets[3].count++;
      else if (hour < 16) hourBuckets[4].count++;
      else if (hour < 18) hourBuckets[5].count++;
      else hourBuckets[6].count++;
    });

    const totalForHours = reports.length || 1; // Prevent division by zero
    const peakHours = hourBuckets.map(b => ({
      range: b.range,
      count: b.count,
      percentage: Math.round((b.count / totalForHours) * 100)
    }));

    return NextResponse.json({
      kpis,
      topProblems,
      longestOpen: openReports,
      categoryAnalytics,
      departmentPerformance,
      monthlyTrend,
      peakHours
    });
    
  } catch (error: any) {
    console.error("Analytics API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
