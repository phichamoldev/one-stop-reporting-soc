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

    // Load existing logs to determine current remark & image for partial updates
    const { data: existingLogs } = await supabaseAdmin
      .from(dataSource.reportLogsTable)
      .select("id, action, old_status, new_status, remark, image_url, created_at")
      .eq("report_id", reportId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    const STAFF_REPLY_ACTIONS = new Set([
      "status_updated",
      "note_updated",
      "image_updated",
      "note_and_image_updated",
      "transfer",
    ]);
    const staffLogs = (existingLogs || []).filter((l) => STAFF_REPLY_ACTIONS.has(l.action));
    const latestStaffLog = staffLogs[0] || null;

    let currentStaffImage: string | null = null;
    if (latestStaffLog) {
      if (latestStaffLog.action === "image_updated" || latestStaffLog.action === "note_and_image_updated") {
        currentStaffImage = latestStaffLog.image_url || null;
      } else {
        currentStaffImage =
          latestStaffLog.image_url ||
          staffLogs.find((l) => l.action === "status_updated" && l.new_status === currentReport.status)?.image_url ||
          null;
      }
    }

    const isStatusProvided = Boolean(status && typeof status === "string" && status.trim() !== "");
    const isStatusChanged = isStatusProvided && (status === "transfer" || status !== currentReport.status);

    const currentRemark = (currentReport.admin_remark ?? latestStaffLog?.remark ?? "").trim();
    const isRemarkProvided = remark !== undefined;
    const isRemarkChanged = isRemarkProvided && (remark || "").trim() !== currentRemark;
    const effectiveRemark = isRemarkProvided
      ? remark
      : (currentReport.admin_remark ?? latestStaffLog?.remark ?? null);

    // Distinguish imageUrl === undefined (unchanged) vs null/"" (explicitly removed) vs string URL (added/replaced)
    const isImageFieldSent = Object.prototype.hasOwnProperty.call(body, "imageUrl") && imageUrl !== undefined;
    const normalizedIncomingImage = isImageFieldSent
      ? typeof imageUrl === "string" && imageUrl.trim() !== ""
        ? imageUrl.trim()
        : null
      : currentStaffImage;
    const isImageChanged = isImageFieldSent && (normalizedIncomingImage || null) !== (currentStaffImage || null);
    const effectiveImageUrl = isImageFieldSent ? normalizedIncomingImage : currentStaffImage;

    const isAssigneeProvided = assigned_to !== undefined;

    // Rule: Must have at least 1 actual change (status, remark, image, or assignment)
    if (!isStatusChanged && !isRemarkChanged && !isImageChanged && !isAssigneeProvided) {
      return NextResponse.json({ error: "กรุณาเลือกสถานะใหม่ หรือแก้ไขข้อมูลก่อนบันทึก" }, { status: 400 });
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
      
      if (isRemarkChanged || (isRemarkProvided && isStatusChanged)) {
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

    // If image was deleted or replaced, clean up old image from storage (best-effort) and sync previous logs
    if (isImageChanged) {
      if (currentStaffImage && currentStaffImage !== effectiveImageUrl) {
        const marker = "/storage/v1/object/public/report-images/";
        const markerIdx = currentStaffImage.indexOf(marker);
        if (markerIdx !== -1) {
          const oldStoragePath = decodeURIComponent(currentStaffImage.slice(markerIdx + marker.length));
          if (oldStoragePath) {
            await supabaseAdmin.storage.from("report-images").remove([oldStoragePath]).catch(() => {});
          }
        }
      }

      if (effectiveImageUrl === null) {
        // Clear image_url on previous logs of this report so deleted image is never resurrected
        await supabaseAdmin
          .from(dataSource.reportLogsTable)
          .update({ image_url: null })
          .eq("report_id", reportId)
          .not("image_url", "is", null);
      }
    }

    // When updating note and/or image without changing status, also keep the latest status_updated log for this status in sync
    if (!isStatusChanged && (isRemarkChanged || isImageChanged)) {
      const targetStatusLog = staffLogs.find(
        (l) => l.action === "status_updated" && l.new_status === currentReport.status
      );
      if (targetStatusLog) {
        await supabaseAdmin
          .from(dataSource.reportLogsTable)
          .update({
            remark: effectiveRemark,
            image_url: effectiveImageUrl,
          })
          .eq("id", targetStatusLog.id);
      }
    }

    // Create the activity / status log
    let actionName = "อัปเดตข้อมูล";
    let logRemark = effectiveRemark || null;
    
    if (status === "transfer") {
      actionName = "transfer";
      logRemark = updatePayload.admin_remark as string;
    } else if (isAssigneeProvided && !isStatusChanged && !isRemarkChanged && !isImageChanged) {
      actionName = "task_assigned";
    } else if (isStatusChanged) {
      actionName = "status_updated";
      // Only include remark on the status_updated log if remark was provided or exists
      logRemark = isRemarkProvided ? (remark || null) : (effectiveRemark || null);
    } else if (isRemarkChanged && isImageChanged) {
      actionName = "note_and_image_updated";
    } else if (isRemarkChanged && !isImageChanged) {
      actionName = "note_updated";
    } else if (!isRemarkChanged && isImageChanged) {
      actionName = "image_updated";
      logRemark = effectiveImageUrl ? "อัปเดตรูปภาพประกอบการดำเนินงาน" : "ลบรูปภาพประกอบการดำเนินงาน";
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
        image_url: effectiveImageUrl,
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
