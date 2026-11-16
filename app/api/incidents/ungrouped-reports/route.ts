import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getReportDataSource } from "@/lib/dataSource";
import { verifyAuthToken, getAccessibleDepartmentIds } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/incidents/ungrouped-reports
 * Fetch reports accessible to staff that are not currently members of any active incident group.
 */
export async function GET(req: Request) {
  try {
    const dataSource = getReportDataSource();
    const { user, error: authErr } = await verifyAuthToken(req);

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const { data: staffProfile } = await supabaseAdmin
      .from("staff_users")
      .select("id, role, department_id, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!staffProfile) {
      return NextResponse.json({ error: "Staff profile not found", code: "FORBIDDEN" }, { status: 403 });
    }

    const accessibleDeptIds = await getAccessibleDepartmentIds(user.id, staffProfile, supabaseAdmin);
    if (accessibleDeptIds.length === 1 && accessibleDeptIds[0] === -1) {
      return NextResponse.json({ error: "No department access", code: "NO_PERMISSION" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const categoryId = searchParams.get("categoryId");
    const status = searchParams.get("status");
    const groupStatus = searchParams.get("groupStatus") || "ungrouped"; // 'ungrouped' | 'grouped' | 'all'
    const timeRange = searchParams.get("timeRange") || "all"; // 'all' | 'today' | '3days' | '7days' | '30days'
    const locationFilter = searchParams.get("location")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(5, parseInt(searchParams.get("limit") || "20", 10)));
    const offset = (page - 1) * limit;

    // 1. Fetch all report_ids that are currently in an incident group with group metadata
    const { data: groupedMembers } = await supabaseAdmin
      .from(dataSource.incidentGroupMembersTable)
      .select(`
        report_id,
        group_id,
        group:${dataSource.incidentGroupsTable} (
          id,
          group_code,
          title,
          status
        )
      `);

    const groupMap = new Map<string, { id: string; group_code: string; title: string; status: string }>();
    (groupedMembers || []).forEach((m: {
      report_id: string;
      group?: { id: string; group_code: string; title: string; status: string } | { id: string; group_code: string; title: string; status: string }[] | null;
    }) => {
      if (m.report_id && m.group) {
        const grp = Array.isArray(m.group) ? m.group[0] : m.group;
        if (grp) groupMap.set(m.report_id, grp);
      }
    });

    const groupedReportIds = Array.from(groupMap.keys());

    // 2. Query reports from active table
    let query = supabaseAdmin
      .from(dataSource.reportsTable)
      .select(`
        id,
        public_id,
        category_id,
        subcategory_id,
        location,
        description,
        status,
        priority,
        reporter_name,
        created_at,
        categories (
          id,
          name_th,
          department_id
        ),
        subcategories (
          id,
          name_th
        )
      `, { count: "exact" })
      .order("created_at", { ascending: false });

    // Handle groupStatus filter
    if (groupStatus === "ungrouped") {
      if (groupedReportIds.length > 0 && groupedReportIds.length <= 150) {
        query = query.not("id", "in", `(${groupedReportIds.join(",")})`);
      }
    } else if (groupStatus === "grouped") {
      if (groupedReportIds.length === 0) {
        return NextResponse.json({ success: true, reports: [], total: 0, page, limit, totalPages: 0 });
      }
      if (groupedReportIds.length <= 150) {
        query = query.in("id", groupedReportIds);
      }
    }

    // Time range filter
    if (timeRange !== "all") {
      const now = new Date();
      let hoursAgo = 24;
      if (timeRange === "3days") hoursAgo = 72;
      else if (timeRange === "7days") hoursAgo = 168;
      else if (timeRange === "30days") hoursAgo = 720;
      const cutoff = new Date(now.getTime() - hoursAgo * 3600 * 1000).toISOString();
      query = query.gte("created_at", cutoff);
    }

    if (locationFilter) {
      query = query.ilike("location", `%${locationFilter}%`);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (categoryId && categoryId !== "all") {
      query = query.eq("category_id", parseInt(categoryId, 10));
    }

    if (search) {
      query = query.or(`public_id.ilike.%${search}%,description.ilike.%${search}%,location.ilike.%${search}%`);
    }

    // Apply department scoping if restricted
    if (accessibleDeptIds.length > 0) {
      const { data: catData } = await supabaseAdmin
        .from("categories")
        .select("id")
        .in("department_id", accessibleDeptIds);

      const allowedCatIds = (catData || []).map((c: { id: number }) => c.id);
      if (allowedCatIds.length > 0) {
        query = query.in("category_id", allowedCatIds);
      } else {
        return NextResponse.json({ success: true, reports: [], total: 0, page, limit, totalPages: 0 });
      }
    }

    const { data: rawReports, count, error: repErr } = await query.range(offset, offset + limit - 1);

    if (repErr) {
      console.error("Error fetching ungrouped reports:", repErr);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // Secondary in-memory safeguard and metadata enrichment
    let filteredReports = rawReports || [];
    if (groupStatus === "ungrouped") {
      const groupedSet = new Set(groupedReportIds);
      filteredReports = filteredReports.filter((r: { id: string }) => !groupedSet.has(r.id));
    } else if (groupStatus === "grouped") {
      const groupedSet = new Set(groupedReportIds);
      filteredReports = filteredReports.filter((r: { id: string }) => groupedSet.has(r.id));
    }

    const enrichedReports = filteredReports.map((r: { id: string; [key: string]: unknown }) => ({
      ...r,
      incidentGroup: groupMap.get(r.id) || null,
    }));

    const totalCount = count ?? filteredReports.length;

    return NextResponse.json({
      success: true,
      reports: enrichedReports,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
    });
  } catch (err: unknown) {
    console.error("Unhandled error in GET /api/incidents/ungrouped-reports:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
