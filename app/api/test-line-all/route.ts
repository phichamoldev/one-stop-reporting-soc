import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { notifyLine } from "@/lib/line";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data: departments, error } = await supabaseAdmin
      .from("departments")
      .select("id, name_th, line_group_id")
      .not("line_group_id", "is", null);

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    const payload = {
      publicId: "SOC-TEST-9999",
      categoryName: "ระบบดิจิทัล คอมพิวเตอร์ และโสตทัศนูปกรณ์",
      subcategoryName: "อินเทอร์เน็ต / Wi-Fi",
      description: "ทดสอบส่งข้อความไปยังทุกกลุ่ม LINE ของระบบ One Stop Service",
      location: "คณะสังคมศาสตร์",
      reporterName: "System Test",
      statusText: "pending",
      date: new Date().toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " น.",
    };

    const results = [];

    for (const dept of departments || []) {
      try {
        const result = await notifyLine(
          payload,
          dept.line_group_id
        );

        results.push({
          departmentId: dept.id,
          departmentName: dept.name_th,
          groupId: dept.line_group_id,
          success: result.success,
          error: result.error || null,
        });

      } catch (err) {
        results.push({
          departmentId: dept.id,
          departmentName: dept.name_th,
          groupId: dept.line_group_id,
          success: false,
          error:
            err instanceof Error
              ? err.message
              : String(err),
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalGroups: results.length,
      results,
    });

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Error",
      },
      { status: 500 }
    );
  }
}