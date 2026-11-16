import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyAuthToken } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await verifyAuthToken(req);

    if (authError || !user) {
      const errStr = String(authError || "").toLowerCase();
      const isUserNotFound =
        errStr.includes("user not found") ||
        errStr.includes("user from sub claim in jwt does not exist");

      return NextResponse.json(
        {
          success: false,
          error: isUserNotFound
            ? "Auth user not found"
            : "Invalid or expired session",
          code: isUserNotFound ? "AUTH_USER_NOT_FOUND" : "SESSION_ERROR",
          details: authError,
        },
        { status: 401 }
      );
    }

    // Fetch profile using server-side supabaseAdmin (strictly matching id = auth.users.id)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("staff_users")
      .select(
        `
        id,
        full_name,
        department_id,
        role,
        status,
        departments (
          name_th
        )
      `
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      const pgCode = (profileError as any).code || "";
      const msg = (profileError.message || "").toLowerCase();
      if (
        pgCode === "42501" ||
        msg.includes("permission denied") ||
        msg.includes("row-level security")
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "RLS permission denied",
            code: "RLS_PERMISSION_ERROR",
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "Database connection or query error",
          code: "DATABASE_CONNECTION_ERROR",
        },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        {
          success: false,
          error: "Staff profile not found",
          code: "STAFF_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    if (profile.status === "suspended") {
      return NextResponse.json(
        {
          success: false,
          error: "Account is suspended",
          code: "ACCOUNT_SUSPENDED",
        },
        { status: 403 }
      );
    }

    if (profile.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          error: "Account is not active",
          code: "ACCOUNT_INACTIVE",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ profile });
  } catch (error: any) {
    console.error("Error fetching staff profile:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Database connection error",
        code: "DATABASE_CONNECTION_ERROR",
      },
      { status: 500 }
    );
  }
}
