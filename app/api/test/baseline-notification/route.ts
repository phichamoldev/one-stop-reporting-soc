import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { notifyLine, isLineNotificationEnabled, LineNotificationPayload } from "@/lib/line";

export const dynamic = "force-dynamic";

// Backend in-flight lock to prevent double-click / concurrent runs
let isBaselineRunning = false;
let currentBaselineRunId: string | null = null;

export interface BaselineMockMessage {
  mockId: string;
  timeline: string;
  language: "Thai" | "English" | "Thai + English";
  reporter: string;
  description: string;
  location: string;
}

// 20 Mock Reports representing the exact same issue over time (AS-IS)
export const BASELINE_20_MESSAGES: BaselineMockMessage[] = [
  // T+0 (3 messages)
  {
    mockId: "BASELINE-001",
    timeline: "T+0",
    language: "Thai",
    reporter: "Test User 001",
    description: "แอร์ห้องประชุม 301 ไม่เย็นเลยค่ะ เปิดไว้แล้วแต่มีแต่ลมร้อน",
    location: "ห้องประชุม 301 ชั้น 3 อาคาร 14"
  },
  {
    mockId: "BASELINE-002",
    timeline: "T+0",
    language: "Thai",
    reporter: "Test User 002",
    description: "ห้องประชุม 301 อาคาร 14 แอร์ไม่ทำงาน ห้องร้อนมากครับ",
    location: "ห้องประชุม 301 อาคาร 14"
  },
  {
    mockId: "BASELINE-003",
    timeline: "T+0",
    language: "English",
    reporter: "Test User 003",
    description: "The air conditioner in meeting room 301 is not cooling.",
    location: "Meeting Room 301, Building 14"
  },

  // T+5m (2 messages)
  {
    mockId: "BASELINE-004",
    timeline: "T+5m",
    language: "Thai",
    reporter: "Test User 004",
    description: "เครื่องปรับอากาศที่ห้องประชุม 301 เสีย ไม่สามารถใช้งานได้",
    location: "อาคาร 14 ห้องประชุม 301"
  },
  {
    mockId: "BASELINE-005",
    timeline: "T+5m",
    language: "Thai + English",
    reporter: "Test User 005",
    description: "AC ห้องประชุม 301 ไม่เย็นครับ",
    location: "ห้องประชุม 301 ชั้น 3 อาคาร 14"
  },

  // T+10m (2 messages)
  {
    mockId: "BASELINE-006",
    timeline: "T+10m",
    language: "English",
    reporter: "Test User 006",
    description: "Meeting room 301 is very hot. The AC is running but there is no cold air.",
    location: "Room 301 Building 14"
  },
  {
    mockId: "BASELINE-007",
    timeline: "T+10m",
    language: "Thai",
    reporter: "Test User 007",
    description: "รบกวนช่วยดูแอร์ห้องประชุม 301 ให้หน่อยค่ะ ตอนนี้ไม่เย็นเลย",
    location: "ห้องประชุม 301 ชั้น 3"
  },

  // T+15m (2 messages)
  {
    mockId: "BASELINE-008",
    timeline: "T+15m",
    language: "Thai + English",
    reporter: "Test User 008",
    description: "Meeting room 301 แอร์เสีย ร้อนมาก",
    location: "Meeting room 301 ชั้น 3 อาคาร 14"
  },
  {
    mockId: "BASELINE-009",
    timeline: "T+15m",
    language: "English",
    reporter: "Test User 009",
    description: "The air conditioning unit in room 301 is not working properly.",
    location: "Room 301, 3rd Floor, Building 14"
  },

  // T+20m (2 messages)
  {
    mockId: "BASELINE-010",
    timeline: "T+20m",
    language: "Thai",
    reporter: "Test User 010",
    description: "แอร์ห้องประชุมเปิดติดแต่ไม่มีความเย็น",
    location: "ห้องประชุม 301 อาคาร 14"
  },
  {
    mockId: "BASELINE-011",
    timeline: "T+20m",
    language: "Thai + English",
    reporter: "Test User 011",
    description: "แอร์ AC ห้องประชุมไม่ทำงาน",
    location: "ห้องประชุม 301 ชั้น 3"
  },

  // T+30m (3 messages)
  {
    mockId: "BASELINE-012",
    timeline: "T+30m",
    language: "English",
    reporter: "Test User 012",
    description: "Please check the AC in meeting room 301. It is blowing warm air.",
    location: "Meeting Room 301, Building 14"
  },
  {
    mockId: "BASELINE-013",
    timeline: "T+30m",
    language: "Thai + English",
    reporter: "Test User 013",
    description: "AC is on แต่ห้องยังร้อนมาก",
    location: "ห้อง 301 อาคาร 14"
  },
  {
    mockId: "BASELINE-014",
    timeline: "T+30m",
    language: "Thai",
    reporter: "Test User 014",
    description: "แอร์ห้องประชุม 301 ร้อนมากค่ะ คนนั่งเต็มห้องเลย",
    location: "ห้องประชุม 301 ชั้น 3 อาคาร 14"
  },

  // T+1h (2 messages)
  {
    mockId: "BASELINE-015",
    timeline: "T+1h",
    language: "English",
    reporter: "Test User 015",
    description: "The meeting room AC stopped cooling.",
    location: "Meeting Room 301"
  },
  {
    mockId: "BASELINE-016",
    timeline: "T+1h",
    language: "Thai + English",
    reporter: "Test User 016",
    description: "Please check แอร์ห้องประชุม 301 ค่ะ",
    location: "ห้องประชุม 301 อาคาร 14"
  },

  // T+2h (2 messages)
  {
    mockId: "BASELINE-017",
    timeline: "T+2h",
    language: "Thai",
    reporter: "Test User 017",
    description: "ช่างเข้ามาดูหรือยังคะ แอร์ห้อง 301 ยังไม่เย็นเลย",
    location: "ห้องประชุม 301 ชั้น 3 อาคาร 14"
  },
  {
    mockId: "BASELINE-018",
    timeline: "T+2h",
    language: "English",
    reporter: "Test User 018",
    description: "Still no cold air in room 301. Need urgent fix for seminar.",
    location: "Building 14 Room 301"
  },

  // T+3h (2 messages)
  {
    mockId: "BASELINE-019",
    timeline: "T+3h",
    language: "Thai + English",
    reporter: "Test User 019",
    description: "ผ่านไป 3 ชั่วโมงแล้ว AC ห้อง 301 ยังร้อนเหมือนเดิม",
    location: "ห้องประชุม 301 อาคาร 14"
  },
  {
    mockId: "BASELINE-020",
    timeline: "T+3h",
    language: "Thai",
    reporter: "Test User 020",
    description: "แจ้งเรื่องแอร์ห้องประชุม 301 อีกรอบครับ ตอนนี้ต้องเปิดพัดลมช่วย",
    location: "ห้องประชุม 301 ชั้น 3 อาคาร 14"
  }
];

export async function POST(req: Request) {
  // [CHECK 0] Emergency Kill Switch
  if (!isLineNotificationEnabled('test_endpoint')) {
    console.log("LINE notification skipped: disabled by environment");
    return NextResponse.json(
      {
        success: false,
        error: "LINE notification skipped: disabled by environment",
        skipped: true,
      },
      { status: 403 }
    );
  }

  // Double click protection
  if (isBaselineRunning) {
    return NextResponse.json(
      {
        success: false,
        error: `A baseline test is already running (Active Run: ${currentBaselineRunId}). Please wait for it to complete.`,
        activeRunId: currentBaselineRunId
      },
      { status: 429 }
    );
  }

  // [CHECK 2, 3, 4, 5] Database safety check: Look up soc-test department dynamically
  const { data: dept, error: deptErr } = await supabaseAdmin
    .from("departments")
    .select("id, code, name_th, line_group_id, is_active")
    .eq("code", "soc-test")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (deptErr || !dept) {
    return NextResponse.json(
      {
        success: false,
        error: "SAFETY ERROR: Department 'soc-test' not found or is inactive in database. Test stopped."
      },
      { status: 404 }
    );
  }

  if (dept.code !== "soc-test" || !dept.line_group_id) {
    return NextResponse.json(
      {
        success: false,
        error: "SAFETY ERROR: Authorized test LINE group missing. Test stopped to protect production."
      },
      { status: 400 }
    );
  }

  // Optional: body parameters (e.g. intervalMs)
  const body = await req.json().catch(() => ({}));
  const intervalMs = Math.max(100, Math.min(body.intervalMs || 400, 2000));

  // Generate testRunId
  const now = new Date();
  const timestampStr = now.toISOString().replace(/[-:T.]/g, "").slice(0, 14);
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const testRunId = `BASELINE-${timestampStr}-${randomSuffix}`;

  isBaselineRunning = true;
  currentBaselineRunId = testRunId;

  console.log(`[baseline-test] START testRunId=${testRunId} target=${dept.name_th} (${dept.code})`);

  const results: Array<{
    index: number;
    mockId: string;
    timeline: string;
    language: string;
    description: string;
    location: string;
    reporter: string;
    sentAt: string;
    status: "Sent" | "Failed";
    error?: string;
  }> = [];

  let sentCount = 0;
  let failedCount = 0;

  try {
    for (let i = 0; i < BASELINE_20_MESSAGES.length; i++) {
      const msg = BASELINE_20_MESSAGES[i];

      // Format payload using the EXACT existing system template (notifyLine via LineNotificationPayload)
      // Note: NO Normalization, NO Grouping, NO Debounce, NO Aggregation, NO Queue!
      const payload: LineNotificationPayload = {
        publicId: `${msg.mockId} [${msg.timeline}]`,
        categoryName: "กายภาพและสิ่งแวดล้อม",
        subcategoryName: "เครื่องปรับอากาศ",
        description: msg.description,
        location: msg.location,
        reporterName: msg.reporter,
        statusText: "pending",
        date: new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })
      };

      try {
        const lineResult = await notifyLine(payload, dept.line_group_id, { event: 'test_endpoint' });
        if (lineResult.success) {
          sentCount++;
          results.push({
            index: i + 1,
            mockId: msg.mockId,
            timeline: msg.timeline,
            language: msg.language,
            description: msg.description,
            location: msg.location,
            reporter: msg.reporter,
            sentAt: new Date().toISOString(),
            status: "Sent"
          });
        } else {
          failedCount++;
          results.push({
            index: i + 1,
            mockId: msg.mockId,
            timeline: msg.timeline,
            language: msg.language,
            description: msg.description,
            location: msg.location,
            reporter: msg.reporter,
            sentAt: new Date().toISOString(),
            status: "Failed",
            error: lineResult.error || "Unknown LINE push error"
          });
        }
      } catch (err: unknown) {
        failedCount++;
        results.push({
          index: i + 1,
          mockId: msg.mockId,
          timeline: msg.timeline,
          language: msg.language,
          description: msg.description,
          location: msg.location,
          reporter: msg.reporter,
          sentAt: new Date().toISOString(),
          status: "Failed",
          error: err instanceof Error ? err.message : "Exception during push"
        });
      }

      // Interval between simulated reports
      if (i < BASELINE_20_MESSAGES.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    // Timeline distribution count
    const timelineSummary: Record<string, number> = {};
    for (const r of results) {
      timelineSummary[r.timeline] = (timelineSummary[r.timeline] || 0) + (r.status === "Sent" ? 1 : 0);
    }

    // Language distribution count
    const languageSummary = {
      Thai: results.filter(r => r.language === "Thai" && r.status === "Sent").length,
      English: results.filter(r => r.language === "English" && r.status === "Sent").length,
      "Thai + English": results.filter(r => r.language === "Thai + English" && r.status === "Sent").length
    };

    const summary = {
      testRunId,
      targetDepartment: dept.name_th,
      targetDepartmentCode: dept.code,
      scenario: "Same Issue / Multi-language (Baseline AS-IS)",
      totalGenerated: BASELINE_20_MESSAGES.length,
      totalSent: sentCount,
      totalFailed: failedCount,
      timeline: timelineSummary,
      languages: languageSummary,
      actualLineMessagesReceived: sentCount, // In AS-IS system: 1 report = 1 LINE push!
      completedAt: new Date().toISOString(),
      messages: results
    };

    console.log(`[baseline-test] COMPLETE testRunId=${testRunId} totalSent=${sentCount}/${BASELINE_20_MESSAGES.length}`);

    return NextResponse.json({
      success: true,
      data: summary
    });

  } catch (err: unknown) {
    console.error(`[baseline-test] ERROR testRunId=${currentBaselineRunId}:`, err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error during baseline test execution."
      },
      { status: 500 }
    );
  } finally {
    isBaselineRunning = false;
    currentBaselineRunId = null;
  }
}

export async function GET() {
  return NextResponse.json({
    isRunning: isBaselineRunning,
    currentRunId: currentBaselineRunId
  });
}
