import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const { publicId } = await params;
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { status, remark, reportId, oldStatus } = body;

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

    const now = new Date().toISOString();
    const updatePayload: any = { updated_at: now };
    
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

    // Update the report
    const { data: updatedReport, error: updateError } = await supabaseAdmin
      .from("reports")
      .update(updatePayload)
      .eq("id", reportId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Create the log
    let actionName = "อัปเดตข้อมูล";
    if (status && remark === undefined) {
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
        new_status: status || updatedReport.status,
        remark: remark || null,
        created_at: now
      });

    if (logError) {
      console.error("Failed to insert report log:", logError);
      // We don't fail the whole request if log fails, but it's bad
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
