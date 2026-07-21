import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAccessibleDepartmentIds } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("staff_users")
      .select("role, department_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Staff profile not found" }, { status: 403 });
    }

    const accessibleDeptIds = await getAccessibleDepartmentIds(user.id, profile, supabaseAdmin);

    if (accessibleDeptIds.length === 1 && accessibleDeptIds[0] === -1) {
      return NextResponse.json({ error: "No permission", code: "NO_PERMISSION" }, { status: 403 });
    }

    let query = supabaseAdmin
      .from("reports")
      .select("id, public_id, description, category_id, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (accessibleDeptIds.length > 0) {
      const { data: catData } = await supabaseAdmin
        .from("categories")
        .select("id")
        .in("department_id", accessibleDeptIds);
        
      const catIds = catData ? catData.map(c => c.id) : [];
      if (catIds.length > 0) {
        query = query.in("category_id", catIds);
      } else {
        query = query.in("category_id", [0]);
      }
    }

    query = query.limit(7);
    const { data: reports, error: reportsError } = await query;

    if (reportsError) {
      console.error("[pending-summary] Supabase query error:", reportsError);
      return NextResponse.json({ error: reportsError.message }, { status: 500 });
    }

    return NextResponse.json({ reports });

  } catch (error: any) {
    console.error("[pending-summary] Uncaught exception:", error);
    return NextResponse.json(
      { error: "Failed to load pending summary" },
      { status: 500 }
    );
  }
}
