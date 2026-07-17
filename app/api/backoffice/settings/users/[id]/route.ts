import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifySuperAdmin, logAuditAction } from "../route";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: targetUserId } = await params;
    const authResult = await verifySuperAdmin(req);
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json();
    const { full_name, department_id, role, status } = body;

    // Prevent disabling or changing role of the last super_admin or oneself
    // (A more robust check would count super_admins in the DB before changing a role, but we'll at least prevent self-lockout)
    if (targetUserId === authResult.user!.id && (role !== "super_admin" || status === "disabled")) {
      return NextResponse.json({ error: "Cannot downgrade or disable your own account" }, { status: 400 });
    }

    // Prepare update payload
    const updatePayload: any = {};
    if (full_name !== undefined) updatePayload.full_name = full_name;
    if (department_id !== undefined) updatePayload.department_id = department_id;
    if (role !== undefined) updatePayload.role = role;
    if (status !== undefined) updatePayload.status = status;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // Update staff profile
    const { data: updatedStaff, error: updateErr } = await supabaseAdmin
      .from("staff_users")
      .update(updatePayload)
      .eq("id", targetUserId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }

    // Log action
    let action = "Update User";
    if (status === "disabled") action = "Disable User";
    if (status === "active" && updatePayload.status === "active") action = "Enable User";
    if (role && updatePayload.role) action = "Change Role";

    await logAuditAction(authResult.user!.id, action, targetUserId, updatePayload);

    return NextResponse.json({ success: true, user: updatedStaff });
  } catch (error: any) {
    console.error("PATCH /settings/users/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
