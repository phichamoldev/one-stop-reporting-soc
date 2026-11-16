"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { fetcherWithAuth } from "@/lib/fetcher";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import {
  Layers,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  ChevronRight,
  FolderOpen,
  Sparkles,
  ShieldAlert,
  HelpCircle,
  Check,
  X,
  Link as LinkIcon,
  Split,
  ChevronDown,
  ChevronUp,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { AppSelect } from "@/components/ui/AppSelect";
import { StatusBadge } from "@/components/design-system/StatusBadge";
import { IncidentDraftReview } from "@/components/backoffice/IncidentDraftReview";

interface IncidentGroup {
  id: string;
  group_code: string;
  title: string;
  description: string | null;
  status: "open" | "resolved" | "closed";
  priority?: "emergency" | "normal" | "needs_review";
  category_id: number | null;
  created_at: string;
  updated_at: string;
  memberCount: number;
  categories?: {
    id: number;
    name_th: string;
  } | null;
}

interface DraftReport {
  id: string;
  public_id: string;
  location?: string | null;
  description?: string | null;
  status?: string;
  priority: "emergency" | "normal" | "needs_review";
  priorityReason?: string;
  created_at: string;
  categoryName?: string;
  subcategoryName?: string;
}

interface CandidateExistingGroup {
  group: {
    id: string;
    group_code: string;
    title: string;
    status: string;
  };
  score: number;
  confidenceLabel: string;
  reasons: string[];
  isPastIncident: boolean;
}

interface IncidentDraft {
  draftId: string;
  proposedTitle: string;
  proposedDescription: string;
  priority: "emergency" | "normal" | "needs_review";
  priorityReason: string;
  category_id: number | null;
  subcategory_id: number | null;
  categoryName?: string;
  subcategoryName?: string;
  reportCount: number;
  reports: DraftReport[];
  earliestReportDate: string;
  latestReportDate: string;
  timeSpanHours: number;
  correlationScore: number;
  reasons: string[];
  evidence?: string[];
  differences?: string[];
  locationSummary?: string;
  spatialGranularity?: string;
  sharedRootCause?: string | null;
  insufficientEvidenceReports?: DraftReport[];
  suggestedExistingGroups: CandidateExistingGroup[];
  conflicts: string[];
  isEmergency: boolean;
}

interface OverviewMetrics {
  emergencyCount: number;
  needsReviewCount: number;
  normalCount: number;
  openIncidentsCount: number;
  totalUngrouped: number;
}

export default function IncidentsListPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useStaffAuth();

  const [activeTab, setActiveTab] = useState<"confirmed" | "drafts">("confirmed");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");

  // Draft state tracking
  const [expandedDrafts, setExpandedDrafts] = useState<Record<string, boolean>>({});
  const [draftTitles, setDraftTitles] = useState<Record<string, string>>({});
  const [selectedReportsPerDraft, setSelectedReportsPerDraft] = useState<Record<string, string[]>>({});
  const [actionLoadingDraftId, setActionLoadingDraftId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Link to existing group modal state
  const [linkModalData, setLinkModalData] = useState<{
    draftId: string;
    targetGroup: { id: string; group_code: string; title: string };
    reportPublicIds: string[];
  } | null>(null);

  const queryParams = new URLSearchParams();
  if (searchTerm) queryParams.set("search", searchTerm);
  if (selectedStatus !== "all") queryParams.set("status", selectedStatus);

  // 1. Fetch Confirmed Incident Groups
  const { data: groupsData, isLoading: groupsLoading, mutate: mutateGroups } = useSWR(
    user ? [`/api/incidents?${queryParams.toString()}`, user.id] : null,
    ([url]) => fetcherWithAuth(url),
    { refreshInterval: 15000 }
  );

  // 2. Fetch Auto-Drafts
  const { data: draftsData, isLoading: draftsLoading, mutate: mutateDrafts } = useSWR(
    user ? [`/api/incidents/drafts`, user.id] : null,
    ([url]) => fetcherWithAuth(url),
    { refreshInterval: 20000 }
  );

  // 3. Fetch Overview KPIs
  const { data: overviewData, mutate: mutateOverview } = useSWR(
    user ? [`/api/incidents/overview`, user.id] : null,
    ([url]) => fetcherWithAuth(url),
    { refreshInterval: 20000 }
  );

  const groups: IncidentGroup[] = groupsData?.groups || [];
  const drafts: IncidentDraft[] = draftsData?.drafts || [];
  const metrics: OverviewMetrics = overviewData?.metrics || {
    emergencyCount: 0,
    needsReviewCount: 0,
    normalCount: 0,
    openIncidentsCount: 0,
    totalUngrouped: 0,
  };

  // Filter confirmed groups by priority if selected
  const filteredGroups = groups.filter((g) => {
    if (selectedPriority === "all") return true;
    return (g.priority || "normal") === selectedPriority;
  });

  // Filter drafts by priority if selected
  const filteredDrafts = drafts.filter((d) => {
    if (selectedPriority === "all") return true;
    return d.priority === selectedPriority;
  });

  const toggleExpandDraft = (draftId: string) => {
    setExpandedDrafts((prev) => ({ ...prev, [draftId]: !prev[draftId] }));
  };

  const getSelectedReportIds = (draft: IncidentDraft): string[] => {
    if (selectedReportsPerDraft[draft.draftId] !== undefined) {
      return selectedReportsPerDraft[draft.draftId];
    }
    return draft.reports.map((r) => r.public_id);
  };

  const toggleReportSelection = (draftId: string, publicId: string, allIds: string[]) => {
    const current = selectedReportsPerDraft[draftId] !== undefined ? selectedReportsPerDraft[draftId] : allIds;
    if (current.includes(publicId)) {
      setSelectedReportsPerDraft((prev) => ({
        ...prev,
        [draftId]: current.filter((id) => id !== publicId),
      }));
    } else {
      setSelectedReportsPerDraft((prev) => ({
        ...prev,
        [draftId]: [...current, publicId],
      }));
    }
  };

  // Confirm Draft Handler
  const handleConfirmDraft = async (draft: IncidentDraft, isSplit = false) => {
    try {
      setActionLoadingDraftId(draft.draftId);
      setActionMessage(null);

      const chosenReports = getSelectedReportIds(draft);
      if (chosenReports.length === 0) {
        alert("กรุณาเลือกคำร้องอย่างน้อย 1 รายการเพื่อสร้างกลุ่ม");
        setActionLoadingDraftId(null);
        return;
      }

      const title = draftTitles[draft.draftId] || draft.proposedTitle;

      const res = await fetcherWithAuth("/api/incidents/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          draftId: draft.draftId,
          title,
          description: draft.proposedDescription,
          category_id: draft.category_id,
          reportPublicIds: chosenReports,
          priority: draft.priority,
        }),
      });

      if (res?.success) {
        setActionMessage({
          text: `สร้างกลุ่มเหตุการณ์ ${res.incidentGroup.group_code} สำเร็จ (${res.addedMembers.length} คำร้อง)`,
          type: "success",
        });
        mutateDrafts();
        mutateGroups();
        mutateOverview();
        if (!isSplit) {
          // If all confirmed, switch back to confirmed groups tab
          setActiveTab("confirmed");
        }
      } else {
        setActionMessage({ text: res?.error || "ไม่สามารถยืนยันกลุ่มเหตุการณ์ได้", type: "error" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการยืนยันกลุ่ม";
      setActionMessage({ text: msg, type: "error" });
    } finally {
      setActionLoadingDraftId(null);
    }
  };

  // Reject Draft Handler
  const handleRejectDraft = async (draft: IncidentDraft) => {
    if (!confirm(`คุณต้องการปฏิเสธข้อเสนอรวมกลุ่ม "${draft.proposedTitle}" หรือไม่?`)) {
      return;
    }
    try {
      setActionLoadingDraftId(draft.draftId);
      setActionMessage(null);

      const res = await fetcherWithAuth("/api/incidents/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          draftId: draft.draftId,
          reportPublicIds: draft.reports.map((r) => r.public_id),
          reason: "เจ้าหน้าที่ตรวจสอบแล้วไม่ใช่เหตุการณ์เดียวกัน",
        }),
      });

      if (res?.success) {
        setActionMessage({ text: "ปฏิเสธร่างข้อเสนอรวมกลุ่มเรียบร้อยแล้ว", type: "success" });
        mutateDrafts();
        mutateOverview();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการปฏิเสธ";
      setActionMessage({ text: msg, type: "error" });
    } finally {
      setActionLoadingDraftId(null);
    }
  };

  // Link to Existing Group Handler
  const handleExecuteLinkToExisting = async () => {
    if (!linkModalData) return;
    try {
      setActionLoadingDraftId(linkModalData.draftId);
      setActionMessage(null);

      const res = await fetcherWithAuth("/api/incidents/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "link_existing",
          draftId: linkModalData.draftId,
          targetGroupId: linkModalData.targetGroup.id,
          reportPublicIds: linkModalData.reportPublicIds,
        }),
      });

      if (res?.success) {
        setActionMessage({
          text: `เชื่อมโยงคำร้องเข้ากลุ่ม ${linkModalData.targetGroup.group_code} สำเร็จ`,
          type: "success",
        });
        setLinkModalData(null);
        mutateDrafts();
        mutateGroups();
        mutateOverview();
      } else {
        setActionMessage({ text: res?.error || "ไม่สามารถเชื่อมโยงคำร้องได้", type: "error" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเชื่อมโยง";
      setActionMessage({ text: msg, type: "error" });
    } finally {
      setActionLoadingDraftId(null);
    }
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case "emergency":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-300 dark:border-red-800 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-600" />
            ฉุกเฉิน (Emergency)
          </span>
        );
      case "needs_review":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
            <HelpCircle className="w-3 h-3 text-amber-600" />
            รอตรวจสอบ (Needs Review)
          </span>
        );
      case "normal":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            ปกติ (Normal)
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            เปิดดำเนินการ (Open)
          </span>
        );
      case "resolved":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            แก้ไขแล้ว (Resolved)
          </span>
        );
      case "closed":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
            ปิดกลุ่ม (Closed)
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 w-full animate-fade-in pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
            กลุ่มเหตุการณ์และความเร่งด่วน
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
            จัดการคำร้องที่เกี่ยวข้องกัน ค้นหาความสัมพันธ์ของคำร้อง และจัดกลุ่มเหตุการณ์เพื่อช่วยให้เจ้าหน้าที่ดำเนินงานได้สะดวกขึ้น
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <Link
            href="/backoffice/incidents/new"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl transition-all shadow-md shadow-primary/15 hover:shadow-primary/30 shrink-0 cursor-pointer text-sm"
          >
            <Plus className="w-5 h-5" />
            <span>สร้างกลุ่มเหตุการณ์ใหม่</span>
          </Link>
        </div>
      </div>

      {/* Action Notification Message */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm font-semibold transition-all ${
            actionMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="p-1 hover:bg-slate-200/50 rounded-lg text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Priority Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Emergency Card */}
        <div
          onClick={() => {
            setSelectedPriority("emergency");
            setActiveTab("drafts");
          }}
          className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 card-shadow transition-all hover:translate-y-[-2px] border-l-4 border-l-red-500 cursor-pointer group"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              เหตุฉุกเฉิน (Emergency)
            </span>
            <div className="p-1.5 bg-red-50 dark:bg-red-950/40 rounded-lg text-red-600 dark:text-red-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-3xl font-black text-red-600 dark:text-red-400 tracking-tight">
              {metrics.emergencyCount}
            </h3>
            <span className="text-xs text-red-600/80 dark:text-red-400/80 font-medium">คำร้องเสี่ยงสูง</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            ต้องคัดกรองทันที ไม่รอการรวมกลุ่ม
          </p>
        </div>

        {/* Needs Review Card */}
        <div
          onClick={() => {
            setSelectedPriority("needs_review");
          }}
          className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 card-shadow transition-all hover:translate-y-[-2px] border-l-4 border-l-amber-500 cursor-pointer group"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-amber-500" />
              รอตรวจสอบ (Needs Review)
            </span>
            <div className="p-1.5 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-amber-600 dark:text-amber-400">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
              {metrics.needsReviewCount}
            </h3>
            <span className="text-xs text-amber-700/80 dark:text-amber-400/80 font-medium">ข้อมูลไม่ชัดเจน</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            ข้อความสั้นหรือมีสัญญาณอันตรายแฝง
          </p>
        </div>

        {/* Normal Card */}
        <div
          onClick={() => {
            setSelectedPriority("normal");
          }}
          className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 card-shadow transition-all hover:translate-y-[-2px] border-l-4 border-l-slate-400 dark:border-l-slate-600 cursor-pointer group"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-slate-400" />
              เรื่องทั่วไป (Normal)
            </span>
            <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-3xl font-black text-slate-800 dark:text-slate-200 tracking-tight">
              {metrics.normalCount}
            </h3>
            <span className="text-xs text-slate-500 font-medium">งานบริการทั่วไป</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            อุปกรณ์ชำรุด งานซ่อม และไอทีปกติ
          </p>
        </div>

        {/* Draft Proposals Card */}
        <div
          onClick={() => {
            setActiveTab("drafts");
            setSelectedPriority("all");
          }}
          className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 card-shadow transition-all hover:translate-y-[-2px] border-l-4 border-l-indigo-600 cursor-pointer group"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              ร่างข้อเสนอ (Drafts)
            </span>
            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
              {drafts.length}
            </h3>
            <span className="text-xs text-indigo-700/80 dark:text-indigo-400/80 font-medium">กลุ่มที่เสนอ</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            รอเจ้าหน้าที่ตรวจสอบและยืนยัน
          </p>
        </div>
      </div>

      {/* Tabs Switcher & Filter Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
          {/* Main Tab Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("confirmed")}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "confirmed"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>กลุ่มเหตุการณ์ที่ยืนยันแล้ว</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-white/20 dark:bg-slate-900/20">
                {groups.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("drafts")}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer relative ${
                activeTab === "drafts"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>ร่างข้อเสนอรวมกลุ่มอัตโนมัติ (Drafts)</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-mono ${
                  activeTab === "drafts"
                    ? "bg-white text-indigo-800"
                    : "bg-indigo-200 text-indigo-900 dark:bg-indigo-800 dark:text-indigo-200"
                }`}
              >
                {drafts.length}
              </span>
              {drafts.some((d) => d.isEmergency) && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
              )}
            </button>
          </div>

          {/* Priority Quick Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
              ระดับ:
            </span>
            <div className="w-44">
              <AppSelect
                value={selectedPriority}
                onChange={(val) => setSelectedPriority(val as string)}
                options={[
                  { label: "ทุกความเร่งด่วน", value: "all" },
                  { label: "🔴 ฉุกเฉิน (Emergency)", value: "emergency" },
                  { label: "🟡 รอตรวจสอบ (Needs Review)", value: "needs_review" },
                  { label: "⚪ ปกติ (Normal)", value: "normal" },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Search & Status Filters for Confirmed Groups */}
        {activeTab === "confirmed" && (
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อกลุ่ม หรือรหัสกลุ่ม (INC-T-xxxxx)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-slate-800 dark:text-slate-100 font-medium"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="w-full sm:w-56">
                <AppSelect
                  value={selectedStatus}
                  onChange={(val) => setSelectedStatus(val as string)}
                  options={[
                    { label: "สถานะทั้งหมด", value: "all" },
                    { label: "เปิดดำเนินการ (Open)", value: "open" },
                    { label: "แก้ไขแล้ว (Resolved)", value: "resolved" },
                    { label: "ปิดกลุ่ม (Closed)", value: "closed" },
                  ]}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================= */}
      {/* TAB 1: CONFIRMED INCIDENT GROUPS LIST                         */}
      {/* ============================================================= */}
      {activeTab === "confirmed" && (
        <>
          {groupsLoading || authLoading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800" />
              ))}
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <FolderOpen className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  ไม่พบกลุ่มเหตุการณ์ที่ยืนยันแล้ว
                </h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
                  {searchTerm || selectedPriority !== "all" || selectedStatus !== "all"
                    ? "ไม่พบกลุ่มเหตุการณ์ที่ตรงกับเงื่อนไขการค้นหา"
                    : "ยังไม่มีกลุ่มเหตุการณ์จริง คุณสามารถตรวจสอบร่างข้อเสนออัตโนมัติในแท็บ 'ร่างข้อเสนอรวมกลุ่ม'"}
                </p>
              </div>
              {drafts.length > 0 && (
                <button
                  onClick={() => setActiveTab("drafts")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  ดูร่างข้อเสนอที่รอการยืนยัน ({drafts.length})
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredGroups.map((group) => {
                const updatedAt = new Date(group.updated_at).toLocaleString("th-TH", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={group.id}
                    onClick={() => router.push(`/backoffice/incidents/${group.group_code}`)}
                    className="group bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 card-shadow hover:border-primary/40 hover:translate-y-[-2px] transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {group.group_code}
                        </span>
                        {getStatusBadge(group.status)}
                        {group.priority && getPriorityBadge(group.priority)}
                        {group.categories && (
                          <span className="text-xs px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-semibold">
                            {group.categories.name_th}
                          </span>
                        )}
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                          ✓ ยืนยันแล้ว
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-slate-800 dark:text-white group-hover:text-primary transition-colors">
                        {group.title}
                      </h3>

                      {group.description && (
                        <p className="text-sm text-slate-500 line-clamp-2">
                          {group.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                      <div className="text-right space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-bold text-sm">
                          <FileText className="w-4 h-4 text-slate-400" />
                          <span>{group.memberCount} คำร้อง</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span>อัปเดต {updatedAt} น.</span>
                        </div>
                      </div>

                      <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ============================================================= */}
      {/* TAB 2: AUTOMATIC INCIDENT GROUP DRAFTS                         */}
      {/* ============================================================= */}
      {activeTab === "drafts" && (
        <div className="space-y-6">
          {/* Informational Guidance Banner */}
          <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/5 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl p-5 flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1 text-sm">
              <h4 className="font-bold text-indigo-950 dark:text-indigo-200">
                ระบบร่างข้อเสนอรวมกลุ่มเหตุการณ์อัตโนมัติ (Automatic Group Drafting)
              </h4>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                ระบบตรวจจับคำร้องที่มีสถานที่ กรอบเวลา และหมวดหมู่ใกล้เคียงกัน เพื่อจัดเตรียมเป็นร่างข้อเสนอให้เจ้าหน้าที่พิจารณา{" "}
                <strong className="text-indigo-700 dark:text-indigo-400">
                  คำร้องยังไม่ถูกรวมกลุ่มจริงหรือเปลี่ยนสถานะใด ๆ จนกว่าเจ้าหน้าที่จะกดยืนยัน (Human-in-the-Loop)
                </strong>
              </p>
            </div>
          </div>

          {draftsLoading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-44 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800" />
              ))}
            </div>
          ) : filteredDrafts.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center mx-auto text-indigo-400">
                <Check className="w-8 h-8 text-indigo-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  ไม่มีร่างกลุ่มเหตุการณ์ที่รอการยืนยัน
                </h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                  คำร้องปัจจุบันยังไม่มีรายการที่มีคะแนนความคล้ายคลึงและสถานที่ซ้ำซ้อนเพียงพอที่จะรวมกลุ่ม หรือได้รับการยืนยันครบถ้วนแล้ว
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredDrafts.map((draft, idx) => {
                const isExpanded = expandedDrafts[draft.draftId] ?? true;
                const chosenReports = getSelectedReportIds(draft);
                const isOperating = actionLoadingDraftId === draft.draftId;

                return (
                  <div
                    key={draft.draftId}
                    className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all shadow-sm ${
                      draft.isEmergency
                        ? "border-red-300 dark:border-red-900/80 ring-1 ring-red-400/30"
                        : "border-indigo-100 dark:border-indigo-950/80"
                    }`}
                  >
                    {/* Draft Card Top Header */}
                    <div className="p-5 sm:p-6 space-y-4">
                      {/* Badge Ribbon */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            <Sparkles className="w-3.5 h-3.5" />
                            ร่างข้อเสนอ #{idx + 1} (Draft Proposal)
                          </span>

                          {getPriorityBadge(draft.priority)}

                          {draft.categoryName && (
                            <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                              {draft.categoryName} {draft.subcategoryName ? `• ${draft.subcategoryName}` : ""}
                            </span>
                          )}

                          <span
                            className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold"
                            title="คะแนนประเมินความสอดคล้องตามกฎ (Rule-based Score 0-100 ไม่ใช่ความน่าจะเป็นทางสถิติ)"
                          >
                            คะแนนประเมินเหตุการณ์: {draft.correlationScore}/100 (Rule Score)
                          </span>

                          {draft.locationSummary && (
                            <span className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-semibold flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span>{draft.locationSummary}</span>
                              {draft.spatialGranularity && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-blue-200/60 dark:bg-blue-800/60 rounded font-medium">
                                  {draft.spatialGranularity === "room"
                                    ? "ระดับห้อง/จุดย่อย"
                                    : draft.spatialGranularity === "floor"
                                    ? "ระดับชั้น"
                                    : draft.spatialGranularity === "building"
                                    ? "ระดับอาคาร"
                                    : draft.spatialGranularity === "campus_area"
                                    ? "ระดับพื้นที่"
                                    : "สถานที่กว้าง"}
                                </span>
                              )}
                            </span>
                          )}

                          {draft.sharedRootCause && (
                            <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold flex items-center gap-1">
                              ⚡ ต้นเหตุร่วม:{" "}
                              {draft.sharedRootCause === "storm_heavy_rain"
                                ? "พายุฝน/น้ำหลาก"
                                : draft.sharedRootCause === "power_grid_failure"
                                ? "ไฟฟ้าดับวงกว้าง"
                                : "งานพิธีการ/กิจกรรมส่วนกลาง"}
                            </span>
                          )}
                        </div>

                        {/* Expand/Collapse Trigger */}
                        <button
                          onClick={() => toggleExpandDraft(draft.draftId)}
                          className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 font-semibold cursor-pointer"
                        >
                          <span>{isExpanded ? "ย่อรายละเอียด" : "ขยายดูคำร้อง"}</span>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Editable Proposed Title */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          ชื่อกลุ่มเหตุการณ์ที่ระบบเสนอ (สามารถแก้ไขก่อนยืนยันได้):
                        </label>
                        <input
                          type="text"
                          value={draftTitles[draft.draftId] !== undefined ? draftTitles[draft.draftId] : draft.proposedTitle}
                          onChange={(e) =>
                            setDraftTitles((prev) => ({
                              ...prev,
                              [draft.draftId]: e.target.value,
                            }))
                          }
                          className="w-full text-base sm:text-lg font-bold text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>

                      {/* Redesigned Compact Review Layout (IncidentDraftReview) */}
                      <IncidentDraftReview draft={draft} />

                      {/* Candidate Existing Groups Banner (if matched) */}
                      {draft.suggestedExistingGroups.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="space-y-0.5">
                            <span className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                              <LinkIcon className="w-3.5 h-3.5 text-amber-600" />
                              พบกลุ่มเหตุการณ์เดิมที่อาจเกี่ยวข้อง:
                            </span>
                            <p className="text-amber-800/80 dark:text-amber-300/80">
                              {draft.suggestedExistingGroups[0].group.group_code} — {draft.suggestedExistingGroups[0].group.title}{" "}
                              ({draft.suggestedExistingGroups[0].confidenceLabel})
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setLinkModalData({
                                draftId: draft.draftId,
                                targetGroup: draft.suggestedExistingGroups[0].group,
                                reportPublicIds: chosenReports,
                              })
                            }
                            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors cursor-pointer shrink-0"
                          >
                            เชื่อมกับกลุ่มเดิม ({draft.suggestedExistingGroups[0].group.group_code})
                          </button>
                        </div>
                      )}

                      {/* Expanded Section: Member Reports Checklist */}
                      {isExpanded && (
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                              คำร้องที่เสนอรวมกลุ่ม ({chosenReports.length}/{draft.reports.length} รายการ):
                            </span>
                            <span className="text-[11px] text-slate-400">
                              ช่วงเวลาห่างกัน {draft.timeSpanHours} ชม.
                            </span>
                          </div>

                          <div className="grid grid-cols-1 gap-2">
                            {draft.reports.map((rep) => {
                              const isChecked = chosenReports.includes(rep.public_id);
                              const repDate = new Date(rep.created_at).toLocaleString("th-TH", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              });

                              return (
                                <div
                                  key={rep.id}
                                  onClick={() =>
                                    toggleReportSelection(
                                      draft.draftId,
                                      rep.public_id,
                                      draft.reports.map((r) => r.public_id)
                                    )
                                  }
                                  className={`p-3 rounded-xl border text-xs transition-all cursor-pointer flex items-start gap-3 ${
                                    isChecked
                                      ? "bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/60"
                                      : "bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/80 opacity-60"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    className="mt-1 rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                                  />

                                  <div className="space-y-1 min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                                        {rep.public_id}
                                      </span>
                                      {rep.status && <StatusBadge status={rep.status} />}
                                      {getPriorityBadge(rep.priority)}
                                      {rep.location && (
                                        <span className="text-slate-500 flex items-center gap-1">
                                          <MapPin className="w-3 h-3 text-slate-400" />
                                          {rep.location}
                                        </span>
                                      )}
                                      <span className="text-slate-400 flex items-center gap-1 ml-auto">
                                        <Clock className="w-3 h-3" />
                                        {repDate} น.
                                      </span>
                                    </div>
                                    <p className="text-slate-600 dark:text-slate-300 line-clamp-2">
                                      {rep.description}
                                    </p>
                                  </div>

                                  <Link
                                    href={`/report/${rep.public_id}`}
                                    target="_blank"
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1.5 text-slate-400 hover:text-primary transition-colors shrink-0"
                                    title="เปิดดูคำร้องต้นฉบับ"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </Link>
                                </div>
                              );
                            })}
                          </div>

                          {/* Insufficient Evidence Reports (Isolated from auto-grouping) */}
                          {draft.insufficientEvidenceReports && draft.insufficientEvidenceReports.length > 0 && (
                            <div className="mt-4 p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2 text-xs">
                              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
                                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>
                                  คำร้องที่คล้ายกันแต่ข้อมูลหลักฐานไม่พอสำหรับรวมกลุ่ม ({draft.insufficientEvidenceReports.length} รายการ)
                                </span>
                              </div>
                              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                                ระบบแยกรายการด้านล่างนี้ไว้เป็น Similar Requests เพื่อป้องกันการรวมกลุ่มผิดพลาด (False Merge) เนื่องจากขาดข้อมูลสถานที่ที่ชัดเจนหรือมีข้อความคลุมเครือ เจ้าหน้าที่สามารถเปิดดูเพื่อพิจารณาเพิ่มเติมได้
                              </p>
                              <div className="space-y-1.5 pt-1">
                                {draft.insufficientEvidenceReports.map((ir) => (
                                  <div
                                    key={ir.id}
                                    className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0 flex-1 space-y-0.5">
                                      <div className="flex items-center gap-2 font-mono font-bold text-slate-700 dark:text-slate-300">
                                        <span>{ir.public_id}</span>
                                        {ir.location && (
                                          <span className="text-[11px] font-normal text-slate-400 flex items-center gap-1">
                                            <MapPin className="w-3 h-3" />
                                            {ir.location}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-slate-600 dark:text-slate-300 text-[11px] line-clamp-1">
                                        {ir.description}
                                      </p>
                                    </div>
                                    <Link
                                      href={`/report/${ir.public_id}`}
                                      target="_blank"
                                      className="p-1.5 text-slate-400 hover:text-primary transition-colors shrink-0"
                                      title="เปิดดูคำร้องต้นฉบับ"
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </Link>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons Footer */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-b-2xl border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-slate-500">
                        เลือก {chosenReports.length} จาก {draft.reports.length} รายการ
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Reject Proposal */}
                        <button
                          type="button"
                          disabled={isOperating}
                          onClick={() => handleRejectDraft(draft)}
                          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <X className="w-4 h-4" />
                          <span>ปฏิเสธข้อเสนอ (Reject)</span>
                        </button>

                        {/* Split Draft Button (if user selected subset) */}
                        {chosenReports.length > 0 && chosenReports.length < draft.reports.length && (
                          <button
                            type="button"
                            disabled={isOperating}
                            onClick={() => handleConfirmDraft(draft, true)}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                          >
                            <Split className="w-4 h-4" />
                            <span>แยกสร้างเฉพาะ {chosenReports.length} รายการ</span>
                          </button>
                        )}

                        {/* Confirm Full Draft */}
                        <button
                          type="button"
                          disabled={isOperating}
                          onClick={() => handleConfirmDraft(draft, false)}
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                        >
                          <Check className="w-4 h-4" />
                          <span>
                            {isOperating
                              ? "กำลังบันทึก..."
                              : `ยืนยันสร้างกลุ่มเหตุการณ์ (${chosenReports.length} รายการ)`}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: LINK TO EXISTING GROUP CONFIRMATION                     */}
      {/* ============================================================= */}
      {linkModalData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 space-y-5 border border-slate-100 dark:border-slate-800 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-amber-600" />
                <span>ยืนยันการเชื่อมโยงคำร้องเข้ากลุ่มเดิม</span>
              </h3>
              <button
                onClick={() => setLinkModalData(null)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <p className="text-slate-600 dark:text-slate-300">
                คุณกำลังจะนำคำร้องจำนวน <strong>{linkModalData.reportPublicIds.length} รายการ</strong>{" "}
                เชื่อมโยงเข้ากลุ่มเหตุการณ์เดิม:
              </p>

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 space-y-1">
                <span className="font-mono font-bold text-amber-800 dark:text-amber-300 text-xs">
                  {linkModalData.targetGroup.group_code}
                </span>
                <h4 className="font-bold text-amber-950 dark:text-amber-100">
                  {linkModalData.targetGroup.title}
                </h4>
              </div>

              <div className="text-xs text-slate-500 space-y-1">
                <p className="font-bold">รายการคำร้องที่จะเพิ่มเข้ากลุ่ม:</p>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {linkModalData.reportPublicIds.map((id) => (
                    <span
                      key={id}
                      className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px]"
                    >
                      {id}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setLinkModalData(null)}
                className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleExecuteLinkToExisting}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-600/20 cursor-pointer"
              >
                ยืนยันการเชื่อมโยง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
