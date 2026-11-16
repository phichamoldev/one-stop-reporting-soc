import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getReportDataSource } from "@/lib/dataSource";
import { verifyAuthToken, getAccessibleDepartmentIds } from "@/lib/auth-helpers";
import { normalizePublicId } from "@/lib/utils";
import { PriorityLevel } from "@/lib/priorityClassifier";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/reports/[publicId]/priority
 * Updates a report's priority classification with role permission checking and audit logging.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const dataSource = getReportDataSource();
    const { publicId } = await params;

    if (!publicId) {
      return NextResponse.json({ error: "Missing publicId" }, { status: 400 });
    }

    // 1. Authenticate Staff
    const { user, error: authErr } = await verifyAuthToken(req);
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

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

    // 2. Parse and Validate Request Body
    const body = await req.json();
    const { priority, reason } = body as { priority: PriorityLevel; reason?: string };

    const validPriorities: PriorityLevel[] = ["emergency", "normal", "needs_review"];
    if (!priority || !validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: `ระดับความเร่งด่วนไม่ถูกต้อง ต้องเป็น: ${validPriorities.join(", ")}` },
        { status: 400 }
      );
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: "กรุณาระบุเหตุผลในการปรับเปลี่ยนระดับความเร่งด่วน" },
        { status: 400 }
      );
    }

    // 3. Resolve Target Report
    const normalizedPublicId = normalizePublicId(publicId);
    const { data: currentReport, error: repErr } = await supabaseAdmin
      .from(dataSource.reportsTable)
      .select(`
        id,
        public_id,
        priority,
        status,
        category_id,
        categories (
          department_id
        )
      `)
      .eq("public_id", normalizedPublicId)
      .maybeSingle();

    if (repErr || !currentReport) {
      return NextResponse.json({ error: "ไม่พบคำร้องที่ระบุ" }, { status: 404 });
    }

    // 4. Department Scope Check
    const reportDeptId = (currentReport.categories as unknown as { department_id?: number } | null)?.department_id;
    if (accessibleDeptIds.length > 0 && reportDeptId && !accessibleDeptIds.includes(reportDeptId)) {
      return NextResponse.json(
        { error: "คุณไม่มีสิทธิ์จัดการคำร้องของหน่วยงานนี้", code: "FORBIDDEN_DEPARTMENT" },
        { status: 403 }
      );
    }

    const oldPriority = currentReport.priority || "normal";

    // 5. Rule: Do not allow regular staff to silently downgrade emergency to normal
    if (oldPriority === "emergency" && priority === "normal") {
      const canDowngradeEmergency = ["super_admin", "admin", "manager"].includes(staffProfile.role);
      if (!canDowngradeEmergency) {
        return NextResponse.json(
          {
            error: "เจ้าหน้าที่ระดับปฏิบัติการไม่สามารถลดระดับเหตุฉุกเฉินเป็นเรื่องทั่วไปได้ ต้องได้รับการอนุมัติจากหัวหน้างาน/ผู้ดูแลระบบ",
            code: "CANNOT_DOWNGRADE_EMERGENCY"
          },
          { status: 403 }
        );
      }
    }

    // 6. Update Report Priority
    const now = new Date().toISOString();
    const { data: updatedReport, error: updateErr } = await supabaseAdmin
      .from(dataSource.reportsTable)
      .update({
        priority,
        updated_at: now,
      })
      .eq("id", currentReport.id)
      .select()
      .single();

    if (updateErr || !updatedReport) {
      console.error("Error updating priority:", updateErr);
      return NextResponse.json({ error: "ไม่สามารถอัปเดตระดับความเร่งด่วนได้" }, { status: 500 });
    }

    // 7. Insert Audit Trail into reportLogsTable
    const auditRemark = `ปรับระดับความเร่งด่วนจาก "${oldPriority}" เป็น "${priority}" โดย ${staffProfile.full_name} (${staffProfile.role}) - เหตุผล: ${reason.trim()}`;
    await supabaseAdmin.from(dataSource.reportLogsTable).insert({
      report_id: currentReport.id,
      user_id: staffProfile.id,
      action: "priority_updated",
      old_status: currentReport.status,
      new_status: currentReport.status,
      remark: auditRemark,
    });

    return NextResponse.json({
      success: true,
      message: `ปรับระดับความเร่งด่วนเป็น "${priority}" สำเร็จ`,
      report: updatedReport,
      oldPriority,
      newPriority: priority,
      updatedBy: {
        id: staffProfile.id,
        full_name: staffProfile.full_name,
        role: staffProfile.role,
      },
      reason: reason.trim(),
    });
  } catch (err: unknown) {
    console.error("Unhandled error in PATCH /api/reports/[publicId]/priority:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
