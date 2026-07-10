import { NextResponse } from "next/server";
import { notifyLine } from "@/lib/line";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const payload = {
      publicId: "SOC-TEST-1234",
      categoryName: "ระบบดิจิทัล คอมพิวเตอร์ และโสตทัศนูปกรณ์",
      subcategoryName: "อินเทอร์เน็ต / Wi-Fi",
      description: "ใช้งาน Wi-Fi คณะไม่ได้ เชื่อมต่อแล้วหลุดบ่อยมาก",
      location: "ห้องสมุดคณะ",
      date: new Date().toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) + ' น.',
      reporterName: "นายทดสอบ ระบบ",
      statusText: "pending"
    };
    
    console.log("Sending LINE notification test...");
    const result = await notifyLine(payload);
    
    console.log("LINE Notification API Response:", result);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Test Endpoint Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
