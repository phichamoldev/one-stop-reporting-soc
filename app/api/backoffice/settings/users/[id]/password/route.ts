import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifySuperAdmin, logAuditAction } from "../../route";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: targetUserId } = await params;
    const authResult = await verifySuperAdmin(req);
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json();
    const { password } = body;

    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Update auth user password
    const { data: updatedUser, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { password }
    );

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }

    // Log action
    await logAuditAction(authResult.user!.id, "Reset Password", updatedUser.user.email || targetUserId, {});

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PATCH /settings/users/[id]/password error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
