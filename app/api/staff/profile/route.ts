import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const url = new URL(req.url);
    const queryToken = url.searchParams.get("token");
    
    const token = queryToken || (authHeader ? authHeader.replace("Bearer ", "").trim() : "");

    if (!token || token === "undefined" || token === "null") {
      return NextResponse.json({ error: "Missing or invalid authorization token", authHeader }, { status: 401 });
    }
    
    // Verify token using a fresh client to avoid any session caching issues
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } }
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error("Auth error in profile route:", authError);
      return NextResponse.json({ error: "Unauthorized", details: authError }, { status: 401 });
    }

    // Fetch profile using Admin key to bypass RLS
    const { data: profile, error: profileError } = await supabaseClient
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
