import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getReportDataSource } from "@/lib/dataSource";
import { verifyAuthToken, getAccessibleDepartmentIds } from "@/lib/auth-helpers";
import { normalizePublicId } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/incidents
 * List incident groups with filtering, member counts, and department scoping.
 */
export async function GET(req: Request) {
  try {
    const dataSource = getReportDataSource();
    const { user, error: authErr } = await verifyAuthToken(req);

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    // 1. Verify staff profile & permissions
    const { data: staffProfile, error: profileErr } = await supabaseAdmin
      .from("staff_users")
      .select("id, role, department_id, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr || !staffProfile) {
      return NextResponse.json({ error: "Staff profile not found", code: "FORBIDDEN" }, { status: 403 });
    }

    const accessibleDeptIds = await getAccessibleDepartmentIds(user.id, staffProfile, supabaseAdmin);
    if (accessibleDeptIds.length === 1 && accessibleDeptIds[0] === -1) {
      return NextResponse.json({ error: "No department access", code: "NO_PERMISSION" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "all";
    const categoryId = searchParams.get("categoryId");

    // 2. Query Incident Groups from active dataSource table
    let query = supabaseAdmin
      .from(dataSource.incidentGroupsTable)
      .select(`
        id,
        group_code,
        title,
        description,
        category_id,
        status,
        created_by,
        created_at,
        updated_at,
        categories (
          id,
          name_th,
          department_id,
          departments (
            id,
            name_th
          )
        ),
        created_by_staff:staff_users!test_incident_groups_created_by_fkey (
          id,
          full_name,
          role
        )
      `)
      .order("updated_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (categoryId && categoryId !== "all") {
      query = query.eq("category_id", parseInt(categoryId, 10));
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,group_code.ilike.%${search}%`);
    }

    const { data: groups, error: queryErr } = await query;

    if (queryErr) {
      // In case the foreign key name differed for production table
      if (queryErr.message?.includes("foreign key") || queryErr.message?.includes("test_incident_groups_created_by_fkey")) {
        const fallbackRes = await supabaseAdmin
          .from(dataSource.incidentGroupsTable)
          .select(`
            id,
            group_code,
            title,
            description,
            category_id,
            status,
            created_by,
            created_at,
            updated_at,
            categories (
              id,
              name_th,
              department_id,
              departments (
                id,
                name_th
              )
            )
          `)
          .order("updated_at", { ascending: false });
        if (fallbackRes.error) {
          console.error("Error fetching incident groups:", fallbackRes.error);
          return NextResponse.json({ error: "Database error" }, { status: 500 });
        }
        return await enrichAndFilterGroups(
          (fallbackRes.data || []) as unknown as Parameters<typeof enrichAndFilterGroups>[0],
          accessibleDeptIds,
          dataSource
        );
      }
      console.error("Error fetching incident groups:", queryErr);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return await enrichAndFilterGroups(
      (groups || []) as unknown as Parameters<typeof enrichAndFilterGroups>[0],
      accessibleDeptIds,
      dataSource
    );
  } catch (err: unknown) {
    console.error("Unhandled error in GET /api/incidents:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * Helper to enrich groups with member counts and filter by staff department access.
 */
async function enrichAndFilterGroups(
  groups: Array<{
    id: string;
    group_code: string;
    title: string;
    categories?: { department_id?: number } | Array<{ department_id?: number }> | null;
    [key: string]: unknown;
  }>,
  accessibleDeptIds: number[],
  dataSource: ReturnType<typeof getReportDataSource>
) {
  if (groups.length === 0) {
    return NextResponse.json({ success: true, groups: [] });
  }

  const groupIds = groups.map((g) => g.id);

  // Fetch member counts for all groups
  const { data: membersData, error: memErr } = await supabaseAdmin
    .from(dataSource.incidentGroupMembersTable)
    .select(`
      id,
      group_id,
      report_id
    `)
    .in("group_id", groupIds);

  if (memErr) {
    console.error("Error counting members:", memErr);
  }

  const memberCounts: Record<string, number> = {};
  (membersData || []).forEach((m: { group_id: string }) => {
    memberCounts[m.group_id] = (memberCounts[m.group_id] || 0) + 1;
  });

  // Department Scoping Filter:
  // If accessibleDeptIds is empty, staff is super_admin/admin (has access to all)
  // Otherwise, filter groups whose category is in accessibleDeptIds or category is null
  let filtered = groups;
  if (accessibleDeptIds.length > 0) {
    filtered = groups.filter((g) => {
      const cat = Array.isArray(g.categories) ? g.categories[0] : g.categories;
      const deptId = cat?.department_id;
      return !deptId || accessibleDeptIds.includes(deptId);
    });
  }

  const result = filtered.map((g) => ({
    ...g,
    memberCount: memberCounts[g.id] || 0,
  }));

  return NextResponse.json({ success: true, groups: result });
}

/**
 * POST /api/incidents
 * Create a new incident group.
 */
export async function POST(req: Request) {
  try {
    const dataSource = getReportDataSource();
    const { user, error: authErr } = await verifyAuthToken(req);

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    // 1. Verify staff profile
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

    const body = await req.json();
    const { title, description, category_id, reportPublicIds } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "กรุณาระบุชื่อกลุ่มเหตุการณ์" }, { status: 400 });
    }

    // 2. Validate category department permission if specified
    if (category_id && accessibleDeptIds.length > 0) {
      const { data: cat } = await supabaseAdmin
        .from("categories")
        .select("id, department_id")
        .eq("id", category_id)
        .maybeSingle();

      if (cat && cat.department_id && !accessibleDeptIds.includes(cat.department_id)) {
        return NextResponse.json({ error: "คุณไม่มีสิทธิ์สร้างกลุ่มในหมวดหมู่นี้" }, { status: 403 });
      }
    }

    // 2.5 Pre-validate target reports before creating incident group (Race Condition & Membership Guard)
    let validatedTargetReports: Array<{ id: string; public_id: string; category_id?: number | null }> = [];
    if (Array.isArray(reportPublicIds) && reportPublicIds.length > 0) {
      const normalizedIds = Array.from(new Set(reportPublicIds.map((p: string) => normalizePublicId(p))));

      const { data: targetReports, error: repErr } = await supabaseAdmin
        .from(dataSource.reportsTable)
        .select(`
          id,
          public_id,
          category_id,
          categories (
            department_id
          )
        `)
        .in("public_id", normalizedIds);

      if (repErr || !targetReports || targetReports.length !== normalizedIds.length) {
        return NextResponse.json({ error: "ไม่พบคำร้องบางรายการ หรือคำร้องถูกลบไปแล้ว" }, { status: 400 });
      }

      // Check department permissions for each report
      if (accessibleDeptIds.length > 0) {
        for (const rep of targetReports) {
          const deptId = (rep.categories as unknown as { department_id?: number } | null)?.department_id;
          if (deptId && !accessibleDeptIds.includes(deptId)) {
            return NextResponse.json({
              error: `คุณไม่มีสิทธิ์จัดการคำร้อง ${rep.public_id} เนื่องจากอยู่ต่างหน่วยงาน`,
              code: "NO_PERMISSION"
            }, { status: 403 });
          }
        }
      }

      // Check if ANY of the selected reports is already in an incident group (Concurrency guard)
      const reportIds = targetReports.map((r) => r.id);
      const { data: existingMemberships } = await supabaseAdmin
        .from(dataSource.incidentGroupMembersTable)
        .select(`
          report_id,
          group:${dataSource.incidentGroupsTable} (
            id,
            group_code,
            title
          )
        `)
        .in("report_id", reportIds);

      if (existingMemberships && existingMemberships.length > 0) {
        const conflictReportId = existingMemberships[0].report_id;
        const conflictRep = targetReports.find((r) => r.id === conflictReportId);
        const groupInfo = Array.isArray(existingMemberships[0].group) ? existingMemberships[0].group[0] : existingMemberships[0].group;
        const groupCodeStr = groupInfo?.group_code || "กลุ่มอื่น";
        return NextResponse.json({
          error: `คำร้อง ${conflictRep?.public_id || "ที่เลือก"} ถูกจัดเข้ากลุ่ม ${groupCodeStr} ไปแล้วโดยผู้ใช้อื่น กรุณารีเฟรชและตรวจสอบรายการใหม่`,
          code: "REPORT_ALREADY_GROUPED",
          conflictReport: conflictRep?.public_id,
          existingGroup: groupCodeStr,
        }, { status: 409 });
      }

      validatedTargetReports = targetReports;
    }

    // 3. Generate Next Incident Group Code
    let groupCode: string;
    const rpcName = dataSource.isTest ? "get_next_test_incident_group_code" : "get_next_incident_group_code";
    const { data: nextCode, error: codeErr } = await supabaseAdmin.rpc(rpcName);

    if (!codeErr && nextCode) {
      groupCode = nextCode;
    } else {
      // Fallback generation
      const { data: latest } = await supabaseAdmin
        .from(dataSource.incidentGroupsTable)
        .select("group_code")
        .order("created_at", { ascending: false })
        .limit(1);

      let nextNum = 1;
      const prefix = dataSource.incidentGroupPrefix;
      if (latest && latest[0]?.group_code) {
        const m = latest[0].group_code.match(new RegExp(`${prefix}(\\d+)`));
        if (m) nextNum = parseInt(m[1], 10) + 1;
      }
      groupCode = `${prefix}${String(nextNum).padStart(5, "0")}`;
    }

    // 4. Insert Incident Group
    const { data: newGroup, error: insertErr } = await supabaseAdmin
      .from(dataSource.incidentGroupsTable)
      .insert({
        group_code: groupCode,
        title: title.trim(),
        description: description?.trim() || null,
        category_id: category_id ? parseInt(category_id, 10) : null,
        status: "open",
        created_by: staffProfile.id,
      })
      .select()
      .single();

    if (insertErr || !newGroup) {
      console.error("Error creating incident group:", insertErr);
      return NextResponse.json({ error: "ไม่สามารถสร้างกลุ่มเหตุการณ์ได้" }, { status: 500 });
    }

    // 5. Insert History Log for group creation
    await supabaseAdmin.from(dataSource.incidentGroupHistoryTable).insert({
      group_id: newGroup.id,
      action: "create_group",
      actor_id: staffProfile.id,
      actor_name: staffProfile.full_name,
      details: {
        group_code: groupCode,
        title: newGroup.title,
        initialReportsCount: validatedTargetReports.length,
      },
    });

    // 6. If initial report publicIds provided, add them to group members
    const addedMembers: string[] = [];
    if (validatedTargetReports.length > 0) {
      for (const rep of validatedTargetReports) {
        // Insert into members
        const { error: memInsertErr } = await supabaseAdmin
          .from(dataSource.incidentGroupMembersTable)
          .insert({
            group_id: newGroup.id,
            report_id: rep.id,
            added_by: staffProfile.id,
            notes: "เพิ่มตอนสร้างกลุ่มเหตุการณ์",
          });

        if (!memInsertErr) {
          addedMembers.push(rep.public_id);

          // Audit history
          await supabaseAdmin.from(dataSource.incidentGroupHistoryTable).insert({
            group_id: newGroup.id,
            report_id: rep.id,
            action: "add_report",
            actor_id: staffProfile.id,
            actor_name: staffProfile.full_name,
            details: { public_id: rep.public_id },
          });

          // Report log entry
          await supabaseAdmin.from(dataSource.reportLogsTable).insert({
            report_id: rep.id,
            user_id: staffProfile.id,
            action: "incident_group_added",
            remark: `เพิ่มคำร้องเข้ากลุ่มเหตุการณ์ ${groupCode} (${newGroup.title})`,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "สร้างกลุ่มเหตุการณ์สำเร็จ",
      incidentGroup: newGroup,
      addedMembers,
    });
  } catch (err: unknown) {
    console.error("Unhandled error in POST /api/incidents:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
