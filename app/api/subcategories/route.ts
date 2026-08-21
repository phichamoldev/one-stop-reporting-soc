import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sortSubcategories } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");

    let query = supabaseAdmin
      .from("subcategories")
      .select("id,name_th")
      .order("id");

    if (categoryId) {
      query = query.eq("category_id", parseInt(categoryId, 10));
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }

    const sortedSubcategories = sortSubcategories(data || []);

    return NextResponse.json({ subcategories: sortedSubcategories });
  } catch (error: any) {
    console.error("Error fetching subcategories:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
