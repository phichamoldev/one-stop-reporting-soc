import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getReportDataSource } from "@/lib/dataSource";
import { verifyAuthToken, getAccessibleDepartmentIds } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/backoffice/related-requests-lab
 * Returns sanitized real database snapshot for the Related Requests UX Lab.
 * Enforces staff authorization and strips all personally identifiable information (PII).
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

    // 1. Fetch Categories and Subcategories for localization
    const { data: categories } = await supabaseAdmin
      .from("categories")
      .select("id, name_th");
    const { data: subcategories } = await supabaseAdmin
      .from("subcategories")
      .select("id, name_th, category_id");

    const categoryMap: Record<number, string> = {};
    (categories || []).forEach((c) => {
      categoryMap[c.id] = c.name_th;
    });

    const subcategoryMap: Record<number, string> = {};
    (subcategories || []).forEach((s) => {
      subcategoryMap[s.id] = s.name_th;
    });

    // 2. Fetch Incident Groups
    const { data: incidentGroups } = await supabaseAdmin
      .from(dataSource.incidentGroupsTable)
      .select("id, group_code, title, description, status, category_id, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(20);

    // 3. Fetch Group Memberships
    const { data: groupMembers } = await supabaseAdmin
      .from(dataSource.incidentGroupMembersTable)
      .select("id, group_id, report_id, added_at");

    const memberReportIds = new Set((groupMembers || []).map((m) => m.report_id));
    const reportToGroupMap: Record<string, { id: string; group_code: string; title: string; status: 'open' | 'resolved' | 'closed' }> = {};

    (groupMembers || []).forEach((m) => {
      const grp = (incidentGroups || []).find((g) => g.id === m.group_id);
      if (grp) {
        reportToGroupMap[m.report_id] = {
          id: grp.id,
          group_code: grp.group_code,
          title: grp.title,
          status: grp.status,
        };
      }
    });

    // 4. Fetch Reports (Pristine & Sanitized, NO PII: no reporter_name, email, phone)
    const { data: rawReports, error: repError } = await supabaseAdmin
      .from(dataSource.reportsTable)
      .select("id, public_id, location, description, status, priority, category_id, subcategory_id, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (repError) {
      return NextResponse.json({ error: repError.message }, { status: 500 });
    }

    const sanitizedReports = (rawReports || []).map((r) => {
      const catName = r.category_id ? categoryMap[r.category_id] || "ไม่ระบุหมวดหมู่" : "ไม่ระบุหมวดหมู่";
      const subcatName = r.subcategory_id ? subcategoryMap[r.subcategory_id] || "" : "";
      const isGrouped = memberReportIds.has(r.id);
      const incidentGroup = reportToGroupMap[r.id] || null;

      return {
        id: r.id,
        public_id: r.public_id,
        location: r.location || "ไม่ระบุสถานที่",
        description: r.description || "ไม่มีรายละเอียด",
        status: r.status,
        priority: r.priority,
        category_id: r.category_id,
        subcategory_id: r.subcategory_id,
        categoryName: catName,
        subcategoryName: subcatName,
        created_at: r.created_at,
        isGrouped,
        incidentGroup,
      };
    });

    return NextResponse.json({
      success: true,
      dataSource: {
        source: dataSource.source,
        reportsTable: dataSource.reportsTable,
        incidentGroupsTable: dataSource.incidentGroupsTable,
        isProduction: dataSource.isProduction,
      },
      reportsCount: sanitizedReports.length,
      reports: sanitizedReports,
      incidentGroups: incidentGroups || [],
    });
  } catch (error: unknown) {
    console.error("[RelatedRequestsLab API] Error:", error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
