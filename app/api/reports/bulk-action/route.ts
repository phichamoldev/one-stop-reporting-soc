import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getReportDataSource } from "@/lib/dataSource";
import { verifyAuthToken, getAccessibleDepartmentIds } from "@/lib/auth-helpers";
import { normalizePublicId } from "@/lib/utils";
import { detectIncidentContradiction, evaluateIncidentIdentity } from "@/lib/similarityDetector";
import { isRealIncidentGroup, isTestReport, localizeConflictReason } from "@/lib/conflictLocalization";

export const dynamic = "force-dynamic";

export interface BulkActionReportResult {
  publicId: string;
  reportId?: string;
  replySaved: boolean;
  statusChanged: boolean;
  oldStatus: string;
  newStatus: string;
  grouped: boolean;
  groupCode?: string;
  groupAction?: "created" | "added_to_existing" | "already_in_group" | "excluded";
  groupingReason?: string;
  notificationStatus: "sent" | "not_applicable" | "failed";
  error?: string;
}

export interface BulkActionResponse {
  success: boolean;
  batchId: string;
  totalRequested: number;
  totalSaved: number;
  totalFailed: number;
  groupResult: {
    action: "created" | "added_to_existing" | "none";
    groupCode?: string;
    groupTitle?: string;
    groupedCount: number;
    excludedCount: number;
  };
  results: BulkActionReportResult[];
  error?: string;
}

// In-memory idempotency cache (10 minute expiry)
const idempotencyCache = new Map<string, { timestamp: number; response: BulkActionResponse }>();

function cleanOldIdempotencyKeys() {
  const now = Date.now();
  for (const [key, val] of idempotencyCache.entries()) {
    if (now - val.timestamp > 10 * 60 * 1000) {
      idempotencyCache.delete(key);
    }
  }
}

/**
 * POST /api/reports/bulk-action
 * 
 * Performs simultaneous bulk reply, status update, and safe automatic incident grouping
 * for reports selected from the Request Detail page.
 * 
 * Reuses existing Business Logic:
 *  - Department-level access control & staff role validation
 *  - Stale status concurrency detection
 *  - Image attachment restriction (completed status only)
 *  - Contradiction guard & identity verification from similarityDetector
 *  - Test / Production Isolation guards
 *  - Audit history logging (report_logs and incident_group_history)
 *  - Separated notification delivery status (staff group only, no private LINE claims)
 */
export async function POST(req: Request) {
  try {
    cleanOldIdempotencyKeys();

    const dataSource = getReportDataSource();
    const { user, error: authErr } = await verifyAuthToken(req);

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    // 1. Verify Staff Profile & Department Scoping
    const { data: staffProfile } = await supabaseAdmin
      .from("staff_users")
      .select("id, role, department_id, full_name, status")
      .eq("id", user.id)
      .maybeSingle();

    if (!staffProfile || staffProfile.status !== "active") {
      return NextResponse.json({ error: "Staff profile not found or inactive", code: "FORBIDDEN" }, { status: 403 });
    }

    const accessibleDeptIds = await getAccessibleDepartmentIds(user.id, staffProfile, supabaseAdmin);
    if (accessibleDeptIds.length === 1 && accessibleDeptIds[0] === -1) {
      return NextResponse.json({ error: "No department access", code: "NO_PERMISSION" }, { status: 403 });
    }

    // 2. Parse Payload
    const body = await req.json();
    const {
      publicIds,
      targetStatus,
      replyMessage,
      imageUrl,
      autoGroup = true,
      targetGroupId = null,
      idempotencyKey,
      expectedStatuses = {},
    } = body;

    if (!Array.isArray(publicIds) || publicIds.length === 0) {
      return NextResponse.json({ error: "กรุณาเลือกคำร้องอย่างน้อย 1 รายการ" }, { status: 400 });
    }

    // Idempotency Check
    if (idempotencyKey && idempotencyCache.has(idempotencyKey)) {
      const cached = idempotencyCache.get(idempotencyKey)!;
      return NextResponse.json(cached.response, { status: 200 });
    }

    const cleanReplyMessage = typeof replyMessage === "string" ? replyMessage.trim() : "";
    const cleanImageUrl = typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : null;

    // Validate targetStatus
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

    const batchId = idempotencyKey || `bulk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const normalizedPublicIds = Array.from(new Set(publicIds.map((p: string) => normalizePublicId(p))));

    // 3. Query All Target Reports in Database (Re-fetch latest state from Server)
    const { data: rawReports, error: repErr } = await supabaseAdmin
      .from(dataSource.reportsTable)
      .select(`
        id,
        public_id,
        status,
        admin_remark,
        description,
        location,
        created_at,
        category_id,
        subcategory_id,
        categories (
          id,
          name_th,
          department_id
        ),
        subcategories (
          id,
          name_th
        )
      `)
      .in("public_id", normalizedPublicIds);

    if (repErr || !rawReports) {
      console.error("[BulkAction] Error fetching reports:", repErr);
      return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลคำร้องจากฐานข้อมูล" }, { status: 500 });
    }

    interface ReportRow {
      id: string;
      public_id: string;
      status: string;
      admin_remark: string | null;
      description: string;
      location: string | null;
      created_at: string;
      category_id: number | null;
      subcategory_id: number | null;
      categories: { id: number; name_th: string; department_id: number | null } | null;
      subcategories: { id: number; name_th: string } | null;
    }

    const reportsMap = new Map<string, ReportRow>();
    (rawReports as unknown as ReportRow[]).forEach((r) => reportsMap.set(r.public_id, r));

    // 4. Validate Each Report against Permissions & Concurrency
    const validReportsForProcessing: ReportRow[] = [];
    const itemResultsMap = new Map<string, BulkActionReportResult>();

    for (const pId of normalizedPublicIds) {
      const rep = reportsMap.get(pId);
      if (!rep) {
        itemResultsMap.set(pId, {
          publicId: pId,
          replySaved: false,
          statusChanged: false,
          oldStatus: "-",
          newStatus: "-",
          grouped: false,
          notificationStatus: "not_applicable",
          error: "ไม่พบคำร้องในระบบ",
        });
        continue;
      }

      // Department Scoping Check
      if (accessibleDeptIds.length > 0) {
        const deptId = rep.categories?.department_id;
        if (deptId && !accessibleDeptIds.includes(deptId)) {
          itemResultsMap.set(pId, {
            publicId: pId,
            reportId: rep.id,
            replySaved: false,
            statusChanged: false,
            oldStatus: rep.status,
            newStatus: rep.status,
            grouped: false,
            notificationStatus: "not_applicable",
            error: "ไม่มีสิทธิ์จัดการคำร้องข้ามหน่วยงาน",
          });
          continue;
        }
      }

      // Completed Report Edit Permission Check
      if (rep.status === "completed" && !["admin", "super_admin", "manager"].includes(staffProfile.role)) {
        itemResultsMap.set(pId, {
          publicId: pId,
          reportId: rep.id,
          replySaved: false,
          statusChanged: false,
          oldStatus: rep.status,
          newStatus: rep.status,
          grouped: false,
          notificationStatus: "not_applicable",
          error: "คำร้องเสร็จสิ้นแล้ว เจ้าหน้าที่ไม่สามารถแก้ไขได้",
        });
        continue;
      }

      // Concurrency Stale State Check
      const clientExpectedStatus = expectedStatuses[pId];
      if (clientExpectedStatus && clientExpectedStatus !== rep.status) {
        itemResultsMap.set(pId, {
          publicId: pId,
          reportId: rep.id,
          replySaved: false,
          statusChanged: false,
          oldStatus: rep.status,
          newStatus: rep.status,
          grouped: false,
          notificationStatus: "not_applicable",
          error: `สถานะคำร้องถูกเปลี่ยนแปลงเป็น '${rep.status}' ก่อนการยืนยัน`,
        });
        continue;
      }

      validReportsForProcessing.push(rep);
    }

    // 5. Execute Per-Report Status and Reply Updates
    const now = new Date().toISOString();
    const successfullyUpdatedReports: ReportRow[] = [];

    for (const rep of validReportsForProcessing) {
      const isStatusChanged = Boolean(targetStatus && targetStatus !== rep.status);
      const isRemarkChanged = Boolean(cleanReplyMessage && cleanReplyMessage !== (rep.admin_remark || ""));

      const updatePayload: Record<string, unknown> = {
        updated_at: now,
      };

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

      // Only perform update if there is something to update
      if (Object.keys(updatePayload).length > 1) {
        const { error: updErr } = await supabaseAdmin
          .from(dataSource.reportsTable)
          .update(updatePayload)
          .eq("id", rep.id);

        if (updErr) {
          itemResultsMap.set(rep.public_id, {
            publicId: rep.public_id,
            reportId: rep.id,
            replySaved: false,
            statusChanged: false,
            oldStatus: rep.status,
            newStatus: rep.status,
            grouped: false,
            notificationStatus: "not_applicable",
            error: "เกิดข้อผิดพลาดในการบันทึกฐานข้อมูล",
          });
          continue;
        }
      }

      // Insert Audit History in report_logs
      let actionName = "status_updated";
      if (!isStatusChanged && isRemarkChanged) actionName = "note_updated";

      await supabaseAdmin.from(dataSource.reportLogsTable).insert({
        report_id: rep.id,
        user_id: user.id,
        action: actionName,
        old_status: rep.status,
        new_status: targetStatus || rep.status,
        remark: cleanReplyMessage || rep.admin_remark,
        image_url: cleanImageUrl || null,
        created_at: now,
      });

      successfullyUpdatedReports.push(rep);

      itemResultsMap.set(rep.public_id, {
        publicId: rep.public_id,
        reportId: rep.id,
        replySaved: Boolean(cleanReplyMessage),
        statusChanged: isStatusChanged,
        oldStatus: rep.status,
        newStatus: targetStatus || rep.status,
        grouped: false,
        notificationStatus: "not_applicable",
      });
    }

    // 6. Automatic Incident Grouping Workflow (if requested and >= 1 valid report)
    const groupOutcome: BulkActionResponse["groupResult"] = {
      action: "none",
      groupedCount: 0,
      excludedCount: 0,
    };

    if (autoGroup && successfullyUpdatedReports.length > 0) {
      // Query existing group memberships for successfully updated reports
      const updatedReportIds = successfullyUpdatedReports.map((r) => r.id);
      const { data: memberRows } = await supabaseAdmin
        .from(dataSource.incidentGroupMembersTable)
        .select(`
          report_id,
          group_id,
          incident_group:${dataSource.incidentGroupsTable} (
            id,
            group_code,
            title,
            status
          )
        `)
        .in("report_id", updatedReportIds);

      interface GroupInfo {
        id: string;
        group_code: string;
        title: string;
        status: string;
      }

      const existingMemberGroups = new Map<string, GroupInfo>();
      (memberRows || []).forEach((row: { report_id: string; incident_group?: GroupInfo | GroupInfo[] | null }) => {
        const ig = Array.isArray(row.incident_group) ? row.incident_group[0] : row.incident_group;
        if (ig && row.report_id) {
          existingMemberGroups.set(row.report_id, ig);
        }
      });

      // Check if any report already belongs to an active group or targetGroupId was specified
      let targetGroup: GroupInfo | null = null;

      if (targetGroupId) {
        const { data: specifiedGroup } = await supabaseAdmin
          .from(dataSource.incidentGroupsTable)
          .select("id, group_code, title, status")
          .eq("id", targetGroupId)
          .maybeSingle();
        if (specifiedGroup && specifiedGroup.status !== "closed") {
          targetGroup = specifiedGroup as GroupInfo;
        }
      }

      if (!targetGroup) {
        // Find if any report has an open group
        for (const rep of successfullyUpdatedReports) {
          const ig = existingMemberGroups.get(rep.id);
          if (ig && ig.status === "open") {
            targetGroup = ig;
            break;
          }
        }
      }

      // Verify contradictions among candidate reports to prevent false grouping
      const nonConflictingReports: ReportRow[] = [];
      const primaryAnchor = successfullyUpdatedReports[0];

      for (const rep of successfullyUpdatedReports) {
        // If rep is already in this targetGroup, mark as already_in_group
        const existingG = existingMemberGroups.get(rep.id);
        if (targetGroup && existingG && existingG.id === targetGroup.id) {
          const res = itemResultsMap.get(rep.public_id);
          if (res) {
            res.grouped = true;
            res.groupCode = targetGroup.group_code;
            res.groupAction = "already_in_group";
            res.groupingReason = "เป็นสมาชิกในกลุ่มเหตุการณ์นี้อยู่แล้ว";
          }
          continue;
        }

        // Test / Production Isolation Guard
        if (targetGroup && isRealIncidentGroup(targetGroup) && isTestReport(rep)) {
          const res = itemResultsMap.get(rep.public_id);
          if (res) {
            res.grouped = false;
            res.groupAction = "excluded";
            res.groupingReason = "ไม่สามารถรวมคำร้องทดสอบเข้ากลุ่ม Production ได้ (Test Data Isolation)";
          }
          groupOutcome.excludedCount++;
          continue;
        }

        // Incident Contradiction Check against primary anchor or target group
        if (rep.id !== primaryAnchor.id) {
          const contra = detectIncidentContradiction(primaryAnchor, rep);
          const identityEval = evaluateIncidentIdentity(primaryAnchor, rep);

          if (contra.isContradiction || identityEval.candidateDecision === "different_incident") {
            const res = itemResultsMap.get(rep.public_id);
            if (res) {
              res.grouped = false;
              res.groupAction = "excluded";
              res.groupingReason = contra.reasons[0]
                ? localizeConflictReason(contra.reasons[0])
                : "ตรวจพบข้อขัดแย้งของสถานที่หรือลักษณะปัญหา ไม่สามารถรวมกลุ่มได้";
            }
            groupOutcome.excludedCount++;
            continue;
          }
        }

        nonConflictingReports.push(rep);
      }

      // Grouping Execution
      if (nonConflictingReports.length > 0) {
        if (targetGroup) {
          // Add non-conflicting reports to existing targetGroup
          for (const rep of nonConflictingReports) {
            // Check if already in another group
            const otherG = existingMemberGroups.get(rep.id);
            if (otherG && otherG.id !== targetGroup.id) {
              const res = itemResultsMap.get(rep.public_id);
              if (res) {
                res.grouped = false;
                res.groupAction = "excluded";
                res.groupingReason = `คำร้องอยู่ในกลุ่ม ${otherG.group_code} อยู่แล้ว การย้ายกลุ่มต้องยืนยันเป็นรายคำร้อง`;
              }
              groupOutcome.excludedCount++;
              continue;
            }

            const { error: addErr } = await supabaseAdmin
              .from(dataSource.incidentGroupMembersTable)
              .insert({
                group_id: targetGroup.id,
                report_id: rep.id,
                added_by: staffProfile.id,
                notes: "เพิ่มเข้ากลุ่มอัตโนมัติจากการตอบกลับแบบชุด (Bulk Action)",
              });

            if (!addErr) {
              await supabaseAdmin.from(dataSource.incidentGroupHistoryTable).insert({
                group_id: targetGroup.id,
                report_id: rep.id,
                action: "add_report",
                actor_id: staffProfile.id,
                actor_name: staffProfile.full_name,
                details: { public_id: rep.public_id, batchId },
              });

              await supabaseAdmin.from(dataSource.reportLogsTable).insert({
                report_id: rep.id,
                user_id: staffProfile.id,
                action: "incident_group_added",
                remark: `เพิ่มเข้ากลุ่มเหตุการณ์ ${targetGroup.group_code} (${targetGroup.title})`,
              });

              const res = itemResultsMap.get(rep.public_id);
              if (res) {
                res.grouped = true;
                res.groupCode = targetGroup.group_code;
                res.groupAction = "added_to_existing";
              }
              groupOutcome.groupedCount++;
            }
          }

          groupOutcome.action = "added_to_existing";
          groupOutcome.groupCode = targetGroup.group_code;
          groupOutcome.groupTitle = targetGroup.title;
        } else if (nonConflictingReports.length >= 2) {
          // Create a new incident group for 2 or more reports
          let newGroupCode: string;
          const rpcName = dataSource.isTest ? "get_next_test_incident_group_code" : "get_next_incident_group_code";
          const { data: codeData } = await supabaseAdmin.rpc(rpcName);

          if (codeData) {
            newGroupCode = codeData;
          } else {
            const prefix = dataSource.incidentGroupPrefix;
            const { data: latest } = await supabaseAdmin
              .from(dataSource.incidentGroupsTable)
              .select("group_code")
              .order("created_at", { ascending: false })
              .limit(1);

            let nextNum = 1;
            if (latest && latest[0]?.group_code) {
              const m = latest[0].group_code.match(new RegExp(`${prefix}(\\d+)`));
              if (m) nextNum = parseInt(m[1], 10) + 1;
            }
            newGroupCode = `${prefix}${String(nextNum).padStart(5, "0")}`;
          }

          const firstDesc = primaryAnchor.description || "เหตุการณ์ที่ได้รับแจ้ง";
          const groupTitle = `เหตุการณ์: ${firstDesc.slice(0, 50).trim()}${firstDesc.length > 50 ? "..." : ""}`;

          const { data: createdGroup, error: crtErr } = await supabaseAdmin
            .from(dataSource.incidentGroupsTable)
            .insert({
              group_code: newGroupCode,
              title: groupTitle,
              category_id: primaryAnchor.category_id,
              status: "open",
              created_by: staffProfile.id,
            })
            .select()
            .single();

          if (!crtErr && createdGroup) {
            await supabaseAdmin.from(dataSource.incidentGroupHistoryTable).insert({
              group_id: createdGroup.id,
              action: "create_group",
              actor_id: staffProfile.id,
              actor_name: staffProfile.full_name,
              details: {
                group_code: newGroupCode,
                batchId,
                initialReportsCount: nonConflictingReports.length,
              },
            });

            for (const rep of nonConflictingReports) {
              const { error: memErr } = await supabaseAdmin
                .from(dataSource.incidentGroupMembersTable)
                .insert({
                  group_id: createdGroup.id,
                  report_id: rep.id,
                  added_by: staffProfile.id,
                  notes: "สร้างกลุ่มและเพิ่มสมาชิกร่วมกันจากการดำเนินการแบบชุด (Bulk Action)",
                });

              if (!memErr) {
                await supabaseAdmin.from(dataSource.reportLogsTable).insert({
                  report_id: rep.id,
                  user_id: staffProfile.id,
                  action: "incident_group_added",
                  remark: `เพิ่มเข้ากลุ่มเหตุการณ์ใหม่ ${newGroupCode} (${groupTitle})`,
                });

                const res = itemResultsMap.get(rep.public_id);
                if (res) {
                  res.grouped = true;
                  res.groupCode = newGroupCode;
                  res.groupAction = "created";
                }
                groupOutcome.groupedCount++;
              }
            }

            groupOutcome.action = "created";
            groupOutcome.groupCode = newGroupCode;
            groupOutcome.groupTitle = groupTitle;
          }
        }
      }
    }

    // 7. LINE Notification Policy (Separated Status)
    // EVENT POLICY: Status updates & bulk replies NEVER send LINE notifications in any environment
    successfullyUpdatedReports.forEach(r => {
      const item = itemResultsMap.get(r.public_id);
      if (item) item.notificationStatus = "not_applicable";
    });

    // 8. Compile Final Output
    const finalResults: BulkActionReportResult[] = normalizedPublicIds.map((pId) => {
      return (
        itemResultsMap.get(pId) || {
          publicId: pId,
          replySaved: false,
          statusChanged: false,
          oldStatus: "-",
          newStatus: "-",
          grouped: false,
          notificationStatus: "not_applicable",
          error: "ไม่สามารถประมวลผลได้",
        }
      );
    });

    const totalSaved = finalResults.filter((r) => r.replySaved || r.statusChanged).length;
    const totalFailed = finalResults.filter((r) => Boolean(r.error)).length;

    const finalResponse: BulkActionResponse = {
      success: totalFailed === 0,
      batchId,
      totalRequested: normalizedPublicIds.length,
      totalSaved,
      totalFailed,
      groupResult: groupOutcome,
      results: finalResults,
    };

    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, {
        timestamp: Date.now(),
        response: finalResponse,
      });
    }

    return NextResponse.json(finalResponse, { status: 200 });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[BulkAction] Unhandled error:", error);
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
