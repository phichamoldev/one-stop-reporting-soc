import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isLineNotificationEnabled } from "@/lib/line";
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

    // Normalize optional location
    body.location = (typeof body.location === "string" && body.location.trim().length > 0)
      ? body.location.trim()
      : null;

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

    if (insertResult.error && (insertResult.error.message?.includes('reporter_type') || insertResult.error.details?.includes('reporter_type'))) {
      console.warn('[Schema Guard] Table missing reporter_type column. Retrying insert without reporter_type...');
      const fallbackBody = { ...body };
      delete fallbackBody.reporter_type;
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

    const { data, error } = insertResult;

    console.log("SUPABASE ERROR =", error);

    if (error) {
      return NextResponse.json(
        { success: false, message: "Internal Server Error" },
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
        }

        console.log("=== DEPARTMENT ROUTING LOGS ===");
        console.log("Category ID:", categoryId);
        console.log("Department ID:", departmentId);
        console.log("Target Group ID:", maskDestination(targetGroupId));
        console.log("Priority:", data.priority);
        console.log("===============================");

        if (targetGroupId) {
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

    console.error("SERVER ERROR =", err);

    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}

