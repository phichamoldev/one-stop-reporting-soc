import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getReportDataSource } from "@/lib/dataSource";
import { verifyAuthToken, getAccessibleDepartmentIds } from "@/lib/auth-helpers";
import { normalizePublicId } from "@/lib/utils";

export const dynamic = "force-dynamic";

export type ReplyDeliveryStatus =
  | "saved"
  | "delivery_succeeded"
  | "delivery_failed"
  | "not_sent"
  | "skipped"
  | "unknown";

export interface BulkReplyItemResult {
  publicId: string;
  reportId?: string;
  status: ReplyDeliveryStatus;
  saved: boolean;
  message?: string;
  error?: string;
  newStatus?: string;
}

export interface BulkReplyResponse {
  success: boolean;
  batchId: string;
  totalRequested: number;
  totalSaved: number;
  totalSkipped: number;
  totalFailed: number;
  results: BulkReplyItemResult[];
  error?: string;
}

/**
 * In-memory short-term idempotency cache to protect against rapid double-clicks
 * Key: idempotencyKey, Value: timestamp + cached response
 */
const idempotencyCache = new Map<string, { timestamp: number; response: BulkReplyResponse }>();

// Periodic cleanup of keys older than 10 minutes
function cleanOldIdempotencyKeys() {
  const now = Date.now();
  for (const [key, val] of idempotencyCache.entries()) {
    if (now - val.timestamp > 10 * 60 * 1000) {
      idempotencyCache.delete(key);
    }
  }
}

/**
 * POST /api/incidents/[id]/bulk-reply
 * Handles bulk reply to selected reports inside an incident group.
 * 
 * Safety & Quality:
 *  - Strict Server-side role & department authorization
 *  - Idempotency & duplicate submission protection
 *  - Does NOT alter unselected reports
 *  - Does NOT alter incident group status or members
 *  - Individual status tracking (saved, skipped, failed)
 *  - Audit log entries in both reportLogsTable and incidentGroupHistoryTable
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    cleanOldIdempotencyKeys();

    const dataSource = getReportDataSource();
    const { id } = await params;
    const { user, error: authErr } = await verifyAuthToken(req);

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    // 1. Verify Staff Profile & Department Scoping
    const { data: staffProfile } = await supabaseAdmin
      .from("staff_users")
      .select("id, role, department_id, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!staffProfile) {
      return NextResponse.json({ error: "Staff profile not found", code: "FORBIDDEN" }, { status: 403 });
    }

    const accessibleDeptIds = await getAccessibleDepartmentIds(user.id, staffProfile, supabaseAdmin);
    if (accessibleDeptIds.length === 1 && accessibleDeptIds[0] === -1) {
      return NextResponse.json({ error: "No department access", code: "NO_PERMISSION" }, { status: 403 });
    }

    // 2. Resolve Incident Group
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    let groupQuery = supabaseAdmin
      .from(dataSource.incidentGroupsTable)
      .select("id, group_code, title, status");

    if (isUUID) {
      groupQuery = groupQuery.eq("id", id);
    } else {
      groupQuery = groupQuery.eq("group_code", id.toUpperCase());
    }

    const { data: targetGroup } = await groupQuery.maybeSingle();
    if (!targetGroup) {
      return NextResponse.json({ error: "ไม่พบกลุ่มเหตุการณ์นี้", code: "NOT_FOUND" }, { status: 404 });
    }

    // 3. Parse Request Payload
    const body = await req.json();
    const {
      publicIds,
      replyMessage,
      message,
      targetStatus, // Optional: if staff chooses to also update status (e.g., 'in_progress' or 'completed')
      imageUrl, // Optional: staff image attachment for the bulk reply
      idempotencyKey,
    } = body;

    if (!Array.isArray(publicIds) || publicIds.length === 0) {
      return NextResponse.json({ error: "กรุณาเลือกคำร้องอย่างน้อย 1 รายการ" }, { status: 400 });
    }

    const rawMessage = replyMessage !== undefined ? replyMessage : message;
    const cleanReplyMessage = (rawMessage || "").trim();
    const cleanImageUrl = typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : null;

    if (!cleanReplyMessage && !targetStatus && !cleanImageUrl) {
      return NextResponse.json({ error: "กรุณาระบุข้อความตอบกลับ หรือสถานะที่ต้องการเปลี่ยน หรือแนบรูปภาพ" }, { status: 400 });
    }

    // Validate targetStatus against allowed system statuses if provided
    const validStatuses = ["pending", "received", "in_progress", "completed", "rejected", "cancelled"];
    if (targetStatus && !validStatuses.includes(targetStatus)) {
      return NextResponse.json({ error: "สถานะคำร้องที่เลือกไม่ถูกต้อง" }, { status: 400 });
    }

    // Rule: Image attachment is permitted ONLY when targetStatus is 'completed'
    if (cleanImageUrl && targetStatus !== "completed") {
      return NextResponse.json(
        {
          error: "สามารถแนบรูปภาพได้เมื่อเลือกสถานะ 'เสร็จสิ้น' เท่านั้น",
          code: "IMAGE_ATTACHMENT_NOT_ALLOWED",
        },
        { status: 400 }
      );
    }

    // Check Idempotency Cache
    if (idempotencyKey && idempotencyCache.has(idempotencyKey)) {
      const cached = idempotencyCache.get(idempotencyKey)!;
      return NextResponse.json(cached.response, { status: 200 });
    }

    const batchId = idempotencyKey || `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const normalizedPublicIds = publicIds.map((p: string) => normalizePublicId(p));

    // 4. Query All Target Reports
    const { data: reportsData, error: repErr } = await supabaseAdmin
      .from(dataSource.reportsTable)
      .select(`
        id,
        public_id,
        status,
        admin_remark,
        category_id,
        categories (
          id,
          name_th,
          department_id
        )
      `)
      .in("public_id", normalizedPublicIds);

    if (repErr) {
      console.error("[BulkReply] Error querying reports:", repErr);
      return NextResponse.json({ error: "Database error querying reports" }, { status: 500 });
    }

    interface QueriedReport {
      id: string;
      public_id: string;
      status: string;
      admin_remark: string | null;
      category_id: number | null;
      categories: {
        id: number;
        name_th: string;
        department_id: number | null;
      } | null;
    }

    const reportsMap = new Map<string, QueriedReport>();
    ((reportsData || []) as unknown as QueriedReport[]).forEach((r) => {
      reportsMap.set(r.public_id, r);
    });

    // 5. Query Active Membership in this Incident Group to confirm they belong to this group
    const reportIds = (reportsData || []).map((r: { id: string }) => r.id);
    const { data: membersData } = await supabaseAdmin
      .from(dataSource.incidentGroupMembersTable)
      .select("report_id")
      .eq("group_id", targetGroup.id)
      .in("report_id", reportIds);

    const groupMemberReportIds = new Set(((membersData || []) as { report_id: string }[]).map((m) => m.report_id));

    // 6. Execute per-report processing with detailed outcome status
    const results: BulkReplyItemResult[] = [];
    let totalSaved = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    const now = new Date().toISOString();

    for (const publicId of normalizedPublicIds) {
      const report = reportsMap.get(publicId);

      // Condition 1: Report existence
      if (!report) {
        results.push({
          publicId,
          status: "skipped",
          saved: false,
          error: "ไม่พบคำร้องในระบบ",
        });
        totalSkipped++;
        continue;
      }

      // Condition 2: Belongs to this incident group
      if (!groupMemberReportIds.has(report.id)) {
        results.push({
          publicId,
          reportId: report.id,
          status: "skipped",
          saved: false,
          error: "คำร้องไม่ได้เป็นสมาชิกในกลุ่มเหตุการณ์นี้",
        });
        totalSkipped++;
        continue;
      }

      // Condition 3: Department Scoping Check
      if (accessibleDeptIds.length > 0) {
        const reportDeptId = report.categories?.department_id;
        if (reportDeptId && !accessibleDeptIds.includes(reportDeptId)) {
          results.push({
            publicId,
            reportId: report.id,
            status: "skipped",
            saved: false,
            error: "ไม่มีสิทธิ์จัดการคำร้องข้ามหน่วยงาน",
          });
          totalSkipped++;
          continue;
        }
      }

      // Condition 4: Cannot edit already completed report if staff role is regular staff
      if (report.status === "completed" && !["admin", "super_admin", "manager"].includes(staffProfile.role)) {
        results.push({
          publicId,
          reportId: report.id,
          status: "skipped",
          saved: false,
          error: "คำร้องเสร็จสิ้นแล้ว เจ้าหน้าที่ไม่สามารถแก้ไขได้",
        });
        totalSkipped++;
        continue;
      }

      // Prepare Update Payload
      const updatePayload: Record<string, unknown> = {
        updated_at: now,
      };

      const isStatusChanged = Boolean(targetStatus && targetStatus !== report.status);
      const isRemarkChanged = Boolean(cleanReplyMessage && cleanReplyMessage !== (report.admin_remark || ""));

      if (cleanReplyMessage) {
        updatePayload.admin_remark = cleanReplyMessage;
      }

      if (targetStatus && isStatusChanged) {
        updatePayload.status = targetStatus;
        if (targetStatus === "completed") {
          updatePayload.completed_by = user.id;
          updatePayload.completed_at = now;
        }
      }

      // Update Report in Database
      const { error: updateErr } = await supabaseAdmin
        .from(dataSource.reportsTable)
        .update(updatePayload)
        .eq("id", report.id);

      if (updateErr) {
        console.error(`[BulkReply] Update failed for report ${publicId}:`, updateErr);
        results.push({
          publicId,
          reportId: report.id,
          status: "unknown",
          saved: false,
          error: "เกิดข้อผิดพลาดในการบันทึกฐานข้อมูล",
        });
        totalFailed++;
        continue;
      }

      // Create Report Log
      let actionName = "note_updated";
      if (isStatusChanged && isRemarkChanged) {
        actionName = "status_updated";
      } else if (isStatusChanged) {
        actionName = "status_updated";
      }

      const { error: logErr } = await supabaseAdmin
        .from(dataSource.reportLogsTable)
        .insert({
          report_id: report.id,
          user_id: user.id,
          action: actionName,
          old_status: report.status,
          new_status: targetStatus || report.status,
          remark: cleanReplyMessage || (isStatusChanged ? `ปรับสถานะเป็น ${targetStatus}` : null),
          image_url: cleanImageUrl,
          created_at: now,
        });

      if (logErr) {
        console.error(`[BulkReply] Failed to write report log for ${publicId}:`, logErr);
      }

      // External delivery channel status evaluation
      // (Citizen updates are read on-demand through web tracking portal, no personal SMS/LINE sent)
      results.push({
        publicId,
        reportId: report.id,
        status: "saved",
        saved: true,
        message: "บันทึกคำตอบและแสดงบนระบบติดตามคำร้องของผู้แจ้งเรียบร้อยแล้ว",
        newStatus: targetStatus || report.status,
      });
      totalSaved++;
    }

    // 7. Record History in Incident Group Audit Trail
    if (totalSaved > 0) {
      await supabaseAdmin.from(dataSource.incidentGroupHistoryTable).insert({
        group_id: targetGroup.id,
        action: "bulk_reply",
        actor_id: staffProfile.id,
        actor_name: staffProfile.full_name,
        details: {
          batchId,
          totalRequested: normalizedPublicIds.length,
          totalSaved,
          totalSkipped,
          totalFailed,
          replyMessage: cleanReplyMessage,
          targetStatus: targetStatus || null,
          imageUrl: cleanImageUrl,
          savedPublicIds: results.filter((r) => r.saved).map((r) => r.publicId),
        },
        created_at: now,
      });

      // Update incident group updated_at timestamp
      await supabaseAdmin
        .from(dataSource.incidentGroupsTable)
        .update({ updated_at: now })
        .eq("id", targetGroup.id);
    }

    const responseData: BulkReplyResponse = {
      success: totalSaved > 0 || totalSkipped === normalizedPublicIds.length,
      batchId,
      totalRequested: normalizedPublicIds.length,
      totalSaved,
      totalSkipped,
      totalFailed,
      results,
    };

    // Store in idempotency cache
    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, {
        timestamp: Date.now(),
        response: responseData,
      });
    }

    return NextResponse.json(responseData, { status: 200 });
  } catch (err: unknown) {
    console.error("[POST /api/incidents/[id]/bulk-reply] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
