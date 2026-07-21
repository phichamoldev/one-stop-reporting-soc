import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Validate token with Supabase Auth
    // We create a temporary client just to get the user from the JWT
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth error in profile route:", authError);
      return NextResponse.json({ error: "Unauthorized", details: authError }, { status: 401 });
    }

    // Fetch profile using Admin key to bypass RLS
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
