import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizePublicId } from "@/lib/utils";
import { getReportDataSource } from "@/lib/dataSource";
import { findSimilarReports, evaluateIncidentIdentity, ReportItem } from "@/lib/similarityDetector";
import { localizeConflictReason } from "@/lib/conflictLocalization";

export const dynamic = "force-dynamic";

interface DBReportWithCategories extends ReportItem {
  categories?: { id: number; name_th: string } | null;
  subcategories?: { id: number; name_th: string } | null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const dataSource = getReportDataSource();
    const { publicId } = await params;

    if (!publicId) {
      return NextResponse.json({ error: "Missing publicId" }, { status: 400 });
    }

    const normalizedPublicId = normalizePublicId(publicId);

    // 1. Fetch Target Report
    const { data: targetData, error: targetErr } = await supabaseAdmin
      .from(dataSource.reportsTable)
      .select(`
        id,
        public_id,
        category_id,
        subcategory_id,
        location,
        description,
        status,
        created_at,
        categories (
          id,
          name_th
        ),
        subcategories (
          id,
          name_th
        )
      `)
      .eq("public_id", normalizedPublicId)
      .maybeSingle();

    if (targetErr) {
      console.error("Error fetching target report:", targetErr);
      return NextResponse.json({ success: false, message: "Database query error" }, { status: 500 });
    }

    if (!targetData) {
      return NextResponse.json({ error: "ไม่พบข้อมูลคำร้อง" }, { status: 404 });
    }

    const target = targetData as unknown as DBReportWithCategories;

    // 2. Fetch Candidate Pool
    // Query recent reports from the same active table
    const { data: candidateData, error: candErr } = await supabaseAdmin
      .from(dataSource.reportsTable)
      .select(`
        id,
        public_id,
        category_id,
        subcategory_id,
        location,
        description,
        status,
        created_at,
        categories (
          id,
          name_th
        ),
        subcategories (
          id,
          name_th
        )
      `)
      .neq("public_id", normalizedPublicId)
      .order("created_at", { ascending: false })
      .limit(250);

    if (candErr) {
      console.error("Error fetching candidate reports:", candErr);
      return NextResponse.json({ success: false, message: "Database query error" }, { status: 500 });
    }

    const candidates = (candidateData || []) as unknown as DBReportWithCategories[];

    // 3. Compute Similarities
    const rawResults = findSimilarReports(target, candidates, {
      minScore: 40,
      limit: 15
    });

    // 4. Query incident group membership for candidates
    const candidateReportIds = rawResults
      .map(res => (res.candidate as DBReportWithCategories).id)
      .filter((id): id is string => Boolean(id));

    const memberGroupMap = new Map<string, { id: string; group_code: string; title: string; status: string }>();

    if (candidateReportIds.length > 0) {
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
        .in("report_id", candidateReportIds);

      (memberRows || []).forEach((row: {
        report_id: string;
        incident_group?: { id: string; group_code: string; title: string; status: string } | Array<{ id: string; group_code: string; title: string; status: string }> | null;
      }) => {
        const ig = Array.isArray(row.incident_group) ? row.incident_group[0] : row.incident_group;
        if (ig && row.report_id) {
          memberGroupMap.set(row.report_id, {
            id: ig.id,
            group_code: ig.group_code,
            title: ig.title,
            status: ig.status
          });
        }
      });
    }

    // Format for staff UI
    const formattedSuggestions = rawResults.map(res => {
      const cand = res.candidate as DBReportWithCategories;
      const identityEval = evaluateIncidentIdentity(target, cand);
      const group = cand.id ? memberGroupMap.get(cand.id) || null : null;

      return {
        public_id: cand.public_id,
        score: res.score,
        confidence: res.confidence,
        confidenceLabel: res.confidenceLabel,
        reasons: res.reasons,
        differences: (identityEval.differences || []).map((d: string) => localizeConflictReason(d)),
        evidence: identityEval.evidence || [],
        candidateDecision: identityEval.candidateDecision,
        isSameIncidentCandidate: identityEval.isSameIncidentCandidate,
        incidentGroup: group,
        breakdown: res.breakdown,
        isPersonalPropertyDuplicate: res.isPersonalPropertyDuplicate,
        report: {
          public_id: cand.public_id,
          categoryName: cand.categories?.name_th || "-",
          subcategoryName: cand.subcategories?.name_th || "-",
          location: cand.location || "ไม่ระบุ",
          description: cand.description || "",
          status: cand.status || "pending",
          created_at: cand.created_at
        }
      };
    });

    const highCount = formattedSuggestions.filter(s => s.confidence === 'high').length;
    const mediumCount = formattedSuggestions.filter(s => s.confidence === 'medium').length;

    return NextResponse.json({
      success: true,
      target: {
        public_id: target.public_id,
        category_id: target.category_id,
        subcategory_id: target.subcategory_id,
        categoryName: target.categories?.name_th || "-",
        subcategoryName: target.subcategories?.name_th || "-",
        location: target.location,
        description: target.description,
        created_at: target.created_at
      },
      similarSuggestions: formattedSuggestions,
      summary: {
        totalEvaluated: candidates.length,
        matchesFound: formattedSuggestions.length,
        highTendencyCount: highCount,
        similarCount: mediumCount
      }
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "Internal Server Error";
    console.error("Unhandled error in similarity detection API:", error);
    return NextResponse.json(
      { success: false, message: errMessage },
      { status: 500 }
    );
  }
}
