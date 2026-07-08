import { NextResponse } from "next/server";
import { notifyLine } from "@/lib/line";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const message = `🔔 ทดสอบแจ้งเตือน One Stop Service\n\nระบบสามารถเชื่อมต่อ LINE OA ได้สำเร็จ`;
    
    console.log("Sending LINE notification test...");
    const result = await notifyLine(message);
    
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
