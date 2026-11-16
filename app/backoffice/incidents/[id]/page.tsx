"use client";

import React, { useState, useEffect, useMemo, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { fetcherWithAuth } from "@/lib/fetcher";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import {
  ArrowLeft,
  Layers,
  FileText,
  Sparkles,
  Search,
  Plus,
  Trash2,
  ExternalLink,
  History,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  User,
  AlertTriangle,
  MessageSquare,
  Send,
  CheckSquare,
  X,
  Check,
  RotateCcw,
  ImagePlus,
  ImageOff,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AppSelect } from "@/components/ui/AppSelect";
import { StatusBadge } from "@/components/design-system/StatusBadge";
import { ReportStatus, getStatusLabel } from "@/types/report";
import { ReportDetailView } from "@/components/backoffice/ReportDetailView";
import { detectIncidentContradiction } from "@/lib/similarityDetector";
import { localizeConflictReason } from "@/lib/conflictLocalization";

interface ReportDetail {
  id: string;
  public_id: string;
  description: string;
  location?: string | null;
  status: ReportStatus;
  reporter_name?: string | null;
  admin_remark?: string | null;
  created_at: string;
  updated_at?: string;
  categories?: { id: number; name_th: string } | null;
  subcategories?: { id: number; name_th: string } | null;
}

interface MemberItem {
  id: string;
  notes?: string | null;
  reports?: ReportDetail | ReportDetail[] | null;
}

interface CandidateItem {
  public_id: string;
  score: number;
  confidence: "high" | "medium" | "low";
  confidenceLabel: string;
  reasons: string[];
  recommendationType?: "same_incident" | "insufficient_evidence" | "similar_request";
  recommendationLabel?: string;
  existingGroup?: { group_code: string; title: string } | null;
  report: {
    public_id: string;
    description: string;
    location?: string | null;
    categoryName?: string;
    status: ReportStatus;
    created_at: string;
  };
}

interface UngroupedItem {
  id: string;
  public_id: string;
  description: string;
  location?: string | null;
  status: ReportStatus;
  created_at: string;
  categories?: { name_th: string } | null;
}

interface HistoryItem {
  id: number;
  action: string;
  actor_name?: string | null;
  details?: Record<string, unknown> | null;
  created_at: string;
}

interface ConfirmMoveModalState {
  show: boolean;
  report: CandidateItem;
  existingGroup?: { current_group_code?: string; current_group_title?: string };
}

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

function getMemberReport(m: MemberItem): ReportDetail | null {
  if (!m.reports) return null;
  return Array.isArray(m.reports) ? m.reports[0] : m.reports;
}

function isReportReplied(rep: ReportDetail | null): boolean {
  return Boolean(rep?.admin_remark && rep.admin_remark.trim().length > 0);
}

export default function IncidentGroupDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const { user, profile } = useStaffAuth();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  const [activeTab, setActiveTab] = useState<"members" | "candidates" | "add_ungrouped" | "history">("members");

  // Selection state for Bulk Reply
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Bulk Reply Modals
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkTargetStatus, setBulkTargetStatus] = useState<string>("");
  const [bulkResultModal, setBulkResultModal] = useState<BulkReplyResponse | null>(null);
  const [bulkImage, setBulkImage] = useState<File | null>(null);
  const [bulkImagePreview, setBulkImagePreview] = useState<string | null>(null);
  const bulkFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleBulkTargetStatusChange = (val: string) => {
    setBulkTargetStatus(val);
    if (val !== "completed") {
      if (bulkImage || bulkImagePreview) {
        setBulkImage(null);
        setBulkImagePreview(null);
      }
    }
  };

  // Individual Reply Modal
  const [individualModal, setIndividualModal] = useState<{
    show: boolean;
    report: ReportDetail;
    message: string;
    targetStatus: string;
  } | null>(null);

  // Drawer state for Request Detail
  const [drawerPublicId, setDrawerPublicId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("report");
    }
    return null;
  });

  // State for moving members
  const [confirmMoveModal, setConfirmMoveModal] = useState<ConfirmMoveModalState | null>(null);

  // State for removing members
  const [memberToRemove, setMemberToRemove] = useState<ReportDetail | null>(null);
  const [removeReason, setRemoveReason] = useState("");

  // Search state for tab 3
  const [ungroupedSearch, setUngroupedSearch] = useState("");
  const [selectedUngrouped, setSelectedUngrouped] = useState<string[]>([]);

  // Action status message
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 1. Fetch Group Details & Members & History
  const { data: groupData, error: groupError, mutate: mutateGroup, isLoading: groupLoading } = useSWR(
    user && id ? [`/api/incidents/${id}`, user.id] : null,
    ([url]) => fetcherWithAuth(url)
  );

  const group = groupData?.incidentGroup;
  const members: MemberItem[] = useMemo(() => groupData?.members || [], [groupData?.members]);
  const history = groupData?.history || [];

  // 2. Fetch Suggested Candidates (Tab 2)
  const { data: candidateData, mutate: mutateCandidates, isLoading: candidatesLoading } = useSWR(
    user && id && activeTab === "candidates" ? [`/api/incidents/${id}/candidates`, user.id] : null,
    ([url]) => fetcherWithAuth(url),
    { dedupingInterval: 10000 }
  );

  const candidates = candidateData?.candidates || [];

  // 3. Fetch Ungrouped Reports (Tab 3)
  const ungroupedQuery = new URLSearchParams({ limit: "30" });
  if (ungroupedSearch) ungroupedQuery.set("search", ungroupedSearch);

  const { data: ungroupedData, mutate: mutateUngrouped, isLoading: ungroupedLoading } = useSWR(
    user && activeTab === "add_ungrouped" ? [`/api/incidents/ungrouped-reports?${ungroupedQuery.toString()}`, user.id] : null,
    ([url]) => fetcherWithAuth(url),
    { dedupingInterval: 10000 }
  );

  const ungroupedReports = ungroupedData?.reports || [];

  // Valid reports list
  const validMemberReports = useMemo(() => {
    return members
      .map(getMemberReport)
      .filter((r): r is ReportDetail => r !== null);
  }, [members]);

  // Contradiction check among current group members
  const incompatibleMembers = useMemo(() => {
    if (validMemberReports.length < 2) return [];

    const issues: {
      member: ReportDetail;
      contradictingWith: ReportDetail;
      reasons: string[];
    }[] = [];

    const seenPairs = new Set<string>();

    for (let i = 0; i < validMemberReports.length; i++) {
      for (let j = i + 1; j < validMemberReports.length; j++) {
        const repA = validMemberReports[i];
        const repB = validMemberReports[j];
        const pairKey = [repA.id, repB.id].sort().join("-");
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);

        const check = detectIncidentContradiction(
          { ...repA, category_id: repA.categories?.id },
          { ...repB, category_id: repB.categories?.id }
        );

        if (check.isContradiction) {
          issues.push({
            member: repB,
            contradictingWith: repA,
            reasons: check.reasons,
          });
        }
      }
    }
    return issues;
  }, [validMemberReports]);

  const incompatiblePublicIds = useMemo(() => {
    return new Set(incompatibleMembers.map((m) => m.member.public_id));
  }, [incompatibleMembers]);

  const unrepliedMemberReports = useMemo(() => {
    return validMemberReports.filter((r) => !isReportReplied(r));
  }, [validMemberReports]);

  // Reports sorted with selected ones first, then unselected
  const sortedModalReports = useMemo(() => {
    return [...validMemberReports].sort((a, b) => {
      const aSel = selectedMemberIds.includes(a.public_id) ? 1 : 0;
      const bSel = selectedMemberIds.includes(b.public_id) ? 1 : 0;
      return bSel - aSel;
    });
  }, [validMemberReports, selectedMemberIds]);

  // Real current status label for selected reports in Bulk Reply
  const currentBulkStatusLabel = useMemo(() => {
    const selectedReports = validMemberReports.filter((r) =>
      selectedMemberIds.includes(r.public_id)
    );
    const targetList = selectedReports.length > 0 ? selectedReports : validMemberReports;
    const uniqueStatuses = Array.from(new Set(targetList.map((r) => r.status)));

    if (uniqueStatuses.length === 1) {
      return getStatusLabel(uniqueStatuses[0]);
    }
    if (uniqueStatuses.length > 1) {
      return uniqueStatuses.map((s) => getStatusLabel(s)).join(", ");
    }
    return "สถานะจริงของคำร้อง";
  }, [validMemberReports, selectedMemberIds]);

  // Drawer handlers with URL sync
  const openDrawer = useCallback((publicId: string) => {
    setDrawerPublicId(publicId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("report", publicId);
      window.history.pushState({}, "", url.toString());
    }
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerPublicId(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("report");
      window.history.pushState({}, "", url.toString());
    }
    mutateGroup();
  }, [mutateGroup]);

  // Handle URL deep-linking on popstate
  useEffect(() => {
    if (typeof window !== "undefined") {
      const onPopState = () => {
        const currentParams = new URLSearchParams(window.location.search);
        setDrawerPublicId(currentParams.get("report") || null);
      };

      window.addEventListener("popstate", onPopState);
      return () => window.removeEventListener("popstate", onPopState);
    }
  }, []);

  // Scroll lock when Drawer or Modals are open
  const isAnyOverlayOpen = Boolean(
    drawerPublicId ||
    bulkModalOpen ||
    bulkResultModal ||
    individualModal?.show ||
    confirmMoveModal?.show ||
    memberToRemove
  );

  useEffect(() => {
    if (isAnyOverlayOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isAnyOverlayOpen]);

  // Keyboard Escape Handler (topmost modal closes first)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmMoveModal?.show) {
          setConfirmMoveModal(null);
        } else if (memberToRemove) {
          setMemberToRemove(null);
        } else if (bulkResultModal) {
          setBulkResultModal(null);
          setSelectedMemberIds([]);
        } else if (bulkModalOpen && !isProcessing) {
          setBulkModalOpen(false);
          setBulkImage(null);
          setBulkImagePreview(null);
        } else if (individualModal?.show && !isProcessing) {
          setIndividualModal(null);
        } else if (drawerPublicId) {
          closeDrawer();
        }
      }
    };
    if (isAnyOverlayOpen) {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, [
    isAnyOverlayOpen,
    confirmMoveModal,
    memberToRemove,
    bulkResultModal,
    bulkModalOpen,
    individualModal,
    drawerPublicId,
    closeDrawer,
    isProcessing,
  ]);

  // Bulk Selection Handlers
  const handleSelectAll = () => {
    const selectableReports = validMemberReports.filter(
      (r) => !(r.status === "completed" && profile?.role === "staff")
    );
    setSelectedMemberIds(selectableReports.map((r) => r.public_id));
  };

  const handleSelectUnreplied = () => {
    const selectableReports = unrepliedMemberReports.filter(
      (r) => !(r.status === "completed" && profile?.role === "staff")
    );
    setSelectedMemberIds(selectableReports.map((r) => r.public_id));
  };

  const handleClearSelection = () => {
    setSelectedMemberIds([]);
  };

  const toggleSelectMember = (publicId: string) => {
    const rep = validMemberReports.find((r) => r.public_id === publicId);
    if (rep?.status === "completed" && profile?.role === "staff") {
      return; // Not selectable by regular staff
    }
    setSelectedMemberIds((prev) =>
      prev.includes(publicId) ? prev.filter((id) => id !== publicId) : [...prev, publicId]
    );
  };

  // Handle Status Change of Incident Group
  const handleStatusChange = async (newStatus: string) => {
    if (!group || newStatus === group.status) return;
    try {
      setIsProcessing(true);
      const res = await fetcherWithAuth(`/api/incidents/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.success) {
        setActionMessage({ type: "success", text: `เปลี่ยนสถานะเป็น "${newStatus}" เรียบร้อยแล้ว` });
        mutateGroup();
      } else {
        setActionMessage({ type: "error", text: res.error || "ไม่สามารถเปลี่ยนสถานะได้" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      setActionMessage({ type: "error", text: msg });
    } finally {
      setIsProcessing(false);
    }
  };

  // Execute Bulk Reply
  const handleExecuteBulkReply = async () => {
    if (!group || selectedMemberIds.length === 0) return;

    if (bulkTargetStatus === "completed" && !bulkImage && !bulkImagePreview) {
      setActionMessage({ type: "error", text: "กรุณาแนบรูปภาพเมื่อเลือกสถานะเสร็จสิ้น" });
      return;
    }

    if (!bulkMessage.trim()) {
      setActionMessage({ type: "error", text: "กรุณาระบุหมายเหตุสรุปผล / ข้อความตอบกลับ" });
      return;
    }

    try {
      setIsProcessing(true);
      setActionMessage(null);

      let uploadedImageUrl: string | null = null;
      if (bulkImage) {
        const fileExt = bulkImage.name.split(".").pop() || "jpg";
        const randomFileToken = Math.random().toString(36).substring(2, 12);
        const isTestEnv = process.env.NEXT_PUBLIC_REPORT_DATA_SOURCE === "test";
        const folderPrefix = isTestEnv ? "test/" : "";
        const fileName = `${folderPrefix}${Date.now()}-${randomFileToken}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("report-images")
          .upload(fileName, bulkImage, { cacheControl: "3600", upsert: false });

        if (uploadError) {
          throw new Error(`เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ: ${uploadError.message}`);
        }

        const { data: imgData } = supabase.storage.from("report-images").getPublicUrl(fileName);
        uploadedImageUrl = imgData.publicUrl;
      }

      const idempotencyKey = `bulk_${group.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const res = await fetcherWithAuth(`/api/incidents/${group.id}/bulk-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicIds: selectedMemberIds,
          message: bulkMessage.trim(),
          targetStatus: bulkTargetStatus || undefined,
          imageUrl: uploadedImageUrl || undefined,
          idempotencyKey,
        }),
      });

      if (res.success) {
        setBulkModalOpen(false);
        setBulkResultModal(res);
        setBulkImage(null);
        setBulkImagePreview(null);
        setBulkMessage("");
        setBulkTargetStatus("");
        mutateGroup();
      } else {
        setActionMessage({
          type: "error",
          text: res.error || "เกิดข้อผิดพลาดในการตอบกลับเป็นชุด",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการตอบกลับ";
      setActionMessage({ type: "error", text: msg });
    } finally {
      setIsProcessing(false);
    }
  };

  // Retry Failed items from Bulk Reply Result
  const handleRetryFailedBulk = () => {
    if (!bulkResultModal) return;
    const failedIds = bulkResultModal.results
      .filter((r) => !r.saved || r.status === "delivery_failed")
      .map((r) => r.publicId);

    if (failedIds.length === 0) return;

    setSelectedMemberIds(failedIds);
    setBulkResultModal(null);
    setBulkModalOpen(true);
  };

  // Execute Individual Reply
  const handleExecuteIndividualReply = async () => {
    if (!individualModal || !individualModal.report || !individualModal.message.trim()) return;
    const rep = individualModal.report;
    try {
      setIsProcessing(true);
      setActionMessage(null);

      const targetStatus = individualModal.targetStatus || rep.status;
      const res = await fetcherWithAuth(`/api/reports/${rep.public_id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: rep.id,
          oldStatus: rep.status,
          status: targetStatus,
          remark: individualModal.message.trim(),
        }),
      });

      if (res.success || res.status) {
        setActionMessage({
          type: "success",
          text: `ตอบกลับคำร้อง ${rep.public_id} เรียบร้อยแล้ว`,
        });
        setIndividualModal(null);
        mutateGroup();
      } else {
        setActionMessage({
          type: "error",
          text: res.error || res.message || "เกิดข้อผิดพลาดในการตอบกลับคำร้อง",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      setActionMessage({ type: "error", text: msg });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Add Candidate to Group
  const handleAddCandidate = async (cand: CandidateItem, confirmMove = false) => {
    if (!group) return;
    try {
      setIsProcessing(true);
      setActionMessage(null);

      const res = await fetcherWithAuth(`/api/incidents/${group.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicIds: [cand.public_id],
          confirmMove,
        }),
      });

      if (res.requiresConfirmation) {
        setConfirmMoveModal({
          show: true,
          report: cand,
          existingGroup: res.conflicts?.[0],
        });
        return;
      }

      if (res.success) {
        setActionMessage({ type: "success", text: `เพิ่มคำร้อง ${cand.public_id} เข้ากลุ่มเรียบร้อยแล้ว` });
        setConfirmMoveModal(null);
        mutateGroup();
        mutateCandidates();
      } else {
        setActionMessage({ type: "error", text: res.error || "เกิดข้อผิดพลาดในการเพิ่มคำร้อง" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      setActionMessage({ type: "error", text: msg });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Add Selected Ungrouped Reports
  const handleAddSelectedUngrouped = async () => {
    if (!group || selectedUngrouped.length === 0) return;
    try {
      setIsProcessing(true);
      setActionMessage(null);

      const res = await fetcherWithAuth(`/api/incidents/${group.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicIds: selectedUngrouped,
        }),
      });

      if (res.success) {
        setActionMessage({
          type: "success",
          text: `เพิ่มคำร้อง ${res.added?.length || 0} รายการเข้ากลุ่มสำเร็จ`,
        });
        setSelectedUngrouped([]);
        mutateGroup();
        mutateUngrouped();
      } else {
        setActionMessage({ type: "error", text: res.error || "เกิดข้อผิดพลาด" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      setActionMessage({ type: "error", text: msg });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Remove Member from Group
  const handleConfirmRemoveMember = async () => {
    if (!group || !memberToRemove) return;
    try {
      setIsProcessing(true);
      setActionMessage(null);

      const res = await fetcherWithAuth(`/api/incidents/${group.id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicId: memberToRemove.public_id,
          reason: removeReason.trim() || undefined,
        }),
      });

      if (res.success) {
        setActionMessage({
          type: "success",
          text: `นำคำร้อง ${memberToRemove.public_id} ออกจากกลุ่มแล้ว (ข้อมูลคำร้องยังคงอยู่ในระบบ)`,
        });
        setMemberToRemove(null);
        setRemoveReason("");
        mutateGroup();
      } else {
        setActionMessage({ type: "error", text: res.error || "เกิดข้อผิดพลาดในการนำคำร้องออก" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      setActionMessage({ type: "error", text: msg });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Remove All Incompatible Members from Group
  const handleRemoveAllIncompatibleMembers = async () => {
    if (!group || incompatibleMembers.length === 0) return;
    try {
      setIsProcessing(true);
      setActionMessage(null);

      // Collect unique member publicIds to remove
      const uniqueTargets = Array.from(new Set(incompatibleMembers.map((m) => m.member.public_id)));
      let removedCount = 0;

      for (const pubId of uniqueTargets) {
        const item = incompatibleMembers.find((m) => m.member.public_id === pubId);
        const localizedReasons = (item?.reasons || []).map((r) => localizeConflictReason(r)).join(", ");
        const res = await fetcherWithAuth(`/api/incidents/${group.id}/members`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicId: pubId,
            reason: `แยกคำร้องเนื่องจากมีข้อขัดแย้งกับเหตุการณ์หลัก: ${localizedReasons || "คนละประเภทปัญหา"}`,
          }),
        });
        if (res.success) {
          removedCount++;
        }
      }

      setActionMessage({
        type: "success",
        text: `แยกคำร้องที่มีข้อขัดแย้งออกจากกลุ่มสำเร็จ (${removedCount} รายการ) ข้อมูลคำร้องต้นฉบับยังคงอยู่ในระบบครบถ้วน`,
      });
      mutateGroup();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการแยกคำร้อง";
      setActionMessage({ type: "error", text: msg });
    } finally {
      setIsProcessing(false);
    }
  };

  if (groupLoading) {
    return (
      <div className="flex-1 p-6 space-y-6 max-w-6xl mx-auto w-full animate-pulse">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="h-32 bg-white dark:bg-slate-900 rounded-2xl" />
        <div className="h-96 bg-white dark:bg-slate-900 rounded-2xl" />
      </div>
    );
  }

  if (groupError || !group) {
    return (
      <div className="flex-1 p-6 max-w-lg mx-auto w-full text-center space-y-4 pt-16">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">ไม่พบกลุ่มเหตุการณ์นี้</h2>
        <p className="text-sm text-slate-500">กลุ่มเหตุการณ์อาจถูกลบไปแล้ว หรือคุณไม่มีสิทธิ์เข้าถึง</p>
        <Link
          href="/backoffice/incidents"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white font-bold rounded-xl text-sm"
        >
          กลับไปหน้ารายการ
        </Link>
      </div>
    );
  }

  const createdAt = new Date(group.created_at).toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto w-full animate-fade-in pb-16">
      {/* Top Breadcrumb */}
      <div>
        <Link
          href="/backoffice/incidents"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          กลับไปรายการกลุ่มเหตุการณ์
        </Link>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${
            actionMessage.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-rose-50 text-rose-600 border border-rose-200"
          }`}
        >
          {actionMessage.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Group Header Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-bold text-sm px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {group.group_code}
              </span>
              {group.categories && (
                <span className="text-xs px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-bold">
                  {group.categories.name_th}
                </span>
              )}
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> สร้างเมื่อ {createdAt} น.
              </span>
            </div>

            <h1 className="text-2xl font-black text-slate-800 dark:text-white">
              {group.title}
            </h1>

            {group.description && (
              <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                {group.description}
              </p>
            )}
          </div>

          {/* Status Changer */}
          <div className="w-full md:w-56 shrink-0 space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
              สถานะกลุ่มเหตุการณ์
            </label>
            <AppSelect
              value={group.status}
              onChange={(val) => handleStatusChange(val as string)}
              disabled={isProcessing}
              options={[
                { label: "เปิดดำเนินการ (Open)", value: "open" },
                { label: "แก้ไขแล้ว (Resolved)", value: "resolved" },
                { label: "ปิดกลุ่ม (Closed)", value: "closed" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-px overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab("members")}
          className={`flex items-center gap-2 px-4 py-3 font-bold text-sm border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === "members"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>คำร้องในกลุ่ม</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
            {members.length}
          </span>
          {unrepliedMemberReports.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-50 text-amber-700 font-bold border border-amber-200">
              ยังไม่ตอบ {unrepliedMemberReports.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("candidates")}
          className={`flex items-center gap-2 px-4 py-3 font-bold text-sm border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === "candidates"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>คำร้องที่ระบบเสนอว่าเกี่ยวข้องกัน</span>
          {candidates.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 font-bold">
              {candidates.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("add_ungrouped")}
          className={`flex items-center gap-2 px-4 py-3 font-bold text-sm border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === "add_ungrouped"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>ค้นหาคำร้องเพิ่มเติม</span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-3 font-bold text-sm border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === "history"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <History className="w-4 h-4" />
          <span>ประวัติการจัดกลุ่ม ({history.length})</span>
        </button>
      </div>

      {/* Tab 1: Current Members */}
      {activeTab === "members" && (
        <div className="space-y-4">
          {members.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-700">ยังไม่มีคำร้องในกลุ่มนี้</h3>
              <p className="text-xs text-slate-400">
                คุณสามารถเลือกดูคำร้องที่ระบบเสนอแนะในแท็บ &quot;คำร้องที่ระบบเสนอว่าเกี่ยวข้องกัน&quot; หรือค้นหาคำร้องเพิ่มเติมได้
              </p>
              <button
                onClick={() => setActiveTab("candidates")}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white font-bold rounded-xl text-xs"
              >
                ดูคำร้องที่ระบบเสนอแนะ
              </button>
            </div>
          ) : (
            <>
              {/* Contradiction Warning Alert */}
              {incompatibleMembers.length > 0 && (
                <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <h4 className="font-bold text-sm text-amber-950 dark:text-amber-100 flex items-center gap-2">
                        <span>ตรวจพบคำร้องที่มีข้อขัดแย้งกับเหตุการณ์หลัก</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                          {incompatibleMembers.length} รายการ
                        </span>
                      </h4>
                      <p className="text-xs text-amber-800/90 dark:text-amber-300">
                        ระบบตรวจพบว่าคำร้องบางรายการในกลุ่มนี้มีข้อขัดแย้งของปัญหา/ระบบบริการที่ไม่เข้ากัน (เช่น ปัญหาน้ำท่วม vs ปัญหา Wi-Fi) เจ้าหน้าที่สามารถกดแยกคำร้องออกเพื่อคงความถูกต้องของกลุ่มเหตุการณ์ โดยระบบจะบันทึก Audit History ให้อัตโนมัติ
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    {incompatibleMembers.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 text-xs shadow-xs"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-primary">{item.member.public_id}</span>
                            <span className="text-slate-400">ขัดแย้งกับ</span>
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{item.contradictingWith.public_id}</span>
                            <span className="text-[10px] text-slate-400">({item.member.location || "ไม่ระบุสถานที่"})</span>
                          </div>
                          <p className="text-slate-700 dark:text-slate-300 line-clamp-1 font-medium">
                            &ldquo;{item.member.description}&rdquo;
                          </p>
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {item.reasons.map((r, rIdx) => (
                              <span key={rIdx} className="text-[11px] px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                                ⚠️ {localizeConflictReason(r)}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMemberToRemove(item.member);
                            setRemoveReason(`แยกคำร้องเนื่องจากมีข้อขัดแย้งกับเหตุการณ์หลัก: ${item.reasons.map((r) => localizeConflictReason(r)).join(", ")}`);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shrink-0 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>แยกออกจากกลุ่ม (Audit Log)</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Bulk removal of all incompatible members */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-amber-200/80 dark:border-amber-800/80">
                    <span className="text-xs text-amber-900/90 dark:text-amber-200 font-medium">
                      สามารถเลือกแยกเฉพาะคำร้องแต่ละรายการ หรือแยกคำร้องที่มีข้อขัดแย้งทั้งหมดออกจากกลุ่ม
                    </span>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleRemoveAllIncompatibleMembers}
                      className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>แยกคำร้องที่มีข้อขัดแย้งทั้งหมดออกจากกลุ่ม ({incompatibleMembers.length} รายการ)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Bulk Selection and Action Toolbar */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* Select All */}
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-slate-500" />
                    <span>เลือกทั้งหมด ({members.length})</span>
                  </button>

                  {/* Select Unreplied */}
                  <button
                    type="button"
                    onClick={handleSelectUnreplied}
                    className="px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100/60 font-bold text-amber-900 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>เลือกเฉพาะที่ยังไม่ตอบกลับ ({unrepliedMemberReports.length})</span>
                  </button>

                  {/* Clear Selection */}
                  {selectedMemberIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="px-3 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-bold transition-colors cursor-pointer"
                    >
                      ล้างการเลือก
                    </button>
                  )}

                  <span className="text-slate-400 pl-1">
                    | เลือกแล้ว <strong className="text-slate-800 dark:text-white font-mono">{selectedMemberIds.length}</strong> จาก {members.length} รายการ
                  </span>
                </div>

                {/* Bulk Reply Trigger Button */}
                <button
                  type="button"
                  onClick={() => {
                    setBulkMessage("");
                    setBulkTargetStatus("");
                    setBulkModalOpen(true);
                  }}
                  disabled={selectedMemberIds.length === 0 || isProcessing}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>ตอบกลับเป็นชุด (Bulk Reply)</span>
                  {selectedMemberIds.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-mono font-black">
                      {selectedMemberIds.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Members List */}
              <div className="grid grid-cols-1 gap-3">
                {members.map((m: MemberItem) => {
                  const rep = getMemberReport(m);
                  if (!rep) return null;

                  const isSelected = selectedMemberIds.includes(rep.public_id);
                  const isReplied = isReportReplied(rep);
                  const isContradictory = incompatiblePublicIds.has(rep.public_id);

                  const repDate = new Date(rep.created_at).toLocaleString("th-TH", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={m.id}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                        isSelected
                          ? "bg-red-50/30 border-primary/50 shadow-sm"
                          : isContradictory
                          ? "bg-amber-50/20 border-amber-300 dark:border-amber-700 shadow-sm"
                          : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm"
                      }`}
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        {/* Checkbox */}
                        <div className="pt-1 shrink-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectMember(rep.public_id)}
                            aria-label={`เลือกคำร้อง ${rep.public_id}`}
                            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                          />
                        </div>

                        {/* Content */}
                        <div className="space-y-2 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openDrawer(rep.public_id)}
                              className="font-mono text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>{rep.public_id}</span>
                            </button>
                            <StatusBadge status={rep.status} />

                            {/* Contradiction Alert Badge */}
                            {isContradictory && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                มีข้อขัดแย้งกับสมาชิกอื่น
                              </span>
                            )}

                            {/* Reply Status Badge */}
                            {isReplied ? (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                ตอบกลับแล้ว
                              </span>
                            ) : (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                ยังไม่ตอบกลับ
                              </span>
                            )}

                            {rep.categories && (
                              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                                {rep.categories.name_th}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> แจ้งเมื่อ {repDate} น.
                            </span>
                          </div>

                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">
                            {rep.description}
                          </p>

                          {/* Admin Remark Preview if replied */}
                          {isReplied && (
                            <div className="text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 space-y-1">
                              <div className="flex items-center gap-1.5 font-bold text-slate-500 text-[11px]">
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                                <span>ข้อความตอบกลับล่าสุด:</span>
                              </div>
                              <p className="line-clamp-2 italic text-slate-600 dark:text-slate-300 whitespace-pre-line pl-5">
                                &ldquo;{rep.admin_remark}&rdquo;
                              </p>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                            {rep.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                {rep.location}
                              </span>
                            )}
                            {rep.reporter_name && (
                              <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                {rep.reporter_name}
                              </span>
                            )}
                          </div>

                          {m.notes && (
                            <p className="text-xs text-slate-400 italic">
                              หมายเหตุการจัดกลุ่ม: {m.notes}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 shrink-0 pt-2 md:pt-0">
                          {/* Request Detail Drawer Trigger */}
                          <button
                            type="button"
                            onClick={() => openDrawer(rep.public_id)}
                            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            title="ดูรายละเอียดและตอบกลับในหน้าต่างสไลด์ (Drawer)"
                          >
                            <FileText className="w-3.5 h-3.5 text-primary" />
                            <span>ดูรายละเอียด</span>
                          </button>

                          {/* Open in New Tab */}
                          <Link
                            href={`/backoffice/reports/${rep.public_id}`}
                            target="_blank"
                            className="p-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center"
                            title="เปิดในแท็บใหม่"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>

                          {/* Remove from Group */}
                          <button
                            type="button"
                            onClick={() => {
                              setMemberToRemove(rep);
                              setRemoveReason("");
                            }}
                            className="p-1.5 text-xs font-bold rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors flex items-center justify-center cursor-pointer"
                            title="นำออกจากกลุ่ม (คำร้องต้นฉบับยังคงอยู่)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 2: AI / Similarity Candidates */}
      {activeTab === "candidates" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">ระบบเสนอคำร้องที่อาจเกี่ยวข้องโดยอิงจาก Similarity Detection</p>
              <p className="text-amber-800 mt-0.5">
                คะแนนคำนวณจากหมวดหมู่ สถานที่ เวลา และเนื้อหาคำร้อง เจ้าหน้าที่ต้องตรวจสอบและกดยืนยันก่อนนำเข้ากลุ่มเสมอ (Human-in-the-Loop)
              </p>
            </div>
          </div>

          {candidatesLoading ? (
            <div className="py-12 text-center text-sm text-slate-400">กำลังประมวลผลความคล้ายคลึงของคำร้อง...</div>
          ) : candidates.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 p-8 text-center text-sm text-slate-400">
              ไม่พบคำร้องที่เข้าเกณฑ์ความคล้ายคลึงกับเหตุการณ์นี้
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {candidates.map((cand: CandidateItem) => {
                const rep = cand.report;
                const repDate = new Date(rep.created_at).toLocaleString("th-TH", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={cand.public_id}
                    className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-700">
                          {cand.public_id}
                        </span>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                            cand.confidence === "high"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          คะแนน {cand.score}% • {cand.confidenceLabel}
                        </span>
                        {cand.recommendationLabel && (
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                              cand.recommendationType === "same_incident"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {cand.recommendationLabel}
                          </span>
                        )}
                        {cand.existingGroup && (
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-bold flex items-center gap-1">
                            <Layers className="w-3 h-3" />
                            อยู่ในกลุ่ม {cand.existingGroup.group_code}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          {repDate} น.
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {rep.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                        {rep.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {rep.location}
                          </span>
                        )}
                        {rep.categoryName && (
                          <span>หมวด: {rep.categoryName}</span>
                        )}
                      </div>

                      {/* Reasons */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {cand.reasons.map((r: string, idx: number) => (
                          <span
                            key={idx}
                            className="text-[11px] px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800 text-slate-600 border border-slate-100 font-medium"
                          >
                            ✓ {localizeConflictReason(r)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <button
                        type="button"
                        onClick={() => openDrawer(cand.public_id)}
                        className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        ดูคำร้อง
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddCandidate(cand)}
                        disabled={isProcessing}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        เพิ่มเข้ากลุ่มนี้
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Add Ungrouped Reports */}
      {activeTab === "add_ungrouped" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาคำร้องที่ยังไม่อยู่ในกลุ่ม..."
                value={ungroupedSearch}
                onChange={(e) => setUngroupedSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-800"
              />
            </div>

            <button
              type="button"
              onClick={handleAddSelectedUngrouped}
              disabled={selectedUngrouped.length === 0 || isProcessing}
              className="w-full sm:w-auto px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>เพิ่มรายการที่เลือกเข้ากลุ่ม ({selectedUngrouped.length})</span>
            </button>
          </div>

          {ungroupedLoading ? (
            <div className="py-12 text-center text-sm text-slate-400">กำลังโหลดคำร้อง...</div>
          ) : ungroupedReports.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl text-center text-sm text-slate-400">
              ไม่พบคำร้องที่ยังไม่อยู่ในกลุ่ม
            </div>
          ) : (
            <div className="space-y-2">
              {ungroupedReports.map((rep: UngroupedItem) => {
                const isSelected = selectedUngrouped.includes(rep.public_id);
                return (
                  <div
                    key={rep.id}
                    onClick={() => {
                      setSelectedUngrouped((prev) =>
                        prev.includes(rep.public_id)
                          ? prev.filter((id) => id !== rep.public_id)
                          : [...prev, rep.public_id]
                      );
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                      isSelected
                        ? "bg-red-50/70 border-primary/40"
                        : "bg-white border-slate-100 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-700">
                          {rep.public_id}
                        </span>
                        <StatusBadge status={rep.status} />
                        {rep.categories?.name_th && (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                            {rep.categories.name_th}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-800 font-medium line-clamp-2">
                        {rep.description}
                      </p>
                      {rep.location && (
                        <p className="text-[11px] text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {rep.location}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: History Audit Logs */}
      {activeTab === "history" && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-800 dark:text-white border-b pb-3">
            บันทึกประวัติการดำเนินการ (Audit Timeline)
          </h3>

          {history.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">ยังไม่มีบันทึกประวัติ</div>
          ) : (
            <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-100">
              {history.map((h: HistoryItem) => {
                const hDate = new Date(h.created_at).toLocaleString("th-TH", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                const getActionText = (action: string) => {
                  switch (action) {
                    case "create_group":
                      return "สร้างกลุ่มเหตุการณ์";
                    case "add_report":
                      return "เพิ่มคำร้องเข้ากลุ่ม";
                    case "remove_report":
                      return "นำคำร้องออกจากกลุ่ม";
                    case "move_report":
                      return "ย้ายคำร้องระหว่างกลุ่ม";
                    case "status_change":
                      return "เปลี่ยนสถานะกลุ่ม";
                    case "update_details":
                      return "ปรับปรุงรายละเอียดกลุ่ม";
                    case "bulk_reply":
                      return "ตอบกลับเป็นชุด (Bulk Reply)";
                    default:
                      return action;
                  }
                };

                return (
                  <div key={h.id} className="relative flex items-start gap-4 pl-8">
                    <div className="absolute left-1.5 top-1.5 w-4 h-4 rounded-full bg-primary/20 border-2 border-primary" />
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {getActionText(h.action)}
                        </span>
                        {h.actor_name && (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                            โดย {h.actor_name}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">{hDate} น.</span>
                      </div>

                      {h.details && (
                        <p className="text-xs text-slate-500 font-mono bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-100">
                          {JSON.stringify(h.details)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* Slide-over Drawer: Request Detail View */}
      {/* ========================================================================= */}
      {mounted && drawerPublicId && createPortal(
        <div className="fixed inset-0 z-[60] overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity"
            onClick={closeDrawer}
          />

          <div className="fixed inset-y-0 right-0 max-w-3xl w-full flex pl-6 sm:pl-10">
            <div className="w-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-slide-in-right">
              {/* Drawer Header */}
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-slate-800/70">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <span>รายละเอียดคำร้อง</span>
                      <span className="font-mono text-primary">{drawerPublicId}</span>
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      ตรวจสอบข้อมูล ประวัติ และตอบกลับหรือปรับสถานะคำร้อง
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/backoffice/reports/${drawerPublicId}`}
                    target="_blank"
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="เปิดในแท็บใหม่"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={closeDrawer}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="ปิด Drawer (Esc)"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto">
                <ReportDetailView
                  publicId={drawerPublicId}
                  userRole={profile?.role}
                  isDrawer={true}
                  onClose={closeDrawer}
                />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* Modal: Bulk Reply Confirmation & Input (Two-Column Layout) */}
      {/* ========================================================================= */}
      {mounted && bulkModalOpen && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 lg:p-6 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div 
            className="fixed inset-0 bg-transparent"
            onClick={() => !isProcessing && setBulkModalOpen(false)}
          />
          <div className="relative z-10 bg-white dark:bg-slate-900 rounded-2xl max-w-5xl w-full p-4 sm:p-6 shadow-2xl border border-slate-100 dark:border-slate-800 my-auto flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">
                    ตอบกลับเป็นชุด (Bulk Reply)
                  </h3>
                  <p className="text-xs text-slate-500">
                    กลุ่มเหตุการณ์: <span className="font-mono font-bold text-primary">{group.group_code}</span> • {group.title || "ไม่ระบุหัวข้อ"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!isProcessing) {
                    setBulkModalOpen(false);
                    setBulkImage(null);
                    setBulkImagePreview(null);
                  }
                }}
                disabled={isProcessing}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                title="ปิด (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Two-Column Grid on Desktop, Stacked on Mobile */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 flex-1 min-h-0 overflow-y-auto pr-0.5">
              
              {/* ================================================================ */}
              {/* LEFT COLUMN: Selected Requests (5 cols on lg)                   */}
              {/* ================================================================ */}
              <div className="lg:col-span-5 flex flex-col space-y-3 min-w-0">
                <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    เลือกคำร้องที่จะได้รับข้อความตอบกลับ ({selectedMemberIds.length} จาก {validMemberReports.length} รายการ)
                  </label>
                  <div className="flex items-center gap-2 text-[11px] shrink-0">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      disabled={isProcessing}
                      className="text-primary hover:underline font-bold cursor-pointer disabled:opacity-40"
                    >
                      เลือกทั้งหมด
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      disabled={isProcessing}
                      className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-bold cursor-pointer disabled:opacity-40"
                    >
                      ล้างการเลือก
                    </button>
                  </div>
                </div>

                {/* Independent Scrollable List */}
                <div className="overflow-y-auto max-h-[360px] lg:max-h-[460px] space-y-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80">
                  {sortedModalReports.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">
                      ไม่มีคำร้องในกลุ่มนี้
                    </div>
                  ) : (
                    sortedModalReports.map((rep) => {
                      const isSelected = selectedMemberIds.includes(rep.public_id);
                      const isBlocked = rep.status === "completed" && profile?.role === "staff";

                      return (
                        <div
                          key={rep.public_id}
                          onClick={() => {
                            if (!isBlocked && !isProcessing) {
                              toggleSelectMember(rep.public_id);
                            }
                          }}
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                            isSelected
                              ? "bg-white dark:bg-slate-900 border-primary/40 shadow-xs ring-1 ring-primary/20"
                              : "bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-700/60 opacity-70 hover:opacity-100"
                          } ${isBlocked ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800" : ""}`}
                        >
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isBlocked || isProcessing}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleSelectMember(rep.public_id);
                            }}
                            aria-label={`เลือกคำร้อง ${rep.public_id}`}
                            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer shrink-0 disabled:opacity-40"
                          />

                          {/* Public ID */}
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200 shrink-0 select-text">
                            {rep.public_id}
                          </span>

                          <span className="text-slate-300 dark:text-slate-600 shrink-0">·</span>

                          {/* Descriptive single-line summary with tooltip */}
                          <span
                            title={rep.description || "-"}
                            className="text-slate-600 dark:text-slate-300 font-medium truncate flex-1 min-w-0"
                          >
                            {rep.description || "-"}
                          </span>

                          {/* Status Badge */}
                          <div className="shrink-0 flex items-center gap-1">
                            {isBlocked ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-bold whitespace-nowrap">
                                เสร็จสิ้นแล้ว
                              </span>
                            ) : (
                              <StatusBadge status={rep.status} />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
                  <span>เลือกแล้ว: <strong className="text-slate-700 dark:text-slate-200 font-mono">{selectedMemberIds.length}</strong> รายการ</span>
                  <span>* คำร้องที่ไม่ได้เลือกจะไม่ถูกแก้ไข</span>
                </div>
              </div>

              {/* ================================================================ */}
              {/* RIGHT COLUMN: Reply and Status (7 cols on lg)                    */}
              {/* ================================================================ */}
              <div className="lg:col-span-7 flex flex-col space-y-4 min-w-0">
                
                {/* 1. สถานะคำร้อง */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    สถานะคำร้อง
                  </label>
                  <AppSelect
                    value={bulkTargetStatus}
                    onChange={(val) => handleBulkTargetStatusChange(val as string)}
                    disabled={isProcessing}
                    options={[
                      { label: currentBulkStatusLabel, value: "" },
                      { label: "รับเรื่องแล้ว (Received)", value: "received" },
                      { label: "กำลังดำเนินการ (In Progress)", value: "in_progress" },
                      { label: "แก้ไขเสร็จสิ้น (Completed)", value: "completed" },
                      { label: "ปฏิเสธคำร้อง (Rejected)", value: "rejected" },
                      { label: "ยกเลิกคำร้อง (Cancelled)", value: "cancelled" },
                    ]}
                  />
                  <p className="text-[11px] text-slate-400">
                    {bulkTargetStatus
                      ? `คำร้องที่เลือกทั้ง ${selectedMemberIds.length} รายการจะถูกเปลี่ยนเป็นสถานะนี้`
                      : `ตอบกลับตามสถานะจริงปัจจุบันของแต่ละคำร้อง (${currentBulkStatusLabel})`}
                  </p>
                </div>

                {/* 2. หมายเหตุสรุปผล / ข้อความตอบกลับ */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    หมายเหตุสรุปผล / ข้อความตอบกลับ <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={bulkMessage}
                    onChange={(e) => setBulkMessage(e.target.value)}
                    placeholder="ระบุข้อความตอบกลับ เช่น เจ้าหน้าที่ได้รับเรื่องแล้ว ขณะนี้กำลังประสานหน่วยงานเข้าดำเนินการแก้ไข..."
                    className="w-full p-3 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-800 dark:text-slate-100 placeholder-slate-400 font-medium resize-y min-h-[90px]"
                    disabled={isProcessing}
                  />
                  <p className="text-[11px] text-slate-400">
                    ข้อความนี้จะแสดงในหน้าติดตามสถานะของประชาชน (Tracking Portal)
                  </p>
                </div>

                {/* 3. รูปภาพแนบ */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      รูปภาพแนบ {bulkTargetStatus === "completed" ? <span className="text-rose-500">* (จำเป็นสำหรับสถานะเสร็จสิ้น)</span> : <span className="text-slate-400 font-normal text-[11px]">(แนบได้เฉพาะสถานะเสร็จสิ้น)</span>}
                    </label>
                    {bulkImagePreview && bulkTargetStatus === "completed" && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                        ✓ มีรูปภาพแนบ
                      </span>
                    )}
                  </div>

                  {bulkTargetStatus !== "completed" ? (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700/80 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-2.5">
                      <ImageOff className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>สามารถแนบรูปภาพได้เมื่อเลือกสถานะ &ldquo;เสร็จสิ้น&rdquo; เท่านั้น</span>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        ref={bulkFileInputRef}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            if (file.size > 5 * 1024 * 1024) {
                              setActionMessage({ type: "error", text: "รูปภาพมีขนาดใหญ่เกินไป (สูงสุด 5MB)" });
                              return;
                            }
                            setBulkImage(file);
                            setBulkImagePreview(URL.createObjectURL(file));
                          }
                        }}
                        className="hidden"
                        disabled={isProcessing}
                      />

                      {!bulkImagePreview ? (
                        <div 
                          onClick={() => !isProcessing && bulkFileInputRef.current?.click()}
                          className={`w-full h-24 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center gap-1 ${!isProcessing ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-primary/50" : "opacity-50"} transition-colors group`}
                        >
                          <ImagePlus className="w-5 h-5 text-slate-400 group-hover:scale-110 transition-transform" />
                          <div className="text-center px-2">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">คลิกเพื่ออัปโหลดรูปภาพแนบ</p>
                            <p className="text-[10px] text-slate-400">รองรับ JPG, PNG, WebP สูงสุด 5MB</p>
                          </div>
                        </div>
                      ) : (
                        <div className="relative w-full max-h-40 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={bulkImagePreview} alt="Preview" className="w-full h-auto max-h-40 object-contain" />
                          {!isProcessing && (
                            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                              <button
                                type="button"
                                onClick={() => bulkFileInputRef.current?.click()}
                                className="px-3 py-1 bg-white text-slate-700 rounded-lg text-xs font-bold shadow-xs hover:bg-slate-50 cursor-pointer"
                              >
                                เปลี่ยนรูป
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setBulkImage(null);
                                  setBulkImagePreview(null);
                                }}
                                className="px-3 py-1 bg-rose-500 text-white rounded-lg text-xs font-bold shadow-xs hover:bg-rose-600 cursor-pointer"
                              >
                                ลบรูป
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 4. Confirmation Summary Box */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                  <div className="font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                    <span>สรุปการตอบกลับเป็นชุด:</span>
                    <span className="font-mono text-primary font-bold">{selectedMemberIds.length} รายการ</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                    <div className="flex items-start gap-1.5">
                      <span className="font-semibold text-slate-500 shrink-0">• สถานะ:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {bulkTargetStatus
                          ? getStatusLabel(bulkTargetStatus)
                          : currentBulkStatusLabel}
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="font-semibold text-slate-500 shrink-0">• ข้อความ:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-sm">
                        {bulkMessage.trim() ? `"${bulkMessage.trim()}"` : <span className="text-rose-500 font-normal">ยังไม่ได้ระบุข้อความตอบกลับ</span>}
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="font-semibold text-slate-500 shrink-0">• รูปภาพ:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {bulkImage
                          ? `แนบรูปภาพแล้ว (${bulkImage.name})`
                          : bulkTargetStatus === "completed"
                          ? <span className="text-rose-500 font-bold">จำเป็นต้องแนบรูปภาพ</span>
                          : "ไม่มีรูปภาพแนบ"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkModalOpen(false);
                      setBulkImage(null);
                      setBulkImagePreview(null);
                    }}
                    disabled={isProcessing}
                    className="px-4 py-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteBulkReply}
                    disabled={
                      isProcessing ||
                      selectedMemberIds.length === 0 ||
                      !bulkMessage.trim() ||
                      (bulkTargetStatus === "completed" && !bulkImage && !bulkImagePreview)
                    }
                    className="px-5 py-2.5 text-xs font-black rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-40 text-white transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>กำลังส่ง...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>ยืนยันส่งตอบกลับ ({selectedMemberIds.length} รายการ)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* Modal: Bulk Reply Result Summary */}
      {/* ========================================================================= */}
      {mounted && bulkResultModal && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div
            className="fixed inset-0 bg-transparent"
            onClick={() => {
              setBulkResultModal(null);
              setSelectedMemberIds([]);
            }}
          />
          <div className="relative z-10 bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-100 dark:border-slate-800 my-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">
                    ผลลัพธ์การตอบกลับเป็นชุด
                  </h3>
                  <p className="text-xs text-slate-500">
                    Batch ID: <span className="font-mono">{bulkResultModal.batchId}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setBulkResultModal(null);
                  setSelectedMemberIds([]);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metrics Chips */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100">
                <div className="text-xs text-slate-400">ทั้งหมด</div>
                <div className="text-base font-black text-slate-700 dark:text-slate-200">
                  {bulkResultModal.totalRequested}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100">
                <div className="text-xs text-emerald-600">สำเร็จ</div>
                <div className="text-base font-black text-emerald-700">
                  {bulkResultModal.totalSaved}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200">
                <div className="text-xs text-slate-500">ข้าม</div>
                <div className="text-base font-black text-slate-700 dark:text-slate-300">
                  {bulkResultModal.totalSkipped}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100">
                <div className="text-xs text-rose-600">ล้มเหลว</div>
                <div className="text-base font-black text-rose-700">
                  {bulkResultModal.totalFailed}
                </div>
              </div>
            </div>

            {/* Per-item Breakdown */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                รายละเอียดผลการดำเนินการแต่ละรายการ:
              </label>
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                {bulkResultModal.results.map((r) => {
                  const rep = validMemberReports.find((v) => v.public_id === r.publicId);
                  return (
                    <div
                      key={r.publicId}
                      className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between gap-2 min-w-0"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 shrink-0">
                          {r.publicId}
                        </span>
                        {rep?.description && (
                          <>
                            <span className="text-slate-300 dark:text-slate-600 shrink-0">·</span>
                            <span
                              title={rep.description}
                              className="text-slate-500 dark:text-slate-400 truncate flex-1 min-w-0"
                            >
                              {rep.description}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="shrink-0">
                        {r.saved ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold flex items-center gap-1 whitespace-nowrap">
                            <Check className="w-3 h-3" />
                            บันทึกสำเร็จ
                          </span>
                        ) : r.status === "skipped" ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium whitespace-nowrap">
                            ข้าม: {r.message || "ไม่มีสิทธิ์"}
                          </span>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-bold whitespace-nowrap">
                            ล้มเหลว: {r.error || "เกิดข้อผิดพลาด"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              {bulkResultModal.totalFailed > 0 && (
                <button
                  type="button"
                  onClick={handleRetryFailedBulk}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>ลองส่งใหม่เฉพาะรายการที่ล้มเหลว ({bulkResultModal.totalFailed})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setBulkResultModal(null);
                  setSelectedMemberIds([]);
                }}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-900 text-white transition-all shadow-sm cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* Modal: Individual Reply Modal */}
      {/* ========================================================================= */}
      {mounted && individualModal && individualModal.show && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div
            className="fixed inset-0 bg-transparent"
            onClick={() => !isProcessing && setIndividualModal(null)}
          />
          <div className="relative z-10 bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-100 dark:border-slate-800 my-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <span>ตอบกลับคำร้องเดี่ยว</span>
                    <span className="font-mono text-primary">{individualModal.report.public_id}</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    ตอบกลับเฉพาะคำร้องนี้ โดยไม่กระทบคำร้องอื่นในกลุ่มเหตุการณ์
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIndividualModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Report Excerpt */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <div className="flex items-center gap-2">
                <StatusBadge status={individualModal.report.status} />
                {individualModal.report.reporter_name && (
                  <span className="text-slate-500">ผู้แจ้ง: {individualModal.report.reporter_name}</span>
                )}
              </div>
              <p className="text-slate-700 dark:text-slate-200 line-clamp-2">
                {individualModal.report.description}
              </p>
            </div>

            {/* Existing Remark if any */}
            {individualModal.report.admin_remark && (
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-500">
                  ข้อความตอบกลับเดิมที่เคยบันทึกไว้:
                </label>
                <p className="p-2.5 rounded-lg bg-amber-50/50 border border-amber-200/60 text-xs text-amber-900 italic whitespace-pre-line">
                  &ldquo;{individualModal.report.admin_remark}&rdquo;
                </p>
              </div>
            )}

            {/* 1. Target Status Dropdown */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                สถานะคำร้อง
              </label>
              <AppSelect
                value={individualModal.targetStatus}
                onChange={(val) =>
                  setIndividualModal({ ...individualModal, targetStatus: val as string })
                }
                options={[
                  {
                    label: getStatusLabel(individualModal.report.status),
                    value: "",
                  },
                  ...(individualModal.report.status !== "received"
                    ? [{ label: "รับเรื่องแล้ว (Received)", value: "received" }]
                    : []),
                  ...(individualModal.report.status !== "in_progress"
                    ? [{ label: "กำลังดำเนินการ (In Progress)", value: "in_progress" }]
                    : []),
                  ...(individualModal.report.status !== "completed"
                    ? [{ label: "แก้ไขเสร็จสิ้น (Completed)", value: "completed" }]
                    : []),
                  ...(individualModal.report.status !== "rejected"
                    ? [{ label: "ปฏิเสธคำร้อง (Rejected)", value: "rejected" }]
                    : []),
                  ...(individualModal.report.status !== "cancelled"
                    ? [{ label: "ยกเลิกคำร้อง (Cancelled)", value: "cancelled" }]
                    : []),
                ]}
              />
            </div>

            {/* 2. Message Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                หมายเหตุสรุปผล / ข้อความตอบกลับ <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={individualModal.message}
                onChange={(e) =>
                  setIndividualModal({ ...individualModal, message: e.target.value })
                }
                placeholder="ระบุข้อความตอบกลับ เช่น เจ้าหน้าที่ได้รับเรื่องแล้ว ขณะนี้กำลังเข้าดำเนินการแก้ไข..."
                className="w-full p-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-800 dark:text-slate-100 placeholder-slate-400 font-medium resize-y min-h-[90px]"
              />
            </div>

            {/* Notice */}
            <p className="text-[11px] text-slate-400">
              ✓ บันทึกข้อความลงหมายเหตุของคำร้อง และบันทึกประวัติการตอบกลับใน Report Logs
            </p>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIndividualModal(null)}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleExecuteIndividualReply}
                disabled={isProcessing || !individualModal.message.trim()}
                className="px-5 py-2 text-xs font-black rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-40 text-white transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isProcessing ? "กำลังบันทึก..." : "บันทึกการตอบกลับ"}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* Modal: Confirm Move from Another Group */}
      {/* ========================================================================= */}
      {mounted && confirmMoveModal && confirmMoveModal.show && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            className="fixed inset-0 bg-transparent"
            onClick={() => setConfirmMoveModal(null)}
          />
          <div className="relative z-10 bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                คำร้องนี้อยู่ในกลุ่มเหตุการณ์อื่นแล้ว
              </h3>
              <p className="text-sm text-slate-500 flex items-center flex-wrap gap-1.5">
                <span>คำร้อง</span>
                <strong className="text-slate-700 font-mono">{confirmMoveModal.report?.public_id}</strong>
                {confirmMoveModal.report?.report?.status && (
                  <StatusBadge status={confirmMoveModal.report.report.status} />
                )}
                <span>ปัจจุบันเป็นสมาชิกของกลุ่ม:</span>
              </p>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-0.5">
                <p className="font-bold text-slate-700 font-mono">
                  {confirmMoveModal.existingGroup?.current_group_code}
                </p>
                <p className="text-slate-600">
                  {confirmMoveModal.existingGroup?.current_group_title}
                </p>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                คุณต้องการย้ายคำร้องนี้มายังกลุ่ม <strong className="text-primary font-mono">{group.group_code}</strong> หรือไม่?
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmMoveModal(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => handleAddCandidate(confirmMoveModal.report, true)}
                className="px-4 py-2 text-xs font-black rounded-xl bg-primary hover:bg-primary-hover text-white transition-all shadow-sm cursor-pointer"
              >
                ยืนยันย้ายกลุ่ม
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* Modal: Remove Member from Group */}
      {/* ========================================================================= */}
      {mounted && memberToRemove && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            className="fixed inset-0 bg-transparent"
            onClick={() => setMemberToRemove(null)}
          />
          <div className="relative z-10 bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                ยืนยันนำคำร้องออกจากกลุ่ม
              </h3>
              <p className="text-sm text-slate-500">
                ต้องการนำคำร้อง <strong className="text-slate-700 font-mono">{memberToRemove.public_id}</strong> ออกจากกลุ่มเหตุการณ์นี้ใช่หรือไม่?
              </p>
              <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                ✓ คำร้องต้นฉบับจะยังคงอยู่ในระบบตามปกติ และสามารถนำกลับเข้ากลุ่มอื่นได้ในอนาคต
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                เหตุผลในการนำออก (บันทึกลง Audit Log)
              </label>
              <input
                type="text"
                placeholder="เช่น เป็นคนละเหตุการณ์, ตรวจสอบแล้วไม่ใช่สถานที่เดียวกัน"
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-800"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMemberToRemove(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveMember}
                className="px-4 py-2 text-xs font-black rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-sm cursor-pointer"
              >
                ยืนยันนำออก
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
