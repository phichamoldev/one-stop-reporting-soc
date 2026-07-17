import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const { publicId } = await params;

    if (!publicId) {
      return NextResponse.json({ error: "Missing publicId" }, { status: 400 });
    }

    let isAuthenticated = false;
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const supabaseClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { user } } = await supabaseClient.auth.getUser(token);
      if (user) isAuthenticated = true;
    }

    const { data, error } = await supabaseAdmin
      .from("reports")
      .select(`
        *,
        categories (
          id,
          name_th,
          department_id
        ),
        subcategories (
          id,
          name_th
        ),
        report_logs (
          id,
          action,
          new_status,
          remark,
          created_at,
          staff_users (
            full_name
          )
        )
      `)
      .eq("public_id", publicId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "ไม่พบข้อมูลรายงาน" }, { status: 404 });
    }

    // PII filtering for public access
    if (!isAuthenticated) {
      delete data.tracking_token;
      delete data.admin_remark;
      delete data.assigned_to;
      delete data.completed_by;
    }

    return NextResponse.json({ report: data });
  } catch (error: any) {
    console.error("Error fetching report:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
