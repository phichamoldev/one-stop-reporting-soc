import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { notifyLine } from "@/lib/line";
import { getAccessibleDepartmentIds } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const { publicId } = await params;
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
    const { status, remark, reportId, oldStatus, departmentId } = body;

    if (!reportId) {
      return NextResponse.json({ error: "Missing reportId" }, { status: 400 });
    }

    // Verify staff exists and is active (optional, depending on business rules)
    const { data: staffProfile } = await supabaseAdmin
      .from("staff_users")
      .select("id, role, department_id")
      .eq("id", user.id)
      .single();

    if (!staffProfile) {
      return NextResponse.json({ error: "Staff profile not found" }, { status: 403 });
    }

    if (staffProfile.role === "staff" && status === "transfer") {
      return NextResponse.json({ error: "Staff cannot transfer reports" }, { status: 403 });
    }

    // 2. Load report information
    const { data: currentReport, error: fetchError } = await supabaseAdmin
      .from("reports")
      .select(`
        id,
        category_id,
        categories(department_id)
      `)
      .eq("id", reportId)
      .single();

    if (fetchError || !currentReport) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const currentDepartmentId = (currentReport.categories as any)?.department_id;

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
    const updatePayload: any = { updated_at: now };
    
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
      
      let oldDeptName = "ไม่ระบุ";
      if (currentDepartmentId) {
        const { data: oldDept } = await supabaseAdmin
          .from("departments")
          .select("name_th")
          .eq("id", currentDepartmentId)
          .single();
        if (oldDept) oldDeptName = oldDept.name_th;
      }
        
      // Get new department name and line group
      const { data: newDept } = await supabaseAdmin
        .from("departments")
        .select("name_th, line_group_id")
        .eq("id", departmentId)
        .single();
        
      const newDeptName = newDept?.name_th || "ไม่ระบุ";
      (req as any).targetLineGroupId = newDept?.line_group_id || null;
      (req as any).oldDeptName = oldDeptName;

      updatePayload.status = "pending";
      updatePayload.category_id = targetCategory.id;
      
      const remarkText = remark ? `\n\nหมายเหตุ:\n${remark}` : "";
      updatePayload.admin_remark = `โอนคำร้อง\n\nจาก:\n${oldDeptName}\n\nไปยัง:\n${newDeptName}${remarkText}`;
    } else {
      if (status) {
        updatePayload.status = status;
        if (status === "completed") {
          updatePayload.completed_by = user.id;
          updatePayload.completed_at = now;
        }
      }
      
      if (remark !== undefined) {
        updatePayload.admin_remark = remark;
      }
    }

    // Update the report
    const { data: updatedReport, error: updateError } = await supabaseAdmin
      .from("reports")
      .update(updatePayload)
      .eq("id", reportId)
      .select(`
        *,
        categories(name_th),
        subcategories(name_th)
      `)
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Create the log
    let actionName = "อัปเดตข้อมูล";
    let logRemark = remark || null;
    
    if (status === "transfer") {
      actionName = "transfer";
      logRemark = updatePayload.admin_remark; // Use the formatted remark with old/new category names
    } else if (status && remark === undefined) {
      actionName = "status_updated";
    } else if (remark !== undefined && !status) {
      actionName = "note_updated";
    }

    const { error: logError } = await supabaseAdmin
      .from("report_logs")
      .insert({
        report_id: reportId,
        user_id: user.id,
        action: actionName,
        old_status: oldStatus || updatedReport.status, // Ideally passing old_status from client or fetching it before update
        new_status: status === "transfer" ? "pending" : (status || updatedReport.status),
        remark: logRemark,
        created_at: now
      });

    if (logError) {
      console.error("Failed to insert report log:", logError);
      // We don't fail the whole request if log fails, but it's bad
    }

    // Trigger LINE notification if it's a transfer
    if (status === "transfer" && (req as any).targetLineGroupId) {
      try {
        const createdAt = new Date(updatedReport.created_at).toLocaleString('th-TH', {
          timeZone: 'Asia/Bangkok',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) + ' น.';

        const payload = {
          publicId: updatedReport.public_id,
          categoryName: (updatedReport.categories as any)?.name_th || "-",
          subcategoryName: (updatedReport.subcategories as any)?.name_th || "-",
          description: updatedReport.description,
          location: updatedReport.location,
          date: createdAt,
          statusText: "pending",
          reporterName: updatedReport.reporter_name,
          isTransfer: true,
          oldDepartmentName: (req as any).oldDeptName,
          transferRemark: remark
        };

        await notifyLine(payload, (req as any).targetLineGroupId);
      } catch (err) {
        console.error("Failed to send LINE notification for transfer:", err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating report:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
