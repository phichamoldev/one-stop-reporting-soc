/**
 * Incident Detector Service
 * 
 * Automatically detects correlations between a target report and:
 *  1. Ungrouped reports (candidates for a new incident group)
 *  2. Currently open incident groups (candidate for adding to open incident)
 *  3. Past / closed incident groups (candidate for recurring problem analysis)
 * 
 * Builds on top of Step 2 Similarity Engine (similarityDetector.ts).
 */

import {
  ReportItem,
  findSimilarReports,
  SimilarityResult,
  calculateLocationSimilarity,
  calculateTimeSimilarity,
  extractLandmark,
  calculateTextSimilarity,
  extractSpatialAnchor,
  extractSystemEntity,
  detectIncidentContradiction,
} from './similarityDetector';

export interface IncidentGroupItem {
  id: string;
  group_code: string;
  title: string;
  description?: string | null;
  category_id?: number | null;
  status: 'open' | 'resolved' | 'closed';
  created_at: string | Date;
  updated_at?: string | Date;
  memberReports?: ReportItem[];
  memberCount?: number;
}

export interface GroupCorrelationResult {
  group: IncidentGroupItem;
  score: number;              // 0 - 100
  confidence: 'high' | 'medium' | 'low';
  confidenceLabel: string;
  reasons: string[];
  isPastIncident: boolean;    // true if status === 'resolved' | 'closed'
  matchedMemberPublicId?: string;
}

export interface IncidentDetectionSummary {
  targetReport: ReportItem;
  relatedUngroupedReports: SimilarityResult[];
  candidateExistingGroups: GroupCorrelationResult[];
  suggestedAction: 'link_to_existing_group' | 'create_new_group_draft' | 'no_grouping_needed';
  primaryRecommendationReason: string;
}

/**
 * Evaluates similarity between a single target report and an existing incident group
 */
export function evaluateReportAgainstGroup(
  report: ReportItem,
  group: IncidentGroupItem
): GroupCorrelationResult {
  const reasons: string[] = [];
  const isPastIncident = group.status === 'closed' || group.status === 'resolved';

  // 1. Category check
  let categoryScore = 0;
  if (group.category_id != null && report.category_id != null) {
    if (group.category_id === report.category_id) {
      categoryScore = 35;
      reasons.push('หมวดหมู่หลักตรงกับกลุ่มเหตุการณ์');
    } else {
      categoryScore = 0;
      reasons.push('คนละหมวดหมู่หลักกับกลุ่มเหตุการณ์');
    }
  } else {
    categoryScore = 15;
    reasons.push('ไม่ได้ระบุหมวดหมู่กลุ่มชัดเจน');
  }

  // 2. Location match
  let bestLocScore = 0;
  let bestLocReason = 'สถานที่ต่างกัน';

  const groupText = `${group.title} ${group.description || ''}`;
  const repLandmark = extractLandmark(report.location || '');
  const groupLandmark = extractLandmark(groupText);

  if (groupLandmark && repLandmark) {
    if (groupLandmark === repLandmark) {
      bestLocScore = 0.9;
      bestLocReason = `สถานที่ทางกายภาพตรงกัน (${groupLandmark})`;
    } else {
      bestLocScore = 0.0;
      bestLocReason = `คนละสถานที่ทางกายภาพ (${repLandmark} กับกลุ่ม ${groupLandmark})`;
    }
  } else {
    const locSim = calculateLocationSimilarity(report.location || '', group.title || '');
    bestLocScore = locSim.score;
    bestLocReason = locSim.reason;
  }

  // Also compare with group members if available
  let matchedMemberPublicId: string | undefined = undefined;
  if (group.memberReports && group.memberReports.length > 0) {
    for (const member of group.memberReports) {
      const memberLocSim = calculateLocationSimilarity(report.location || '', member.location || '');
      if (memberLocSim.score > bestLocScore) {
        bestLocScore = memberLocSim.score;
        bestLocReason = `สถานที่ตรงกับคำร้องสมาชิก ${member.public_id} (${memberLocSim.reason})`;
        matchedMemberPublicId = member.public_id;
      }
    }
  }

  const locationScore = Math.round(bestLocScore * 25);
  reasons.push(`สถานที่: ${bestLocReason}`);

  // 3. Time window check
  const timeEval = calculateTimeSimilarity(report.created_at, group.created_at);
  let timeScore = Math.round(timeEval.score * 20);

  if (isPastIncident) {
    reasons.push(`กลุ่มเดิมที่เคยเกิดขึ้น (${group.group_code}): ${timeEval.reason}`);
    timeScore = Math.min(timeScore, 10);
  } else {
    reasons.push(`กรอบเวลากลุ่ม: ${timeEval.reason}`);
  }

  // 4. Text description match with group title & summary
  const textSim = calculateTextSimilarity(report.description || '', groupText);
  const textScore = Math.round(textSim * 20);
  if (textSim >= 0.4) {
    reasons.push(`ข้อความคำร้องตรงกับหัวข้อกลุ่ม ${Math.round(textSim * 100)}%`);
  } else if (textSim >= 0.15) {
    reasons.push(`ข้อความมีคำสำคัญตรงกับกลุ่ม (${Math.round(textSim * 100)}%)`);
  }

  // 5. Contradiction check against representative group report or title
  const repAnchor = extractSpatialAnchor(report.location || '', report.description || '');
  const groupAnchor = extractSpatialAnchor(group.title, group.description || '');
  const repEntity = extractSystemEntity(report.description || '', report.location || '', report.subcategory_id);
  const groupEntity = extractSystemEntity(groupText, group.title, group.category_id);

  let hasContradiction = false;
  // Room mismatch between localized report and group
  if (
    repAnchor.room &&
    groupAnchor.room &&
    repAnchor.room !== groupAnchor.room &&
    ['hvac_cooling', 'electrical_routine', 'it_av'].includes(repEntity)
  ) {
    hasContradiction = true;
    reasons.push(`[ข้อขัดแย้ง] คนละห้อง (กลุ่ม: ห้อง ${groupAnchor.room} vs คำร้อง: ห้อง ${repAnchor.room})`);
  }

  const groupDummy: ReportItem = {
    public_id: group.group_code,
    category_id: group.category_id,
    location: group.title,
    description: group.description,
    created_at: group.created_at,
  };
  const contraCheck = detectIncidentContradiction(report, groupDummy);
  if (contraCheck.isContradiction) {
    hasContradiction = true;
    contraCheck.reasons.forEach((r) => {
      if (!reasons.includes(`[ข้อขัดแย้ง] ${r}`)) {
        reasons.push(`[ข้อขัดแย้ง] ${r}`);
      }
    });
  }

  let rawTotal = categoryScore + locationScore + timeScore + textScore;

  if (categoryScore === 0) {
    rawTotal = Math.min(rawTotal, 20);
  }

  if (bestLocScore === 0.0) {
    rawTotal = Math.min(rawTotal, 25);
  }

  if (hasContradiction) {
    rawTotal = Math.min(rawTotal, 15);
  }

  const finalScore = Math.min(100, Math.max(0, rawTotal));

  let confidence: 'high' | 'medium' | 'low' = 'low';
  let confidenceLabel = 'หลักฐานไม่เพียงพอ';

  if (!hasContradiction && finalScore >= 75 && bestLocScore >= 0.7 && categoryScore >= 20) {
    confidence = 'high';
    confidenceLabel = isPastIncident
      ? 'มีแนวโน้มสูงว่าเป็นเหตุการณ์ซ้ำกับกลุ่มเดิมที่ปิดแล้ว (เสนอตรวจสอบ)'
      : 'มีแนวโน้มสูงว่าเป็นส่วนหนึ่งของกลุ่มเหตุการณ์นี้';
  } else if (!hasContradiction && finalScore >= 50 && bestLocScore >= 0.4) {
    confidence = 'medium';
    confidenceLabel = isPastIncident
      ? 'อาจมีความเกี่ยวข้องกับกลุ่มเดิมในอดีต (ควรตรวจสอบ)'
      : 'มีความเกี่ยวข้องกับกลุ่มเหตุการณ์นี้ (ควรพิจารณาเชื่อมโยง)';
  }

  return {
    group,
    score: finalScore,
    confidence,
    confidenceLabel,
    reasons,
    isPastIncident,
    matchedMemberPublicId,
  };
}

/**
 * Main Detection Engine for a target report
 */
export function detectIncidentCorrelations(
  targetReport: ReportItem,
  context: {
    ungroupedReports: ReportItem[];
    openGroups: IncidentGroupItem[];
    closedGroups?: IncidentGroupItem[];
  }
): IncidentDetectionSummary {
  const { ungroupedReports, openGroups, closedGroups = [] } = context;

  // 1. Find similar ungrouped reports
  const relatedUngroupedReports = findSimilarReports(targetReport, ungroupedReports, {
    minScore: 45,
    limit: 10,
  });

  // 2. Correlate with existing groups (both open and closed)
  const candidateExistingGroups: GroupCorrelationResult[] = [];

  for (const group of openGroups) {
    const evalRes = evaluateReportAgainstGroup(targetReport, group);
    if (evalRes.score >= 45) {
      candidateExistingGroups.push(evalRes);
    }
  }

  for (const group of closedGroups) {
    const evalRes = evaluateReportAgainstGroup(targetReport, group);
    if (evalRes.score >= 50) {
      candidateExistingGroups.push(evalRes);
    }
  }

  // Sort groups descending by score
  candidateExistingGroups.sort((a, b) => b.score - a.score);

  // 3. Synthesize Primary Recommendation
  let suggestedAction: IncidentDetectionSummary['suggestedAction'] = 'no_grouping_needed';
  let primaryRecommendationReason = 'ยังไม่พบความสัมพันธ์ชัดเจนกับกลุ่มเหตุการณ์หรือคำร้องอื่น';

  const bestOpenGroup = candidateExistingGroups.find((g) => !g.isPastIncident && g.confidence === 'high');
  const bestMediumOpenGroup = candidateExistingGroups.find((g) => !g.isPastIncident && g.confidence === 'medium');
  const highUngroupedCount = relatedUngroupedReports.filter((r) => r.confidence === 'high').length;

  if (bestOpenGroup) {
    suggestedAction = 'link_to_existing_group';
    primaryRecommendationReason = `เสนอให้เชื่อมโยงเข้ากลุ่มเหตุการณ์เปิดอยู่ ${bestOpenGroup.group.group_code} (${bestOpenGroup.group.title}) เนื่องจากสถานที่และปัญหาสอดคล้องกัน`;
  } else if (highUngroupedCount >= 1 || relatedUngroupedReports.length >= 2) {
    suggestedAction = 'create_new_group_draft';
    primaryRecommendationReason = `พบคำร้องใหม่ที่มีความคล้ายคลึงกัน ${relatedUngroupedReports.length} รายการ เสนอจัดทำร่างกลุ่มเหตุการณ์ใหม่`;
  } else if (bestMediumOpenGroup) {
    suggestedAction = 'link_to_existing_group';
    primaryRecommendationReason = `อาจเกี่ยวข้องกับกลุ่มเหตุการณ์ ${bestMediumOpenGroup.group.group_code} (แนะนำให้เจ้าหน้าที่ตรวจสอบก่อนรวมกลุ่ม)`;
  }

  return {
    targetReport,
    relatedUngroupedReports,
    candidateExistingGroups,
    suggestedAction,
    primaryRecommendationReason,
  };
}
