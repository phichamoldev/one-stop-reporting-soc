import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifySuperAdmin, logAuditAction } from "../users/route";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const authResult = await verifySuperAdmin(req);
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { data: settings, error } = await supabaseAdmin
      .from("system_settings")
      .select("*");

    if (error) throw error;

    // Convert array of {key, value} to an object
    const settingsObj = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, any>);

    return NextResponse.json({ settings: settingsObj });
  } catch (error: any) {
    console.error("GET /settings/system error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const authResult = await verifySuperAdmin(req);
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: "Missing key or value" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("system_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await logAuditAction(authResult.user!.id, "Update System Settings", key, { value });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PATCH /settings/system error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
