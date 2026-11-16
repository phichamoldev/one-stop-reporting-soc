import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getReportDataSource } from "@/lib/dataSource";
import { verifyAuthToken, getAccessibleDepartmentIds } from "@/lib/auth-helpers";
import { isRealIncidentGroup, isTestReport } from "@/lib/conflictLocalization";

export const dynamic = "force-dynamic";

/**
 * GET /api/incidents/[id]
 * Fetch single incident group details, member reports, and audit history.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const dataSource = getReportDataSource();
    const { id } = await params;
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

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

    // 1. Fetch Group
    let groupQuery = supabaseAdmin
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
      `);

    if (isUUID) {
      groupQuery = groupQuery.eq("id", id);
    } else {
      groupQuery = groupQuery.eq("group_code", id.toUpperCase());
    }

    const { data: group, error: groupErr } = await groupQuery.maybeSingle();

    if (groupErr || !group) {
      return NextResponse.json({ error: "ไม่พบกลุ่มเหตุการณ์นี้" }, { status: 404 });
    }

    // Verify department access to group
    const groupDeptId = (group.categories as unknown as { department_id?: number } | null)?.department_id;
    if (accessibleDeptIds.length > 0 && groupDeptId && !accessibleDeptIds.includes(groupDeptId)) {
      return NextResponse.json({ error: "คุณไม่มีสิทธิ์เข้าถึงกลุ่มเหตุการณ์นี้" }, { status: 403 });
    }

    // 2. Fetch Members joined with Reports
    const { data: members, error: memErr } = await supabaseAdmin
      .from(dataSource.incidentGroupMembersTable)
      .select(`
        id,
        group_id,
        report_id,
        added_by,
        added_at,
        notes,
        reports:${dataSource.reportsTable} (
          id,
          public_id,
          location,
          description,
          status,
          admin_remark,
          reporter_name,
          phone,
          created_at,
          updated_at,
          category_id,
          categories (
            id,
            name_th,
            department_id
          ),
          subcategories (
            id,
            name_th
          )
        )
      `)
      .eq("group_id", group.id)
      .order("added_at", { ascending: false });

    if (memErr) {
      console.error("Error fetching members:", memErr);
    }

    // 2.5 Automated Test Data Removal from Real Incident Groups (Isolation Guard)
    let activeMembers = members || [];
    const isReal = isRealIncidentGroup(group);

    if (isReal && activeMembers.length > 0) {
      const testMembers = activeMembers.filter((m) => {
        const rep = (m as { reports?: unknown })?.reports as { public_id?: string; email?: string } | null;
        return isTestReport(rep);
      });

      if (testMembers.length > 0) {
        for (const tm of testMembers) {
          const rep = (tm as { reports?: unknown })?.reports as { id: string; public_id: string } | null;
          if (!rep) continue;

          // Remove membership link (CASCADE does NOT delete underlying report)
          await supabaseAdmin
            .from(dataSource.incidentGroupMembersTable)
            .delete()
            .eq("id", tm.id);

          // Write Audit History to incidentGroupHistoryTable
          await supabaseAdmin.from(dataSource.incidentGroupHistoryTable).insert({
            group_id: group.id,
            report_id: rep.id,
            action: "remove_report",
            actor_id: null,
            actor_name: "ระบบตรวจสอบความถูกต้องอัตโนมัติ (Automated Isolation Guard)",
            details: {
              public_id: rep.public_id,
              reason: "ตรวจพบข้อมูลทดสอบ (Test Report) ในกลุ่มเหตุการณ์จริง ระบบจึงนำออกจากกลุ่มโดยอัตโนมัติเพื่อความถูกต้องของข้อมูล",
              source: "auto_test_data_cleanup",
              removed_at: new Date().toISOString(),
            },
          });

          // Write log to reportLogsTable
          await supabaseAdmin.from(dataSource.reportLogsTable).insert({
            report_id: rep.id,
            user_id: null,
            action: "incident_group_removed",
            remark: `ระบบอัตโนมัตินำคำร้องทดสอบออกจากกลุ่มเหตุการณ์จริง ${group.group_code} (${group.title})`,
          });
        }

        // Update group updated_at
        await supabaseAdmin
          .from(dataSource.incidentGroupsTable)
          .update({ updated_at: new Date().toISOString() })
          .eq("id", group.id);

        // Filter out removed test members from response
        const testMemberIds = new Set(testMembers.map((tm) => tm.id));
        activeMembers = activeMembers.filter((m) => !testMemberIds.has(m.id));
      }
    }

    // 3. Fetch Group History Logs
    const { data: history, error: histErr } = await supabaseAdmin
      .from(dataSource.incidentGroupHistoryTable)
      .select(`
        id,
        group_id,
        report_id,
        action,
        actor_id,
        actor_name,
        details,
        created_at
      `)
      .eq("group_id", group.id)
      .order("created_at", { ascending: false });

    if (histErr) {
      console.error("Error fetching history:", histErr);
    }

    return NextResponse.json({
      success: true,
      incidentGroup: group,
      members: activeMembers,
      history: history || [],
    });
  } catch (err: unknown) {
    console.error("Unhandled error in GET /api/incidents/[id]:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * PATCH /api/incidents/[id]
 * Update group title, description, category_id, or status.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const dataSource = getReportDataSource();
    const { id } = await params;
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

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

    // Fetch existing group
    let existingQuery = supabaseAdmin.from(dataSource.incidentGroupsTable).select("*");
    if (isUUID) {
      existingQuery = existingQuery.eq("id", id);
    } else {
      existingQuery = existingQuery.eq("group_code", id.toUpperCase());
    }

    const { data: currentGroup } = await existingQuery.maybeSingle();
    if (!currentGroup) {
      return NextResponse.json({ error: "ไม่พบกลุ่มเหตุการณ์นี้" }, { status: 404 });
    }

    const body = await req.json();
    const { title, description, status, category_id } = body;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const changes: Record<string, { old: unknown; new: unknown }> = {};

    if (title && title.trim() !== currentGroup.title) {
      updates.title = title.trim();
      changes.title = { old: currentGroup.title, new: title.trim() };
    }

    if (description !== undefined && description !== currentGroup.description) {
      updates.description = description ? description.trim() : null;
      changes.description = { old: currentGroup.description, new: updates.description };
    }

    if (status && ["open", "resolved", "closed"].includes(status) && status !== currentGroup.status) {
      updates.status = status;
      changes.status = { old: currentGroup.status, new: status };
    }

    if (category_id !== undefined && category_id !== currentGroup.category_id) {
      updates.category_id = category_id ? parseInt(category_id, 10) : null;
      changes.category_id = { old: currentGroup.category_id, new: updates.category_id };
    }

    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ success: true, incidentGroup: currentGroup, message: "ไม่มีข้อมูลเปลี่ยนแปลง" });
    }

    // Perform Update
    const { data: updatedGroup, error: updateErr } = await supabaseAdmin
      .from(dataSource.incidentGroupsTable)
      .update(updates)
      .eq("id", currentGroup.id)
      .select()
      .single();

    if (updateErr || !updatedGroup) {
      console.error("Error updating incident group:", updateErr);
      return NextResponse.json({ error: "ไม่สามารถบันทึกข้อมูลได้" }, { status: 500 });
    }

    // Log in History
    await supabaseAdmin.from(dataSource.incidentGroupHistoryTable).insert({
      group_id: currentGroup.id,
      action: changes.status ? "status_change" : "update_details",
      actor_id: staffProfile.id,
      actor_name: staffProfile.full_name,
      details: changes,
    });

    return NextResponse.json({
      success: true,
      message: "ปรับปรุงกลุ่มเหตุการณ์เรียบร้อยแล้ว",
      incidentGroup: updatedGroup,
    });
  } catch (err: unknown) {
    console.error("Unhandled error in PATCH /api/incidents/[id]:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * DELETE /api/incidents/[id]
 * Delete group without deleting underlying reports.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const dataSource = getReportDataSource();
    const { id } = await params;
    const { user, error: authErr } = await verifyAuthToken(req);

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const { data: staffProfile } = await supabaseAdmin
      .from("staff_users")
      .select("id, role, department_id, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!staffProfile || !["super_admin", "admin", "manager"].includes(staffProfile.role)) {
      return NextResponse.json({ error: "ต้องเป็นผู้จัดการหรือผู้ดูแลระบบจึงจะลบกลุ่มได้" }, { status: 403 });
    }

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    let findQuery = supabaseAdmin.from(dataSource.incidentGroupsTable).select("id, group_code, title");
    if (isUUID) {
      findQuery = findQuery.eq("id", id);
    } else {
      findQuery = findQuery.eq("group_code", id.toUpperCase());
    }

    const { data: group } = await findQuery.maybeSingle();
    if (!group) {
      return NextResponse.json({ error: "ไม่พบกลุ่มเหตุการณ์นี้" }, { status: 404 });
    }

    const { error: delErr } = await supabaseAdmin
      .from(dataSource.incidentGroupsTable)
      .delete()
      .eq("id", group.id);

    if (delErr) {
      console.error("Error deleting group:", delErr);
      return NextResponse.json({ error: "ไม่สามารถลบกลุ่มเหตุการณ์ได้" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `ลบกลุ่มเหตุการณ์ ${group.group_code} สำเร็จ (คำร้องสมาชิกยังคงอยู่)`,
    });
  } catch (err: unknown) {
    console.error("Unhandled error in DELETE /api/incidents/[id]:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
