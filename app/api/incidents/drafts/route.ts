import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getReportDataSource } from "@/lib/dataSource";
import { verifyAuthToken, getAccessibleDepartmentIds } from "@/lib/auth-helpers";
import { normalizePublicId } from "@/lib/utils";
import { generateIncidentDrafts, ProposedReportItem } from "@/lib/incidentDraftService";
import { IncidentGroupItem } from "@/lib/incidentDetector";

export const dynamic = "force-dynamic";

// Global in-memory set to store rejected/dismissed draft IDs during runtime
const globalDismissedDraftIds = new Set<string>();

/**
 * Safely checks whether an error from Supabase RPC indicates that the stored procedure
 * does not exist in the database or PostgREST schema cache.
 * ONLY in this case is a fallback to legacy REST permitted during pre-migration transition.
 * Any other error (network timeout, connection reset, DB error, unexpected abort) MUST NOT fallback
 * to prevent duplicate group creation if the RPC actually succeeded and committed.
 */
function isRpcMissingInDatabase(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = error.message || "";
  const code = error.code || "";
  return (
    code === "PGRST202" ||
    code === "42883" ||
    msg.includes("Could not find the function") ||
    msg.includes("in the schema cache") ||
    (msg.includes("function") && msg.includes("does not exist"))
  );
}

/**
 * GET /api/incidents/drafts
 * Scans ungrouped reports, clusters them using Step 2 similarity & context rules,
 * and generates explainable Incident Group Draft proposals waiting for staff confirmation.
 */
export async function GET(req: Request) {
  try {
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

    // 2. Fetch grouped report IDs from active incidentGroupMembersTable
    const { data: groupedMembers } = await supabaseAdmin
      .from(dataSource.incidentGroupMembersTable)
      .select("report_id");

    const groupedReportIds = new Set((groupedMembers || []).map((m: { report_id: string }) => m.report_id));

    // 3. Query all candidate reports from active reportsTable
    let repQuery = supabaseAdmin
      .from(dataSource.reportsTable)
      .select(`
        id,
        public_id,
        category_id,
        subcategory_id,
        location,
        description,
        status,
        priority,
        reporter_name,
        created_at,
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
      .order("created_at", { ascending: false })
      .limit(300);

    // Apply department scoping if restricted
    if (accessibleDeptIds.length > 0) {
      const { data: catData } = await supabaseAdmin
        .from("categories")
        .select("id")
        .in("department_id", accessibleDeptIds);

      const allowedCatIds = (catData || []).map((c: { id: number }) => c.id);
      if (allowedCatIds.length > 0) {
        repQuery = repQuery.in("category_id", allowedCatIds);
      } else {
        return NextResponse.json({ success: true, drafts: [], totalDrafts: 0 });
      }
    }

    const { data: rawReports, error: repErr } = await repQuery;
    if (repErr) {
      console.error("Error fetching reports for drafting:", repErr);
      return NextResponse.json({ error: "Database query error" }, { status: 500 });
    }

    interface RawReportRow {
      id: string;
      public_id: string;
      category_id?: number | null;
      subcategory_id?: number | null;
      location?: string | null;
      description?: string | null;
      status: string;
      priority?: "emergency" | "normal" | "needs_review" | null;
      reporter_name?: string | null;
      created_at: string;
      categories?: { id?: number; name_th?: string } | { id?: number; name_th?: string }[] | null;
      subcategories?: { id?: number; name_th?: string } | { id?: number; name_th?: string }[] | null;
    }

    // Filter to purely ungrouped reports
    const rawList = (rawReports || []) as unknown as RawReportRow[];
    const ungroupedList: ProposedReportItem[] = rawList
      .filter((r) => !groupedReportIds.has(r.id))
      .map((r) => {
        const cat = Array.isArray(r.categories) ? r.categories[0] : r.categories;
        const sub = Array.isArray(r.subcategories) ? r.subcategories[0] : r.subcategories;
        return {
          id: r.id,
          public_id: r.public_id,
          category_id: r.category_id,
          subcategory_id: r.subcategory_id,
          location: r.location,
          description: r.description,
          status: r.status,
          priority: (r.priority as ProposedReportItem['priority']) || 'normal',
          reporter_name: r.reporter_name,
          created_at: r.created_at,
          categoryName: cat?.name_th,
          subcategoryName: sub?.name_th,
        };
      });

    // 4. Query existing groups for candidate linking proposals
    const { data: existingGroupsData } = await supabaseAdmin
      .from(dataSource.incidentGroupsTable)
      .select(`
        id,
        group_code,
        title,
        description,
        category_id,
        status,
        created_at,
        updated_at
      `)
      .order("updated_at", { ascending: false })
      .limit(50);

    const existingGroups: IncidentGroupItem[] = (existingGroupsData || []).map((g: {
      id: string;
      group_code: string;
      title: string;
      description?: string | null;
      category_id?: number | null;
      status: 'open' | 'resolved' | 'closed';
      created_at: string;
      updated_at?: string;
    }) => ({
      id: g.id,
      group_code: g.group_code,
      title: g.title,
      description: g.description,
      category_id: g.category_id,
      status: g.status,
      created_at: g.created_at,
      updated_at: g.updated_at,
    }));

    // 5. Generate Drafts using similarity & context clustering
    const drafts = generateIncidentDrafts(ungroupedList, existingGroups, {
      dismissedDraftIds: globalDismissedDraftIds,
      minClusterSize: 2,
      similarityThreshold: 50,
    });

    return NextResponse.json({
      success: true,
      drafts,
      totalDrafts: drafts.length,
      evaluatedUngroupedCount: ungroupedList.length,
    });
  } catch (err: unknown) {
    console.error("Unhandled error in GET /api/incidents/drafts:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/incidents/drafts
 * Handles officer confirmation, rejection, split, or link actions on an Incident Group Draft.
 */
export async function POST(req: Request) {
  try {
    const dataSource = getReportDataSource();
    const { user, error: authErr } = await verifyAuthToken(req);

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

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

    const body = await req.json();
    const { action, draftId, title, description, category_id, reportPublicIds, targetGroupId, reason } = body;

    if (!action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    // -------------------------------------------------------------
    // Action 1: CONFIRM DRAFT -> Create real incident group
    // -------------------------------------------------------------
    if (action === "confirm") {
      if (!title || !title.trim()) {
        return NextResponse.json({ error: "กรุณาระบุชื่อกลุ่มเหตุการณ์" }, { status: 400 });
      }

      if (!Array.isArray(reportPublicIds) || reportPublicIds.length === 0) {
        return NextResponse.json({ error: "ต้องระบุคำร้องอย่างน้อย 1 รายการ" }, { status: 400 });
      }

      // 1. Resolve selected reports into UUIDs and check department authorization
      const normalizedIds = reportPublicIds.map((p: string) => normalizePublicId(p));
      const { data: reportsToAdd, error: fetchRepsErr } = await supabaseAdmin
        .from(dataSource.reportsTable)
        .select("id, public_id, category_id, categories(department_id)")
        .in("public_id", normalizedIds);

      if (fetchRepsErr || !reportsToAdd || reportsToAdd.length === 0) {
        return NextResponse.json({ error: "ไม่พบคำร้องที่เลือกในระบบ" }, { status: 404 });
      }

      const validReportUuids: string[] = [];
      const addedMembers: string[] = [];
      for (const rep of reportsToAdd) {
        const deptId = (rep.categories as unknown as { department_id?: number } | null)?.department_id;
        if (accessibleDeptIds.length > 0 && deptId && !accessibleDeptIds.includes(deptId)) {
          continue; // Skip unauthorized
        }
        validReportUuids.push(rep.id);
        addedMembers.push(rep.public_id);
      }

      if (validReportUuids.length === 0) {
        return NextResponse.json({ error: "ไม่มีคำร้องที่เจ้าหน้าที่มีสิทธิ์เข้าถึง", code: "NO_ACCESSIBLE_REPORTS" }, { status: 403 });
      }

      // 2. Prepare Idempotency Key, Fingerprint, and Request Hash
      // Support Partial Confirmation: Incorporate report IDs hash into auto-generated key
      const sortedUuids = validReportUuids.slice().sort();
      const reportsSetHash = crypto.createHash("sha256").update(sortedUuids.join(",")).digest("hex").slice(0, 16);
      const finalIdempotencyKey = (
        body.idempotencyKey || 
        `draft_confirm_${draftId || "adhoc"}_${reportsSetHash}_${staffProfile.id}`
      ).trim();
      const draftFingerprint = (draftId || `fp_${normalizedIds.slice().sort().join("_")}`).trim();
      
      const payloadToHash = {
        title: title.trim(),
        description: description?.trim() || null,
        category_id: category_id ? parseInt(category_id, 10) : null,
        report_ids: sortedUuids,
        draft_fingerprint: draftFingerprint,
      };
      const requestHash = crypto.createHash("sha256").update(JSON.stringify(payloadToHash)).digest("hex");

      // 3. Attempt Atomic RPC
      const rpcName = dataSource.isTest ? "test_confirm_incident_draft_atomic" : "confirm_incident_draft_atomic";
      const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc(rpcName, {
        p_title: title.trim(),
        p_description: description?.trim() || null,
        p_category_id: category_id ? parseInt(category_id, 10) : null,
        p_report_ids: sortedUuids,
        p_draft_fingerprint: draftFingerprint,
        p_staff_id: staffProfile.id,
        p_idempotency_key: finalIdempotencyKey,
        p_request_hash: requestHash,
      });

      if (!rpcErr && rpcResult) {
        if (!rpcResult.success) {
          const statusMap: Record<string, number> = {
            UNAUTHORIZED_STAFF: 401,
            FORBIDDEN_ROLE: 403,
            INVALID_IDEMPOTENCY_KEY: 400,
            INVALID_REQUEST_HASH: 400,
            EMPTY_REPORTS: 400,
            DUPLICATE_REPORT_IDS: 400,
            INVALID_TITLE: 400,
            MISSING_FINGERPRINT: 400,
            REPORT_NOT_FOUND: 404,
            REPORT_ALREADY_GROUPED: 409,
            IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_OPERATION: 409,
            IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD: 409,
          };
          const status = statusMap[rpcResult.code] || 400;
          return NextResponse.json({ error: rpcResult.reason, code: rpcResult.code, details: rpcResult }, { status });
        }

        if (draftId) {
          globalDismissedDraftIds.add(draftId);
        }

        return NextResponse.json({
          success: true,
          message: `ยืนยันสร้างกลุ่มเหตุการณ์ ${rpcResult.group_code} สำเร็จ (${rpcResult.member_count} คำร้อง)`,
          incidentGroup: {
            id: rpcResult.group_id,
            group_code: rpcResult.group_code,
            title: title.trim(),
          },
          addedMembers,
        });
      }

      // STRICT RPC FALLBACK SAFETY:
      // Fallback is permitted ONLY when RPC is strictly confirmed missing from schema cache.
      // If error is network timeout, abort, or 500, we MUST fail closed to prevent duplicate group creation.
      if (rpcErr) {
        if (isRpcMissingInDatabase(rpcErr)) {
          console.warn(`[RPC Fallback Safe] RPC '${rpcName}' missing in schema cache. Falling back to legacy REST flow during pre-migration transition.`);
        } else {
          console.error(`[RPC Execution Error] RPC '${rpcName}' failed with non-missing error:`, rpcErr);
          return NextResponse.json({
            error: "เกิดข้อผิดพลาดในการประมวลผลคำขอ (RPC Error)",
            code: "RPC_EXECUTION_ERROR",
            details: rpcErr.message,
          }, { status: 500 });
        }
      }

      // Generate Next Group Code
      let groupCode: string;
      const codeRpcName = dataSource.isTest ? "get_next_test_incident_group_code" : "get_next_incident_group_code";
      const { data: nextCode, error: codeErr } = await supabaseAdmin.rpc(codeRpcName);

      if (!codeErr && nextCode) {
        groupCode = nextCode;
      } else {
        const { data: latest } = await supabaseAdmin
          .from(dataSource.incidentGroupsTable)
          .select("group_code")
          .order("created_at", { ascending: false })
          .limit(1);

        let nextNum = 1;
        const prefix = dataSource.incidentGroupPrefix;
        if (latest && latest[0]?.group_code) {
          const m = latest[0].group_code.match(new RegExp(`${prefix}(\\d+)`));
          if (m) nextNum = parseInt(m[1], 10) + 1;
        }
        groupCode = `${prefix}${String(nextNum).padStart(5, "0")}`;
      }

      // Insert confirmed group
      const { data: newGroup, error: insertErr } = await supabaseAdmin
        .from(dataSource.incidentGroupsTable)
        .insert({
          group_code: groupCode,
          title: title.trim(),
          description: description?.trim() || null,
          category_id: category_id ? parseInt(category_id, 10) : null,
          status: "open",
          created_by: staffProfile.id,
        })
        .select()
        .single();

      if (insertErr || !newGroup) {
        console.error("Error creating confirmed incident group:", insertErr);
        return NextResponse.json({ error: "ไม่สามารถสร้างกลุ่มเหตุการณ์ได้" }, { status: 500 });
      }

      // Log group creation history
      await supabaseAdmin.from(dataSource.incidentGroupHistoryTable).insert({
        group_id: newGroup.id,
        action: "create_group",
        actor_id: staffProfile.id,
        actor_name: staffProfile.full_name,
        details: {
          group_code: groupCode,
          title: newGroup.title,
          source: "confirmed_from_draft",
          draftId: draftId || null,
          initialReportsCount: validReportUuids.length,
        },
      });

      // Add selected reports into members
      for (const rep of reportsToAdd) {
        const deptId = (rep.categories as unknown as { department_id?: number } | null)?.department_id;
        if (accessibleDeptIds.length > 0 && deptId && !accessibleDeptIds.includes(deptId)) {
          continue;
        }

        const { error: memErr } = await supabaseAdmin
          .from(dataSource.incidentGroupMembersTable)
          .insert({
            group_id: newGroup.id,
            report_id: rep.id,
            added_by: staffProfile.id,
            notes: "ยืนยันจากร่างข้อเสนอรวมกลุ่มอัตโนมัติ",
          });

        if (!memErr) {
          await supabaseAdmin.from(dataSource.incidentGroupHistoryTable).insert({
            group_id: newGroup.id,
            report_id: rep.id,
            action: "add_report",
            actor_id: staffProfile.id,
            actor_name: staffProfile.full_name,
            details: { public_id: rep.public_id, source: "draft_confirmed" },
          });

          await supabaseAdmin.from(dataSource.reportLogsTable).insert({
            report_id: rep.id,
            user_id: staffProfile.id,
            action: "incident_group_added",
            remark: `ยืนยันคำร้องเข้ากลุ่มเหตุการณ์ ${groupCode} (${newGroup.title}) จากร่างข้อเสนออัตโนมัติ`,
          });
        }
      }

      // Mark draft as resolved/dismissed so it disappears
      if (draftId) {
        globalDismissedDraftIds.add(draftId);
      }

      return NextResponse.json({
        success: true,
        message: `ยืนยันสร้างกลุ่มเหตุการณ์ ${groupCode} สำเร็จ (${addedMembers.length} คำร้อง)`,
        incidentGroup: newGroup,
        addedMembers,
      });
    }

    // -------------------------------------------------------------
    // Action 2: REJECT DRAFT -> Dismiss suggestion
    // -------------------------------------------------------------
    if (action === "reject") {
      if (!draftId) {
        return NextResponse.json({ error: "Missing draftId" }, { status: 400 });
      }

      globalDismissedDraftIds.add(draftId);

      // Log rejection remark to the reports involved if available
      if (Array.isArray(reportPublicIds) && reportPublicIds.length > 0) {
        const normalizedIds = reportPublicIds.map((p: string) => normalizePublicId(p));
        const { data: targetReps } = await supabaseAdmin
          .from(dataSource.reportsTable)
          .select("id, public_id")
          .in("public_id", normalizedIds);

        if (targetReps) {
          for (const rep of targetReps) {
            await supabaseAdmin.from(dataSource.reportLogsTable).insert({
              report_id: rep.id,
              user_id: staffProfile.id,
              action: "draft_rejected",
              remark: `เจ้าหน้าที่ปฏิเสธข้อเสนอจัดกลุ่มอัตโนมัติ (${draftId}) - เหตุผล: ${reason || "ไม่ใช่เหตุการณ์เดียวกัน"}`,
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: "ปฏิเสธร่างข้อเสนอรวมกลุ่มเรียบร้อยแล้ว",
        draftId,
      });
    }

    // -------------------------------------------------------------
    // Action 3: LINK TO EXISTING GROUP
    // -------------------------------------------------------------
    if (action === "link_existing") {
      if (!targetGroupId) {
        return NextResponse.json({ error: "Missing targetGroupId" }, { status: 400 });
      }

      if (!Array.isArray(reportPublicIds) || reportPublicIds.length === 0) {
        return NextResponse.json({ error: "ต้องระบุคำร้องอย่างน้อย 1 รายการ" }, { status: 400 });
      }

      // Verify target group exists
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetGroupId);
      let gQuery = supabaseAdmin.from(dataSource.incidentGroupsTable).select("id, group_code, title");
      if (isUUID) {
        gQuery = gQuery.eq("id", targetGroupId);
      } else {
        gQuery = gQuery.eq("group_code", targetGroupId.toUpperCase());
      }

      const { data: targetGroup } = await gQuery.maybeSingle();
      if (!targetGroup) {
        return NextResponse.json({ error: "ไม่พบกลุ่มเหตุการณ์เป้าหมาย" }, { status: 404 });
      }

      const normalizedIds = reportPublicIds.map((p: string) => normalizePublicId(p));
      const { data: reportsToAdd, error: fetchRepsErr } = await supabaseAdmin
        .from(dataSource.reportsTable)
        .select("id, public_id, category_id, categories(department_id)")
        .in("public_id", normalizedIds);

      if (fetchRepsErr || !reportsToAdd || reportsToAdd.length === 0) {
        return NextResponse.json({ error: "ไม่พบคำร้องที่เลือกในระบบ" }, { status: 404 });
      }

      const validReportUuids: string[] = [];
      const addedMembers: string[] = [];
      for (const rep of reportsToAdd) {
        const deptId = (rep.categories as unknown as { department_id?: number } | null)?.department_id;
        if (accessibleDeptIds.length > 0 && deptId && !accessibleDeptIds.includes(deptId)) {
          continue;
        }
        validReportUuids.push(rep.id);
        addedMembers.push(rep.public_id);
      }

      if (validReportUuids.length === 0) {
        return NextResponse.json({ error: "ไม่มีคำร้องที่เจ้าหน้าที่มีสิทธิ์เข้าถึง", code: "NO_ACCESSIBLE_REPORTS" }, { status: 403 });
      }

      // Prepare Idempotency Key and Request Hash for link_existing
      // Support Partial Linking: Incorporate target group and report IDs hash
      const sortedUuids = validReportUuids.slice().sort();
      const linkReportsHash = crypto.createHash("sha256").update(`${targetGroup.id}:${sortedUuids.join(",")}`).digest("hex").slice(0, 16);
      const finalIdempotencyKey = (
        body.idempotencyKey || 
        `draft_link_${targetGroup.id}_${linkReportsHash}_${staffProfile.id}`
      ).trim();
      const linkPayloadToHash = {
        groupId: targetGroup.id,
        reportIds: sortedUuids,
      };
      const requestHash = crypto.createHash("sha256").update(JSON.stringify(linkPayloadToHash)).digest("hex");

      // Attempt Atomic RPC
      const rpcName = dataSource.isTest ? "test_link_reports_to_incident_group_atomic" : "link_reports_to_incident_group_atomic";
      const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc(rpcName, {
        p_group_id: targetGroup.id,
        p_report_ids: sortedUuids,
        p_staff_id: staffProfile.id,
        p_idempotency_key: finalIdempotencyKey,
        p_request_hash: requestHash,
      });

      if (!rpcErr && rpcResult) {
        if (!rpcResult.success) {
          const statusMap: Record<string, number> = {
            FORBIDDEN: 403,
            GROUP_NOT_FOUND: 404,
            GROUP_CLOSED: 400,
            INVALID_IDEMPOTENCY_KEY: 400,
            INVALID_REQUEST_HASH: 400,
            EMPTY_REPORTS: 400,
            REPORT_NOT_FOUND: 404,
            REPORT_ALREADY_GROUPED: 409,
            IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_OPERATION: 409,
            IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD: 409,
          };
          const status = statusMap[rpcResult.code] || 400;
          return NextResponse.json({ error: rpcResult.reason, code: rpcResult.code, details: rpcResult }, { status });
        }

        if (draftId) {
          globalDismissedDraftIds.add(draftId);
        }

        return NextResponse.json({
          success: true,
          message: `เชื่อมโยง ${rpcResult.added_count} คำร้อง เข้ากลุ่ม ${rpcResult.group_code} สำเร็จ`,
          targetGroup,
          addedMembers,
        });
      }

      // STRICT RPC FALLBACK SAFETY:
      // Fallback is permitted ONLY when RPC is strictly confirmed missing from schema cache.
      // If error is network timeout, abort, or 500, we MUST fail closed to prevent duplicate linkage.
      if (rpcErr) {
        if (isRpcMissingInDatabase(rpcErr)) {
          console.warn(`[Link RPC Fallback Safe] RPC '${rpcName}' missing in schema cache. Falling back to legacy REST flow during pre-migration transition.`);
        } else {
          console.error(`[Link RPC Execution Error] RPC '${rpcName}' failed with non-missing error:`, rpcErr);
          return NextResponse.json({
            error: "เกิดข้อผิดพลาดในการประมวลผลคำขอ (Link RPC Error)",
            code: "RPC_EXECUTION_ERROR",
            details: rpcErr.message,
          }, { status: 500 });
        }
      }

      for (const rep of reportsToAdd) {
        const deptId = (rep.categories as unknown as { department_id?: number } | null)?.department_id;
        if (accessibleDeptIds.length > 0 && deptId && !accessibleDeptIds.includes(deptId)) {
          continue;
        }

        const { error: memErr } = await supabaseAdmin
          .from(dataSource.incidentGroupMembersTable)
          .insert({
            group_id: targetGroup.id,
            report_id: rep.id,
            added_by: staffProfile.id,
            notes: "เชื่อมโยงจากร่างข้อเสนอเข้ากลุ่มเดิม",
          });

        if (!memErr) {
          // Audit history
          await supabaseAdmin.from(dataSource.incidentGroupHistoryTable).insert({
            group_id: targetGroup.id,
            report_id: rep.id,
            action: "add_report",
            actor_id: staffProfile.id,
            actor_name: staffProfile.full_name,
            details: { public_id: rep.public_id, source: "draft_linked_to_existing" },
          });

          // Report log
          await supabaseAdmin.from(dataSource.reportLogsTable).insert({
            report_id: rep.id,
            user_id: staffProfile.id,
            action: "incident_group_added",
            remark: `เชื่อมโยงคำร้องเข้ากลุ่มเหตุการณ์เดิม ${targetGroup.group_code} (${targetGroup.title})`,
          });
        }
      }

      if (draftId) {
        globalDismissedDraftIds.add(draftId);
      }

      return NextResponse.json({
        success: true,
        message: `เชื่อมโยง ${addedMembers.length} คำร้อง เข้ากลุ่ม ${targetGroup.group_code} สำเร็จ`,
        targetGroup,
        addedMembers,
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err: unknown) {
    console.error("Unhandled error in POST /api/incidents/drafts:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
