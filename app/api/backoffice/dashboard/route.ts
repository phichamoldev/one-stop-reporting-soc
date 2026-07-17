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
    
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get Staff Profile to determine role & department
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("staff_users")
      .select("role, department_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Staff profile not found" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    // date could be 'today', 'week', 'month', 'all'
    const dateRange = searchParams.get("dateRange");

    // Build base query for reports
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
      `, { count: "exact" })
      .order("created_at", { ascending: false });

    // Enforce permissions
    const accessibleDeptIds = await getAccessibleDepartmentIds(user.id, profile, supabaseAdmin);

    if (accessibleDeptIds.length === 1 && accessibleDeptIds[0] === -1) {
      return NextResponse.json({ error: "คุณไม่มีสิทธิ์เข้าถึงข้อมูล", code: "NO_PERMISSION" }, { status: 403 });
    }

    let filterOptions = { departments: [] as string[], categories: [] as string[] };

    if (accessibleDeptIds.length > 0) {
      // Find departments
      const { data: deptData } = await supabaseAdmin
         .from("departments")
         .select("name_th")
         .in("id", accessibleDeptIds);
      filterOptions.departments = deptData ? deptData.map(d => d.name_th).filter(Boolean) : [];

      // Find categories that belong to these departments
      const { data: catData } = await supabaseAdmin
        .from("categories")
        .select("id, name_th")
        .in("department_id", accessibleDeptIds);
        
      const catIds = catData ? catData.map(c => c.id) : [];
      filterOptions.categories = catData ? Array.from(new Set(catData.map(c => c.name_th).filter(Boolean))) : [];
      
      if (catIds.length > 0) {
        query = query.in("category_id", catIds);
      } else {
        // If department has no categories, return empty
        query = query.in("category_id", [0]); // Force empty
      }
    } else {
      // Super Admin / Admin
      const { data: deptData } = await supabaseAdmin.from("departments").select("name_th");
      filterOptions.departments = deptData ? deptData.map(d => d.name_th).filter(Boolean) : [];
      
      const { data: catData } = await supabaseAdmin.from("categories").select("name_th");
      filterOptions.categories = catData ? Array.from(new Set(catData.map(c => c.name_th).filter(Boolean))) : [];
    }

    // Apply filters
    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (category && category !== "all") {
      query = query.eq("category_id", parseInt(category, 10));
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,public_id.ilike.%${search}%`);
    }

    if (dateRange && dateRange !== "all") {
      const now = new Date();
      let startDate = new Date();
      
      if (dateRange === "today") {
        startDate.setHours(0, 0, 0, 0);
      } else if (dateRange === "week" || dateRange === "7days") {
        startDate.setDate(now.getDate() - 7);
      } else if (dateRange === "month" || dateRange === "30days") {
        startDate.setDate(now.getDate() - 30);
      } else if (dateRange === "90days") {
        startDate.setDate(now.getDate() - 90);
      }
      
      query = query.gte("created_at", startDate.toISOString());
    }

    // For dashboard, we might want to get all matching to calculate stats accurately,
    // or run separate queries. Running separate queries for KPIs vs filtered list is safer for performance if data grows,
    // but for V1 we'll fetch up to 1000 records to compute analytics if it's small, OR we can fetch them separately.
    // Let's do a single query for now to simplify, up to 1000 items.
    query = query.limit(1000);

    const { data: reports, error: reportsError, count } = await query;

    if (reportsError) {
      return NextResponse.json({ error: reportsError.message }, { status: 500 });
    }

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const kpis = {
      total: reports.length,
      pending: reports.filter(r => r.status === "pending" || r.status === "received").length,
      inProgress: reports.filter(r => r.status === "in_progress").length,
      completed: reports.filter(r => r.status === "completed").length,
      cancelled: reports.filter(r => r.status === "cancelled").length,
      todayNew: reports.filter(r => new Date(r.created_at) >= todayDate).length,
    };

    // Calculate Analytics
    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byDepartment: Record<string, number> = {};

    reports.forEach(r => {
      // Category
      const catName = r.categories?.name_th || "อื่นๆ";
      byCategory[catName] = (byCategory[catName] || 0) + 1;

      // Status
      const stat = r.status;
      byStatus[stat] = (byStatus[stat] || 0) + 1;

      // Department
      const deptName = r.categories?.departments?.name_th || "ไม่ระบุ";
      byDepartment[deptName] = (byDepartment[deptName] || 0) + 1;
    });

    // Generate Trend Data (Group by date)
    const trendMap: Record<string, number> = {};
    
    // Determine the date range to populate 0 values
    let daysToLookBack = 7;
    if (dateRange === "month" || dateRange === "30days") daysToLookBack = 30;
    if (dateRange === "90days") daysToLookBack = 90;
    if (dateRange === "all" || !dateRange) daysToLookBack = 7; // Default for trend chart
    
    const nowForTrend = new Date();
    for (let i = daysToLookBack - 1; i >= 0; i--) {
      const d = new Date(nowForTrend);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
      trendMap[dateStr] = 0;
    }

    reports.forEach(r => {
      const d = new Date(r.created_at);
      const dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
      if (trendMap[dateStr] !== undefined) {
        trendMap[dateStr]++;
      }
    });

    const trend = Object.entries(trendMap).map(([date, count]) => ({ date, count }));

    return NextResponse.json({
      reports,
      kpis,
      filterOptions,
      analytics: {
        category: Object.entries(byCategory).map(([name, value]) => ({ name, value })),
        status: Object.entries(byStatus).map(([name, value]) => ({ name, value })),
        department: Object.entries(byDepartment).map(([name, value]) => ({ name, value })),
        trend
      }
    });

  } catch (error: any) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
