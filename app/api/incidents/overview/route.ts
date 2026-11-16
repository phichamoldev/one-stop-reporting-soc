import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getReportDataSource } from "@/lib/dataSource";
import { verifyAuthToken, getAccessibleDepartmentIds } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/incidents/overview
 * Priority and incident summary metrics for Backoffice incident grouping dashboard.
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

    // 1. Grouped report IDs to exclude
    const { data: groupedMembers } = await supabaseAdmin
      .from(dataSource.incidentGroupMembersTable)
      .select("report_id");

    const groupedReportIds = new Set((groupedMembers || []).map((m: { report_id: string }) => m.report_id));

    // 2. Query reports from active table
    let repQuery = supabaseAdmin
      .from(dataSource.reportsTable)
      .select(`
        id,
        priority,
        status,
        category_id,
        categories (
          department_id
        )
      `);

    if (accessibleDeptIds.length > 0) {
      const { data: catData } = await supabaseAdmin
        .from("categories")
        .select("id")
        .in("department_id", accessibleDeptIds);
      const allowedCatIds = (catData || []).map((c: { id: number }) => c.id);
      if (allowedCatIds.length > 0) {
        repQuery = repQuery.in("category_id", allowedCatIds);
      } else {
        return NextResponse.json({
          success: true,
          metrics: { emergencyCount: 0, needsReviewCount: 0, normalCount: 0, openIncidentsCount: 0, totalUngrouped: 0 }
        });
      }
    }

    const { data: reports } = await repQuery;

    let emergencyCount = 0;
    let needsReviewCount = 0;
    let normalCount = 0;
    let totalUngrouped = 0;

    (reports || []).forEach((r: { id: string; priority?: string | null }) => {
      if (!groupedReportIds.has(r.id)) {
        totalUngrouped++;
        const p = (r.priority || "normal").toLowerCase();
        if (p === "emergency") {
          emergencyCount++;
        } else if (p === "needs_review") {
          needsReviewCount++;
        } else {
          normalCount++;
        }
      }
    });

    // 3. Open Incidents Count
    const incQuery = supabaseAdmin
      .from(dataSource.incidentGroupsTable)
      .select("id, status, category_id, categories(department_id)")
      .eq("status", "open");

    const { data: openGroups } = await incQuery;

    let openIncidentsCount = 0;
    (openGroups || []).forEach((g: { categories?: unknown }) => {
      if (accessibleDeptIds.length > 0) {
        const cat = Array.isArray(g.categories) ? g.categories[0] : g.categories;
        const deptId = (cat as { department_id?: number } | null)?.department_id;
        if (deptId && !accessibleDeptIds.includes(deptId)) return;
      }
      openIncidentsCount++;
    });

    return NextResponse.json({
      success: true,
      metrics: {
        emergencyCount,
        needsReviewCount,
        normalCount,
        openIncidentsCount,
        totalUngrouped,
      },
    });
  } catch (err: unknown) {
    console.error("Unhandled error in GET /api/incidents/overview:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
