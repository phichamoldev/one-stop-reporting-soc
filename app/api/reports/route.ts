/**
 * Reports API Handler - Stabilized Hotfix Pipeline
 * - Multi-Schema Guard: Handles missing reporter_type and NOT NULL location constraints gracefully.
 * - Robust LINE Notification Dispatch: Non-blocking event tracker persistence with emergency direct fallback.
 * - Department Routing: Automatically routes alerts to department groups with default production group fallback.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isLineNotificationEnabled, notifyLine, LineNotificationPayload } from "@/lib/line";
import { maskDestination } from "@/lib/notificationLogger";
import { getReportDataSource } from "@/lib/dataSource";
import { classifyPriority } from "@/lib/priorityClassifier";
import { classifyReportTaxonomy } from "@/lib/taxonomyClassifier";
import { processNewReportForIncidents } from "@/lib/incidentAutomationService";
import { processReportForEventNotification, EventNotificationProcessResult } from "@/lib/eventNotificationService";


export async function POST(req: Request) {
  try {
    const dataSource = getReportDataSource();
    const body = await req.json();

    if (dataSource.isTest) {
      // Generate next test public ID: SOC-T-00001, SOC-T-00002...
      const { data: nextTestId } = await supabaseAdmin.rpc("get_next_test_public_id");
      if (nextTestId) {
        body.public_id = nextTestId;
      } else {
        const { data: latest } = await supabaseAdmin
          .from("test_reports")
          .select("public_id")
          .order("created_at", { ascending: false })
          .limit(1);
        let nextNum = 1;
        if (latest && latest[0]?.public_id) {
          const m = latest[0].public_id.match(/SOC-T-(\d+)/);
          if (m) nextNum = parseInt(m[1], 10) + 1;
        }
        body.public_id = `SOC-T-${String(nextNum).padStart(5, '0')}`;
      }
    }

    if (!body.tracking_token) {
      body.tracking_token = crypto.randomUUID();
    }

    // Normalize optional location:
    // If not provided or empty, fallback to '-' to maintain compatibility with NOT NULL constraint on production schema
    const rawLocation = typeof body.location === "string" ? body.location.trim() : "";
    body.location = rawLocation.length > 0 ? rawLocation : "-";

    // Taxonomy Guard: Strictly prevent fire/emergency reports from ever being classified as Category 3 (บริหารงานบุคคล)
    if (
      (body.category_id === 3 || !body.category_id) &&
      /(?:ไฟไหม้|เพลิงไหม้|ควันไฟ|ควันหนา|เปลวไฟ|ไฟลุก|ก๊าซรั่ว|แก๊สรั่ว|ลิฟต์)/i.test(body.description || '')
    ) {
      const taxonomy = classifyReportTaxonomy(body.description, body.location);
      body.category_id = taxonomy.category_id;
      body.subcategory_id = taxonomy.subcategory_id;
      console.warn(`[Taxonomy Guard] Corrected misclassified report to Category ${taxonomy.category_id} (${taxonomy.category_name}) - Subcategory ${taxonomy.subcategory_id} (${taxonomy.subcategory_name})`);
    }

    // Auto-classify priority using context-aware rules
    const priorityEval = classifyPriority({
      category_id: body.category_id,
      subcategory_id: body.subcategory_id,
      description: body.description,
      location: body.location,
      current_priority: body.priority,
    });

    // Assign classified priority
    if (!body.priority || body.priority === "low" || body.priority === "normal") {
      body.priority = priorityEval.priority;
    }

    console.log("INSERT BODY (Table: " + dataSource.reportsTable + ", Priority: " + body.priority + ")", body);

    let insertResult = await supabaseAdmin
      .from(dataSource.reportsTable)
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

    if (insertResult.error) {
      console.warn("[Schema Guard] First insert attempt failed:", insertResult.error);
      let needsRetry = false;
      const fallbackBody = { ...body };

      // 1. Missing reporter_type column in database schema
      if (
        insertResult.error.message?.includes('reporter_type') ||
        insertResult.error.details?.includes('reporter_type') ||
        insertResult.error.hint?.includes('reporter_type')
      ) {
        console.warn('[Schema Guard] Table missing reporter_type column. Retrying insert without reporter_type...');
        delete fallbackBody.reporter_type;
        needsRetry = true;
      }

      // 2. Location NOT NULL constraint in database schema
      if (
        insertResult.error.message?.includes('location') ||
        insertResult.error.details?.includes('location') ||
        insertResult.error.code === '23502'
      ) {
        console.warn("[Schema Guard] Location NOT NULL constraint encountered. Setting location to '-' and retrying...");
        fallbackBody.location = "-";
        needsRetry = true;
      }

      if (needsRetry) {
        insertResult = await supabaseAdmin
          .from(dataSource.reportsTable)
          .insert(fallbackBody)
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
      }
    }

    const { data, error } = insertResult;

    console.log("SUPABASE ERROR =", error);

    if (error) {
      console.error("[POST /api/reports] Database insert failed permanently:", error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || "การลงข้อมูลล้มเหลว",
          message: error.message || "การลงข้อมูลล้มเหลว",
          code: error.code || "DB_INSERT_ERROR",
        },
        { status: 400 }
      );
    }

    // 3. Log initial priority classification to reportLogsTable
    try {
      await supabaseAdmin.from(dataSource.reportLogsTable).insert({
        report_id: data.id,
        action: "priority_classified",
        new_status: data.status,
        remark: `จัดประเภทความเร่งด่วนเป็น "${data.priority}" - เหตุผล: ${priorityEval.reason}`,
      });
    } catch (logErr) {
      console.error("Error writing initial priority log:", logErr);
    }

    // 4. Transactional Event Tracker & Notification Outbox Dispatcher
    let eventNotificationResult: EventNotificationProcessResult | null = null;

    try {
      if (!isLineNotificationEnabled('new_report')) {
        console.log("LINE notification skipped: disabled by environment");
      } else {
        let targetGroupId: string | null = null;
        let departmentId: number | null = null;
        const categoryId = data.category_id;

        if (dataSource.isTest) {
          // Query SOC TEST department dynamically from database without hard-coding group ID
          const { data: testDept } = await supabaseAdmin
            .from("departments")
            .select("id, line_group_id")
            .or("code.eq.soc-test,name_th.eq.SOC TEST")
            .eq("is_active", true)
            .single();
          targetGroupId = testDept?.line_group_id || process.env.LINE_TEST_GROUP_ID || null;
          departmentId = testDept?.id || null;
        } else {
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

          // Production Fallback: If department group is unmapped or null, route to default Production LINE group
          if (!targetGroupId && process.env.LINE_GROUP_ID) {
            targetGroupId = process.env.LINE_GROUP_ID;
            console.log("[POST /api/reports] Target group unmapped, fallback to default production LINE_GROUP_ID:", maskDestination(targetGroupId));
          }
        }

        console.log("=== DEPARTMENT ROUTING LOGS ===");
        console.log("Category ID:", categoryId);
        console.log("Department ID:", departmentId);
        console.log("Target Group ID:", maskDestination(targetGroupId));
        console.log("Priority:", data.priority);
        console.log("===============================");

        if (targetGroupId) {
          try {
            eventNotificationResult = await processReportForEventNotification({
              report: {
                id: data.id,
                public_id: data.public_id,
                category_id: data.category_id,
                subcategory_id: data.subcategory_id,
                category_name: data.categories?.name_th || data.category || "-",
                subcategory_name: data.subcategories?.name_th || "-",
                location: data.location,
                description: data.description,
                priority: data.priority,
                reporter_name: data.reporter_name,
                created_at: data.created_at,
              },
              priorityReason: priorityEval.reason,
              targetGroupId,
            });
            console.log("EVENT NOTIFICATION RESULT:", eventNotificationResult);
          } catch (eventNotifErr) {
            console.error("[POST /api/reports] Event Notification Pipeline Exception:", eventNotifErr);
            // Fail-safe direct dispatch: Ensure notification is never dropped under any failure condition
            console.log("[POST /api/reports] Executing direct LINE dispatch fallback...");
            const createdAtFormatted = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) + " น.";
            const fallbackPayload: LineNotificationPayload = {
              publicId: data.public_id,
              categoryName: data.categories?.name_th || data.category || "ระบบแจ้งเหตุ SOC STATION",
              subcategoryName: data.subcategories?.name_th || "-",
              description: data.description || "-",
              location: data.location || "-",
              date: createdAtFormatted,
              statusText: "pending",
              reporterName: data.reporter_name || "-",
              priority: (data.priority as any) || "normal",
              priorityReason: priorityEval.reason,
              notificationType: "normal_alert",
            };
            const notifyRes = await notifyLine(fallbackPayload, targetGroupId, {
              event: "normal_alert",
              reportId: data.id,
              idempotencyKey: `evt_norm_${data.public_id}`,
            });
            eventNotificationResult = {
              trackerId: "direct_fallback",
              eventCode: data.public_id,
              action: "normal_alert_sent",
              notifyResult: notifyRes,
            };
          }
        }
      }
    } catch (eventNotifErr) {
      console.error("[POST /api/reports] Event Notification Pipeline Exception:", eventNotifErr);
    }

    // 4. Automatic Incident Correlation & Draft Generation (Background processing)
    // Non-blocking & idempotent: Executes safely and logs audit trail without disrupting report response
    let incidentAutomationResult = null;
    try {
      incidentAutomationResult = await processNewReportForIncidents({
        id: data.id,
        public_id: data.public_id,
        category_id: data.category_id,
        subcategory_id: data.subcategory_id,
        location: data.location,
        description: data.description,
        status: data.status,
        priority: data.priority,
        reporter_name: data.reporter_name,
        created_at: data.created_at,
      });
    } catch (incidentAutoErr) {
      console.error("[POST /api/reports] Background Incident Detection Exception:", incidentAutoErr);
    }

    return NextResponse.json(
      {
        data,
        priorityClassification: priorityEval,
        eventNotification: eventNotificationResult,
        incidentAutomation: incidentAutomationResult,
      },
      { status: 200 }
    );

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("SERVER ERROR =", err);

    return NextResponse.json(
      { success: false, error: errorMsg, message: errorMsg },
      { status: 500 }
    );
  }
}

