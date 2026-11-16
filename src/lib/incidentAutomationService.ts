/**
 * Automatic Incident Detection & Workflow Trigger Service
 * 
 * Invoked immediately after a new report is recorded via POST /api/reports.
 * Executes background correlation detection, prepares draft proposals, and records audit history.
 * 
 * Safety & Quality:
 *  - Non-blocking: Errors are caught safely so citizen report submissions are never affected.
 *  - Idempotent: Repeated invocations for the same report ID will not duplicate logs or drafts.
 *  - Human-in-the-loop: Never modifies real incident group members or report statuses automatically.
 *  - Test/Production Isolated: Respects dataSource routing.
 */

import { supabaseAdmin } from './supabase-admin';
import { getReportDataSource } from './dataSource';
import { ReportItem } from './similarityDetector';
import { IncidentGroupItem, detectIncidentCorrelations, IncidentDetectionSummary } from './incidentDetector';
import { generateIncidentDrafts, ProposedReportItem } from './incidentDraftService';

export interface AutomationResult {
  processed: boolean;
  alreadyProcessed: boolean;
  summary?: IncidentDetectionSummary;
  draftsCount?: number;
  auditRemark?: string;
  error?: string;
}

export async function processNewReportForIncidents(
  newReport: {
    id: string;
    public_id: string;
    category_id?: number | null;
    subcategory_id?: number | null;
    location?: string | null;
    description?: string | null;
    status: string;
    priority?: string | null;
    reporter_name?: string | null;
    created_at: string;
  }
): Promise<AutomationResult> {
  const dataSource = getReportDataSource();

  try {
    // 1. Idempotency Check: Verify if detection was already run for this report
    const { data: existingLog } = await supabaseAdmin
      .from(dataSource.reportLogsTable)
      .select('id')
      .eq('report_id', newReport.id)
      .eq('action', 'incident_detection_completed')
      .limit(1)
      .maybeSingle();

    if (existingLog) {
      return {
        processed: true,
        alreadyProcessed: true,
        auditRemark: 'ข้ามการประมวลผลซ้ำ (ตรวจจับไปแล้ว)',
      };
    }

    // 2. Fetch grouped report IDs to exclude
    const { data: groupedMembers } = await supabaseAdmin
      .from(dataSource.incidentGroupMembersTable)
      .select('report_id');

    const groupedReportIds = new Set((groupedMembers || []).map((m: { report_id: string }) => m.report_id));

    // If this report is already part of a confirmed group, skip drafting
    if (groupedReportIds.has(newReport.id)) {
      return {
        processed: true,
        alreadyProcessed: true,
        auditRemark: 'คำร้องถูกจัดกลุ่มจริงแล้ว',
      };
    }

    // 3. Fetch Candidate Ungrouped Reports in the same category
    let ungroupedQuery = supabaseAdmin
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
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (newReport.category_id != null) {
      ungroupedQuery = ungroupedQuery.eq('category_id', newReport.category_id);
    }

    const { data: rawCandidates, error: candErr } = await ungroupedQuery;
    if (candErr) {
      console.error('[IncidentAutomation] Failed to fetch candidate reports:', candErr);
    }

    const candidatePool: ReportItem[] = (rawCandidates || [])
      .filter((r: { id: string }) => !groupedReportIds.has(r.id) && r.id !== newReport.id)
      .map((r: {
        id: string;
        public_id: string;
        category_id?: number | null;
        subcategory_id?: number | null;
        location?: string | null;
        description?: string | null;
        status: string;
        created_at: string;
        reporter_name?: string | null;
      }) => ({
        id: r.id,
        public_id: r.public_id,
        category_id: r.category_id,
        subcategory_id: r.subcategory_id,
        location: r.location,
        description: r.description,
        status: r.status,
        created_at: r.created_at,
        reporter_name: r.reporter_name,
      }));

    // 4. Fetch Existing Open and Closed Groups
    const { data: rawGroups } = await supabaseAdmin
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
      .order('updated_at', { ascending: false })
      .limit(30);

    const openGroups: IncidentGroupItem[] = [];
    const closedGroups: IncidentGroupItem[] = [];

    (rawGroups || []).forEach((g: {
      id: string;
      group_code: string;
      title: string;
      description?: string | null;
      category_id?: number | null;
      status: 'open' | 'resolved' | 'closed';
      created_at: string;
      updated_at?: string;
    }) => {
      const item: IncidentGroupItem = {
        id: g.id,
        group_code: g.group_code,
        title: g.title,
        description: g.description,
        category_id: g.category_id,
        status: g.status,
        created_at: g.created_at,
        updated_at: g.updated_at,
      };
      if (g.status === 'open') {
        openGroups.push(item);
      } else {
        closedGroups.push(item);
      }
    });

    // 5. Run Correlation Detection
    const targetReportItem: ReportItem = {
      id: newReport.id,
      public_id: newReport.public_id,
      category_id: newReport.category_id,
      subcategory_id: newReport.subcategory_id,
      location: newReport.location,
      description: newReport.description,
      status: newReport.status,
      created_at: newReport.created_at,
      reporter_name: newReport.reporter_name,
    };

    const summary = detectIncidentCorrelations(targetReportItem, {
      ungroupedReports: candidatePool,
      openGroups,
      closedGroups,
    });

    // 6. Check if this report triggers or joins a draft cluster
    const clusterTestPool: ProposedReportItem[] = [
      {
        ...targetReportItem,
        priority: (newReport.priority as ProposedReportItem['priority']) || 'normal',
      },
      ...candidatePool.map((c) => ({
        ...c,
        priority: 'normal' as const,
      })),
    ];

    const activeDrafts = generateIncidentDrafts(clusterTestPool, openGroups, {
      minClusterSize: 2,
      similarityThreshold: 50,
    });

    const relatedDraft = activeDrafts.find((d) =>
      d.reports.some((r) => r.public_id === newReport.public_id)
    );

    // 7. Compose Audit Remark & Action Details
    let auditRemark = summary.primaryRecommendationReason;
    if (relatedDraft) {
      auditRemark = `จัดเตรียมร่างกลุ่มเหตุการณ์อัตโนมัติ (${relatedDraft.proposedTitle}) มีสมาชิกรวม ${relatedDraft.reportCount} รายการ (คะแนนความเข้ากัน ${relatedDraft.correlationScore}%)`;
    }

    // 8. Write Audit Trail to reportLogsTable
    try {
      await supabaseAdmin.from(dataSource.reportLogsTable).insert({
        report_id: newReport.id,
        action: 'incident_detection_completed',
        new_status: newReport.status,
        remark: auditRemark,
      });
    } catch (logErr) {
      console.error('[IncidentAutomation] Error writing audit log:', logErr);
    }

    return {
      processed: true,
      alreadyProcessed: false,
      summary,
      draftsCount: activeDrafts.length,
      auditRemark,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[IncidentAutomation] Unhandled exception in background incident automation:', errorMsg);

    // Record failure in audit log if possible so staff can troubleshoot
    try {
      await supabaseAdmin.from(dataSource.reportLogsTable).insert({
        report_id: newReport.id,
        action: 'incident_detection_failed',
        new_status: newReport.status,
        remark: `การตรวจจับเหตุการณ์อัตโนมัติขัดข้อง: ${errorMsg.slice(0, 200)}`,
      });
    } catch {
      // Silent catch to prevent crashing caller
    }

    return {
      processed: false,
      alreadyProcessed: false,
      error: errorMsg,
    };
  }
}
