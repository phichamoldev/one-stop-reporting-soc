import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyLine } from "@/lib/line";

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
      .select(`
        *,
        categories (
          id,
          name_th
        ),
        subcategories (
          id,
          name_th
        )
      `)
      .single();

    console.log("SUPABASE ERROR =", error);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    try {
      const createdAt = new Date(data.created_at).toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) + ' น.';

      const payload = {
        publicId: data.public_id,
        categoryName: data.categories?.name_th || data.category || "-",
        subcategoryName: data.subcategories?.name_th || "-",
        description: data.description,
        location: data.location,
        date: createdAt,
        statusText: "pending",
        reporterName: data.reporter_name
      };

      let targetGroupId: string | null = null;
      let departmentId: number | null = null;
      const categoryId = data.category_id;

      if (categoryId) {
        const { data: categoryData } = await supabaseAdmin
          .from("categories")
          .select("department_id")
          .eq("id", categoryId)
          .single();

        departmentId = categoryData?.department_id || null;

        if (departmentId) {
          const { data: deptData } = await supabaseAdmin
            .from("departments")
            .select("line_group_id")
            .eq("id", departmentId)
            .single();
            
          targetGroupId = deptData?.line_group_id || null;
        }
      }

      console.log("=== DEPARTMENT ROUTING LOGS ===");
      console.log("Category ID:", categoryId);
      console.log("Department ID:", departmentId);
      console.log("Target Group ID:", targetGroupId);
      console.log("===============================");

      console.log("=== CALLING LINE ===");
      console.log(payload);

      const notifyResult = await notifyLine(payload, targetGroupId);
      
      console.log("LINE RESULT:", notifyResult);

      if (!notifyResult.success) {
        console.error("LINE Notification Failed:", notifyResult.error);
      }
    } catch (lineError) {
      console.error("LINE Notification Exception:", lineError);
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
