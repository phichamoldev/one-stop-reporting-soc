import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyAuthToken } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await verifyAuthToken(req);
    
    if (authError || !user) {
      console.error("Auth error in profile route:", authError);
      return NextResponse.json({ error: "Unauthorized", details: authError }, { status: 401 });
    }

    // Fetch profile using global supabaseAdmin to bypass RLS
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("staff_users")
      .select(`
        id,
        full_name,
        department_id,
        role,
        departments (
          name_th
        )
      `)
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch (error: any) {
    console.error("Error fetching staff profile:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
