import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

console.log(
  "SERVICE ROLE EXISTS:",
  !!process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log(
  "SUPABASE URL EXISTS:",
  !!process.env.NEXT_PUBLIC_SUPABASE_URL
);

console.log(
  "SERVICE ROLE PREFIX:",
  process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20)
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("INSERT BODY", body);

    const { data, error } = await supabaseAdmin
      .from("reports")
      .insert(body)
      .select()
      .single();

    console.log("SUPABASE ERROR =", error);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { data },
      { status: 200 }
    );

  } catch (err: unknown) {

    console.error("SERVER ERROR =", err);

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Server error"
      },
      { status: 500 }
    );
  }
}
console.log(
  "SERVICE ROLE:",
  process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20)
);
