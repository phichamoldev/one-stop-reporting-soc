import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAccessibleDepartmentIds } from "@/lib/auth-helpers";
import { getReportDataSource } from "@/lib/dataSource";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const dataSource = getReportDataSource();
    const { publicId: _publicId } = await params;
    void _publicId;
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { status, remark, reportId, departmentId, imageUrl, oldStatus, assigned_to } = body;

    if (!reportId) {
      return NextResponse.json({ error: "Missing reportId" }, { status: 400 });
    }

    // Verify staff exists and is active
    const { data: staffProfile } = await supabaseAdmin
      .from("staff_users")
      .select("id, role, department_id, status")
      .eq("id", user.id)
      .single();

    if (!staffProfile || staffProfile.status !== "active") {
      return NextResponse.json({ error: "Staff profile not found or inactive", code: "FORBIDDEN" }, { status: 403 });
    }

    if (staffProfile.role === "staff" && status === "transfer") {
      return NextResponse.json({ error: "Staff cannot transfer reports" }, { status: 403 });
    }

    // 2. Load report information
    const { data: currentReport, error: fetchError } = await supabaseAdmin
      .from(dataSource.reportsTable)
      .select(`
        id,
        category_id,
        status,
        admin_remark,
        categories(department_id)
      `)
      .eq("id", reportId)
      .single();

    if (fetchError || !currentReport) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Concurrent modification check if oldStatus was provided
    if (oldStatus && currentReport.status !== oldStatus) {
      return NextResponse.json(
        {
          error: "สถานะคำร้องถูกเปลี่ยนแปลงโดยผู้ใช้อื่นแล้ว กรุณารีเฟรชข้อมูลล่าสุดก่อนดำเนินการ",
          code: "CONCURRENT_MODIFICATION",
          currentStatus: currentReport.status,
        },
        { status: 409 }
      );
    }

    const isStatusProvided = Boolean(status && typeof status === "string" && status.trim() !== "");
    const isStatusChanged = isStatusProvided && (status === "transfer" || status !== currentReport.status);
    const isRemarkProvided = remark !== undefined;
    const isRemarkChanged = isRemarkProvided && (remark || "").trim() !== (currentReport.admin_remark || "").trim();
    const isImageProvided = Boolean(imageUrl);
    const isAssigneeProvided = assigned_to !== undefined;

    // Rule: Must have at least 1 change (status, remark, image, or assignment)
    if (!isStatusChanged && !isRemarkChanged && !isImageProvided && !isAssigneeProvided) {
      return NextResponse.json({ error: "กรุณาเลือกสถานะใหม่ หรือเพิ่มหมายเหตุ" }, { status: 400 });
    }

    // Rule: Image attachment is permitted ONLY when status is 'completed'
    const effectiveStatus = (status && status !== "transfer") ? status : currentReport.status;
    if (isImageProvided && effectiveStatus !== "completed") {
      return NextResponse.json(
        {
          error: "สามารถแนบรูปภาพได้เมื่อเลือกสถานะ 'เสร็จสิ้น' เท่านั้น",
          code: "IMAGE_ATTACHMENT_NOT_ALLOWED",
        },
        { status: 400 }
      );
    }

    if (currentReport.status === 'completed' && !['admin', 'super_admin', 'manager'].includes(staffProfile.role)) {
      return NextResponse.json({ error: "Forbidden: Cannot edit a completed report" }, { status: 403 });
    }

    const currentDeptObj = Array.isArray(currentReport.categories)
      ? (currentReport.categories[0] as { department_id: number | null } | undefined)
      : (currentReport.categories as unknown as { department_id: number | null } | null);
    const currentDepartmentId = currentDeptObj?.department_id;

    // 3. Resolve accessible departments
    const accessibleDepartmentIds = await getAccessibleDepartmentIds(
      staffProfile.id,
      staffProfile,
      supabaseAdmin
    );

    // 4. Ownership Validation
    if (staffProfile.role === "manager" || staffProfile.role === "staff") {
      if (!currentDepartmentId || !accessibleDepartmentIds.includes(currentDepartmentId)) {
        return NextResponse.json({ error: "Forbidden: You do not have access to this report's department" }, { status: 403 });
      }
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = { updated_at: now };
    let oldDeptName = "ไม่ระบุ";
    
    if (status === "transfer") {
      if (!departmentId) {
        return NextResponse.json({ error: "Missing destination departmentId for transfer" }, { status: 400 });
      }

      // 5. Transfer Validation
      if (currentDepartmentId === departmentId) {
        return NextResponse.json({ error: "Cannot transfer to the same department" }, { status: 400 });
      }
      
      // Get target category based on department_id
      const { data: targetCategory } = await supabaseAdmin
        .from("categories")
        .select("id")
        .eq("department_id", departmentId)
        .limit(1)
        .single();
        
      if (!targetCategory) {
        return NextResponse.json({ error: "Invalid department or no mapped category" }, { status: 400 });
      }
      
      if (currentDepartmentId) {
        const { data: oldDept } = await supabaseAdmin
          .from("departments")
          .select("name_th")
          .eq("id", currentDepartmentId)
          .single();
        if (oldDept) oldDeptName = oldDept.name_th;
      }
        
      // Get new department name
      const { data: newDept } = await supabaseAdmin
        .from("departments")
        .select("name_th")
        .eq("id", departmentId)
        .single();
        
      const newDeptName = newDept?.name_th || "ไม่ระบุ";

      updatePayload.status = "pending";
      updatePayload.category_id = targetCategory.id;
      
      const remarkText = remark ? `\n\nหมายเหตุ:\n${remark}` : "";
      updatePayload.admin_remark = `โอนคำร้อง\n\nจาก:\n${oldDeptName}\n\nไปยัง:\n${newDeptName}${remarkText}`;
    } else {
      if (isStatusChanged) {
        updatePayload.status = status;
        if (status === "completed") {
          updatePayload.completed_by = user.id;
          updatePayload.completed_at = now;
        }
      }
      
      if (isRemarkChanged || (remark !== undefined && isStatusChanged)) {
        updatePayload.admin_remark = remark;
      }
      if (isAssigneeProvided) {
        updatePayload.assigned_to = assigned_to;
      }
    }

    // Update the report
    const { error: updateError } = await supabaseAdmin
      .from(dataSource.reportsTable)
      .update(updatePayload)
      .eq("id", reportId)
      .select("id")
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }

    // Create the log
    let actionName = "อัปเดตข้อมูล";
    let logRemark = remark || null;
    
    if (status === "transfer") {
      actionName = "transfer";
      logRemark = updatePayload.admin_remark as string; // Use the formatted remark with old/new category names
    } else if (isAssigneeProvided && !isStatusChanged && !isRemarkChanged) {
      actionName = "task_assigned";
    } else if (isStatusChanged && !isRemarkChanged) {
      actionName = "status_updated";
    } else if (isRemarkChanged && !isStatusChanged) {
      actionName = "note_updated";
    } else if (isStatusChanged && isRemarkChanged) {
      actionName = "status_updated";
    }

    const { error: logError } = await supabaseAdmin
      .from(dataSource.reportLogsTable)
      .insert({
        report_id: reportId,
        user_id: user.id,
        action: actionName,
        old_status: currentReport.status,
        new_status: status === "transfer" ? "pending" : (isStatusChanged ? status : currentReport.status),
        remark: logRemark,
        image_url: imageUrl || null,
        created_at: now
      });

    if (logError) {
      console.error("Failed to insert report log:", logError);
      // We don't fail the whole request if log fails, but it's bad
    }

    // Event Policy: Status changes and transfers never send LINE notifications (Localhost & Production)

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error updating report:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
