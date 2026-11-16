"use client";

import React, { useState, useEffect, useSyncExternalStore, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { fetcherWithAuth } from '@/lib/fetcher';
import { supabase } from '@/lib/supabase';
import { StatusBadge } from "@/components/design-system/StatusBadge";
import { 
  Layers, 
  MapPin, 
  Calendar, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Eye,
  PlusCircle,
  Link as LinkIcon,
  X,
  ArrowRight,
  ShieldAlert,
  Info,
  CheckSquare,
  Square,
  MessageSquare,
  UploadCloud,
  ImageOff,
  RotateCcw,
  Check,
  Send,
  Loader2
} from 'lucide-react';
import { ReportStatus, STATUS_DETAILS } from '@/types/report';
import { localizeConflictReason } from '@/lib/conflictLocalization';
import { detectIncidentContradiction } from '@/lib/similarityDetector';
import { ReportDetailView } from '@/components/backoffice/ReportDetailView';
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

interface SimilarReportsCardProps {
  publicId: string;
  userRole?: string;
}

interface SuggestionReport {
  public_id: string;
  categoryName: string;
  subcategoryName: string;
  location: string;
  description: string;
  status: ReportStatus;
  created_at: string;
}

interface ScoreBreakdown {
  categoryScore: number;
  locationScore: number;
  timeScore: number;
  textScore: number;
  totalScore: number;
}

export interface CandidateIncidentGroup {
  id: string;
  group_code: string;
  title: string;
  status: 'open' | 'resolved' | 'closed';
}

export interface CandidateGroupCorrelation {
  id?: string;
  group: CandidateIncidentGroup;
  score: number;
  confidence?: 'high' | 'medium' | 'low';
  confidenceLabel?: string;
  reasons: string[];
  isPastIncident?: boolean;
}

interface SuggestionItem {
  public_id: string;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  confidenceLabel: string;
  reasons: string[];
  differences?: string[];
  evidence?: string[];
  candidateDecision?: string;
  isSameIncidentCandidate?: boolean;
  incidentGroup?: CandidateIncidentGroup | null;
  breakdown: ScoreBreakdown;
  isPersonalPropertyDuplicate: boolean;
  report: SuggestionReport;
}

interface SimilarAPIResponse {
  success: boolean;
  target?: {
    public_id: string;
    category_id?: number | null;
    subcategory_id?: number | null;
    categoryName?: string;
    subcategoryName?: string;
    location?: string;
    description?: string;
    created_at?: string;
    status?: ReportStatus;
  };
  similarSuggestions: SuggestionItem[];
  summary: {
    totalEvaluated: number;
    matchesFound: number;
    highTendencyCount: number;
    similarCount: number;
  };
}

export type RelatedRequestType = 'similar_not_grouped' | 'matching_existing_group' | 'already_grouped';

export interface ClassifiedRelation {
  type: RelatedRequestType;
  typeLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  actualGroup: CandidateIncidentGroup | null;
  suggestedGroup: CandidateIncidentGroup | null;
  isSameAsCurrentGroup: boolean;
  isInOtherGroup: boolean;
  isClosed: boolean;
  suggestedReason?: string;
}

export function getRelatedItemClassification(
  item: SuggestionItem,
  currentIncident: CandidateIncidentGroup | null,
  topCandidateGroup: { group: CandidateIncidentGroup; score: number } | null
): ClassifiedRelation {
  // Case 3: Already Grouped (คำร้องที่รวมกลุ่มแล้ว)
  // Has actual recorded group in database
  if (item.incidentGroup) {
    const isSameAsCurrentGroup = Boolean(currentIncident && item.incidentGroup.id === currentIncident.id);
    const isClosed = item.incidentGroup.status === 'closed';
    return {
      type: 'already_grouped',
      typeLabel: isSameAsCurrentGroup ? 'รวมกลุ่มนี้แล้ว' : 'รวมกลุ่มแล้ว',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
      badgeText: 'text-emerald-700 dark:text-emerald-300',
      badgeBorder: 'border-emerald-200 dark:border-emerald-800',
      actualGroup: item.incidentGroup,
      suggestedGroup: null,
      isSameAsCurrentGroup,
      isInOtherGroup: !isSameAsCurrentGroup,
      isClosed,
    };
  }

  // Case 2: New Request Matching an Existing Incident Group (คำร้องใหม่ที่คล้ายกับ Incident Group เดิม)
  // Candidate item itself is not grouped yet, but an incident group is available:
  if (currentIncident) {
    const isClosed = currentIncident.status === 'closed';
    return {
      type: 'matching_existing_group',
      typeLabel: 'พบกลุ่มที่อาจเกี่ยวข้อง',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
      badgeText: 'text-amber-700 dark:text-amber-300',
      badgeBorder: 'border-amber-200 dark:border-amber-800',
      actualGroup: null,
      suggestedGroup: currentIncident,
      isSameAsCurrentGroup: false,
      isInOtherGroup: false,
      isClosed,
      suggestedReason: `คำร้องนี้มีความคล้ายคลึงกับคำร้องหลักในกลุ่ม ${currentIncident.group_code}`,
    };
  }

  if (topCandidateGroup && topCandidateGroup.group && topCandidateGroup.score >= 45) {
    const isClosed = topCandidateGroup.group.status === 'closed';
    return {
      type: 'matching_existing_group',
      typeLabel: 'พบกลุ่มที่อาจเกี่ยวข้อง',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
      badgeText: 'text-amber-700 dark:text-amber-300',
      badgeBorder: 'border-amber-200 dark:border-amber-800',
      actualGroup: null,
      suggestedGroup: topCandidateGroup.group,
      isSameAsCurrentGroup: false,
      isInOtherGroup: false,
      isClosed,
      suggestedReason: `ตรวจพบกลุ่มเหตุการณ์ที่มีปัญหาและสถานที่ใกล้เคียงกัน (${topCandidateGroup.score}% match)`,
    };
  }

  // Case 1: Similar but Not Grouped (คำร้องคล้ายกัน แต่ยังไม่ได้รวมกลุ่ม)
  return {
    type: 'similar_not_grouped',
    typeLabel: 'ยังไม่ได้รวมกลุ่ม',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/40',
    badgeText: 'text-blue-700 dark:text-blue-300',
    badgeBorder: 'border-blue-200 dark:border-blue-800',
    actualGroup: null,
    suggestedGroup: null,
    isSameAsCurrentGroup: false,
    isInOtherGroup: false,
    isClosed: false,
  };
}

/**
 * Filter and compute strictly eligible similar candidates for Bulk Reply & Auto-Grouping Toolbar (Phase 4).
 * Candidate Counting Rules:
 * 1. Do not count anchor request itself
 * 2. Deduplicate candidate IDs
 * 3. Do not count reports in current confirmed incident group
 * 4. Do not count reports belonging to other incident groups
 * 6. Must meet similarity threshold (score >= 45) and pass contradiction check
 * 7 & 8. Must match active filter/search
 */
export function getEligibleSimilarCandidates(
  suggestions: SuggestionItem[],
  anchorReport: {
    public_id: string;
    category_id?: number | null;
    subcategory_id?: number | null;
    location?: string | null;
    description?: string | null;
    created_at?: string;
  } | null,
  activeFilter: 'all' | RelatedRequestType = 'all'
): SuggestionItem[] {
  if (!suggestions || suggestions.length === 0 || !anchorReport) return [];

  const seenIds = new Set<string>();
  const eligible: SuggestionItem[] = [];

  for (const item of suggestions) {
    // 1. Not anchor report itself
    if (!item.public_id || item.public_id === anchorReport.public_id) continue;

    // 2. Not duplicate candidate ID
    if (seenIds.has(item.public_id)) continue;
    seenIds.add(item.public_id);

    // 3 & 4. Must not already belong to any confirmed incident group
    if (item.incidentGroup) continue;

    // 6. Similarity score threshold (>= 45)
    if ((item.score ?? 0) < 45) continue;

    // Contradiction check against anchor report
    const targetRepItem = {
      id: "anchor",
      public_id: anchorReport.public_id,
      category_id: anchorReport.category_id || 1,
      subcategory_id: anchorReport.subcategory_id || 1,
      location: anchorReport.location || "",
      description: anchorReport.description || "",
      created_at: anchorReport.created_at || new Date().toISOString()
    };
    const candRepItem = {
      id: item.public_id,
      public_id: item.public_id,
      category_id: 1,
      subcategory_id: 1,
      location: item.report.location || "",
      description: item.report.description || "",
      created_at: item.report.created_at
    };
    const contra = detectIncidentContradiction(targetRepItem, candRepItem);
    if (contra.isContradiction) continue;

    // 7 & 8. Active filter check
    if (activeFilter !== 'all' && activeFilter !== 'similar_not_grouped') {
      continue;
    }

    eligible.push(item);
  }

  return eligible;
}

export function filterAndDeduplicateCandidateGroups(
  candidateGroups: CandidateGroupCorrelation[] | undefined,
  currentIncident: CandidateIncidentGroup | null
): CandidateGroupCorrelation[] {
  if (currentIncident || !candidateGroups || candidateGroups.length === 0) return [];
  const seenGroupIds = new Set<string>();
  const uniqueGroups: CandidateGroupCorrelation[] = [];

  for (const cg of candidateGroups) {
    const gId = cg.group?.id || cg.id;
    if (!gId || seenGroupIds.has(gId)) continue;
    if ((cg.score ?? 0) >= 45) {
      seenGroupIds.add(gId);
      uniqueGroups.push(cg);
    }
  }
  return uniqueGroups;
}

export function computeRelatedRequestsDisplayCase(
  currentIncident: CandidateIncidentGroup | null,
  relevantCandidateGroups: CandidateGroupCorrelation[]
): { isCaseA: boolean; isCaseB: boolean; isCaseC: boolean; activeCase: 'A' | 'B' | 'C' } {
  const isCaseA = Boolean(currentIncident);
  const isCaseB = !isCaseA && relevantCandidateGroups.length > 0;
  const isCaseC = !isCaseA && !isCaseB;
  return {
    isCaseA,
    isCaseB,
    isCaseC,
    activeCase: isCaseA ? 'A' : isCaseB ? 'B' : 'C',
  };
}

function generateUploadFileName(fileExt: string) {
  const randomFileToken = Math.random().toString(36).substring(2, 12);
  const isTestEnv = process.env.NEXT_PUBLIC_REPORT_DATA_SOURCE === "test";
  const folderPrefix = isTestEnv ? "test/" : "";
  return `${folderPrefix}${Date.now()}-${randomFileToken}.${fileExt}`;
}

export const SimilarReportsCard: React.FC<SimilarReportsCardProps> = ({ publicId, userRole }) => {
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [quickViewPublicId, setQuickViewPublicId] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Single Action Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createSelectedReportIds, setCreateSelectedReportIds] = useState<string[]>([]);
  const [createSupportingReasons, setCreateSupportingReasons] = useState<string[]>([]);
  const [createDifferences, setCreateDifferences] = useState<string[]>([]);

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkTargetGroup, setLinkTargetGroup] = useState<CandidateIncidentGroup | null>(null);
  const [linkReportPublicId, setLinkReportPublicId] = useState<string>('');
  const [linkReasons, setLinkReasons] = useState<string[]>([]);
  const [linkDifferences, setLinkDifferences] = useState<string[]>([]);

  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveReportPublicId, setMoveReportPublicId] = useState<string>('');
  const [moveCurrentGroup, setMoveCurrentGroup] = useState<{ group_code: string; title: string } | null>(null);
  const [moveTargetGroup, setMoveTargetGroup] = useState<CandidateIncidentGroup | null>(null);
  const [moveNotes, setMoveNotes] = useState<string>('');

  // =========================================================================
  // Bulk Action Workflow States
  // =========================================================================
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([publicId]);
  const [bulkFormOpen, setBulkFormOpen] = useState(false);
  const [bulkTargetStatus, setBulkTargetStatus] = useState<string>('');
  const [bulkReplyMessage, setBulkReplyMessage] = useState<string>('');
  const [bulkImage, setBulkImage] = useState<File | null>(null);
  const [bulkImagePreview, setBulkImagePreview] = useState<string | null>(null);
  const [bulkAutoGroup, setBulkAutoGroup] = useState<boolean>(true);

  // Bulk Modals
  const [bulkConfirmModalOpen, setBulkConfirmModalOpen] = useState(false);
  const [bulkResultModalOpen, setBulkResultModalOpen] = useState(false);
  const [bulkResponseData, setBulkResponseData] = useState<BulkActionResponse | null>(null);

  // Fetch similar suggestions
  const { data, isLoading, mutate: mutateSimilar } = useSWR<SimilarAPIResponse>(
    publicId ? `/api/reports/${publicId}/similar` : null,
    fetcherWithAuth,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000
    }
  );

  // Fetch current report's incident group membership
  const { data: incidentRes, error: incidentError, isLoading: isIncidentLoading, mutate: mutateIncident } = useSWR(
    publicId ? `/api/reports/${publicId}/incident` : null,
    fetcherWithAuth,
    { dedupingInterval: 30000 }
  );

  const isGroupCheckUnavailable = Boolean(incidentError);
  const currentIncident = incidentRes?.incidentGroup as CandidateIncidentGroup | null;

  // Fetch candidate existing groups if current report is not grouped
  const { data: existingGroupsRes, mutate: mutateExistingGroups } = useSWR(
    publicId && !currentIncident ? `/api/incidents/search-existing?reportPublicId=${publicId}` : null,
    fetcherWithAuth,
    { dedupingInterval: 30000 }
  );


  const candidateGroups: CandidateGroupCorrelation[] = existingGroupsRes?.groups || [];

  // Deduplicate candidate groups by Group ID and filter by matching relevance score >= 45 (Phase 2 Case B)
  const relevantCandidateGroups = useMemo(() => {
    return filterAndDeduplicateCandidateGroups(candidateGroups, currentIncident);
  }, [currentIncident, candidateGroups]);

  const topCandidateGroup = relevantCandidateGroups.length > 0 ? relevantCandidateGroups[0] : null;

  // The Three Mutually Exclusive Display Cases (Phase 2)
  // Case A: Request Already Belongs to a Confirmed Incident Group
  // Case B: Request Is Ungrouped but Related to an Existing Incident Group
  // Case C: Request Is Ungrouped and Has No Related Existing Group
  const { isCaseA, isCaseB, isCaseC } = useMemo(
    () => computeRelatedRequestsDisplayCase(currentIncident, relevantCandidateGroups),
    [currentIncident, relevantCandidateGroups]
  );

  // Category Filter Tab State ('all' | 'similar_not_grouped' | 'matching_existing_group' | 'already_grouped')
  const [filterType, setFilterType] = useState<'all' | RelatedRequestType>('all');

  // Keyboard escape listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (quickViewPublicId) setQuickViewPublicId(null);
        if (createModalOpen) setCreateModalOpen(false);
        if (linkModalOpen) setLinkModalOpen(false);
        if (moveModalOpen) setMoveModalOpen(false);
        if (bulkConfirmModalOpen) setBulkConfirmModalOpen(false);
        if (bulkResultModalOpen) setBulkResultModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quickViewPublicId, createModalOpen, linkModalOpen, moveModalOpen, bulkConfirmModalOpen, bulkResultModalOpen]);

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const suggestions = useMemo(() => data?.similarSuggestions || [], [data?.similarSuggestions]);
  const summary = data?.summary;

  // Compute classified relation for all suggestions (Phase 2 & 3)
  const classifiedSuggestions = useMemo(() => {
    return suggestions.map(item => ({
      item,
      relation: getRelatedItemClassification(item, currentIncident, topCandidateGroup)
    }));
  }, [suggestions, currentIncident, topCandidateGroup]);

  // Compute strictly eligible similar candidates for Bulk Toolbar (Phase 4)
  const eligibleSimilarCandidates = useMemo(() => {
    if (!isCaseC) return [];
    return getEligibleSimilarCandidates(suggestions, data?.target || null, filterType);
  }, [isCaseC, suggestions, data?.target, filterType]);

  // Display Condition: แสดง Bulk Reply & Auto-Grouping Toolbar เมื่อ:
  // นับรวมคำร้องต้นทาง (1) + คำร้องที่คล้ายกันที่ผ่านเกณฑ์ (eligibleSimilarCandidates) มีอย่างน้อย 2 รายการ
  // นั่นคือ เมื่อพบ candidate อย่างน้อย 1 รายการ
  const totalGroupableCount = 1 + eligibleSimilarCandidates.length;
  const canShowBulkToolbar = isCaseC && eligibleSimilarCandidates.length >= 1;

  const type1Count = useMemo(() => classifiedSuggestions.filter(c => c.relation.type === 'similar_not_grouped').length, [classifiedSuggestions]);
  const type2Count = useMemo(() => classifiedSuggestions.filter(c => c.relation.type === 'matching_existing_group').length, [classifiedSuggestions]);
  const type3Count = useMemo(() => classifiedSuggestions.filter(c => c.relation.type === 'already_grouped').length, [classifiedSuggestions]);

  const filteredItems = useMemo(() => {
    if (filterType === 'all') return classifiedSuggestions;
    return classifiedSuggestions.filter(c => c.relation.type === filterType);
  }, [classifiedSuggestions, filterType]);

  const displayedItems = filteredItems.slice(0, displayLimit);
  const hasMore = filteredItems.length > displayLimit;

  // Auto clean-up selection when eligible candidates count drops < 1 or items change
  useEffect(() => {
    if (!canShowBulkToolbar) {
      setSelectedReportIds([publicId]);
      if (bulkFormOpen) setBulkFormOpen(false);
    } else {
      const allowedIds = new Set([publicId, ...eligibleSimilarCandidates.map(c => c.public_id)]);
      setSelectedReportIds(prev => {
        const filtered = prev.filter(id => allowedIds.has(id));
        return filtered.includes(publicId) ? filtered : [publicId, ...filtered];
      });
    }
  }, [canShowBulkToolbar, eligibleSimilarCandidates, publicId, bulkFormOpen]);

  // Selection handlers: only allows toggling eligible candidates (source report is always locked in selection)
  const toggleSelectReport = (pId: string) => {
    if (!canShowBulkToolbar) return;
    if (pId === publicId) return; // Source report is always kept in grouping selection

    const isEligible = eligibleSimilarCandidates.some(c => c.public_id === pId);
    if (!isEligible) return;

    setSelectedReportIds(prev => {
      if (prev.includes(pId)) {
        return prev.filter(id => id !== pId);
      } else {
        return [...prev, pId];
      }
    });
  };

  const handleSelectAll = () => {
    if (!canShowBulkToolbar) return;
    const allIds = [publicId, ...eligibleSimilarCandidates.map(s => s.public_id)];
    setSelectedReportIds(Array.from(new Set(allIds)));
  };

  const handleDeselectAll = () => {
    setSelectedReportIds([publicId]);
  };

  // Image upload handler
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setActionErrorMsg("ขนาดรูปภาพต้องไม่เกิน 5MB");
        return;
      }
      setBulkImage(file);
      const url = URL.createObjectURL(file);
      setBulkImagePreview(url);
    }
  };

  const removeBulkImage = () => {
    setBulkImage(null);
    if (bulkImagePreview) {
      URL.revokeObjectURL(bulkImagePreview);
      setBulkImagePreview(null);
    }
  };

  // Open Bulk Confirmation Modal
  const handleOpenBulkConfirm = () => {
    if (bulkAutoGroup && selectedReportIds.length < 2) {
      setActionErrorMsg("การจัดกลุ่มเหตุการณ์ต้องมีคำร้องอย่างน้อย 2 รายการ (คำร้องต้นทาง + คำร้องที่คล้ายกันอย่างน้อย 1 รายการ)");
      return;
    }
    if (selectedReportIds.length === 0) {
      setActionErrorMsg("กรุณาเลือกคำร้องอย่างน้อย 1 รายการ");
      return;
    }
    if (!bulkTargetStatus && !bulkReplyMessage.trim() && !bulkImage) {
      setActionErrorMsg("กรุณาเลือกสถานะคำร้อง หรือกรอกข้อความตอบกลับ");
      return;
    }
    setActionErrorMsg(null);
    setBulkConfirmModalOpen(true);
  };

  // Execute Bulk Action
  const handleExecuteBulkAction = async (retryPublicIds?: string[]) => {
    const idsToProcess = retryPublicIds || selectedReportIds;
    if (idsToProcess.length === 0) return;

    try {
      setIsSubmitting(true);
      setActionErrorMsg(null);

      let uploadedImageUrl: string | null = null;
      if (bulkImage) {
        const fileExt = bulkImage.name.split('.').pop() || 'jpg';
        const fileName = generateUploadFileName(fileExt);
        const { error: uploadError } = await supabase.storage
          .from('report-images')
          .upload(fileName, bulkImage, { cacheControl: '3600', upsert: false });

        if (uploadError) {
          throw new Error('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพแนบ');
        }
        const { data: imgData } = supabase.storage.from('report-images').getPublicUrl(fileName);
        uploadedImageUrl = imgData.publicUrl;
      }

      const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const res: BulkActionResponse = await fetcherWithAuth('/api/reports/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicIds: idsToProcess,
          targetStatus: bulkTargetStatus || undefined,
          replyMessage: bulkReplyMessage.trim() || undefined,
          imageUrl: uploadedImageUrl,
          autoGroup: bulkAutoGroup,
          targetGroupId: currentIncident?.id || undefined,
          idempotencyKey
        })
      });

      setBulkResponseData(res);
      setBulkConfirmModalOpen(false);
      setBulkResultModalOpen(true);

      // Revalidate data
      await Promise.all([mutateSimilar(), mutateIncident(), mutateExistingGroups()]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการดำเนินการแบบชุด";
      setActionErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Single Action Modal Handlers
  const openCreateGroupModal = (additionalReportPublicId?: string, reasons: string[] = [], diffs: string[] = []) => {
    const reportIds = [publicId];
    if (additionalReportPublicId && additionalReportPublicId !== publicId) {
      reportIds.push(additionalReportPublicId);
    }
    const defaultTitle = data?.target?.description 
      ? `เหตุการณ์: ${data.target.description.slice(0, 50).trim()}${data.target.description.length > 50 ? '...' : ''}`
      : `กลุ่มเหตุการณ์คำร้อง ${publicId}`;

    setCreateTitle(defaultTitle);
    setCreateSelectedReportIds(reportIds);
    setCreateSupportingReasons(reasons);
    setCreateDifferences(diffs);
    setActionErrorMsg(null);
    setCreateModalOpen(true);
  };

  const handleConfirmCreateGroup = async () => {
    if (!createTitle.trim()) {
      setActionErrorMsg("กรุณาระบุชื่อกลุ่มเหตุการณ์");
      return;
    }
    try {
      setIsSubmitting(true);
      setActionErrorMsg(null);
      const res = await fetcherWithAuth('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createTitle.trim(),
          category_id: data?.target?.category_id || null,
          reportPublicIds: createSelectedReportIds
        })
      });

      if (res?.success) {
        setActionSuccessMsg(`สร้างกลุ่มเหตุการณ์ ${res.incidentGroup.group_code} สำเร็จ`);
        setCreateModalOpen(false);
        await Promise.all([mutateIncident(), mutateExistingGroups(), mutateSimilar()]);
      } else {
        setActionErrorMsg(res?.error || "เกิดข้อผิดพลาดในการสร้างกลุ่มเหตุการณ์");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการสร้างกลุ่ม";
      setActionErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openLinkGroupModal = (group: CandidateIncidentGroup, targetRepId: string, reasons: string[] = [], diffs: string[] = []) => {
    setLinkTargetGroup(group);
    setLinkReportPublicId(targetRepId);
    setLinkReasons(reasons);
    setLinkDifferences(diffs);
    setActionErrorMsg(null);
    setLinkModalOpen(true);
  };

  const handleConfirmLinkGroup = async () => {
    if (!linkTargetGroup?.id || !linkReportPublicId) return;
    try {
      setIsSubmitting(true);
      setActionErrorMsg(null);

      const res = await fetcherWithAuth(`/api/incidents/${linkTargetGroup.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicIds: [linkReportPublicId],
          confirmMove: false
        })
      });

      if (res?.requiresConfirmation) {
        const conflict = res.conflicts?.[0];
        setLinkModalOpen(false);
        setMoveReportPublicId(linkReportPublicId);
        setMoveCurrentGroup({
          group_code: conflict?.current_group_code || 'กลุ่มอื่น',
          title: conflict?.current_group_title || 'กลุ่มเหตุการณ์เดิม'
        });
        setMoveTargetGroup(linkTargetGroup);
        setMoveModalOpen(true);
        return;
      }

      if (res?.success) {
        setActionSuccessMsg(`เชื่อมคำร้อง ${linkReportPublicId} เข้ากลุ่ม ${linkTargetGroup.group_code} สำเร็จ`);
        setLinkModalOpen(false);
        await Promise.all([mutateIncident(), mutateExistingGroups(), mutateSimilar()]);
      } else {
        setActionErrorMsg(res?.error || "เกิดข้อผิดพลาดในการเชื่อมคำร้องเข้ากลุ่ม");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเชื่อมกลุ่ม";
      setActionErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmMoveGroup = async () => {
    if (!moveTargetGroup?.id || !moveReportPublicId) return;
    try {
      setIsSubmitting(true);
      setActionErrorMsg(null);

      const res = await fetcherWithAuth(`/api/incidents/${moveTargetGroup.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicIds: [moveReportPublicId],
          confirmMove: true,
          notes: moveNotes || "ย้ายกลุ่มเหตุการณ์ผ่านหน้ารายละเอียดคำร้อง"
        })
      });

      if (res?.success) {
        setActionSuccessMsg(`ย้ายคำร้อง ${moveReportPublicId} เข้ากลุ่ม ${moveTargetGroup.group_code} สำเร็จ`);
        setMoveModalOpen(false);
        await Promise.all([mutateIncident(), mutateExistingGroups(), mutateSimilar()]);
      } else {
        setActionErrorMsg(res?.error || "เกิดข้อผิดพลาดในการย้ายกลุ่มเหตุการณ์");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการย้ายกลุ่ม";
      setActionErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Risk Analysis for selected reports
  const selectedCandidatesInfo = selectedReportIds.map(pId => {
    if (pId === publicId) {
      return {
        publicId: pId,
        isPrimary: true,
        description: data?.target?.description || "คำร้องหลักของหน้านี้",
        location: data?.target?.location || "-",
        status: data?.target?.status || "pending",
        relation: null as ClassifiedRelation | null,
        hasContradiction: false,
        contradictionReason: ""
      };
    }
    const cand = suggestions.find(s => s.public_id === pId);
    const candRelation = cand ? getRelatedItemClassification(cand, currentIncident, topCandidateGroup) : null;
    let contraReason = "";
    if (data?.target && cand) {
      const targetRepItem = {
        id: "anchor",
        public_id: publicId,
        category_id: data.target.category_id || 1,
        subcategory_id: data.target.subcategory_id || 1,
        location: data.target.location || "",
        description: data.target.description || "",
        created_at: data.target.created_at || new Date().toISOString()
      };
      const candRepItem = {
        id: cand.public_id,
        public_id: cand.public_id,
        category_id: cand.report.status ? 1 : 1,
        subcategory_id: 1,
        location: cand.report.location || "",
        description: cand.report.description || "",
        created_at: cand.report.created_at
      };
      const contra = detectIncidentContradiction(targetRepItem, candRepItem);
      if (contra.isContradiction) {
        contraReason = contra.reasons[0] ? localizeConflictReason(contra.reasons[0]) : "คนละเหตุการณ์";
      }
    }
    return {
      publicId: pId,
      isPrimary: false,
      description: cand?.report.description || "-",
      location: cand?.report.location || "-",
      status: cand?.report.status || "pending",
      relation: candRelation,
      hasContradiction: Boolean(contraReason),
      contradictionReason: contraReason
    };
  });

  const highRiskSelectedCount = selectedCandidatesInfo.filter(c => c.hasContradiction).length;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800/60 p-6 md:p-7 card-shadow transition-all space-y-5">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/50 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-base font-black text-slate-800 dark:text-slate-100">
                ความสัมพันธ์ของคำร้อง (Related Requests)
              </h4>
              {isIncidentLoading ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                  กำลังตรวจสอบกลุ่ม...
                </span>
              ) : currentIncident ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                  <CheckCircle2 className="w-3 h-3" />
                  อยู่ในกลุ่มเหตุการณ์แล้ว
                </span>
              ) : isGroupCheckUnavailable ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800">
                  <AlertCircle className="w-3 h-3" />
                  ไม่สามารถตรวจสอบกลุ่มได้
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                  <Layers className="w-3 h-3" />
                  ยังไม่ได้จัดกลุ่มเหตุการณ์
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">
              ตรวจสอบคำร้องที่คล้ายกันและสถานะการเชื่อมโยงกับกลุ่มเหตุการณ์ เพื่อช่วยให้เจ้าหน้าที่พิจารณาและดำเนินการได้อย่างถูกต้อง
            </p>
          </div>
        </div>

        {isCaseC && summary && summary.matchesFound > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            {summary.highTendencyCount > 0 && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/50">
                แนวโน้มสูง {summary.highTendencyCount}
              </span>
            )}
            {summary.similarCount > 0 && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50">
                คล้ายคลึง {summary.similarCount}
              </span>
            )}
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              พบ {summary.matchesFound} รายการ
            </span>
          </div>
        )}
      </div>

      {/* Action Success / Error Notifications */}
      {actionSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setActionSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {actionErrorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{actionErrorMsg}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setActionErrorMsg(null)}
            className="text-rose-600 hover:text-rose-900 dark:text-rose-400 dark:hover:text-rose-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Availability warning if group check failed (AC-12) */}
      {isGroupCheckUnavailable && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>ไม่สามารถตรวจสอบสถานะกลุ่มเหตุการณ์ล่าสุดได้ ระบบระงับปุ่มสร้างหรือเชื่อมกลุ่มชั่วคราวเพื่อป้องกันข้อผิดพลาด</span>
          </div>
          <button 
            type="button" 
            onClick={() => { mutateIncident(); mutateSimilar(); }}
            className="px-2.5 py-1 rounded-lg bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 text-[11px] font-bold hover:bg-amber-300 transition-colors cursor-pointer shrink-0"
          >
            รีเฟรชข้อมูล
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CASE A: Request Already Belongs to a Confirmed Incident Group            */}
      {/* Condition: currentIncident != null                                        */}
      {/* Displays ONLY concise group status card with link to incident page.      */}
      {/* Does NOT show duplicate member list, bulk checkboxes, or bulk toolbar.    */}
      {/* ========================================================================= */}
      {isCaseA && currentIncident && (
        <div className="space-y-4 animate-fade-in">
          <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-50/90 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-200/80 dark:border-emerald-800/60 shadow-sm space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-emerald-950 dark:text-emerald-100">
                      คำร้องนี้อยู่ในกลุ่มเหตุการณ์แล้ว
                    </span>
                    <span className="font-mono font-black text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-emerald-300/60 shadow-xs text-xs">
                      {currentIncident.group_code}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      currentIncident.status === 'open'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {currentIncident.status === 'open' ? 'กำลังดำเนินการ (Open)' : 'ปิดแล้ว (Closed)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 mt-1 font-medium">
                    {currentIncident.title}
                  </p>
                </div>
              </div>

              <Link
                href={`/backoffice/incidents/${currentIncident.id || currentIncident.group_code}`}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
              >
                <span>ดูกลุ่มเหตุการณ์</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            <p className="text-[11px] text-emerald-800 dark:text-emerald-300/90 pl-1">
              ✓ คำร้องนี้ได้รับการยืนยันเป็นสมาชิกของกลุ่มเหตุการณ์ในฐานข้อมูลเรียบร้อยแล้ว การจัดการคำร้องสมาชิกและการดำเนินการเป็นชุดสามารถทำได้จากหน้ากลุ่มเหตุการณ์
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CASE B: Request Is Ungrouped but Related to an Existing Incident Group   */}
      {/* Condition: !currentIncident && relevantCandidateGroups.length > 0        */}
      {/* Displays concise card(s) of related group(s) without listing all members. */}
      {/* Does NOT show bulk toolbar or repeated member reports.                    */}
      {/* ========================================================================= */}
      {isCaseB && (
        <div className="space-y-4 animate-fade-in">
          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              ตรวจพบกลุ่มเหตุการณ์เดิมที่อาจเกี่ยวข้อง (เป็นเพียงกลุ่มที่อาจเกี่ยวข้อง ยังไม่ได้ยืนยันว่าเป็นเหตุการณ์เดียวกัน)
            </span>
          </div>

          {relevantCandidateGroups.map((cg) => {
            const grp = cg.group;
            const isClosed = grp.status === 'closed';

            return (
              <div
                key={grp.id}
                className="p-5 rounded-2xl bg-amber-50/70 border border-amber-300/80 dark:bg-amber-950/20 dark:border-amber-800/60 space-y-3.5 shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-black text-amber-900 dark:text-amber-200 text-sm">
                      {grp.group_code}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                      {grp.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      isClosed
                        ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    }`}>
                      {isClosed ? "ปิดแล้ว (Closed)" : "เปิดอยู่ (Open)"}
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-300/60 text-amber-800 dark:text-amber-300">
                      คะแนนความเข้ากัน {cg.score}%
                    </span>
                  </div>
                </div>

                {/* Filtered reasons */}
                <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-amber-200/60 dark:border-amber-900/40 text-[11px] space-y-1">
                  <span className="font-bold text-slate-700 dark:text-slate-300">เหตุผลความเกี่ยวข้อง:</span>
                  {cg.reasons.map((r: string, idx: number) => (
                    <p key={idx} className="flex items-start gap-1.5 text-slate-600 dark:text-slate-300">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{localizeConflictReason(r)}</span>
                    </p>
                  ))}
                </div>

                <p className="text-[11px] text-amber-800 dark:text-amber-400">
                  • คำร้องนี้ยังไม่ได้เชื่อมเข้ากลุ่มจริง เจ้าหน้าที่ต้องตรวจสอบและกดยืนยันก่อนดำเนินการ
                </p>

                <div className="flex justify-end gap-2 pt-1">
                  <Link
                    href={`/backoffice/incidents/${grp.id || grp.group_code}`}
                    target="_blank"
                    className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>ตรวจสอบกลุ่ม</span>
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </Link>

                  {!isClosed ? (
                    <button
                      type="button"
                      disabled={isGroupCheckUnavailable || isSubmitting}
                      onClick={() => openLinkGroupModal(grp, publicId, cg.reasons, [])}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      <span>พิจารณาเชื่อมเข้ากลุ่ม</span>
                    </button>
                  ) : (
                    <span className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed">
                      กลุ่มปิดแล้ว (ไม่อนุญาตให้เชื่อม)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* CASE C: Request Is Ungrouped and Has No Related Existing Group           */}
      {/* Condition: !currentIncident && relevantCandidateGroups.length === 0      */}
      {/* Displays candidate reports list or empty state.                          */}
      {/* Conditionally displays Bulk Reply Toolbar ONLY when eligibleCandidates >= 2 */}
      {/* ========================================================================= */}
      {isCaseC && (
        <div className="space-y-4 animate-fade-in">

          {/* Conditional Bulk Reply & Auto-Grouping Toolbar (Phase 4: only when eligibleSimilarCandidates.length >= 2) */}
          {canShowBulkToolbar && (
            <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/60 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                        การดำเนินการแบบชุด (Bulk Reply & Auto-Grouping)
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[11px] font-black">
                        เลือก {selectedReportIds.length} จากทั้งหมด {totalGroupableCount} รายการ
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      เลือกคำร้องที่เกี่ยวข้องกันเพื่อเปลี่ยนสถานะ ตอบกลับ และจัดกลุ่มเหตุการณ์พร้อมกัน (คำร้องต้นทาง 1 รายการ + คำร้องที่คล้ายกัน {eligibleSimilarCandidates.length} รายการ)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    เลือกทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    ยกเลิกทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkFormOpen(!bulkFormOpen)}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{bulkFormOpen ? "ปิดฟอร์มตอบกลับ" : "เปิดฟอร์มตอบกลับแบบชุด"}</span>
                    {bulkFormOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Dedicated Bulk Action Form (Strict 5-step order from Section 2) */}
              {bulkFormOpen && (
                <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/50 space-y-4 shadow-sm animate-fade-in text-xs">
                  <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <Send className="w-4 h-4 text-indigo-600" />
                      <span>กำหนดการดำเนินการสำหรับ {selectedReportIds.length} คำร้องที่เลือก</span>
                    </span>
                  </div>

                  {/* Step 1: สถานะคำร้อง */}
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">
                      1. สถานะคำร้องเป้าหมาย <span className="text-slate-400 font-normal">(เลือกสถานะที่ต้องการเปลี่ยนให้ทุกคำร้องที่เลือก)</span>:
                    </label>
                    <select
                      value={bulkTargetStatus}
                      onChange={(e) => {
                        const newStatus = e.target.value;
                        setBulkTargetStatus(newStatus);
                        if (newStatus !== 'completed' && bulkImage) {
                          removeBulkImage();
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500/20 outline-hidden"
                    >
                      <option value="">-- ไม่เปลี่ยนสถานะ (คงสถานะเดิมของแต่ละคำร้อง) --</option>
                      <option value="pending">{STATUS_DETAILS.pending.label}</option>
                      <option value="received">{STATUS_DETAILS.received.label}</option>
                      <option value="in_progress">{STATUS_DETAILS.in_progress.label}</option>
                      <option value="completed">{STATUS_DETAILS.completed.label}</option>
                      <option value="rejected">{STATUS_DETAILS.rejected.label}</option>
                      <option value="cancelled">{STATUS_DETAILS.cancelled.label}</option>
                    </select>
                  </div>

                  {/* Step 2: หมายเหตุสรุปผล / ข้อความตอบกลับ */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block font-bold text-slate-700 dark:text-slate-300">
                        2. หมายเหตุสรุปผล / ข้อความตอบกลับ <span className="text-slate-400 font-normal">(บันทึกข้อความเดียวกันให้แต่ละคำร้อง)</span>:
                      </label>
                      <span className="text-[11px] text-slate-400 font-medium">รองรับข้อความยาวหลายบรรทัด</span>
                    </div>
                    <textarea
                      rows={5}
                      value={bulkReplyMessage}
                      onChange={(e) => setBulkReplyMessage(e.target.value)}
                      placeholder="เช่น ตรวจสอบปัญหาเครือข่าย Wi-Fi ในพื้นที่ที่ได้รับแจ้ง และดำเนินการประสานผู้ดูแลระบบเข้าตรวจสอบแก้ไข..."
                      className="w-full p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-xs sm:text-sm font-medium leading-relaxed focus:ring-2 focus:ring-indigo-500/20 outline-hidden resize-y min-h-[130px] sm:min-h-[150px]"
                    />
                  </div>

                  {/* Step 3: รูปภาพแนบ (แนบได้เฉพาะสถานะเสร็จสิ้น) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block font-bold text-slate-700 dark:text-slate-300">
                        3. รูปภาพแนบ <span className="text-slate-400 font-normal text-xs">(ไม่บังคับ — แนบได้เฉพาะเมื่อเลือกสถานะเสร็จสิ้น)</span>
                      </label>
                      {bulkImage && (
                        <button
                          type="button"
                          onClick={removeBulkImage}
                          className="text-[11px] text-rose-500 hover:underline font-bold cursor-pointer"
                        >
                          ลบรูปภาพ
                        </button>
                      )}
                    </div>

                    {bulkTargetStatus !== 'completed' ? (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 text-[11px] flex items-center gap-2">
                        <ImageOff className="w-4 h-4 shrink-0 text-slate-400" />
                        <span>สามารถแนบรูปภาพได้เมื่อเลือกสถานะ &ldquo;เสร็จสิ้น&rdquo; เท่านั้น</span>
                      </div>
                    ) : (
                      <div>
                        {!bulkImagePreview ? (
                          <label className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded-xl p-3 flex items-center justify-center gap-2 cursor-pointer transition-colors bg-slate-50 dark:bg-slate-800/30">
                            <UploadCloud className="w-4 h-4 text-indigo-500" />
                            <span className="font-bold text-slate-600 dark:text-slate-300 text-xs">คลิกเพื่ออัปโหลดภาพการดำเนินงาน (ไม่เกิน 5MB)</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageChange}
                              className="hidden"
                            />
                          </label>
                        ) : (
                          <div className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={bulkImagePreview}
                              alt="แนบรูปภาพ"
                              className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                            />
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 flex-1 truncate">
                              <p className="font-bold truncate">{bulkImage?.name}</p>
                              <p className="text-slate-400 font-mono">{(bulkImage!.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Step 4: การจัดกลุ่มเหตุการณ์ */}
                  <div className="space-y-1 p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bulkAutoGroup}
                        onChange={(e) => setBulkAutoGroup(e.target.checked)}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold text-amber-950 dark:text-amber-100">
                          4. จัดกลุ่มเหตุการณ์อัตโนมัติ (Automatic Incident Grouping)
                        </span>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed mt-0.5">
                          ระบบจะวิเคราะห์ความถูกต้อง หากผ่าน Validation จะสร้างกลุ่มใหม่หรือเพิ่มเข้า Incident Group เดิมโดยอัตโนมัติ และจะคัดแยกคำร้องที่ตรวจพบข้อขัดแย้งออกเพื่อความปลอดภัย
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Step 5: ปุ่มตรวจสอบและยืนยัน */}
                  <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setBulkFormOpen(false)}
                      className="px-3.5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      disabled={bulkAutoGroup ? selectedReportIds.length < 2 : selectedReportIds.length === 0}
                      onClick={handleOpenBulkConfirm}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>
                        {bulkAutoGroup && selectedReportIds.length < 2
                          ? "กรุณาเลือกคำร้องที่คล้ายกันอย่างน้อย 1 รายการเพื่อจัดกลุ่ม"
                          : `5. ตรวจสอบและยืนยันการดำเนินการ (${selectedReportIds.length} รายการ)`}
                      </span>
                      {(!bulkAutoGroup || selectedReportIds.length >= 2) && <ArrowRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Primary Target Report Selection Row (Source report is automatically included) */}
              <div className="p-3.5 rounded-xl border border-indigo-200/60 bg-indigo-50/30 dark:bg-indigo-950/10 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                  <input
                    type="checkbox"
                    checked={true}
                    disabled={true}
                    readOnly={true}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-not-allowed opacity-80"
                  />
                  <span>คำร้องต้นทาง:</span>
                  <span className="font-mono text-primary font-black">{publicId}</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    ({data?.target?.description?.slice(0, 40) || 'คำร้องปัจจุบัน'})
                  </span>
                </div>
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-indigo-200/50">
                  คำร้องต้นทาง (รวมอัตโนมัติ)
                </span>
              </div>
            </div>
          )}

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="space-y-3 pt-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/40 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded-md"></div>
                    <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded-md"></div>
                  </div>
                  <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-700 rounded-md"></div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && suggestions.length === 0 && (
            <div className="text-center py-8 px-4 rounded-2xl bg-slate-50/60 dark:bg-slate-800/20 border border-dashed border-slate-200 dark:border-slate-800">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                ไม่พบคำร้องที่เข้าเกณฑ์ความคล้ายคลึง
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                คำร้องนี้ยังไม่มีรายการอื่นที่ระบุสถานที่และเวลาใกล้เคียงกันจนถึงเกณฑ์ที่ต้องตรวจสอบร่วมกัน
              </p>
            </div>
          )}

          {/* Category Filter Tabs */}
          {!isLoading && suggestions.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs border-b border-slate-100 dark:border-slate-800/60">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'
                }`}
              >
                <span>ทั้งหมด</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 dark:bg-white/20">
                  {suggestions.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterType('similar_not_grouped')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  filterType === 'similar_not_grouped'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 border border-blue-200/50 dark:border-blue-900/40'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                <span>ยังไม่ได้รวมกลุ่ม</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-200/50 dark:bg-blue-800/50">
                  {type1Count}
                </span>
              </button>

              {type3Count > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterType('already_grouped')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    filterType === 'already_grouped'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-900/40'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>รวมกลุ่มแล้ว</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-200/50 dark:bg-emerald-800/50">
                    {type3Count}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Empty State for specific category filter */}
          {!isLoading && suggestions.length > 0 && filteredItems.length === 0 && (
            <div className="text-center py-8 px-4 rounded-2xl bg-slate-50/60 dark:bg-slate-800/20 border border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                ไม่พบคำร้องในประเภทที่เลือก
              </p>
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className="mt-2 text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                แสดงคำร้องทั้งหมด
              </button>
            </div>
          )}

          {/* Suggestions List with Candidate Cards */}
          {!isLoading && displayedItems.length > 0 && (
            <div className="space-y-3.5">
              {displayedItems.map(({ item, relation }) => {
                const isEligibleCandidate = eligibleSimilarCandidates.some(c => c.public_id === item.public_id);
                const isSelected = selectedReportIds.includes(item.public_id);
                const isExpanded = !!expandedItems[item.public_id];
                const report = item.report;
                const hasDifferences = item.differences && item.differences.length > 0;

                return (
                  <div 
                    key={item.public_id}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isSelected && isEligibleCandidate
                        ? 'border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/10'
                        : relation.type === 'already_grouped'
                        ? 'border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/15 dark:bg-emerald-950/10 hover:border-emerald-300'
                        : 'border-blue-200/70 dark:border-blue-900/40 bg-blue-50/15 dark:bg-blue-950/10 hover:border-blue-300'
                    }`}
                  >
                    {/* Main Card Body */}
                    <div className="p-4 sm:p-5 space-y-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Checkbox for Bulk Selection: only shown when bulk toolbar is active and candidate is eligible */}
                          {canShowBulkToolbar && isEligibleCandidate && (
                            <button
                              type="button"
                              onClick={() => toggleSelectReport(item.public_id)}
                              className="text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer mr-1"
                              title={isSelected ? "ยกเลิกการเลือก" : "เลือกสำหรับดำเนินการแบบชุด"}
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-indigo-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          )}

                          {/* Request ID */}
                          <button 
                            type="button"
                            onClick={() => setQuickViewPublicId(item.public_id)}
                            className="text-sm font-black font-mono text-slate-800 dark:text-slate-100 hover:text-primary transition-colors flex items-center gap-1.5 cursor-pointer group"
                            title="คลิกเพื่อเปิดดูรายละเอียดคำร้องโดยไม่เปลี่ยนหน้า"
                          >
                            <span className="group-hover:underline">{item.public_id}</span>
                            <Eye className="w-3.5 h-3.5 opacity-60 text-slate-400 group-hover:text-primary" />
                          </button>

                          {/* Relationship Status Badge */}
                          {relation.type === 'already_grouped' && (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>รวมกลุ่มแล้ว:</span>
                              <strong className="font-mono">{relation.actualGroup?.group_code}</strong>
                            </span>
                          )}

                          {relation.type === 'similar_not_grouped' && (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              <HelpCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>ยังไม่ได้รวมกลุ่ม</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <StatusBadge status={report.status} className="text-[10px] px-2.5 py-0.5" />
                        </div>
                      </div>

                      {/* Topic / Description */}
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-medium line-clamp-2 leading-relaxed">
                        {report.description}
                      </p>

                      {/* Location & Metadata Chips */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>{report.location}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{new Date(report.created_at).toLocaleString('th-TH', { 
                            day: 'numeric', 
                            month: 'short', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })} น.</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          หมวด: {report.categoryName} • {report.subcategoryName}
                        </div>
                      </div>

                      {/* Similarity Score Disclaimer */}
                      <div className="flex items-center gap-2 flex-wrap pt-0.5">
                        <span className="text-xs font-mono font-black px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          ความคล้ายคลึง: {item.score}%
                        </span>
                        <span className="text-[11px] text-slate-400">
                          (ประเมินจากความคล้ายคลึงทางข้อความและสถานที่ ไม่ใช่หลักฐานการเป็นสมาชิกกลุ่ม)
                        </span>
                      </div>

                      {/* Key Differences Warning Box */}
                      {hasDifferences && (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-300/40 dark:border-amber-700/40 text-[11px] space-y-1">
                          <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>ข้อแตกต่างสำคัญที่ควรตรวจสอบ:</span>
                          </div>
                          <ul className="space-y-0.5 pl-4 list-disc text-amber-950 dark:text-amber-100">
                            {item.differences!.map((diff: string, dIdx: number) => (
                              <li key={dIdx}>{localizeConflictReason(diff)}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Group status if already in group */}
                      {relation.type === 'already_grouped' && relation.actualGroup && (
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-300/50 dark:border-emerald-700/50 text-xs space-y-1.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 font-bold text-emerald-900 dark:text-emerald-200">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>สมาชิกของกลุ่มเหตุการณ์:</span>
                              <Link 
                                href={`/backoffice/incidents/${relation.actualGroup.id}`}
                                target="_blank"
                                className="font-mono text-emerald-800 dark:text-emerald-300 underline hover:text-emerald-950 dark:hover:text-emerald-100 flex items-center gap-1"
                              >
                                <span>{relation.actualGroup.group_code}</span>
                                <ExternalLink className="w-3 h-3 opacity-70" />
                              </Link>
                              <span className="font-normal text-slate-600 dark:text-slate-300">
                                ({relation.actualGroup.title || "กลุ่มเหตุการณ์"})
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] shrink-0">
                              <span className="text-slate-500 font-normal">สถานะกลุ่ม:</span>
                              <span className={`px-2 py-0.5 rounded-full font-bold ${
                                relation.isClosed 
                                  ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300' 
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              }`}>
                                {relation.isClosed ? 'ปิดแล้ว (Closed)' : 'เปิดอยู่ (Open)'}
                              </span>
                            </div>
                          </div>
                          <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed pl-5.5">
                            บันทึกเป็นสมาชิกของกลุ่มในฐานข้อมูลแล้ว
                          </p>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <button
                          type="button"
                          onClick={() => toggleExpand(item.public_id)}
                          className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer self-start sm:self-auto"
                        >
                          <span>เหตุผลสนับสนุน ({item.reasons.length})</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                          {relation.type === 'similar_not_grouped' && (
                            <>
                              <button
                                type="button"
                                disabled={isGroupCheckUnavailable}
                                onClick={() => openCreateGroupModal(
                                  item.public_id, 
                                  item.reasons, 
                                  item.differences || []
                                )}
                                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                                <span>พิจารณารวมกลุ่ม</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setQuickViewPublicId(item.public_id)}
                                className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                                title="ดูรายละเอียดคำร้องในหน้าต่างสไลด์"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>ดูรายละเอียด</span>
                              </button>
                            </>
                          )}

                          {relation.type === 'already_grouped' && relation.actualGroup && (
                            <>
                              <Link
                                href={`/backoffice/incidents/${relation.actualGroup.id}`}
                                target="_blank"
                                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs flex items-center gap-1.5"
                              >
                                <Layers className="w-3.5 h-3.5" />
                                <span>ดูกลุ่มเหตุการณ์</span>
                              </Link>
                              <button
                                type="button"
                                onClick={() => setQuickViewPublicId(item.public_id)}
                                className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                                title="ดูรายละเอียดคำร้องในหน้าต่างสไลด์"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>ดูรายละเอียดคำร้อง</span>
                              </button>
                            </>
                          )}

                          <Link
                            href={`/backoffice/reports/${item.public_id}`}
                            target="_blank"
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            title="เปิดในแท็บใหม่"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Supporting Reasons Details */}
                    {isExpanded && (
                      <div className="bg-white/80 dark:bg-slate-900/80 px-4 sm:px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-xs space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-[11px]">
                          <div>
                            <span className="text-slate-400">หมวดหมู่: </span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {item.breakdown.categoryScore}/35
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">สถานที่: </span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {item.breakdown.locationScore}/25
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">กรอบเวลา: </span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {item.breakdown.timeScore}/20
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">ความคล้ายข้อความ: </span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {item.breakdown.textScore}/20
                            </span>
                          </div>
                        </div>

                        <ul className="space-y-1 text-slate-600 dark:text-slate-300 pt-1">
                          {item.reasons.map((r: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-amber-500 font-bold">•</span>
                              <span>{localizeConflictReason(r)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* View More / Show Less Controls */}
              {filteredItems.length > 5 && (
                <div className="pt-2 text-center">
                  {hasMore ? (
                    <button
                      type="button"
                      onClick={() => setDisplayLimit(prev => prev + 5)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                    >
                      แสดงเพิ่มเติม (เหลืออีก {filteredItems.length - displayLimit} รายการ)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDisplayLimit(5)}
                      className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                    >
                      ย่อรายการ (แสดง 5 รายการแรก)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* Drawer: Quick View for Related Report without Leaving Current Context    */}
      {/* ========================================================================= */}
      {mounted && quickViewPublicId && createPortal(
        <div className="fixed inset-0 z-[80] flex justify-end bg-black/60 backdrop-blur-xs animate-fade-in">
          <div 
            className="fixed inset-0 bg-transparent cursor-pointer"
            onClick={() => setQuickViewPublicId(null)}
          />
          <div className="relative z-10 bg-white dark:bg-slate-900 w-full max-w-4xl h-full shadow-2xl flex flex-col border-l border-slate-100 dark:border-slate-800 animate-slide-left overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">ตรวจสอบคำร้องที่เกี่ยวข้อง:</span>
                    <span className="font-mono font-black text-slate-900 dark:text-white text-base">
                      {quickViewPublicId}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    แสดงรายละเอียดคำร้องในหน้าต่างสไลด์ เพื่อให้ท่านเปรียบเทียบข้อมูลโดยไม่ต้องออกจากหน้านี้
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/backoffice/reports/${quickViewPublicId}`}
                  target="_blank"
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                >
                  <span>เปิดเต็มหน้า</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => setQuickViewPublicId(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <ReportDetailView
                publicId={quickViewPublicId}
                userRole={userRole}
                isDrawer={true}
                onClose={() => setQuickViewPublicId(null)}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* Modal: Bulk Reply & Grouping Confirmation Modal (Section 2 & 3)          */}
      {/* ========================================================================= */}
      {mounted && bulkConfirmModalOpen && createPortal(
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div 
            className="fixed inset-0 bg-transparent cursor-pointer"
            onClick={() => !isSubmitting && setBulkConfirmModalOpen(false)}
          />
          <div className="relative z-10 bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 space-y-4 border border-slate-100 dark:border-slate-800 shadow-2xl animate-scale-up my-auto max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/10 text-indigo-600 flex items-center justify-center shrink-0">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">
                    ยืนยันการตอบกลับและจัดกลุ่มแบบชุด
                  </h3>
                  <p className="text-xs text-slate-400">
                    ตรวจสอบรายการคำร้อง สถานะ และข้อความที่จะบันทึกพร้อมกัน
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setBulkConfirmModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">
              {/* Risk Warning Alert if any selected report has contradiction */}
              {highRiskSelectedCount > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>คำเตือน: ตรวจพบคำร้องที่มีความเสี่ยงจะถูกรวมผิดกลุ่ม ({highRiskSelectedCount} รายการ)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    ระบบตรวจพบว่ามีคำร้องที่ระบุสถานที่คนละจุดหรือคนละประเภทปัญหา ระบบความปลอดภัยจะยกเว้นการจัดกลุ่มอัตโนมัติสำหรับรายการดังกล่าว แต่ยังคงบันทึกการตอบกลับและสถานะตามปกติ (ท่านสามารถคลิกยกเลิกการเลือกคำร้องด้านล่างได้หากไม่ต้องการดำเนินการ)
                  </p>
                </div>
              )}

              {/* Selected Reports Table / List */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    รายการคำร้องที่จะดำเนินการ ({selectedCandidatesInfo.length} รายการ):
                  </span>
                  <span className="text-[11px] text-slate-400">
                    คลิกเครื่องหมายกากบาทเพื่อนำออกจากการดำเนินการชุดนี้
                  </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50/50 dark:bg-slate-800/30">
                  {selectedCandidatesInfo.map(c => (
                    <div key={c.publicId} className="p-3 flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-primary text-sm">{c.publicId}</span>
                          {c.isPrimary && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              คำร้องหลัก
                            </span>
                          )}
                          {/* Relationship Badge in Bulk Confirmation */}
                          {c.relation?.type === 'already_grouped' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1 border border-emerald-300">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                              <span>รวมกลุ่มแล้ว ({c.relation.actualGroup?.group_code})</span>
                            </span>
                          )}
                          {c.relation?.type === 'matching_existing_group' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 flex items-center gap-1 border border-amber-300">
                              <AlertCircle className="w-2.5 h-2.5 text-amber-600" />
                              <span>พบกลุ่มแนะนำ ({c.relation.suggestedGroup?.group_code})</span>
                            </span>
                          )}
                          {c.relation?.type === 'similar_not_grouped' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 flex items-center gap-1 border border-blue-200">
                              <HelpCircle className="w-2.5 h-2.5 text-blue-600" />
                              <span>ยังไม่ได้รวมกลุ่ม</span>
                            </span>
                          )}
                          <span className="text-slate-400 font-medium">
                            สถานะเดิม: <strong className="text-slate-700 dark:text-slate-200">{STATUS_DETAILS[c.status as ReportStatus]?.label || c.status}</strong>
                          </span>
                          {bulkTargetStatus && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                              <ArrowRight className="w-3 h-3" />
                              <span>{STATUS_DETAILS[bulkTargetStatus as ReportStatus]?.label || bulkTargetStatus}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                          {c.description}
                        </p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{c.location}</span>
                        </p>
                        {c.hasContradiction && (
                          <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>ข้อขัดแย้ง: {c.contradictionReason} (จะไม่ถูกจัดกลุ่ม)</span>
                          </p>
                        )}
                      </div>

                      {/* Remove from this batch button */}
                      {selectedCandidatesInfo.length > 1 && (
                        <button
                          type="button"
                          onClick={() => toggleSelectReport(c.publicId)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="นำออกจากชุดนี้"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Reply Message Preview */}
              {bulkReplyMessage && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="font-bold text-slate-700 dark:text-slate-300">ข้อความที่จะบันทึก:</span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 italic whitespace-pre-wrap">
                    &ldquo;{bulkReplyMessage}&rdquo;
                  </p>
                </div>
              )}

              {/* Image Preview if Attached */}
              {bulkImagePreview && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bulkImagePreview} alt="รูปภาพแนบ" className="w-14 h-14 object-cover rounded-lg border" />
                  <div className="text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">ภาพแนบการดำเนินการเสร็จสิ้น</span>
                    <p className="text-[11px] text-slate-400">{bulkImage?.name}</p>
                  </div>
                </div>
              )}

              {/* Grouping Impact */}
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-1.5 text-blue-900 dark:text-blue-200">
                <span className="font-bold flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>ผลการจัดกลุ่มที่คาดว่าจะเกิดขึ้น:</span>
                </span>
                <ul className="space-y-0.5 pl-4 list-disc text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                  {bulkAutoGroup ? (
                    currentIncident ? (
                      <li>คำร้องที่ผ่านการตรวจสอบจะถูกเพิ่มเข้ากลุ่มเหตุการณ์เดิม <strong className="font-mono font-black">{currentIncident.group_code}</strong></li>
                    ) : (
                      <li>คำร้องที่ผ่านการตรวจสอบ (ไม่มีข้อขัดแย้ง) จะถูกจัดตั้งเป็นกลุ่มเหตุการณ์ใหม่ร่วมกัน</li>
                    )
                  ) : (
                    <li>ไม่อนุมัติการจัดกลุ่ม (อัปเดตเฉพาะสถานะและข้อความตอบกลับเท่านั้น)</li>
                  )}
                  <li>คำร้องที่มีข้อขัดแย้งด้านสถานที่หรือคนละประเด็นจะไม่ถูกรวมกลุ่ม เพื่อรักษาความถูกต้องของข้อมูล</li>
                  <li>ระบบบันทึก Audit History และรายงานผลแยกรายคำร้อง</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setBulkConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition-colors cursor-pointer"
              >
                ย้อนกลับแก้ไข
              </button>
              <button
                type="button"
                disabled={isSubmitting || selectedReportIds.length === 0}
                onClick={() => handleExecuteBulkAction()}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? "กำลังดำเนินการ..." : `ยืนยันดำเนินการ (${selectedReportIds.length} รายการ)`}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* Modal: Bulk Reply Result Summary (Section 6)                              */}
      {/* ========================================================================= */}
      {mounted && bulkResultModalOpen && bulkResponseData && createPortal(
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="relative z-10 bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 space-y-4 border border-slate-100 dark:border-slate-800 shadow-2xl animate-scale-up my-auto max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  bulkResponseData.totalFailed === 0
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-amber-500/10 text-amber-600'
                }`}>
                  {bulkResponseData.totalFailed === 0 ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">
                    ผลการดำเนินการแบบชุด (Execution Summary)
                  </h3>
                  <p className="text-xs text-slate-400">
                    สำเร็จ {bulkResponseData.totalSaved} จาก {bulkResponseData.totalRequested} รายการ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBulkResultModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">
              {/* Grouping Outcome Summary Banner */}
              {bulkResponseData.groupResult.action !== 'none' && (
                <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <span className="font-bold text-indigo-950 dark:text-indigo-100">
                        {bulkResponseData.groupResult.action === 'created' 
                          ? 'สร้างกลุ่มเหตุการณ์ใหม่สำเร็จ: ' 
                          : 'เพิ่มเข้ากลุ่มเหตุการณ์เดิมสำเร็จ: '}
                      </span>
                      <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 ml-1">
                        {bulkResponseData.groupResult.groupCode}
                      </span>
                      <p className="text-[11px] text-slate-500">
                        รวมคำร้องเข้ากลุ่ม {bulkResponseData.groupResult.groupedCount} รายการ (คัดแยก {bulkResponseData.groupResult.excludedCount} รายการ)
                      </p>
                    </div>
                  </div>
                  {bulkResponseData.groupResult.groupCode && (
                    <Link
                      href={`/backoffice/incidents/${bulkResponseData.groupResult.groupCode}`}
                      target="_blank"
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors shrink-0 flex items-center gap-1"
                    >
                      <span>เปิดกลุ่ม</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              )}

              {/* Per-Report Detailed Results (Section 6 Requirement) */}
              <div className="space-y-2">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  รายละเอียดผลการประมวลผลแยกรายคำร้อง:
                </span>

                <div className="space-y-2">
                  {bulkResponseData.results.map((res: BulkActionReportResult) => {
                    const isOk = !res.error;
                    return (
                      <div 
                        key={res.publicId}
                        className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                          isOk 
                            ? 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700' 
                            : 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-primary text-sm">{res.publicId}</span>
                            {res.replySaved && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                ✓ บันทึกคำตอบ
                              </span>
                            )}
                            {res.statusChanged && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                                สถานะ: {res.oldStatus} ➔ {res.newStatus}
                              </span>
                            )}
                            {res.grouped ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 flex items-center gap-1">
                                <Layers className="w-3 h-3" />
                                <span>กลุ่ม: {res.groupCode}</span>
                              </span>
                            ) : res.groupAction === 'excluded' ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                คัดแยกจากการจัดกลุ่ม
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setBulkResultModalOpen(false);
                                setQuickViewPublicId(res.publicId);
                              }}
                              className="px-2 py-1 text-[11px] font-bold rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>ดูคำร้อง</span>
                            </button>
                            {res.error && (
                              <button
                                type="button"
                                onClick={() => handleExecuteBulkAction([res.publicId])}
                                className="px-2 py-1 text-[11px] font-bold rounded-md bg-rose-600 text-white hover:bg-rose-700 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>ลองใหม่</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {res.groupingReason && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-1">
                            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>การจัดกลุ่ม: {res.groupingReason}</span>
                          </p>
                        )}

                        {res.error && (
                          <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>ข้อผิดพลาด: {res.error}</span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setBulkResultModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs transition-colors cursor-pointer"
              >
                ปิดหน้ารายงานผล
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* Existing Single Modals: Create, Link, Move                                */}
      {/* ========================================================================= */}
      {mounted && createModalOpen && createPortal(
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div 
            className="fixed inset-0 bg-transparent"
            onClick={() => !isSubmitting && setCreateModalOpen(false)}
          />
          <div className="relative z-10 bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 space-y-4 border border-slate-100 dark:border-slate-800 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  ยืนยันการสร้างกลุ่มเหตุการณ์ใหม่
                </h3>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  คำร้องที่จะรวมเข้ากลุ่ม ({createSelectedReportIds.length} รายการ):
                </label>
                <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  {createSelectedReportIds.map(id => (
                    <span key={id} className="font-mono font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 text-primary border border-primary/20">
                      {id}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  ชื่อกลุ่มเหตุการณ์ที่แนะนำ (ปรับแก้ไขได้):
                </label>
                <input
                  type="text"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="ระบุชื่อสรุปเหตุการณ์..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-primary/20 outline-hidden"
                />
              </div>

              {createSupportingReasons.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                  <span className="font-bold text-slate-700 dark:text-slate-300">หลักฐานสนับสนุน:</span>
                  <ul className="space-y-0.5 pl-4 list-disc text-slate-600 dark:text-slate-400 text-[11px]">
                    {createSupportingReasons.map((r, i) => (
                      <li key={i}>{localizeConflictReason(r)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {createDifferences.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-1">
                  <span className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>ข้อแตกต่างที่ควรพิจารณา:</span>
                  </span>
                  <ul className="space-y-0.5 pl-4 list-disc text-amber-800 dark:text-amber-300 text-[11px]">
                    {createDifferences.map((d, i) => (
                      <li key={i}>{localizeConflictReason(d)}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-1 text-blue-900 dark:text-blue-200">
                <span className="font-bold flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-blue-600" />
                  <span>ผลกระทบที่คาดว่าจะเกิดขึ้น:</span>
                </span>
                <ul className="space-y-0.5 pl-4 list-disc text-[11px] text-blue-800 dark:text-blue-300">
                  <li>คำร้องจะถูกรวมเข้าสู่กลุ่มเหตุการณ์ใหม่ในระบบ Incident Management</li>
                  <li>สามารถติดตามสถานะและตอบกลับผู้แจ้งพร้อมกันได้ในที่เดียว</li>
                  <li>บันทึกประวัติการสร้างกลุ่มใน Audit History และคงสถานะคำร้องเดิม</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isSubmitting || !createTitle.trim()}
                onClick={handleConfirmCreateGroup}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{isSubmitting ? "กำลังสร้างกลุ่ม..." : "ยืนยันสร้างกลุ่มเหตุการณ์"}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {mounted && linkModalOpen && linkTargetGroup && createPortal(
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div 
            className="fixed inset-0 bg-transparent"
            onClick={() => !isSubmitting && setLinkModalOpen(false)}
          />
          <div className="relative z-10 bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 space-y-4 border border-slate-100 dark:border-slate-800 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                  <LinkIcon className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  ยืนยันการเชื่อมคำร้องเข้ากลุ่มเหตุการณ์เดิม
                </h3>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setLinkModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-500">คำร้องเป้าหมาย:</span>
                  <span className="font-mono font-bold text-primary">{linkReportPublicId}</span>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="font-bold text-slate-500">กลุ่มเหตุการณ์ปลายทาง:</span>
                  <span className="font-mono font-black text-amber-600">{linkTargetGroup.group_code}</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">({linkTargetGroup.title})</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                    linkTargetGroup.status === 'closed'
                      ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}>
                    {linkTargetGroup.status === 'closed' ? 'ปิดแล้ว (Closed)' : 'เปิดอยู่'}
                  </span>
                </div>
                {linkTargetGroup.status === 'closed' && (
                  <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-800 dark:text-rose-300 font-bold flex items-center gap-1.5 mt-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>กลุ่มเหตุการณ์นี้ปิดแล้ว (Closed) ระบบไม่อนุญาตให้เชื่อมคำร้องใหม่เข้ากลุ่มที่ปิดแล้ว</span>
                  </div>
                )}
              </div>

              {linkReasons.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                  <span className="font-bold text-slate-700 dark:text-slate-300">เหตุผลความเกี่ยวข้อง:</span>
                  <ul className="space-y-0.5 pl-4 list-disc text-slate-600 dark:text-slate-400 text-[11px]">
                    {linkReasons.map((r, i) => (
                      <li key={i}>{localizeConflictReason(r)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {linkDifferences.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-1">
                  <span className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>ข้อแตกต่างที่ควรพิจารณา:</span>
                  </span>
                  <ul className="space-y-0.5 pl-4 list-disc text-amber-800 dark:text-amber-300 text-[11px]">
                    {linkDifferences.map((d, i) => (
                      <li key={i}>{localizeConflictReason(d)}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-1 text-blue-900 dark:text-blue-200">
                <span className="font-bold flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-blue-600" />
                  <span>ผลกระทบที่คาดว่าจะเกิดขึ้น:</span>
                </span>
                <ul className="space-y-0.5 pl-4 list-disc text-[11px] text-blue-800 dark:text-blue-300">
                  <li>คำร้อง {linkReportPublicId} จะกลายเป็นสมาชิกของกลุ่ม {linkTargetGroup.group_code}</li>
                  <li>สามารถติดตามและอัปเดตความคืบหน้าร่วมกับสมาชิกอื่นในกลุ่มได้</li>
                  <li>ระบบบันทึก Audit History การเพิ่มสมาชิกอย่างถูกต้อง</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setLinkModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isSubmitting || linkTargetGroup.status === 'closed'}
                onClick={handleConfirmLinkGroup}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <LinkIcon className="w-4 h-4" />
                <span>{isSubmitting ? "กำลังเชื่อมกลุ่ม..." : "ยืนยันเชื่อมเข้ากลุ่ม"}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {mounted && moveModalOpen && moveTargetGroup && createPortal(
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div 
            className="fixed inset-0 bg-transparent"
            onClick={() => !isSubmitting && setMoveModalOpen(false)}
          />
          <div className="relative z-10 bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 space-y-4 border border-rose-200 dark:border-rose-900 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100 dark:border-rose-950">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-rose-700 dark:text-rose-400">
                  คำร้องนี้เป็นสมาชิกของกลุ่มอื่นอยู่แล้ว
                </h3>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setMoveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 space-y-2">
                <p className="text-rose-900 dark:text-rose-200 leading-relaxed font-medium">
                  คำร้อง <strong className="font-mono text-primary">{moveReportPublicId}</strong> ปัจจุบันอยู่ในกลุ่ม <strong className="font-mono text-slate-800 dark:text-white">{moveCurrentGroup?.group_code}</strong> ({moveCurrentGroup?.title})
                </p>
                <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold pt-1 border-t border-rose-200/60 dark:border-rose-900/60">
                  <span>กลุ่มเดิม: {moveCurrentGroup?.group_code}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>กลุ่มใหม่: {moveTargetGroup.group_code}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  เหตุผลการย้ายกลุ่ม (เพื่อบันทึกลง Audit Log):
                </label>
                <input
                  type="text"
                  value={moveNotes}
                  onChange={(e) => setMoveNotes(e.target.value)}
                  placeholder="ระบุเหตุผล เช่น จัดกลุ่มเดิมคลาดเคลื่อน..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-rose-500/20 outline-hidden"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-1 text-slate-700 dark:text-slate-300">
                <span className="font-bold flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-slate-500" />
                  <span>ผลกระทบที่คาดว่าจะเกิดขึ้น:</span>
                </span>
                <ul className="space-y-0.5 pl-4 list-disc text-[11px] text-slate-600 dark:text-slate-400">
                  <li>คำร้องจะถูกนำออกจากกลุ่มเดิม และย้ายเข้าสู่กลุ่ม {moveTargetGroup.group_code}</li>
                  <li>ประวัติการย้ายและเหตุผลจะถูกบันทึกใน Audit History ทั้งสองกลุ่ม</li>
                  <li>คำร้องต้นฉบับจะยังคงอยู่ครบถ้วนและไม่ถูกลบ</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setMoveModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmMoveGroup}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>{isSubmitting ? "กำลังดำเนินการ..." : "ยืนยันย้ายกลุ่ม"}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
