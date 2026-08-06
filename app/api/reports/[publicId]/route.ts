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
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) {
        // Verify the user is a staff member
        const { data: staffProfile } = await supabaseAdmin
          .from("staff_users")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();
        
        if (staffProfile) {
          isAuthenticated = true;
        }
      }
    }

    const normalizedPublicId = publicId.trim().toUpperCase();
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedPublicId);

    let query = supabaseAdmin
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
      `);

    if (isUUID) {
      query = query.eq("tracking_token", normalizedPublicId.toLowerCase());
    } else {
      query = query.eq("public_id", normalizedPublicId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
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
