import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getReportDataSource } from "@/lib/dataSource";
import { verifyAuthToken, getAccessibleDepartmentIds } from "@/lib/auth-helpers";
import { normalizePublicId } from "@/lib/utils";
import { evaluateReportAgainstGroup, IncidentGroupItem, GroupCorrelationResult } from "@/lib/incidentDetector";
import { ReportItem } from "@/lib/similarityDetector";

export const dynamic = "force-dynamic";

/**
 * GET /api/incidents/search-existing
 * Search and propose existing incident groups (both open and past/closed) for a given report or search query.
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
    const reportPublicId = searchParams.get("reportPublicId")?.trim();
    const search = searchParams.get("search")?.trim();
    const categoryId = searchParams.get("categoryId");

    // 1. If reportPublicId provided, load target report
    let targetReport: ReportItem | null = null;
    if (reportPublicId) {
      const normalized = normalizePublicId(reportPublicId);
      const { data: rep } = await supabaseAdmin
        .from(dataSource.reportsTable)
        .select(`
          id,
          public_id,
          category_id,
          subcategory_id,
          location,
          description,
          status,
          created_at
        `)
        .eq("public_id", normalized)
        .maybeSingle();

      if (rep) {
        targetReport = rep as ReportItem;
      }
    }

    // 2. Query Existing Groups
    let groupQuery = supabaseAdmin
      .from(dataSource.incidentGroupsTable)
      .select(`
        id,
        group_code,
        title,
        description,
        category_id,
        status,
        created_at,
        updated_at,
        categories (
          id,
          name_th,
          department_id
        )
      `)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (search) {
      groupQuery = groupQuery.or(`title.ilike.%${search}%,description.ilike.%${search}%,group_code.ilike.%${search}%`);
    }

    if (categoryId && categoryId !== "all") {
      groupQuery = groupQuery.eq("category_id", parseInt(categoryId, 10));
    }

    const { data: rawGroups, error: groupErr } = await groupQuery;
    if (groupErr) {
      console.error("Error fetching existing incident groups:", groupErr);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // Department Scoping
    const rawGroupList = (rawGroups || []) as unknown as Array<{
      id: string;
      group_code: string;
      title: string;
      description?: string | null;
      category_id?: number | null;
      status: 'open' | 'resolved' | 'closed';
      created_at: string;
      updated_at?: string;
      categories?: { department_id?: number } | Array<{ department_id?: number }> | null;
    }>;

    const filteredGroups = rawGroupList.filter((g) => {
      if (accessibleDeptIds.length > 0) {
        const cat = Array.isArray(g.categories) ? g.categories[0] : g.categories;
        const deptId = cat?.department_id;
        if (deptId && !accessibleDeptIds.includes(deptId)) return false;
      }
      return true;
    });

    // 3. Fetch member counts and member samples
    const groupIds = filteredGroups.map((g) => g.id);
    const { data: membersData } = await supabaseAdmin
      .from(dataSource.incidentGroupMembersTable)
      .select(`
        group_id,
        report_id,
        reports:${dataSource.reportsTable} (
          id,
          public_id,
          location,
          description,
          created_at
        )
      `)
      .in("group_id", groupIds);

    const groupMembersMap: Record<string, ReportItem[]> = {};
    (membersData || []).forEach((m: { group_id: string; reports?: unknown }) => {
      if (!groupMembersMap[m.group_id]) groupMembersMap[m.group_id] = [];
      if (m.reports) groupMembersMap[m.group_id].push(m.reports as ReportItem);
    });

    // 4. If targetReport is present, evaluate correlations
    const results: Array<GroupCorrelationResult & { memberCount: number }> = [];

    for (const g of filteredGroups) {
      const groupItem: IncidentGroupItem = {
        id: g.id,
        group_code: g.group_code,
        title: g.title,
        description: g.description,
        category_id: g.category_id,
        status: g.status,
        created_at: g.created_at,
        updated_at: g.updated_at,
        memberReports: groupMembersMap[g.id] || [],
        memberCount: (groupMembersMap[g.id] || []).length,
      };

      if (targetReport) {
        const correlation = evaluateReportAgainstGroup(targetReport, groupItem);
        results.push({
          ...correlation,
          memberCount: groupItem.memberCount || 0,
        });
      } else {
        results.push({
          group: groupItem,
          score: 100,
          confidence: 'high',
          confidenceLabel: 'ตรงตามเงื่อนไขการค้นหา',
          reasons: ['ผลลัพธ์จากการค้นหา'],
          isPastIncident: groupItem.status === 'closed' || groupItem.status === 'resolved',
          memberCount: groupItem.memberCount || 0,
        });
      }
    }

    if (targetReport) {
      results.sort((a, b) => b.score - a.score);
    }

    return NextResponse.json({
      success: true,
      targetReport,
      groups: results,
      total: results.length,
    });
  } catch (err: unknown) {
    console.error("Unhandled error in GET /api/incidents/search-existing:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
