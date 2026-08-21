import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// In-memory rate limiting: max 15 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const limitWindow = 60 * 1000; // 1 minute
  const maxRequests = 15;

  const current = rateLimitMap.get(ip);
  if (!current || now > current.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + limitWindow });
    return false;
  }

  if (current.count >= maxRequests) {
    return true;
  }

  current.count += 1;
  return false;
}

function maskPhoneNumber(phoneDigits: string): string {
  if (phoneDigits.length === 10) {
    // Format: 081-2XX-5678
    return `${phoneDigits.slice(0, 3)}-${phoneDigits.charAt(3)}XX-${phoneDigits.slice(6)}`;
  } else if (phoneDigits.length === 9) {
    // Format: 02-1XX-4567
    return `${phoneDigits.slice(0, 2)}-${phoneDigits.charAt(2)}XX-${phoneDigits.slice(5)}`;
  }
  return `${phoneDigits.slice(0, 3)}XXXX${phoneDigits.slice(-2)}`;
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               req.headers.get("x-real-ip") || 
               "unknown-ip";

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "มีการค้นหาถี่เกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง" },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";

    const digitsOnly = rawPhone.replace(/\D/g, "");

    if (!digitsOnly || digitsOnly.length < 9 || digitsOnly.length > 10 || !digitsOnly.startsWith("0")) {
      return NextResponse.json(
        { error: "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง (กรุณากรอกตัวเลข 9-10 หลัก)" },
        { status: 400 }
      );
    }

    const maskedPhone = maskPhoneNumber(digitsOnly);

    // Support both plain digits and standard hyphenated variants
    const possibleFormats = [digitsOnly];
    if (digitsOnly.length === 10) {
      possibleFormats.push(`${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`);
      possibleFormats.push(`${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3)}`);
    } else if (digitsOnly.length === 9) {
      possibleFormats.push(`${digitsOnly.slice(0, 2)}-${digitsOnly.slice(2, 5)}-${digitsOnly.slice(5)}`);
      possibleFormats.push(`${digitsOnly.slice(0, 2)}-${digitsOnly.slice(2)}`);
    }

    const { data: reports, error } = await supabaseAdmin
      .from("reports")
      .select(`
        id,
        public_id,
        description,
        location,
        status,
        created_at,
        categories (
          name_th
        )
      `)
      .in("phone", possibleFormats)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Lookup Reports by Phone Error:", error);
      return NextResponse.json(
        { error: "เกิดข้อผิดพลาดในการดึงข้อมูล กรุณาลองใหม่อีกครั้ง" },
        { status: 500 }
      );
    }

    if (!reports || reports.length === 0) {
      return NextResponse.json({
        found: false,
        count: 0,
        maskedPhone,
        reports: []
      });
    }

    const mappedReports = reports.map((r: any) => ({
      public_id: r.public_id,
      title: r.description || "คำร้องแจ้งปัญหา",
      description: r.description || "",
      location: r.location || "",
      status: r.status,
      created_at: r.created_at,
      category_name: r.categories?.name_th || undefined
    }));

    return NextResponse.json({
      found: true,
      count: mappedReports.length,
      maskedPhone,
      reports: mappedReports
    });

  } catch (err: any) {
    console.error("POST /api/reports/lookup Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
