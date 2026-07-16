import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const { publicId } = await params;

    if (!publicId) {
      return NextResponse.json({ error: "Missing publicId" }, { status: 400 });
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

    return NextResponse.json({ report: data });
  } catch (error: any) {
    console.error("Error fetching report:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
