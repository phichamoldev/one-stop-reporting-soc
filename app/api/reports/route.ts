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
      .select()
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

      const message = `🔔 มีคำร้องใหม่\n\nเลขอ้างอิง: ${data.public_id}\n\nหมวดหมู่: ${data.category}\n\nหัวข้อ: ${data.description}\n\nสถานที่: ${data.location}\n\nวันที่แจ้ง: ${createdAt}\n\nสถานะ: รอรับเรื่อง\n\n--------------------\n\nเปิดระบบ:\nhttps://supportsoc.vercel.app`;

      console.log("=== CALLING LINE ===");
      console.log(message);

      const notifyResult = await notifyLine(message);
      
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
