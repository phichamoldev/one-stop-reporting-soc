import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getReportDataSource } from "@/lib/dataSource";
import { verifyAuthToken, getAccessibleDepartmentIds } from "@/lib/auth-helpers";
import {
  evaluateIncidentIdentity,
  detectIncidentContradiction,
  IncidentIdentityEvaluation,
  ReportItem
} from "@/lib/similarityDetector";

export const dynamic = "force-dynamic";

interface DBReportWithCategories extends ReportItem {
  categories?: { id: number; name_th: string; department_id?: number } | null;
  subcategories?: { id: number; name_th: string } | null;
}

/**
 * GET /api/incidents/[id]/candidates
 * Propose related reports for an incident group using Step 2 similarity detection.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const dataSource = getReportDataSource();
    const { id } = await params;
    const { user, error: authErr } = await verifyAuthToken(req);

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

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

    // 1. Resolve Group
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    let groupQuery = supabaseAdmin.from(dataSource.incidentGroupsTable).select("id, group_code, title, description, category_id");
    if (isUUID) {
      groupQuery = groupQuery.eq("id", id);
    } else {
      groupQuery = groupQuery.eq("group_code", id.toUpperCase());
    }

    const { data: targetGroup } = await groupQuery.maybeSingle();
    if (!targetGroup) {
      return NextResponse.json({ error: "ไม่พบกลุ่มเหตุการณ์นี้" }, { status: 404 });
    }

    // 2. Fetch Existing Group Members
    const { data: existingMembers } = await supabaseAdmin
      .from(dataSource.incidentGroupMembersTable)
      .select(`
        report_id,
        reports:${dataSource.reportsTable} (
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
            name_th,
            department_id
          ),
          subcategories (
            id,
            name_th
          )
        )
      `)
      .eq("group_id", targetGroup.id);

    const memberReports = (existingMembers || [])
      .map((m: { reports?: unknown }) => m.reports)
      .filter(Boolean) as unknown as DBReportWithCategories[];

    const existingMemberIds = new Set(memberReports.map((r) => r.id));

    // 3. Fetch Candidate Pool from active table (reportsTable)
    const candidateQuery = supabaseAdmin
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

    const { data: rawCandidates, error: candErr } = await candidateQuery;
    if (candErr) {
      console.error("Error fetching candidates:", candErr);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    interface CandidateSuggestion {
      public_id: string;
      score: number;
      confidence: string;
      confidenceLabel: string;
      reasons: string[];
      breakdown: unknown;
      matchedWithMember?: string;
      existingGroup?: { group_code: string; title: string } | null;
      report: unknown;
    }

    // Filter out existing members and apply department scoping
    const rawCandidateList = (rawCandidates || []) as unknown as Array<{
      id: string;
      categories?: { department_id?: number } | Array<{ department_id?: number }> | null;
      [key: string]: unknown;
    }>;

    const candidatePool = rawCandidateList.filter((c) => {
      if (existingMemberIds.has(c.id)) return false;
      if (accessibleDeptIds.length > 0) {
        const cat = Array.isArray(c.categories) ? c.categories[0] : c.categories;
        const deptId = cat?.department_id;
        if (deptId && !accessibleDeptIds.includes(deptId)) return false;
      }
      return true;
    }) as unknown as DBReportWithCategories[];

    // 4. Query other groups to check if candidate is in another group
    const candidateIds = candidatePool.map((c) => c.id).filter(Boolean) as string[];
    const { data: otherGroupMemberships } = await supabaseAdmin
      .from(dataSource.incidentGroupMembersTable)
      .select(`
        report_id,
        incident_group:${dataSource.incidentGroupsTable} (
          id,
          group_code,
          title
        )
      `)
      .in("report_id", candidateIds);

    const otherGroupList = (otherGroupMemberships || []) as unknown as Array<{
      report_id: string;
      incident_group?: { group_code: string; title: string } | Array<{ group_code: string; title: string }> | null;
    }>;

    const otherGroupMap = new Map<string, { group_code: string; title: string }>();
    otherGroupList.forEach((m) => {
      const ig = Array.isArray(m.incident_group) ? m.incident_group[0] : m.incident_group;
      if (ig) {
        otherGroupMap.set(m.report_id, {
          group_code: ig.group_code,
          title: ig.title,
        });
      }
    });

    // 5. Compute Candidate Suggestions using Incident Identity & Contradiction Guards
    const suggestionsMap = new Map<string, CandidateSuggestion>();

    if (memberReports.length > 0) {
      // Evaluate each candidate against group members
      for (const cand of candidatePool) {
        // Zero tolerance for contradictions: If candidate contradicts ANY current member, exclude it!
        const hasContradiction = memberReports.some((m) => {
          const contra = detectIncidentContradiction(m, cand);
          return contra.isContradiction;
        });
        if (hasContradiction) continue;

        // Evaluate incident identity compatibility across members
        let bestScore = 0;
        let bestEval: IncidentIdentityEvaluation | null = null;
        let matchedMemberId: string | undefined = undefined;

        for (const member of memberReports) {
          const evalRes = evaluateIncidentIdentity(member, cand);
          if (evalRes.ruleScore > bestScore) {
            bestScore = evalRes.ruleScore;
            bestEval = evalRes;
            matchedMemberId = member.public_id;
          }
        }

        if (bestEval && bestScore >= 45) {
          const inOther = cand.id ? otherGroupMap.get(cand.id) : null;
          const isSame = bestEval.candidateDecision === 'same_incident';
          const isInsufficient = bestEval.candidateDecision === 'insufficient_evidence';

          suggestionsMap.set(cand.public_id, {
            public_id: cand.public_id,
            score: bestScore,
            confidence: isSame ? 'high' : (isInsufficient ? 'medium' : 'low'),
            confidenceLabel: isSame
              ? 'มีแนวโน้มสูงว่าเป็นเหตุการณ์เดียวกัน (หลักฐานสอดคล้อง)'
              : isInsufficient
              ? 'คำร้องคล้ายกันแต่หลักฐานไม่เพียงพอ (Needs Review)'
              : 'คำร้องที่มีบริบทใกล้เคียงกัน (Similar Request)',
            reasons: [
              ...bestEval.evidence,
              ...(bestEval.differences.map((d) => `ข้อสังเกต: ${d}`)),
            ],
            breakdown: {
              decision: bestEval.candidateDecision,
              ruleScore: bestEval.ruleScore,
              spatialGranularity: bestEval.spatialGranularity,
              sharedRootCause: bestEval.sharedRootCause,
            },
            matchedWithMember: matchedMemberId,
            existingGroup: inOther || null,
            report: {
              public_id: cand.public_id,
              categoryName: cand.categories?.name_th || "-",
              subcategoryName: cand.subcategories?.name_th || "-",
              location: cand.location || "ไม่ระบุ",
              description: cand.description || "",
              status: cand.status || "pending",
              created_at: cand.created_at,
            },
          });
        }
      }
    } else {
      // Group has no members yet: compare against synthetic group anchor
      const syntheticTarget: ReportItem = {
        id: "target",
        public_id: targetGroup.group_code,
        category_id: targetGroup.category_id || 1,
        subcategory_id: null,
        location: "",
        description: `${targetGroup.title} ${targetGroup.description || ""}`,
        created_at: new Date().toISOString(),
      };

      for (const cand of candidatePool) {
        const contra = detectIncidentContradiction(syntheticTarget, cand);
        if (contra.isContradiction) continue;

        const evalRes = evaluateIncidentIdentity(syntheticTarget, cand);
        if (evalRes.ruleScore >= 45) {
          const inOther = cand.id ? otherGroupMap.get(cand.id) : null;
          const isSame = evalRes.candidateDecision === 'same_incident';
          const isInsufficient = evalRes.candidateDecision === 'insufficient_evidence';

          suggestionsMap.set(cand.public_id, {
            public_id: cand.public_id,
            score: evalRes.ruleScore,
            confidence: isSame ? 'high' : (isInsufficient ? 'medium' : 'low'),
            confidenceLabel: isSame
              ? 'มีแนวโน้มสูงว่าเป็นเหตุการณ์เดียวกัน'
              : isInsufficient
              ? 'คำร้องคล้ายกันแต่หลักฐานไม่เพียงพอ'
              : 'คำร้องที่มีบริบทใกล้เคียงกัน',
            reasons: [
              ...evalRes.evidence,
              ...(evalRes.differences.map((d) => `ข้อสังเกต: ${d}`)),
            ],
            breakdown: {
              decision: evalRes.candidateDecision,
              ruleScore: evalRes.ruleScore,
            },
            existingGroup: inOther || null,
            report: {
              public_id: cand.public_id,
              categoryName: cand.categories?.name_th || "-",
              subcategoryName: cand.subcategories?.name_th || "-",
              location: cand.location || "ไม่ระบุ",
              description: cand.description || "",
              status: cand.status || "pending",
              created_at: cand.created_at,
            },
          });
        }
      }
    }

    const candidateList = Array.from(suggestionsMap.values()).sort((a, b) => b.score - a.score);

    return NextResponse.json({
      success: true,
      candidates: candidateList,
      totalEvaluated: candidatePool.length,
      suggestionsCount: candidateList.length,
    });
  } catch (err: unknown) {
    console.error("Unhandled error in GET /api/incidents/[id]/candidates:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
