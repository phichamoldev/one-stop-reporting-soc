"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import useSWR from "swr";
import { fetcherWithAuth } from "@/lib/fetcher";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import {
  FlaskConical,
  Database,
  RotateCcw,
  Layers,
  CheckSquare,
  Square,
  AlertCircle,
  CheckCircle2,
  X,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Link as LinkIcon,
  MessageSquare,
  Send,
  Sliders,
  Eye,
  FileText,
  Sparkles,
  Filter,
  Search,
  Check,
  Info,
  Lock,
  Unlock,
  AlertTriangle,
  PlusCircle,
  Clock,
  MapPin,
  Tag,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import {
  LAB_SCENARIOS,
  LabScenario,
  LabSuggestionItem,
  LabAnchorReport,
  REAL_REPORT_FAN_CANDIDATE_1,
  REAL_REPORT_FAN_CANDIDATE_2,
  REAL_REPORT_FAN_CANDIDATE_3,
} from "@/lib/relatedRequestsLabScenarios";
import {
  computeRelatedRequestsDisplayCase,
  filterAndDeduplicateCandidateGroups,
  getEligibleSimilarCandidates,
  CandidateIncidentGroup,
  CandidateGroupCorrelation,
} from "@/components/backoffice/SimilarReportsCard";

export const RelatedRequestsLabView: React.FC = () => {
  const { profile } = useStaffAuth();

  // SWR: Optional real database snapshot
  const { data: dbData, error: dbError, isLoading: dbLoading } = useSWR(
    "/api/backoffice/related-requests-lab",
    fetcherWithAuth,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  // Scenario Selection State
  const [activeScenarioId, setActiveScenarioId] = useState<string>("a3-multiple-candidates");
  const activeScenario = useMemo(
    () => LAB_SCENARIOS.find((s) => s.id === activeScenarioId) || LAB_SCENARIOS[0],
    [activeScenarioId]
  );

  // =========================================================================
  // Local Demo State (Overrides scenario presets for interactive testing)
  // =========================================================================
  const [demoAnchor, setDemoAnchor] = useState<LabAnchorReport>(activeScenario.anchorReport);
  const [demoCurrentIncident, setDemoCurrentIncident] = useState<CandidateIncidentGroup | null>(
    activeScenario.currentIncident
  );
  const [demoCandidateGroups, setDemoCandidateGroups] = useState<CandidateGroupCorrelation[]>(
    activeScenario.candidateGroups
  );
  const [demoSuggestions, setDemoSuggestions] = useState<LabSuggestionItem[]>(
    activeScenario.suggestions
  );
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>(
    activeScenario.interactiveDefaults?.selectedReportIds || [activeScenario.anchorReport.public_id]
  );
  const [filterType, setFilterType] = useState<"all" | "similar_not_grouped" | "matching_existing_group" | "already_grouped">(
    activeScenario.interactiveDefaults?.filterType || "all"
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Bulk Form States
  const [bulkFormOpen, setBulkFormOpen] = useState(
    Boolean(activeScenario.interactiveDefaults?.bulkFormOpen)
  );
  const [bulkTargetStatus, setBulkTargetStatus] = useState(
    activeScenario.interactiveDefaults?.bulkTargetStatus || ""
  );
  const [bulkReplyMessage, setBulkReplyMessage] = useState(
    activeScenario.interactiveDefaults?.bulkReplyMessage || ""
  );
  const [bulkAutoGroup, setBulkAutoGroup] = useState(true);

  // Test Control Toggles
  const [forceLoading, setForceLoading] = useState(false);
  const [forceError, setForceError] = useState(false);
  const [forceEmpty, setForceEmpty] = useState(false);

  // Modal States (Demo Mode)
  const [quickViewItem, setQuickViewItem] = useState<LabSuggestionItem | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(
    activeScenario.interactiveDefaults?.modalPreview === "confirm"
  );
  const [resultModalOpen, setResultModalOpen] = useState(
    activeScenario.interactiveDefaults?.modalPreview === "result_partial"
  );
  const [ineligibleAlertOpen, setIneligibleAlertOpen] = useState(
    activeScenario.interactiveDefaults?.modalPreview === "ineligible_alert"
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync state whenever active scenario changes
  useEffect(() => {
    setDemoAnchor(activeScenario.anchorReport);
    setDemoCurrentIncident(activeScenario.currentIncident);
    setDemoCandidateGroups(activeScenario.candidateGroups);
    setDemoSuggestions(activeScenario.suggestions);
    setSelectedReportIds(
      activeScenario.interactiveDefaults?.selectedReportIds || [activeScenario.anchorReport.public_id]
    );
    setFilterType(activeScenario.interactiveDefaults?.filterType || "all");
    setSearchQuery("");
    setBulkFormOpen(Boolean(activeScenario.interactiveDefaults?.bulkFormOpen));
    setBulkTargetStatus(activeScenario.interactiveDefaults?.bulkTargetStatus || "");
    setBulkReplyMessage(activeScenario.interactiveDefaults?.bulkReplyMessage || "");
    setForceLoading(false);
    setForceError(false);
    setForceEmpty(false);
    setQuickViewItem(null);
    setConfirmModalOpen(activeScenario.interactiveDefaults?.modalPreview === "confirm");
    setResultModalOpen(activeScenario.interactiveDefaults?.modalPreview === "result_partial");
    setIneligibleAlertOpen(activeScenario.interactiveDefaults?.modalPreview === "ineligible_alert");
  }, [activeScenario]);

  // Reset Demo State Handler
  const handleResetDemoState = () => {
    setDemoAnchor(activeScenario.anchorReport);
    setDemoCurrentIncident(activeScenario.currentIncident);
    setDemoCandidateGroups(activeScenario.candidateGroups);
    setDemoSuggestions(activeScenario.suggestions);
    setSelectedReportIds(
      activeScenario.interactiveDefaults?.selectedReportIds || [activeScenario.anchorReport.public_id]
    );
    setFilterType(activeScenario.interactiveDefaults?.filterType || "all");
    setSearchQuery("");
    setBulkFormOpen(false);
    setBulkTargetStatus("");
    setBulkReplyMessage("");
    setForceLoading(false);
    setForceError(false);
    setForceEmpty(false);
    setConfirmModalOpen(false);
    setResultModalOpen(false);
    setIneligibleAlertOpen(false);
    setToastMessage("คืนค่าสถานะการทดลอง (Local Demo State) สู่ค่าเริ่มต้นของ Scenario เรียบร้อยแล้ว");
    setTimeout(() => setToastMessage(null), 3000);
  };

  // =========================================================================
  // Derived Calculation via Real Core Functions
  // =========================================================================

  // 1. Deduplicate Candidate Groups (Case B)
  const relevantCandidateGroups = useMemo(() => {
    if (forceEmpty) return [];
    return filterAndDeduplicateCandidateGroups(demoCandidateGroups, demoCurrentIncident);
  }, [demoCandidateGroups, demoCurrentIncident, forceEmpty]);

  // 2. Compute The Three Mutually Exclusive Display Cases (Phase 2)
  const { isCaseA, isCaseB, isCaseC, activeCase } = useMemo(() => {
    return computeRelatedRequestsDisplayCase(demoCurrentIncident, relevantCandidateGroups);
  }, [demoCurrentIncident, relevantCandidateGroups]);

  // 3. Search and text filtering
  const searchedSuggestions = useMemo(() => {
    if (forceEmpty) return [];
    if (!searchQuery.trim()) return demoSuggestions;
    const q = searchQuery.toLowerCase().trim();
    return demoSuggestions.filter(
      (s) =>
        s.public_id.toLowerCase().includes(q) ||
        s.report.description.toLowerCase().includes(q) ||
        s.report.location.toLowerCase().includes(q) ||
        s.report.categoryName.toLowerCase().includes(q)
    );
  }, [demoSuggestions, searchQuery, forceEmpty]);

  // 4. Calculate Eligible Candidates for Bulk Toolbar (Phase 4, Rules 1-10)
  const eligibleSimilarCandidates = useMemo(() => {
    if (!isCaseC || forceEmpty) return [];
    // Cast to expected SuggestionItem shape
    return getEligibleSimilarCandidates(
      searchedSuggestions as any,
      demoAnchor,
      filterType
    );
  }, [isCaseC, forceEmpty, searchedSuggestions, demoAnchor, filterType]);

  // 5. Display Condition: canShowBulkToolbar
  // Active when: Case C (Ungrouped) AND Source Report (1) + Eligible Candidates >= 2 (i.e. Candidates >= 1)
  const canShowBulkToolbar = isCaseC && !forceEmpty && eligibleSimilarCandidates.length >= 1;

  // 6. Reactive Selection Clean-up (Rule 16)
  useEffect(() => {
    if (!canShowBulkToolbar) {
      setSelectedReportIds([demoAnchor.public_id]);
      if (bulkFormOpen) setBulkFormOpen(false);
    } else {
      const allowed = new Set([demoAnchor.public_id, ...eligibleSimilarCandidates.map((c) => c.public_id)]);
      setSelectedReportIds((prev) => {
        const filtered = prev.filter((id) => allowed.has(id));
        return filtered.includes(demoAnchor.public_id) ? filtered : [demoAnchor.public_id, ...filtered];
      });
    }
  }, [canShowBulkToolbar, eligibleSimilarCandidates, demoAnchor.public_id, bulkFormOpen]);

  // Selection Handlers
  const handleToggleSelect = (pId: string) => {
    if (!canShowBulkToolbar) return;
    if (pId === demoAnchor.public_id) return; // Keep anchor in selection
    const isEligible = eligibleSimilarCandidates.some((c) => c.public_id === pId);
    if (!isEligible) return;

    setSelectedReportIds((prev) =>
      prev.includes(pId) ? prev.filter((id) => id !== pId) : [...prev, pId]
    );
  };

  const handleSelectAll = () => {
    if (!canShowBulkToolbar) return;
    const all = [demoAnchor.public_id, ...eligibleSimilarCandidates.map((c) => c.public_id)];
    setSelectedReportIds(Array.from(new Set(all)));
  };

  const handleDeselectAll = () => {
    setSelectedReportIds([demoAnchor.public_id]);
  };

  // Grouped Scenarios Map
  const scenarioGroups = useMemo(() => {
    const map: Record<string, { title: string; items: LabScenario[] }> = {
      group_a: { title: "Group A — Related Requests Display", items: [] },
      group_b: { title: "Group B — Candidate Quality & Grouping", items: [] },
      group_c: { title: "Group C — Bulk Toolbar Visibility", items: [] },
      group_d: { title: "Group D — Selection & Bulk Reply", items: [] },
    };
    LAB_SCENARIOS.forEach((s) => {
      if (map[s.groupId]) map[s.groupId].items.push(s);
    });
    return map;
  }, []);

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full animate-fade-in pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-2xl flex items-center gap-2 border border-slate-700 animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. Header Section                                                         */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <FlaskConical className="w-3.5 h-3.5" />
              Related Requests UX Lab
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                activeScenario.isRealData
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300"
              }`}
            >
              <Database className="w-3 h-3" />
              {activeScenario.dataSourceLabel}
            </span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              Scenario {activeScenario.code}
            </span>
          </div>

          <h1 className="text-2xl font-black text-slate-800 dark:text-white">
            {activeScenario.title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl">
            {activeScenario.description}
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start lg:self-center shrink-0">
          <button
            type="button"
            onClick={handleResetDemoState}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="คืนสถานะการทดลองในหน้าเท่านั้น โดยไม่กระทบฐานข้อมูลจริง"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span>Reset Demo State</span>
          </button>
          <Link
            href="/backoffice/incidents"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            <span>กลับหน้าระบบจริง</span>
          </Link>
        </div>
      </div>

      {/* Safety Notice Banner */}
      <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-blue-900 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            <strong>โหมดทดลองปลอดภัย (Safe Playground):</strong> ทุกการคลิก การเลือก และการตอบกลับในหน้านี้เป็น Local Demo State เท่านั้น ระบบจะไม่แก้ไขข้อมูลจริงในฐานข้อมูล และไม่ส่งข้อความ LINE
          </span>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-100/60 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 shrink-0">
          Isolation Guard Active
        </span>
      </div>

      {/* ========================================================================= */}
      {/* 2. Scenario Catalog & Test Controls Grid                                  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Scenario Selector Catalog */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="font-black text-xs text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-indigo-600" />
                <span>Scenario Catalog</span>
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                {LAB_SCENARIOS.length} Scenarios
              </span>
            </div>

            {/* Accordion / List of Scenarios by Group */}
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {Object.entries(scenarioGroups).map(([key, grp]) => (
                <div key={key} className="space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 pl-1 block">
                    {grp.title}
                  </span>
                  <div className="space-y-1">
                    {grp.items.map((s) => {
                      const isActive = s.id === activeScenarioId;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setActiveScenarioId(s.id)}
                          className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-start gap-2 cursor-pointer ${
                            isActive
                              ? "bg-indigo-600 text-white font-bold shadow-xs shadow-indigo-600/20"
                              : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-black shrink-0 ${
                              isActive
                                ? "bg-white/20 text-white"
                                : s.isRealData
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {s.code}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold leading-tight">
                              {s.title.replace(/^Scenario [A-Z0-9]+:\s*/, "")}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Test Controls Panel */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3.5">
            <span className="font-black text-xs text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Sliders className="w-3.5 h-3.5 text-indigo-600" />
              <span>Interactive Controls</span>
            </span>

            {/* Quick Candidate Count Override */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                จำนวน Candidate (ปรับเพื่อทดสอบเกณฑ์ Toolbar):
              </label>
              <div className="grid grid-cols-4 gap-1.5 text-xs">
                {[0, 1, 2, 3].map((count) => {
                  const currentCount = demoSuggestions.length;
                  const isSelected = currentCount === count && !forceEmpty;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => {
                        setForceEmpty(false);
                        if (count === 0) {
                          setDemoSuggestions([]);
                        } else if (count === 1) {
                          setDemoSuggestions([activeScenario.suggestions[0] || REAL_REPORT_FAN_CANDIDATE_1]);
                        } else if (count === 2) {
                          setDemoSuggestions([REAL_REPORT_FAN_CANDIDATE_1, REAL_REPORT_FAN_CANDIDATE_2]);
                        } else {
                          setDemoSuggestions([
                            REAL_REPORT_FAN_CANDIDATE_1,
                            REAL_REPORT_FAN_CANDIDATE_2,
                            REAL_REPORT_FAN_CANDIDATE_3,
                          ]);
                        }
                      }}
                      className={`py-1.5 rounded-lg font-bold text-center transition-all cursor-pointer ${
                        isSelected
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                      }`}
                    >
                      {count} รายการ
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Group Membership Switcher */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                สถานะกลุ่มของคำร้องหลัก (Anchor Group):
              </label>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setDemoCurrentIncident(null)}
                  className={`py-1.5 px-2 rounded-lg font-bold text-center transition-all cursor-pointer ${
                    !demoCurrentIncident
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                  }`}
                >
                  ยังไม่มีกลุ่ม
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDemoCurrentIncident({
                      id: "inc-t-00001",
                      group_code: "INC-T-00001",
                      title: "กลุ่มเหตุการณ์ระบบไฟ/พัดลม อาคาร 1",
                      status: "open",
                    })
                  }
                  className={`py-1.5 px-2 rounded-lg font-bold text-center transition-all cursor-pointer ${
                    Boolean(demoCurrentIncident)
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                  }`}
                >
                  อยู่ในกลุ่มแล้ว (Case A)
                </button>
              </div>
            </div>

            {/* Incident Group Status Simulator */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                กลุ่มที่อาจเกี่ยวข้อง (Case B Suggested Groups):
              </label>
              <div className="grid grid-cols-3 gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setDemoCandidateGroups([])}
                  className={`py-1.5 rounded-lg font-bold text-center cursor-pointer ${
                    demoCandidateGroups.length === 0
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  ไม่มีกลุ่ม
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDemoCandidateGroups([
                      {
                        id: "grp-demo-open",
                        group: {
                          id: "grp-demo-open",
                          group_code: "INC-T-00010",
                          title: "ซ่อมแซมระบบพัดลม ซุ้มสังมา",
                          status: "open",
                        },
                        score: 85,
                        reasons: ["หมวดหมู่ตรงกัน", "สถานที่ตรงกัน"],
                      },
                    ])
                  }
                  className={`py-1.5 rounded-lg font-bold text-center cursor-pointer ${
                    demoCandidateGroups.length === 1
                      ? "bg-amber-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  1 กลุ่ม (เปิด)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDemoCandidateGroups([
                      {
                        id: "grp-1",
                        group: { id: "grp-1", group_code: "INC-T-00010", title: "กลุ่มงานระบบไฟ", status: "open" },
                        score: 88,
                        reasons: ["สถานที่ตรงกัน"],
                      },
                      {
                        id: "grp-2",
                        group: { id: "grp-2", group_code: "INC-T-00020", title: "กลุ่มงานพัดลม", status: "closed" },
                        score: 75,
                        reasons: ["หมวดหมู่งานพัดลมตรงกัน"],
                      },
                    ])
                  }
                  className={`py-1.5 rounded-lg font-bold text-center cursor-pointer ${
                    demoCandidateGroups.length >= 2
                      ? "bg-amber-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  2 กลุ่ม (หลายกลุ่ม)
                </button>
              </div>
            </div>

            {/* State Simulation Toggles */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                UI States Simulation:
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setForceLoading(!forceLoading)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    forceLoading
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {forceLoading ? "✓ Loading Active" : "Loading State"}
                </button>
                <button
                  type="button"
                  onClick={() => setForceError(!forceError)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    forceError
                      ? "bg-red-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {forceError ? "✓ Error Active" : "Error State"}
                </button>
                <button
                  type="button"
                  onClick={() => setForceEmpty(!forceEmpty)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    forceEmpty
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {forceEmpty ? "✓ Empty Active" : "Empty State"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live UX Playground Canvas */}
        <div className="lg:col-span-3 space-y-4">
          {/* ========================================================================= */}
          {/* Status Explanation Banner                                                 */}
          {/* ========================================================================= */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="font-black text-xs text-slate-800 dark:text-white uppercase tracking-wider">
                  Test Evaluation Panel
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    activeCase === "A"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : activeCase === "B"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                      : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                  }`}
                >
                  Active Case {activeCase}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Bulk Toolbar:</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                    canShowBulkToolbar
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {canShowBulkToolbar ? "แสดงผล (Visible)" : "ซ่อน (Hidden)"}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <strong>เหตุผลการแสดงผล:</strong> {activeScenario.explanation}
            </p>

            {/* Counts Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
                <span className="text-slate-400 block">Candidate ทั้งหมด</span>
                <span className="font-mono font-black text-slate-800 dark:text-white text-sm">
                  {demoSuggestions.length}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
                <span className="text-slate-400 block">Eligible Candidate</span>
                <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                  {eligibleSimilarCandidates.length}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
                <span className="text-slate-400 block">กลุ่มที่เกี่ยวข้อง</span>
                <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                  {relevantCandidateGroups.length}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
                <span className="text-slate-400 block">เลือกแล้ว (Selected)</span>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                  {selectedReportIds.length}
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* Anchor Report Card                                                        */}
          {/* ========================================================================= */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  คำร้องหลัก (Anchor Request)
                </span>
                <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                  {demoAnchor.public_id}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  {demoAnchor.status}
                </span>
                {forceLoading ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                    กำลังตรวจสอบกลุ่ม...
                  </span>
                ) : forceError ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800">
                    <AlertCircle className="w-3 h-3" />
                    ไม่สามารถตรวจสอบกลุ่มได้
                  </span>
                ) : demoCurrentIncident ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="w-3 h-3" />
                    อยู่ในกลุ่มเหตุการณ์แล้ว
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                    <Layers className="w-3 h-3" />
                    ยังไม่ได้จัดกลุ่มเหตุการณ์
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                <span>{new Date(demoAnchor.created_at).toLocaleString("th-TH")}</span>
              </div>
            </div>

            <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
              {demoAnchor.description}
            </p>

            <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{demoAnchor.location}</span>
              </span>
              <span className="flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                <span>{demoAnchor.categoryName} • {demoAnchor.subcategoryName}</span>
              </span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* Simulated Loading & Error States                                         */}
          {/* ========================================================================= */}
          {forceLoading && (
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
              <div className="h-20 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
              <div className="h-20 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
            </div>
          )}

          {forceError && (
            <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-xs text-red-900 dark:text-red-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                <div>
                  <span className="font-bold">จำลองข้อผิดพลาดในการโหลดข้อมูล</span>
                  <p className="text-[11px] text-red-700 dark:text-red-300">
                    ไม่สามารถดึงข้อมูลคำร้องที่คล้ายกันได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForceError(false)}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold text-xs hover:bg-red-700 cursor-pointer"
              >
                ลองใหม่ (Retry)
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* Live Related Requests UI (The Three Display Cases)                       */}
          {/* ========================================================================= */}
          {!forceLoading && !forceError && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-base font-black text-slate-800 dark:text-white">
                    คำร้องที่เกี่ยวข้องและกลุ่มเหตุการณ์ (Related Requests UI)
                  </h2>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">
                  UX Component Live View
                </span>
              </div>

              {/* ------------------------------------------------------------------- */}
              {/* CASE A: Request Already Belongs to a Confirmed Incident Group       */}
              {/* ------------------------------------------------------------------- */}
              {isCaseA && demoCurrentIncident && (
                <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-800/60 space-y-3.5 shadow-xs animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600/10 text-emerald-600 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                            คำร้องนี้อยู่ในกลุ่มเหตุการณ์แล้ว
                          </span>
                          <span className="font-mono font-black text-emerald-950 dark:text-emerald-100 text-sm">
                            {demoCurrentIncident.group_code}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                          {demoCurrentIncident.title}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300/60">
                        {demoCurrentIncident.status === "open" ? "เปิดดำเนินการ (Open)" : "ปิดแล้ว (Closed)"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setToastMessage(`เปิดหน้ากลุ่มเหตุการณ์ ${demoCurrentIncident.group_code} (Demo)`);
                          setTimeout(() => setToastMessage(null), 3000);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>ดูกลุ่มเหตุการณ์</span>
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300/90 pl-1 border-t border-emerald-200/50 pt-2">
                    ✓ คำร้องนี้ได้รับการยืนยันเป็นสมาชิกของกลุ่มเหตุการณ์แล้ว การจัดการคำร้องสมาชิกและการดำเนินการเป็นชุดสามารถทำได้จากหน้ากลุ่มเหตุการณ์
                  </p>
                </div>
              )}

              {/* ------------------------------------------------------------------- */}
              {/* CASE B: Ungrouped but Related to an Existing Incident Group         */}
              {/* ------------------------------------------------------------------- */}
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
                    const isClosed = grp.status === "closed";

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
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                isClosed
                                  ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              }`}
                            >
                              {isClosed ? "ปิดแล้ว (Closed)" : "เปิดอยู่ (Open)"}
                            </span>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-300/60 text-amber-800 dark:text-amber-300">
                              คะแนน {cg.score}%
                            </span>
                          </div>
                        </div>

                        {/* Reasons */}
                        <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-amber-200/60 dark:border-amber-900/40 text-[11px] space-y-1">
                          <span className="font-bold text-slate-700 dark:text-slate-300">เหตุผลความเกี่ยวข้อง:</span>
                          {cg.reasons.map((r, idx) => (
                            <p key={idx} className="flex items-start gap-1.5 text-slate-600 dark:text-slate-300">
                              <span className="text-amber-500 font-bold">•</span>
                              <span>{r}</span>
                            </p>
                          ))}
                        </div>

                        <p className="text-[11px] text-amber-800 dark:text-amber-400">
                          • คำร้องนี้ยังไม่ได้เชื่อมเข้ากลุ่มจริง เจ้าหน้าที่ต้องตรวจสอบและกดยืนยันก่อนดำเนินการ
                        </p>

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setToastMessage(`ตรวจสอบกลุ่มเหตุการณ์ ${grp.group_code} (Demo)`);
                              setTimeout(() => setToastMessage(null), 3000);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>ตรวจสอบกลุ่ม</span>
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </button>

                          {!isClosed ? (
                            <button
                              type="button"
                              onClick={() => {
                                setToastMessage(`ทดลองเชื่อมโยงคำร้องเข้ากลุ่ม ${grp.group_code} สำเร็จ (Demo Only)`);
                                setTimeout(() => setToastMessage(null), 3000);
                              }}
                              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                            >
                              <LinkIcon className="w-3.5 h-3.5" />
                              <span>พิจารณาเชื่อมเข้ากลุ่ม (Demo)</span>
                            </button>
                          ) : (
                            <span className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed">
                              กลุ่มปิดแล้ว (ไม่อนุญาตให้เชื่อม)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ------------------------------------------------------------------- */}
              {/* CASE C: Ungrouped and Has No Related Existing Group                 */}
              {/* ------------------------------------------------------------------- */}
              {isCaseC && (
                <div className="space-y-4 animate-fade-in">

                  {/* ----------------------------------------------------------------- */}
                  {/* Bulk Reply & Auto-Grouping Toolbar (Phase 4: candidates >= 2)      */}
                  {/* ----------------------------------------------------------------- */}
                  {canShowBulkToolbar && (
                    <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/60 space-y-3 animate-fade-in">
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
                                เลือก {selectedReportIds.length} จากทั้งหมด {1 + eligibleSimilarCandidates.length} รายการ
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
                            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
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

                      {/* Bulk Action Form (Strict 5 Steps) */}
                      {bulkFormOpen && (
                        <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/50 space-y-4 shadow-xs text-xs animate-fade-in">
                          <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
                            <span className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                              <Send className="w-4 h-4 text-indigo-600" />
                              <span>กำหนดการดำเนินการสำหรับ {selectedReportIds.length} คำร้องที่เลือก</span>
                            </span>
                          </div>

                          {/* Step 1: Target Status */}
                          <div className="space-y-1">
                            <label className="block font-bold text-slate-700 dark:text-slate-300">
                              1. สถานะคำร้องเป้าหมาย:
                            </label>
                            <select
                              value={bulkTargetStatus}
                              onChange={(e) => setBulkTargetStatus(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-medium"
                            >
                              <option value="">-- ไม่เปลี่ยนสถานะ (คงสถานะเดิม) --</option>
                              <option value="pending">รอดำเนินการ (Pending)</option>
                              <option value="received">รับเรื่องแล้ว (Received)</option>
                              <option value="in_progress">กำลังดำเนินการ (In Progress)</option>
                              <option value="completed">เสร็จสิ้น (Completed)</option>
                              <option value="rejected">ปฏิเสธ (Rejected)</option>
                              <option value="cancelled">ยกเลิก (Cancelled)</option>
                            </select>
                          </div>

                          {/* Step 2: Reply Message */}
                          <div className="space-y-1">
                            <label className="block font-bold text-slate-700 dark:text-slate-300">
                              2. ข้อความตอบกลับสำหรับทุกคำร้องที่เลือก:
                            </label>
                            <textarea
                              rows={3}
                              value={bulkReplyMessage}
                              onChange={(e) => setBulkReplyMessage(e.target.value)}
                              placeholder="กรอกข้อความตอบกลับเพื่อบันทึกประวัติการดำเนินการ..."
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-medium"
                            />
                          </div>

                          {/* Step 4: Auto-Grouping */}
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="checkbox"
                              id="autoGroupCheck"
                              checked={bulkAutoGroup}
                              onChange={(e) => setBulkAutoGroup(e.target.checked)}
                              className="rounded text-indigo-600"
                            />
                            <label htmlFor="autoGroupCheck" className="font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                              จัดกลุ่มเหตุการณ์อัตโนมัติ (Auto-Grouping) หากผ่านเกณฑ์
                            </label>
                          </div>

                          {/* Step 5: Submit Button */}
                          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                            <button
                              type="button"
                              disabled={bulkAutoGroup ? selectedReportIds.length < 2 : selectedReportIds.length === 0}
                              onClick={() => setConfirmModalOpen(true)}
                              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <Send className="w-4 h-4" />
                              <span>
                                {bulkAutoGroup && selectedReportIds.length < 2
                                  ? "กรุณาเลือกคำร้องที่คล้ายกันอย่างน้อย 1 รายการเพื่อจัดกลุ่ม"
                                  : `ตรวจสอบและยืนยันการตอบกลับแบบชุด (${selectedReportIds.length} รายการ)`}
                              </span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Empty State */}
                  {searchedSuggestions.length === 0 && (
                    <div className="text-center py-10 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/20 border border-dashed border-slate-200 dark:border-slate-800 space-y-2 animate-fade-in">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                        <Layers className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        ไม่พบคำร้องที่ใกล้เคียงหรือเกี่ยวข้อง
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                        คำร้องนี้อาจเป็นปัญหาเฉพาะเจาะจง หรือยังไม่มีการแจ้งปัญหาในลักษณะหรือบริเวณเดียวกัน
                      </p>
                    </div>
                  )}

                  {/* Candidate Request Cards List */}
                  {searchedSuggestions.length > 0 && (
                    <div className="space-y-3.5">
                      {searchedSuggestions.map((item) => {
                        const isEligible = eligibleSimilarCandidates.some((c) => c.public_id === item.public_id);
                        const isSelected = selectedReportIds.includes(item.public_id);
                        const hasDifferences = item.differences && item.differences.length > 0;
                        const isGrouped = Boolean(item.incidentGroup);

                        return (
                          <div
                            key={item.public_id}
                            className={`rounded-2xl border transition-all overflow-hidden ${
                              isSelected && isEligible
                                ? "border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/15"
                                : isGrouped
                                ? "border-emerald-200 bg-emerald-50/15 dark:border-emerald-900/40"
                                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                            }`}
                          >
                            <div className="p-4 sm:p-5 space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Checkbox: ONLY shown when canShowBulkToolbar is true AND item is eligible */}
                                  {canShowBulkToolbar && isEligible && (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleSelect(item.public_id)}
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

                                  <button
                                    type="button"
                                    onClick={() => setQuickViewItem(item)}
                                    className="text-sm font-black font-mono text-slate-800 dark:text-slate-100 hover:text-indigo-600 transition-colors flex items-center gap-1 cursor-pointer group"
                                  >
                                    <span className="group-hover:underline">{item.public_id}</span>
                                    <Eye className="w-3.5 h-3.5 opacity-60 text-slate-400 group-hover:text-indigo-600" />
                                  </button>

                                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    {item.report.categoryName}
                                  </span>

                                  {isGrouped && (
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                      อยู่ในกลุ่ม {item.incidentGroup?.group_code}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                                    คะแนน {item.score}%
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setQuickViewItem(item)}
                                    className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                                  >
                                    ดูรายละเอียด
                                  </button>
                                </div>
                              </div>

                              <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                                {item.report.description}
                              </p>

                              <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{item.report.location}</span>
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{new Date(item.report.created_at).toLocaleString("th-TH")}</span>
                                </span>
                              </div>

                              {/* Differences Callout (if any) */}
                              {hasDifferences && (
                                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
                                  <span className="font-bold flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                    <span>ข้อแตกต่างที่ควรพิจารณา:</span>
                                  </span>
                                  {item.differences?.map((d, i) => (
                                    <p key={i} className="pl-4">• {d}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. Demo Modals                                                            */}
      {/* ========================================================================= */}

      {/* Confirmation Modal (Scenario D4) */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-600" />
                <span>ยืนยันการดำเนินการแบบชุด ({selectedReportIds.length} รายการ)</span>
              </span>
              <button onClick={() => setConfirmModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-400">
                คุณกำลังจะส่งข้อความตอบกลับและปรับปรุงสถานะให้กับคำร้องดังต่อไปนี้:
              </p>

              <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                {selectedReportIds.map((id) => (
                  <div key={id} className="flex items-center justify-between text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                    <span>{id}</span>
                    <span className="text-[10px] text-slate-400">{id === demoAnchor.public_id ? "(คำร้องหลัก)" : "(Candidate)"}</span>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 space-y-1 text-xs">
                <span className="font-bold text-indigo-900 dark:text-indigo-200">สถานะเป้าหมาย:</span>
                <p className="text-indigo-800 dark:text-indigo-300 font-medium">
                  {bulkTargetStatus || "คงสถานะเดิม"}
                </p>
                <span className="font-bold text-indigo-900 dark:text-indigo-200 pt-1 block">ข้อความตอบกลับ:</span>
                <p className="text-indigo-800 dark:text-indigo-300 font-medium whitespace-pre-wrap">
                  {bulkReplyMessage || "(ไม่มีข้อความตอบกลับ)"}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmModalOpen(false);
                  setResultModalOpen(true);
                  setToastMessage("จำลองการส่งการตอบกลับแบบชุดสำเร็จ (Demo)");
                  setTimeout(() => setToastMessage(null), 3000);
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs"
              >
                ยืนยันการตอบกลับ (Demo)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result / Partial Failure Modal (Scenario D5) */}
      {resultModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>ผลการดำเนินการแบบชุด (จำลอง Scenario D5)</span>
              </span>
              <button onClick={() => setResultModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-center font-bold">
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="text-xs block text-emerald-600">สำเร็จ</span>
                  <span className="text-xl font-black">2 คำร้อง</span>
                </div>
                <div className="p-3 rounded-xl bg-red-50 text-red-800 border border-red-200">
                  <span className="text-xs block text-red-600">ล้มเหลว</span>
                  <span className="text-xl font-black">1 คำร้อง</span>
                </div>
              </div>

              {/* Succeeded list */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
                <span className="font-bold text-slate-700 dark:text-slate-300">รายการที่ดำเนินการสำเร็จ:</span>
                <p className="text-emerald-600 font-mono">✓ {demoAnchor.public_id} - เปลี่ยนสถานะและตอบกลับสำเร็จ</p>
                <p className="text-emerald-600 font-mono">✓ SOC-28934 - เปลี่ยนสถานะและตอบกลับสำเร็จ</p>
              </div>

              {/* Failed item with Retry */}
              <div className="p-3 rounded-xl bg-red-50/70 border border-red-200 space-y-2">
                <span className="font-bold text-red-900">รายการที่ล้มเหลว (Failed):</span>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-red-800">SOC-INVALID-99</span>
                  <span className="text-[11px] text-red-600">ข้อผิดพลาด: สถานะในฐานข้อมูลถูกเปลี่ยนไปก่อนหน้า</span>
                  <button
                    type="button"
                    onClick={() => {
                      setToastMessage("ทดลอง Retry คำร้อง SOC-INVALID-99 แบบแยกเดี่ยวสำเร็จ (Demo)");
                      setTimeout(() => setToastMessage(null), 3000);
                    }}
                    className="px-2.5 py-1 rounded bg-red-600 text-white font-bold text-[11px] hover:bg-red-700 cursor-pointer shrink-0"
                  >
                    Retry เดี่ยว
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setResultModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick View Modal */}
      {quickViewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-600" />
                <span>รายละเอียดคำร้อง: {quickViewItem.public_id}</span>
              </span>
              <button onClick={() => setQuickViewItem(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 text-[11px]">รายละเอียด:</span>
                <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                  {quickViewItem.report.description}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 text-[11px]">สถานที่:</span>
                  <p className="font-bold text-slate-700 dark:text-slate-300">{quickViewItem.report.location}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">หมวดหมู่:</span>
                  <p className="font-bold text-slate-700 dark:text-slate-300">{quickViewItem.report.categoryName}</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
                <span className="font-bold text-slate-700 dark:text-slate-300">เหตุผลความใกล้เคียง:</span>
                {quickViewItem.reasons.map((r, i) => (
                  <p key={i} className="text-slate-600 dark:text-slate-400">• {r}</p>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setQuickViewItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
