import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifySuperAdmin } from "../users/route";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const authResult = await verifySuperAdmin(req);
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { data: logs, error } = await supabaseAdmin
      .from("audit_logs")
      .select(`
        id,
        action,
        target,
        details,
        created_at,
        staff_users (
          full_name,
          role
        )
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error("GET /settings/audit-logs error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
