import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getReportDataSource } from "@/lib/dataSource";
import { verifyAuthToken, getAccessibleDepartmentIds } from "@/lib/auth-helpers";
import { normalizePublicId } from "@/lib/utils";
import { detectIncidentContradiction } from "@/lib/similarityDetector";
import { isRealIncidentGroup, isTestReport } from "@/lib/conflictLocalization";

export const dynamic = "force-dynamic";

/**
 * POST /api/incidents/[id]/members
 * Add one or more reports to an incident group.
 * Supports duplicate prevention, cross-group move detection, and department scoping.
 */
export async function POST(
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

    // 1. Resolve Target Group
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    let groupQuery = supabaseAdmin.from(dataSource.incidentGroupsTable).select("id, group_code, title, status");
    if (isUUID) {
      groupQuery = groupQuery.eq("id", id);
    } else {
      groupQuery = groupQuery.eq("group_code", id.toUpperCase());
    }

    const { data: targetGroup } = await groupQuery.maybeSingle();
    if (!targetGroup) {
      return NextResponse.json({ error: "ไม่พบกลุ่มเหตุการณ์นี้" }, { status: 404 });
    }

    if (targetGroup.status === "closed") {
      return NextResponse.json(
        {
          error: `กลุ่มเหตุการณ์ ${targetGroup.group_code} ถูกปิดแล้ว (Closed) จึงไม่สามารถเพิ่มสมาชิกใหม่ได้`,
          code: "GROUP_CLOSED"
        },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { publicIds, notes, confirmMove } = body;

    if (!Array.isArray(publicIds) || publicIds.length === 0) {
      return NextResponse.json({ error: "กรุณาระบุรหัสคำร้องอย่างน้อย 1 รายการ" }, { status: 400 });
    }

    const normalizedIds = publicIds.map((p: string) => normalizePublicId(p));

    // 2. Fetch Target Reports
    const { data: reports, error: repErr } = await supabaseAdmin
      .from(dataSource.reportsTable)
      .select(`
        id,
        public_id,
        category_id,
        subcategory_id,
        status,
        description,
        location,
        created_at,
        categories (
          id,
          name_th,
          department_id
        )
      `)
      .in("public_id", normalizedIds);

    if (repErr || !reports || reports.length === 0) {
      return NextResponse.json({ error: "ไม่พบข้อมูลคำร้องที่ระบุ" }, { status: 404 });
    }

    // 3. Department Permission Check
    if (accessibleDeptIds.length > 0) {
      for (const rep of reports) {
        const deptId = (rep.categories as unknown as { department_id?: number } | null)?.department_id;
        if (deptId && !accessibleDeptIds.includes(deptId)) {
          return NextResponse.json(
            { error: `คุณไม่มีสิทธิ์จัดการคำร้อง ${rep.public_id} เนื่องจากอยู่ต่างหน่วยงาน`, code: "NO_PERMISSION" },
            { status: 403 }
          );
        }
      }
    }

    // 3.1 Test Data Guard against Real Incident Groups
    if (isRealIncidentGroup(targetGroup)) {
      for (const rep of reports) {
        if (isTestReport(rep)) {
          return NextResponse.json(
            {
              error: `ไม่สามารถเพิ่มคำร้องทดสอบ ${rep.public_id} เข้ากลุ่มเหตุการณ์จริงได้`,
              code: "TEST_DATA_IN_PRODUCTION",
              publicId: rep.public_id,
            },
            { status: 422 }
          );
        }
      }
    }

    // 3.5 Incident Contradiction Guard against Target Group Members
    const { data: currentMembers } = await supabaseAdmin
      .from(dataSource.incidentGroupMembersTable)
      .select(`
        report_id,
        reports:${dataSource.reportsTable} (
          id,
          public_id,
          category_id,
          subcategory_id,
          location,
          description,
          created_at
        )
      `)
      .eq("group_id", targetGroup.id);

    const existingMemberReports = (currentMembers || [])
      .map((m) => (m as { reports?: unknown })?.reports)
      .filter((r): r is { id: string; public_id: string; description: string; location?: string | null; category_id?: number | null; created_at: string } => Boolean(r && typeof (r as { created_at?: unknown }).created_at === "string"));

    if (existingMemberReports.length > 0) {
      const contradictionErrors: Array<{
        public_id: string;
        conflicting_with: string;
        reasons: string[];
      }> = [];

      for (const newRep of reports) {
        for (const existingRep of existingMemberReports) {
          const contra = detectIncidentContradiction(existingRep, newRep);
          if (contra.isContradiction) {
            contradictionErrors.push({
              public_id: newRep.public_id,
              conflicting_with: existingRep.public_id,
              reasons: contra.reasons,
            });
            break;
          }
        }
      }

      if (contradictionErrors.length > 0) {
        return NextResponse.json(
          {
            error: "ไม่สามารถเพิ่มคำร้องเข้ากลุ่มได้ เนื่องจากตรวจพบข้อขัดแย้งกับสมาชิกในกลุ่ม (คนละเหตุการณ์/คนละประเภทปัญหา)",
            code: "INCIDENT_CONTRADICTION",
            conflicts: contradictionErrors,
          },
          { status: 422 }
        );
      }
    }

    const reportIds = reports.map((r) => r.id);

    // 4. Check for Existing Membership in THIS group (Duplicates Prevention)
    const { data: existingInTarget } = await supabaseAdmin
      .from(dataSource.incidentGroupMembersTable)
      .select("report_id")
      .eq("group_id", targetGroup.id)
      .in("report_id", reportIds);

    const alreadyInTargetIds = new Set((existingInTarget || []).map((m) => m.report_id));

    // 5. Check for Existing Membership in OTHER groups (Move Check)
    const { data: existingInOther } = await supabaseAdmin
      .from(dataSource.incidentGroupMembersTable)
      .select(`
        id,
        report_id,
        group_id,
        incident_group:${dataSource.incidentGroupsTable} (
          id,
          group_code,
          title
        ),
        report:${dataSource.reportsTable} (
          public_id
        )
      `)
      .neq("group_id", targetGroup.id)
      .in("report_id", reportIds);

    const conflictingOtherGroups = existingInOther || [];

    // If any reports belong to another group and confirmMove is NOT explicitly true
    if (conflictingOtherGroups.length > 0 && !confirmMove) {
      const rawConflictList = conflictingOtherGroups as unknown as Array<{
        report?: { public_id?: string } | Array<{ public_id?: string }> | null;
        incident_group?: { group_code?: string; title?: string } | Array<{ group_code?: string; title?: string }> | null;
      }>;

      const conflictList = rawConflictList.map((c) => {
        const rep = Array.isArray(c.report) ? c.report[0] : c.report;
        const ig = Array.isArray(c.incident_group) ? c.incident_group[0] : c.incident_group;
        return {
          public_id: rep?.public_id,
          current_group_code: ig?.group_code,
          current_group_title: ig?.title,
        };
      });

      return NextResponse.json(
        {
          error: "มีคำร้องที่อยู่ในกลุ่มอื่นแล้ว กรุณายืนยันการย้ายกลุ่ม",
          requiresConfirmation: true,
          conflicts: conflictList,
        },
        { status: 409 }
      );
    }

    // 6. Process Additions and Moves
    const added: string[] = [];
    const moved: string[] = [];
    const skippedAlreadyInGroup: string[] = [];

    for (const rep of reports) {
      // If already in target group, skip (rule 7: prevent duplicate in same group)
      if (alreadyInTargetIds.has(rep.id)) {
        skippedAlreadyInGroup.push(rep.public_id);
        continue;
      }

      // If in another group and confirmed move
      const otherGroupMembership = conflictingOtherGroups.find((c: { report_id: string }) => c.report_id === rep.id);
      if (otherGroupMembership) {
        // Remove from old group
        await supabaseAdmin
          .from(dataSource.incidentGroupMembersTable)
          .delete()
          .eq("id", otherGroupMembership.id);

        // History in old group
        await supabaseAdmin.from(dataSource.incidentGroupHistoryTable).insert({
          group_id: otherGroupMembership.group_id,
          report_id: rep.id,
          action: "move_report",
          actor_id: staffProfile.id,
          actor_name: staffProfile.full_name,
          details: {
            public_id: rep.public_id,
            moved_to_group_code: targetGroup.group_code,
          },
        });

        moved.push(rep.public_id);
      }

      // Insert into target group
      const { error: insertErr } = await supabaseAdmin
        .from(dataSource.incidentGroupMembersTable)
        .insert({
          group_id: targetGroup.id,
          report_id: rep.id,
          added_by: staffProfile.id,
          notes: notes?.trim() || null,
        });

      if (!insertErr) {
        added.push(rep.public_id);

        // Group history entry
        await supabaseAdmin.from(dataSource.incidentGroupHistoryTable).insert({
          group_id: targetGroup.id,
          report_id: rep.id,
          action: otherGroupMembership ? "move_report" : "add_report",
          actor_id: staffProfile.id,
          actor_name: staffProfile.full_name,
          details: {
            public_id: rep.public_id,
            notes: notes?.trim() || null,
            from_other_group: otherGroupMembership ? (otherGroupMembership.incident_group as { group_code?: string } | null)?.group_code : null,
          },
        });

        // Report timeline log entry
        await supabaseAdmin.from(dataSource.reportLogsTable).insert({
          report_id: rep.id,
          user_id: staffProfile.id,
          action: "incident_group_added",
          remark: `เพิ่มคำร้องเข้ากลุ่มเหตุการณ์ ${targetGroup.group_code} (${targetGroup.title})${
            notes ? ` หมายเหตุ: ${notes}` : ""
          }`,
        });
      }
    }

    // Update target group's updated_at
    await supabaseAdmin
      .from(dataSource.incidentGroupsTable)
      .update({ updated_at: new Date().toISOString() })
      .eq("id", targetGroup.id);

    return NextResponse.json({
      success: true,
      message: `เพิ่มคำร้องเข้ากลุ่มเหตุการณ์สำเร็จ (${added.length} รายการ)`,
      added,
      moved,
      skippedAlreadyInGroup,
    });
  } catch (err: unknown) {
    console.error("Unhandled error in POST /api/incidents/[id]/members:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * DELETE /api/incidents/[id]/members
 * Remove a report from the incident group without deleting the underlying report.
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

    if (!staffProfile) {
      return NextResponse.json({ error: "Staff profile not found", code: "FORBIDDEN" }, { status: 403 });
    }

    const accessibleDeptIds = await getAccessibleDepartmentIds(user.id, staffProfile, supabaseAdmin);
    if (accessibleDeptIds.length === 1 && accessibleDeptIds[0] === -1) {
      return NextResponse.json({ error: "No department access", code: "NO_PERMISSION" }, { status: 403 });
    }

    // Resolve group
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    let groupQuery = supabaseAdmin.from(dataSource.incidentGroupsTable).select("id, group_code, title");
    if (isUUID) {
      groupQuery = groupQuery.eq("id", id);
    } else {
      groupQuery = groupQuery.eq("group_code", id.toUpperCase());
    }

    const { data: targetGroup } = await groupQuery.maybeSingle();
    if (!targetGroup) {
      return NextResponse.json({ error: "ไม่พบกลุ่มเหตุการณ์นี้" }, { status: 404 });
    }

    const body = await req.json();
    const { publicId, reason } = body;

    if (!publicId) {
      return NextResponse.json({ error: "กรุณาระบุรหัสคำร้องที่ต้องการนำออก" }, { status: 400 });
    }

    const normalizedPublicId = normalizePublicId(publicId);

    // Resolve report
    const { data: report } = await supabaseAdmin
      .from(dataSource.reportsTable)
      .select(`
        id,
        public_id,
        category_id,
        categories (
          department_id
        )
      `)
      .eq("public_id", normalizedPublicId)
      .maybeSingle();

    if (!report) {
      return NextResponse.json({ error: "ไม่พบคำร้องที่ระบุ" }, { status: 404 });
    }

    // Check department scope
    if (accessibleDeptIds.length > 0) {
      const deptId = (report.categories as unknown as { department_id?: number } | null)?.department_id;
      if (deptId && !accessibleDeptIds.includes(deptId)) {
        return NextResponse.json({ error: "คุณไม่มีสิทธิ์จัดการคำร้องนี้ข้ามหน่วยงาน" }, { status: 403 });
      }
    }

    // Delete membership record (CASCADE does NOT delete report)
    const { data: deletedMember, error: delErr } = await supabaseAdmin
      .from(dataSource.incidentGroupMembersTable)
      .delete()
      .eq("group_id", targetGroup.id)
      .eq("report_id", report.id)
      .select()
      .maybeSingle();

    if (delErr) {
      console.error("Error removing member:", delErr);
      return NextResponse.json({ error: "ไม่สามารถนำคำร้องออกจากกลุ่มได้" }, { status: 500 });
    }

    if (!deletedMember) {
      return NextResponse.json({ error: "คำร้องนี้ไม่ได้อยู่ในกลุ่มเหตุการณ์ดังกล่าว" }, { status: 404 });
    }

    // History Log in Incident Group
    await supabaseAdmin.from(dataSource.incidentGroupHistoryTable).insert({
      group_id: targetGroup.id,
      report_id: report.id,
      action: "remove_report",
      actor_id: staffProfile.id,
      actor_name: staffProfile.full_name,
      details: {
        public_id: report.public_id,
        reason: reason?.trim() || "เจ้าหน้าที่นำออกจากกลุ่ม",
      },
    });

    // Report timeline log
    await supabaseAdmin.from(dataSource.reportLogsTable).insert({
      report_id: report.id,
      user_id: staffProfile.id,
      action: "incident_group_removed",
      remark: `นำคำร้องออกจากกลุ่มเหตุการณ์ ${targetGroup.group_code} (${targetGroup.title})${
        reason ? ` เหตุผล: ${reason}` : ""
      }`,
    });

    // Update group's updated_at
    await supabaseAdmin
      .from(dataSource.incidentGroupsTable)
      .update({ updated_at: new Date().toISOString() })
      .eq("id", targetGroup.id);

    return NextResponse.json({
      success: true,
      message: `นำคำร้อง ${report.public_id} ออกจากกลุ่มสำเร็จ`,
      publicId: report.public_id,
    });
  } catch (err: unknown) {
    console.error("Unhandled error in DELETE /api/incidents/[id]/members:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
