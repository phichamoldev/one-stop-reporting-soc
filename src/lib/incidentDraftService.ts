/**
 * Automatic Incident Group Drafting Service
 * 
 * Automatically clusters ungrouped reports into proposed Incident Group Drafts
 * based on verified real-world incident identity (shared spatial anchor, system entity,
 * ongoing time window, and absence of physical/logical contradictions).
 * 
 * Safety & Quality:
 *  - Human-in-the-loop: Drafts are purely proposals waiting for officer review.
 *  - Zero permanent changes or member additions until officer explicitly confirms.
 *  - Deterministic clustering prevents duplicate drafts for the same incident.
 *  - Anti-Transitive / Anti-Chaining: Complete linkage + anchor compatibility ensures
 *    that transitive connections (A ~ B, B ~ C) NEVER merge A and C if they are different incidents.
 *  - Insufficient evidence separation: Vague location reports are separated into an unconfirmed review list.
 *  - Excludes personal property duplicates (subcategory 33).
 */

import {
  ReportItem,
  extractSpatialAnchor,
  extractSystemEntity,
  extractProbableRootCause,
  evaluateIncidentIdentity,
} from './similarityDetector';
import { PriorityLevel, classifyPriority } from './priorityClassifier';
import { IncidentGroupItem, GroupCorrelationResult, evaluateReportAgainstGroup } from './incidentDetector';

export interface ProposedReportItem extends ReportItem {
  priority: PriorityLevel;
  priorityReason?: string;
  categoryName?: string;
  subcategoryName?: string;
  isPotentialConflict?: boolean;
  conflictReason?: string;
}

export interface IncidentGroupDraft {
  draftId: string;
  proposedTitle: string;
  proposedDescription: string;
  priority: PriorityLevel;
  priorityReason: string;
  category_id: number | null;
  subcategory_id: number | null;
  categoryName?: string;
  subcategoryName?: string;
  reportCount: number;
  reports: ProposedReportItem[];
  earliestReportDate: string;
  latestReportDate: string;
  timeSpanHours: number;
  correlationScore: number;
  reasons: string[];
  evidence: string[];
  differences: string[];
  locationSummary: string;
  spatialGranularity: string;
  sharedRootCause?: string | null;
  insufficientEvidenceReports?: ProposedReportItem[];
  suggestedExistingGroups: GroupCorrelationResult[];
  conflicts: string[];
  isEmergency: boolean;
}

/**
 * Generates a deterministic hash/id for a cluster of report public IDs
 */
export function getClusterDraftId(publicIds: string[]): string {
  const sorted = [...publicIds].sort().join('_');
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    hash = (hash << 5) - hash + sorted.charCodeAt(i);
    hash |= 0;
  }
  return `draft_${Math.abs(hash).toString(36)}_${publicIds.length}`;
}

/**
 * Synthesizes a human-readable title for a group of reports
 */
function synthesizeDraftTitle(reports: ProposedReportItem[]): string {
  if (reports.length === 0) return 'กลุ่มคำร้องที่เกี่ยวข้อง';

  const first = reports[0];
  const combinedLoc = reports.map((r) => r.location || '').join(' ');
  const combinedDesc = reports.map((r) => r.description || '').join(' ');
  const anchor = extractSpatialAnchor(combinedLoc, combinedDesc);
  const subcatName = first.subcategoryName || 'แจ้งปัญหา';

  // Extract core issue phrase from description
  const cleanDesc = (first.description || '')
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, ' ')
    .trim();
  const words = cleanDesc.split(/\s+/).slice(0, 4).join(' ');

  if (anchor.summary && anchor.summary !== 'ไม่ระบุสถานที่ชัดเจน') {
    return `${subcatName}: ${anchor.summary} (${words || 'หลายรายการ'})`;
  }
  if (first.location) {
    return `${subcatName}: บริเวณ${first.location} (${words || 'หลายรายการ'})`;
  }
  return `${subcatName}: ${words || 'พบคำร้องเหตุการณ์เดียวกันหลายรายการ'}`;
}

/**
 * Clusters ungrouped reports and builds explainable Incident Group Drafts
 */
export function generateIncidentDrafts(
  ungroupedReports: ProposedReportItem[],
  existingGroups: IncidentGroupItem[] = [],
  options: {
    dismissedDraftIds?: Set<string>;
    minClusterSize?: number;
    similarityThreshold?: number;
  } = {}
): IncidentGroupDraft[] {
  const {
    dismissedDraftIds = new Set<string>(),
    minClusterSize = 2,
  } = options;

  if (ungroupedReports.length < minClusterSize) {
    return [];
  }

  // Pre-classify report priorities if not already present
  const enrichedReports: ProposedReportItem[] = ungroupedReports.map((r) => {
    if (!r.priority || (r.priority as string) === 'low') {
      const cls = classifyPriority({
        category_id: r.category_id,
        subcategory_id: r.subcategory_id,
        description: r.description,
        location: r.location,
        current_priority: r.priority as PriorityLevel,
      });
      return {
        ...r,
        priority: cls.priority,
        priorityReason: cls.reason,
      };
    }
    return r;
  });

  // Filter out personal property reports (subcategory 33) from multi-report incident drafting
  const eligibleReports = enrichedReports.filter((r) => r.subcategory_id !== 33);
  const n = eligibleReports.length;

  if (n < minClusterSize) {
    return [];
  }

  // 1. Build Pairwise Incident Identity Compatibility Matrix
  const isCompatible: boolean[][] = Array.from({ length: n }, () => new Array(n).fill(false));
  const identityScores: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const candidatePairs: { i: number; j: number; score: number }[] = [];

  for (let i = 0; i < n; i++) {
    isCompatible[i][i] = true;
    for (let j = i + 1; j < n; j++) {
      const rA = eligibleReports[i];
      const rB = eligibleReports[j];

      const identityEval = evaluateIncidentIdentity(rA, rB);

      // Must be a verified real-world Same Incident Candidate (NOT merely surface similarity!)
      if (identityEval.isSameIncidentCandidate) {
        isCompatible[i][j] = true;
        isCompatible[j][i] = true;
        identityScores[i][j] = identityEval.ruleScore;
        identityScores[j][i] = identityEval.ruleScore;
        candidatePairs.push({ i, j, score: identityEval.ruleScore });
      }
    }
  }

  // 2. Anti-Chaining Complete-Linkage Clique Clustering with Centroid Anchor
  // Sort candidate pairs descending by score so the strongest verified incident pairs seed clusters first
  candidatePairs.sort((a, b) => b.score - a.score);

  const clusteredIndices = new Set<number>();
  const clusters: ProposedReportItem[][] = [];

  for (const pair of candidatePairs) {
    if (clusteredIndices.has(pair.i) || clusteredIndices.has(pair.j)) continue;

    const clusterMemberIndices = [pair.i, pair.j];
    clusteredIndices.add(pair.i);
    clusteredIndices.add(pair.j);

    // Expand cluster ONLY if candidate k is mutually compatible with EVERY current member (Zero chaining!)
    for (let k = 0; k < n; k++) {
      if (clusteredIndices.has(k)) continue;

      const allCompatible = clusterMemberIndices.every((mIdx) => isCompatible[mIdx][k]);
      if (allCompatible) {
        clusterMemberIndices.push(k);
        clusteredIndices.add(k);
      }
    }

    if (clusterMemberIndices.length >= minClusterSize) {
      clusters.push(clusterMemberIndices.map((idx) => eligibleReports[idx]));
    }
  }

  // Build Drafts from Clusters
  const drafts: IncidentGroupDraft[] = [];

  for (const cluster of clusters) {
    const publicIds = cluster.map((r) => r.public_id);
    const draftId = getClusterDraftId(publicIds);

    // Skip dismissed drafts
    if (dismissedDraftIds.has(draftId)) continue;

    // Determine Draft Priority
    let draftPriority: PriorityLevel = 'normal';
    let draftPriorityReason = 'เรื่องทั่วไป ไม่พบรายงานความเสี่ยงเร่งด่วน';

    const hasEmergency = cluster.some((r) => r.priority === 'emergency');
    const hasNeedsReview = cluster.some((r) => r.priority === 'needs_review');

    if (hasEmergency) {
      draftPriority = 'emergency';
      const emergencyReports = cluster.filter((r) => r.priority === 'emergency');
      const emergCount = emergencyReports.length;
      draftPriorityReason = emergCount === cluster.length
        ? 'ทุกคำร้องในกลุ่มเป็นระดับฉุกเฉินเร่งด่วน'
        : `พบคำร้องระดับฉุกเฉิน ${emergCount} จาก ${cluster.length} รายการ`;
    } else if (hasNeedsReview) {
      draftPriority = 'needs_review';
      draftPriorityReason = 'มีคำร้องในกลุ่มที่ข้อมูลยังไม่ชัดเจน ควรให้เจ้าหน้าที่ตรวจสอบความเร่งด่วนร่วมกัน';
    }

    // Time window calculation
    const timestamps = cluster.map((r) => new Date(r.created_at).getTime()).filter((t) => !isNaN(t));
    const earliestTime = Math.min(...timestamps);
    const latestTime = Math.max(...timestamps);
    const timeSpanHours = Math.max(0, Math.round(((latestTime - earliestTime) / (1000 * 60 * 60)) * 10) / 10);

    // Physical spatial anchor synthesis
    const clusterLocations = cluster.map((r) => r.location || '').filter(Boolean);
    const clusterDescs = cluster.map((r) => r.description || '').filter(Boolean);
    const clusterAnchor = extractSpatialAnchor(clusterLocations.join(' '), clusterDescs.join(' '));

    // Gather concrete evidence
    const evidenceSet = new Set<string>();
    const diffSet = new Set<string>();
    let pairScoreSum = 0;
    let pairScoreCount = 0;

    for (let ci = 0; ci < cluster.length; ci++) {
      for (let cj = ci + 1; cj < cluster.length; cj++) {
        const idEval = evaluateIncidentIdentity(cluster[ci], cluster[cj]);
        idEval.evidence.forEach((ev) => evidenceSet.add(ev));
        idEval.differences.forEach((df) => diffSet.add(df));
        pairScoreSum += idEval.ruleScore;
        pairScoreCount++;
      }
    }

    const computedScore = pairScoreCount > 0 ? Math.round(pairScoreSum / pairScoreCount) : 80;

    // Add high-level evidence summary
    if (clusterAnchor.summary && clusterAnchor.summary !== 'ไม่ระบุสถานที่ชัดเจน') {
      evidenceSet.add(`สถานที่เกิดเหตุทางกายภาพตรงกัน: ${clusterAnchor.summary} (${clusterAnchor.granularity})`);
    }
    evidenceSet.add(`เกิดขึ้นต่อเนื่องในช่วงเวลาห่างกันไม่เกิน ${timeSpanHours} ชั่วโมง`);

    const sharedCause = extractProbableRootCause(clusterDescs.join(' '));
    if (sharedCause) {
      evidenceSet.add(`เหตุการณ์มีสาเหตุร่วม: ${sharedCause}`);
    }

    // Watchpoints / differences
    const locations = Array.from(new Set(clusterLocations));
    if (locations.length > 1) {
      diffSet.add(`ระบุข้อความสถานที่ย่อยต่างกันเล็กน้อย (${locations.join(' vs ')})`);
    }

    // Identify Insufficient Evidence Reports from remaining ungrouped pool
    // (reports matching domain and time window, but lacking clear location)
    const clusterEntity = extractSystemEntity(clusterDescs[0] || '', clusterLocations[0] || '', cluster[0].subcategory_id);
    const insufficientReports: ProposedReportItem[] = [];

    for (let k = 0; k < n; k++) {
      if (clusteredIndices.has(k)) continue;
      const candidate = eligibleReports[k];
      const candEntity = extractSystemEntity(candidate.description || '', candidate.location || '', candidate.subcategory_id);

      if (candEntity === clusterEntity && candidate.category_id === cluster[0].category_id) {
        const candTime = new Date(candidate.created_at).getTime();
        const timeDiff = Math.abs(candTime - earliestTime) / (1000 * 60 * 60);
        if (timeDiff <= 12) {
          const candAnchor = extractSpatialAnchor(candidate.location || '', candidate.description || '');
          if (candAnchor.granularity === 'campus_vague' || candAnchor.granularity === 'unspecified') {
            insufficientReports.push(candidate);
          }
        }
      }
    }

    // Check against existing groups
    const suggestedExistingGroups: GroupCorrelationResult[] = [];
    for (const group of existingGroups) {
      const evalRes = evaluateReportAgainstGroup(cluster[0], group);
      if (evalRes.score >= 45) {
        suggestedExistingGroups.push(evalRes);
      }
    }
    suggestedExistingGroups.sort((a, b) => b.score - a.score);

    const proposedTitle = synthesizeDraftTitle(cluster);
    const proposedDescription = `ร่างข้อเสนอรวมกลุ่มเหตุการณ์อัตโนมัติจาก ${cluster.length} คำร้อง ในช่วงเวลา ${timeSpanHours} ชั่วโมง (คะแนนกฎ: ${computedScore}%)`;

    drafts.push({
      draftId,
      proposedTitle,
      proposedDescription,
      priority: draftPriority,
      priorityReason: draftPriorityReason,
      category_id: cluster[0].category_id ?? null,
      subcategory_id: cluster[0].subcategory_id ?? null,
      categoryName: cluster[0].categoryName,
      subcategoryName: cluster[0].subcategoryName,
      reportCount: cluster.length,
      reports: cluster,
      earliestReportDate: new Date(earliestTime).toISOString(),
      latestReportDate: new Date(latestTime).toISOString(),
      timeSpanHours,
      correlationScore: computedScore,
      reasons: Array.from(evidenceSet).slice(0, 4),
      evidence: Array.from(evidenceSet),
      differences: Array.from(diffSet),
      locationSummary: clusterAnchor.summary,
      spatialGranularity: clusterAnchor.granularity,
      sharedRootCause: sharedCause,
      insufficientEvidenceReports: insufficientReports.slice(0, 5),
      suggestedExistingGroups,
      conflicts: Array.from(diffSet),
      isEmergency: draftPriority === 'emergency',
    });
  }

  // Sort drafts: Emergencies first, then by reportCount descending
  drafts.sort((a, b) => {
    if (a.isEmergency && !b.isEmergency) return -1;
    if (!a.isEmergency && b.isEmergency) return 1;
    return b.reportCount - a.reportCount;
  });

  return drafts;
}
