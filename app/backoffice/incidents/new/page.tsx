"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { fetcherWithAuth } from "@/lib/fetcher";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import {
  ArrowLeft,
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  MapPin,
  Clock,
  CheckSquare,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ExternalLink,
  X,
  Loader2,
  RotateCcw
} from "lucide-react";
import { AppSelect } from "@/components/ui/AppSelect";
import { StatusBadge } from "@/components/design-system/StatusBadge";
import { ReportStatus } from "@/types/report";

export interface SelectedReportItem {
  id: string;
  public_id: string;
  category_id?: number | null;
  subcategory_id?: number | null;
  location?: string | null;
  description: string;
  status: ReportStatus;
  priority?: string | null;
  reporter_name?: string | null;
  created_at: string;
  categories?: {
    id: number;
    name_th: string;
    department_id?: number;
  } | null;
  subcategories?: {
    id: number;
    name_th: string;
  } | null;
  incidentGroup?: {
    id: string;
    group_code: string;
    title: string;
    status: string;
  } | null;
}

type WorkflowStep = "select" | "details" | "confirm" | "success";

export default function CreateIncidentGroupPage() {
  const searchParams = useSearchParams();
  const initialReportParam = searchParams.get("reportId");

  const { user } = useStaffAuth();

  // 1. Workflow State
  const [currentStep, setCurrentStep] = useState<WorkflowStep>("select");

  // 2. Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [timeRange, setTimeRange] = useState<string>("all");
  const [groupStatusFilter, setGroupStatusFilter] = useState<"ungrouped" | "all" | "grouped">("ungrouped");
  const [locationKeyword, setLocationKeyword] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // 3. Persistent Selection State (stores full report item so filters don't erase selected items)
  const [selectedReportsMap, setSelectedReportsMap] = useState<Map<string, SelectedReportItem>>(new Map());

  // 4. Incident Group Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [groupCategoryId, setGroupCategoryId] = useState("");
  const [hasAutoSuggested, setHasAutoSuggested] = useState(false);

  // 5. Submission & Concurrency State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdGroup, setCreatedGroup] = useState<{
    group_code: string;
    title: string;
    memberCount: number;
    id: string;
  } | null>(null);

  // Fetch Categories
  const { data: catData } = useSWR("/api/categories", fetcherWithAuth, {
    dedupingInterval: 3600000,
  });
  const categories = catData?.categories || [];

  // Fetch Existing Drafts (for non-intrusive matching tip)
  const { data: draftsData } = useSWR(
    user ? [`/api/incidents/drafts`, user.id] : null,
    ([url]) => fetcherWithAuth(url),
    { dedupingInterval: 30000 }
  );
  const existingDrafts = useMemo(() => draftsData?.drafts || [], [draftsData?.drafts]);

  // Fetch Reports Query
  const reportQuery = new URLSearchParams({
    page: String(currentPage),
    limit: String(pageSize),
    groupStatus: groupStatusFilter,
  });
  if (searchTerm.trim()) reportQuery.set("search", searchTerm.trim());
  if (selectedCategoryId) reportQuery.set("categoryId", selectedCategoryId);
  if (timeRange !== "all") reportQuery.set("timeRange", timeRange);
  if (locationKeyword.trim()) reportQuery.set("location", locationKeyword.trim());

  const { data: reportResult, isLoading: reportsLoading, mutate: mutateReports } = useSWR(
    user ? [`/api/incidents/ungrouped-reports?${reportQuery.toString()}`, user.id] : null,
    ([url]) => fetcherWithAuth(url),
    { dedupingInterval: 5000 }
  );

  const availableReports: SelectedReportItem[] = useMemo(
    () => reportResult?.reports || [],
    [reportResult?.reports]
  );
  const totalReportsCount = reportResult?.total || 0;
  const totalPages = reportResult?.totalPages || 1;

  // Auto-load initial report from URL parameter if provided
  useEffect(() => {
    if (initialReportParam && user) {
      fetcherWithAuth(`/api/reports/${initialReportParam}`)
        .then((res) => {
          if (res?.data) {
            setSelectedReportsMap((prev) => {
              const next = new Map(prev);
              next.set(res.data.public_id, res.data);
              return next;
            });
          }
        })
        .catch(() => {
          // Fallback ignore if not found
        });
    }
  }, [initialReportParam, user]);

  // Selected reports as array
  const selectedReportsArray = useMemo(() => {
    return Array.from(selectedReportsMap.values());
  }, [selectedReportsMap]);

  // Toggle single report selection
  const toggleReport = (report: SelectedReportItem) => {
    // If report is already grouped in another incident, prevent selection
    if (report.incidentGroup) {
      return;
    }
    setSelectedReportsMap((prev) => {
      const next = new Map(prev);
      if (next.has(report.public_id)) {
        next.delete(report.public_id);
      } else {
        next.set(report.public_id, report);
      }
      return next;
    });
  };

  // Remove report from selection
  const removeSelectedReport = (publicId: string) => {
    setSelectedReportsMap((prev) => {
      const next = new Map(prev);
      next.delete(publicId);
      return next;
    });
  };

  // Select all eligible (ungrouped) reports in current view
  const selectAllInCurrentPage = () => {
    setSelectedReportsMap((prev) => {
      const next = new Map(prev);
      availableReports.forEach((rep) => {
        if (!rep.incidentGroup) {
          next.set(rep.public_id, rep);
        }
      });
      return next;
    });
  };

  // Clear all selections
  const clearAllSelections = () => {
    setSelectedReportsMap(new Map());
  };

  // Check if all selectable reports on current page are selected
  const isAllCurrentSelected = useMemo(() => {
    const selectable = availableReports.filter((r) => !r.incidentGroup);
    if (selectable.length === 0) return false;
    return selectable.every((r) => selectedReportsMap.has(r.public_id));
  }, [availableReports, selectedReportsMap]);

  // Risk & Variance Analysis for Selected Reports
  const varianceAnalysis = useMemo(() => {
    if (selectedReportsArray.length === 0) {
      return { locations: [], hasLocationVariance: false, timeSpanText: "", categoryId: "", isSingleCategory: true };
    }

    // Locations
    const locSet = new Set<string>();
    selectedReportsArray.forEach((r) => {
      if (r.location?.trim()) locSet.add(r.location.trim());
    });
    const locations = Array.from(locSet);
    const hasLocationVariance = locations.length > 1;

    // Time Span
    const timestamps = selectedReportsArray.map((r) => new Date(r.created_at).getTime()).sort((a, b) => a - b);
    const earliest = timestamps[0];
    const latest = timestamps[timestamps.length - 1];
    const diffHours = Math.round((latest - earliest) / (1000 * 3600));
    let timeSpanText = "เกิดในเวลาใกล้เคียงกัน";
    if (diffHours >= 24) {
      const days = Math.round(diffHours / 24);
      timeSpanText = `ห่างกันประมาณ ${days} วัน (${diffHours} ชั่วโมง)`;
    } else if (diffHours > 0) {
      timeSpanText = `ห่างกันประมาณ ${diffHours} ชั่วโมง`;
    }

    // Category
    const catSet = new Set(selectedReportsArray.map((r) => r.category_id).filter(Boolean));
    const isSingleCategory = catSet.size <= 1;
    const commonCategoryId = catSet.size === 1 ? String(selectedReportsArray[0].category_id || "") : "";

    return {
      locations,
      hasLocationVariance,
      timeSpanText,
      categoryId: commonCategoryId,
      isSingleCategory,
    };
  }, [selectedReportsArray]);

  // Suggest Title and Summary based on real data
  const autoSuggestDetails = () => {
    if (selectedReportsArray.length === 0) return;

    // 1. Identify common Category Name
    const firstRep = selectedReportsArray[0];
    const commonCatName = firstRep.categories?.name_th || "";

    // 2. Identify Location
    const primaryLocation = varianceAnalysis.locations[0] || "";

    // 3. Extract common keywords from descriptions without hallucination
    let issueKeyword = "";
    const combinedDesc = selectedReportsArray.map((r) => r.description).join(" ");
    if (/น้ำท่วม|น้ำขัง|ระบายไม่ทัน/i.test(combinedDesc)) {
      issueKeyword = "ปัญหาน้ำท่วมขัง";
    } else if (/ไฟดับ|ไฟฟ้าดับ|ไฟตก/i.test(combinedDesc)) {
      issueKeyword = "ปัญหาไฟฟ้าขัดข้อง";
    } else if (/แอร์|เครื่องปรับอากาศ|ไม่เย็น/i.test(combinedDesc)) {
      issueKeyword = "ปัญหาเครื่องปรับอากาศขัดข้อง";
    } else if (/ลิฟต์/i.test(combinedDesc)) {
      issueKeyword = "ปัญหาลิฟต์โดยสารขัดข้อง";
    } else if (/ขยะ|ส่งกลิ่น/i.test(combinedDesc)) {
      issueKeyword = "ปัญหาขยะและสุขอนามัย";
    } else if (/เสียงดัง|รบกวน/i.test(combinedDesc)) {
      issueKeyword = "ปัญหาเสียงรบกวน";
    } else {
      issueKeyword = commonCatName || "เหตุการณ์ร่วม";
    }

    let generatedTitle = issueKeyword;
    if (primaryLocation) {
      generatedTitle += ` บริเวณ${primaryLocation}`;
    }
    if (varianceAnalysis.hasLocationVariance) {
      generatedTitle += ` และพื้นที่ใกล้เคียง`;
    }

    // Suggested Description
    const dateFirst = new Date(selectedReportsArray[0].created_at).toLocaleDateString("th-TH", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const generatedDesc = `รวมคำร้องที่เกี่ยวข้อง (${selectedReportsArray.length} รายการ) แจ้งเข้ามาตั้งแต่ ${dateFirst} น. จากบริเวณ ${varianceAnalysis.locations.slice(0, 3).join(", ") || "พื้นที่เดียวกัน"}`;

    setTitle(generatedTitle);
    setDescription(generatedDesc);
    if (varianceAnalysis.categoryId) {
      setGroupCategoryId(varianceAnalysis.categoryId);
    }
    setHasAutoSuggested(true);
  };

  // Check if any selected report matches an existing Draft
  const matchingDraft = useMemo(() => {
    if (!existingDrafts || existingDrafts.length === 0 || selectedReportsArray.length === 0) {
      return null;
    }
    return existingDrafts.find((d: { reports?: Array<{ public_id: string }> }) =>
      d.reports?.some((dr) => selectedReportsMap.has(dr.public_id))
    );
  }, [existingDrafts, selectedReportsArray, selectedReportsMap]);

  // Navigate to Step 2
  const handleProceedToDetails = () => {
    if (selectedReportsMap.size === 0) {
      setErrorMessage("กรุณาเลือกคำร้องอย่างน้อย 1 รายการก่อนดำเนินการ");
      return;
    }
    setErrorMessage(null);
    if (!hasAutoSuggested && !title.trim()) {
      autoSuggestDetails();
    }
    setCurrentStep("details");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Navigate to Step 3 (Confirmation)
  const handleProceedToConfirm = () => {
    if (!title.trim()) {
      setErrorMessage("กรุณาระบุชื่อกลุ่มเหตุการณ์");
      return;
    }
    setErrorMessage(null);
    setCurrentStep("confirm");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Final Submit Handler
  const handleFinalSubmit = async () => {
    if (!title.trim()) {
      setErrorMessage("กรุณาระบุชื่อกลุ่มเหตุการณ์");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const reportPublicIds = Array.from(selectedReportsMap.keys());

      const res = await fetcherWithAuth("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          category_id: groupCategoryId ? parseInt(groupCategoryId, 10) : null,
          reportPublicIds,
        }),
      });

      if (res.success && res.incidentGroup) {
        setCreatedGroup({
          group_code: res.incidentGroup.group_code,
          title: res.incidentGroup.title,
          memberCount: res.addedMembers?.length || reportPublicIds.length,
          id: res.incidentGroup.id,
        });
        setCurrentStep("success");
      } else {
        // Handle race condition or concurrency error
        if (res.code === "REPORT_ALREADY_GROUPED") {
          setErrorMessage(
            res.error || "คำร้องบางรายการถูกจัดเข้ากลุ่มอื่นไปแล้วโดยผู้ใช้อื่น กรุณาตรวจสอบรายการใหม่"
          );
          // Re-fetch reports to reflect up-to-date DB status
          mutateReports();
        } else {
          setErrorMessage(res.error || "เกิดข้อผิดพลาดในการสร้างกลุ่มเหตุการณ์");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset all to create another group
  const handleResetForAnother = () => {
    setCurrentStep("select");
    setSelectedReportsMap(new Map());
    setTitle("");
    setDescription("");
    setGroupCategoryId("");
    setHasAutoSuggested(false);
    setCreatedGroup(null);
    setErrorMessage(null);
    mutateReports();
  };

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto w-full animate-fade-in pb-24">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/backoffice/incidents"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>กลับไปหน้ารายการกลุ่มเหตุการณ์</span>
        </Link>

        {currentStep !== "success" && (
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            Manual Grouping Workflow
          </span>
        )}
      </div>

      {/* Main Header Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
        <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
          <Layers className="w-4 h-4" />
          <span>สร้างกลุ่มเหตุการณ์ด้วยตนเอง</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">
          {currentStep === "select" && "1. ค้นหาและเลือกคำร้องที่เกี่ยวข้อง"}
          {currentStep === "details" && "2. กำหนดรายละเอียดกลุ่มเหตุการณ์"}
          {currentStep === "confirm" && "3. ตรวจสอบและยืนยันการสร้างกลุ่ม"}
          {currentStep === "success" && "สร้างกลุ่มเหตุการณ์สำเร็จ"}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          ค้นหาและรวมคำร้องหลายรายการที่เป็นเหตุการณ์เดียวกัน เพื่อให้เจ้าหน้าที่ติดตาม จัดการสถานะ และสื่อสารภาพรวมได้อย่างมีประสิทธิภาพ
        </p>

        {/* Step Progression Bar */}
        {currentStep !== "success" && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-xs font-bold">
            <button
              type="button"
              onClick={() => setCurrentStep("select")}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl transition-all cursor-pointer ${
                currentStep === "select"
                  ? "bg-primary text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
              <span>เลือกคำร้อง ({selectedReportsMap.size})</span>
            </button>

            <button
              type="button"
              disabled={selectedReportsMap.size === 0}
              onClick={() => handleProceedToDetails()}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl transition-all ${
                selectedReportsMap.size === 0
                  ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400"
                  : currentStep === "details"
                  ? "bg-primary text-white shadow-xs cursor-pointer"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
              <span>ข้อมูลกลุ่ม</span>
            </button>

            <button
              type="button"
              disabled={selectedReportsMap.size === 0 || !title.trim()}
              onClick={() => handleProceedToConfirm()}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl transition-all ${
                selectedReportsMap.size === 0 || !title.trim()
                  ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400"
                  : currentStep === "confirm"
                  ? "bg-primary text-white shadow-xs cursor-pointer"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">3</span>
              <span>ยืนยันสร้างกลุ่ม</span>
            </button>
          </div>
        )}
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs sm:text-sm font-bold flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 1: Search, Filter, and Multi-Select Reports                          */}
      {/* ========================================================================= */}
      {currentStep === "select" && (
        <div className="space-y-5 animate-fade-in">
          {/* Search & Filter Toolbar */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            {/* Top row: Keyword search & Location search */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-7 relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาด้วยรหัสคำร้อง, ข้อความปัญหา, คำสำคัญ..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-800 dark:text-slate-100 font-medium placeholder:text-slate-400"
                />
              </div>

              <div className="md:col-span-5 relative">
                <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="กรองตามสถานที่ / อาคาร..."
                  value={locationKeyword}
                  onChange={(e) => {
                    setLocationKeyword(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-800 dark:text-slate-100 font-medium placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Bottom row: Category, Time Range, and Grouping Status Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-48">
                  <AppSelect
                    value={selectedCategoryId}
                    onChange={(val) => {
                      setSelectedCategoryId(val as string);
                      setCurrentPage(1);
                    }}
                    options={[
                      { label: "หมวดหมู่ทั้งหมด", value: "" },
                      ...categories.map((c: { id: number; name_th: string }) => ({
                        label: c.name_th,
                        value: c.id.toString(),
                      })),
                    ]}
                  />
                </div>

                <div className="w-40">
                  <AppSelect
                    value={timeRange}
                    onChange={(val) => {
                      setTimeRange(val as string);
                      setCurrentPage(1);
                    }}
                    options={[
                      { label: "ช่วงเวลาทั้งหมด", value: "all" },
                      { label: "24 ชั่วโมงล่าสุด", value: "today" },
                      { label: "3 วันล่าสุด", value: "3days" },
                      { label: "7 วันล่าสุด", value: "7days" },
                      { label: "30 วันล่าสุด", value: "30days" },
                    ]}
                  />
                </div>
              </div>

              {/* Status Tab Pills */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold self-start md:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setGroupStatusFilter("ungrouped");
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    groupStatusFilter === "ungrouped"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  ยังไม่ได้จัดกลุ่ม
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGroupStatusFilter("all");
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    groupStatusFilter === "all"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  คำร้องทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGroupStatusFilter("grouped");
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    groupStatusFilter === "grouped"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  อยู่ในกลุ่มแล้ว
                </button>
              </div>
            </div>
          </div>

          {/* Selection Status & Batch Action Bar */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-primary text-white shadow-xs">
                เลือกแล้ว {selectedReportsMap.size} คำร้อง
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                พบทั้งหมด {totalReportsCount} รายการในเงื่อนไขนี้
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={selectAllInCurrentPage}
                disabled={availableReports.filter((r) => !r.incidentGroup).length === 0}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <CheckSquare className="w-3.5 h-3.5 text-primary" />
                <span>{isAllCurrentSelected ? "เลือกครบทุกรายการแล้ว" : "เลือกทั้งหมดในหน้านี้"}</span>
              </button>

              {selectedReportsMap.size > 0 && (
                <button
                  type="button"
                  onClick={clearAllSelections}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ล้างการเลือกทั้งหมด</span>
                </button>
              )}
            </div>
          </div>

          {/* Persistent Selected Reports Tray (Horizontal pills) */}
          {selectedReportsArray.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  รายการคำร้องที่เลือกไว้สำหรับสร้างกลุ่ม ({selectedReportsArray.length}):
                </span>
                <span className="text-[11px]">คลิกกากบาท (✕) เพื่อนำคำร้องออก</span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 max-h-24 scrollbar-thin">
                {selectedReportsArray.map((rep) => (
                  <div
                    key={rep.public_id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700 shrink-0"
                  >
                    <span className="font-mono font-bold">{rep.public_id}</span>
                    {rep.location && <span className="text-slate-400 truncate max-w-[100px]">• {rep.location}</span>}
                    <button
                      type="button"
                      onClick={() => removeSelectedReport(rep.public_id)}
                      className="p-0.5 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded text-slate-400 hover:text-rose-600 cursor-pointer ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reports Compact List / Grid */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {reportsLoading ? (
              <div className="py-16 text-center space-y-3">
                <Loader2 className="w-7 h-7 text-primary animate-spin mx-auto" />
                <p className="text-xs font-bold text-slate-400">กำลังค้นหาและดึงข้อมูลคำร้อง...</p>
              </div>
            ) : availableReports.length === 0 ? (
              <div className="py-16 text-center px-4 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  ไม่พบคำร้องที่ตรงกับเงื่อนไขการค้นหา
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  ลองล้างคำค้นหา หรือเปลี่ยนตัวกรองหมวดหมู่ สถานที่ และช่วงเวลา เพื่อดูรายการคำร้องอื่น ๆ
                </p>
                {(searchTerm || locationKeyword || selectedCategoryId || timeRange !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      setLocationKeyword("");
                      setSelectedCategoryId("");
                      setTimeRange("all");
                      setCurrentPage(1);
                    }}
                    className="px-4 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    ล้างตัวกรองทั้งหมด
                  </button>
                )}
              </div>
            ) : (
              availableReports.map((rep) => {
                const isSelected = selectedReportsMap.has(rep.public_id);
                const isGrouped = Boolean(rep.incidentGroup);
                const createdDate = new Date(rep.created_at).toLocaleDateString("th-TH", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={rep.id}
                    onClick={() => {
                      if (!isGrouped) toggleReport(rep);
                    }}
                    className={`p-4 transition-all flex items-start gap-3.5 select-none ${
                      isGrouped
                        ? "opacity-60 bg-slate-50/50 dark:bg-slate-900/50 cursor-not-allowed"
                        : isSelected
                        ? "bg-red-50/50 dark:bg-red-950/20 cursor-pointer"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="pt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        disabled={isGrouped}
                        checked={isSelected}
                        onChange={() => {}} // Handled by parent container click
                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    </div>

                    {/* Report Content */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-black text-slate-900 dark:text-white">
                          {rep.public_id}
                        </span>

                        <StatusBadge status={rep.status} className="text-[10px] py-0 px-2" />

                        {rep.categories?.name_th && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {rep.categories.name_th}
                          </span>
                        )}

                        {/* Incident Grouping Status Badge */}
                        {isGrouped ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            อยู่ในกลุ่มแล้ว ({rep.incidentGroup?.group_code})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            <Layers className="w-3 h-3 text-slate-400" />
                            ยังไม่ได้จัดกลุ่ม
                          </span>
                        )}

                        <span className="text-[11px] text-slate-400 flex items-center gap-1 ml-auto">
                          <Clock className="w-3 h-3" /> {createdDate} น.
                        </span>
                      </div>

                      <p className="text-xs text-slate-800 dark:text-slate-200 font-medium line-clamp-2">
                        {rep.description}
                      </p>

                      <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap pt-0.5">
                        {rep.location && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{rep.location}</span>
                          </span>
                        )}
                        {rep.reporter_name && (
                          <span>ผู้แจ้ง: {rep.reporter_name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 pt-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>หน้าก่อนหน้า</span>
              </button>

              <span>
                หน้า {currentPage} จาก {totalPages} ({totalReportsCount} รายการ)
              </span>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>หน้าถัดไป</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Sticky Bottom Action Bar */}
          <div className="sticky bottom-4 z-20 p-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                เลือกคำร้องแล้ว {selectedReportsMap.size} รายการ
              </span>
              {selectedReportsMap.size === 0 && (
                <span className="text-xs text-slate-400">
                  (เลือกอย่างน้อย 1 รายการเพื่อดำเนินการต่อ)
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={selectedReportsMap.size === 0}
              onClick={handleProceedToDetails}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:pointer-events-none text-white font-black text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-primary/15 cursor-pointer"
            >
              <span>ถัดไป: กำหนดข้อมูลกลุ่ม ({selectedReportsMap.size})</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: Incident Group Details & Synthesis                                */}
      {/* ========================================================================= */}
      {currentStep === "details" && (
        <div className="space-y-6 animate-fade-in">
          {/* Related Draft Tip Banner if any selected report is in an active draft */}
          {matchingDraft && (
            <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-indigo-600 shrink-0" />
                <div>
                  <span className="font-bold">ตรวจพบข้อเสนอรวมกลุ่มอัตโนมัติ (Draft) ที่เกี่ยวข้อง:</span>
                  <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5">
                    &ldquo;{matchingDraft.proposedTitle}&rdquo; ครอบคลุมคำร้องที่คุณเลือกบางส่วน คุณสามารถไปยืนยันผ่านหน้ารายการ Drafts หรือดำเนินการสร้างกลุ่มด้วยตนเองต่อไปได้
                  </p>
                </div>
              </div>
              <Link
                href="/backoffice/incidents"
                className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-700 hover:bg-indigo-100 transition-colors shrink-0 flex items-center gap-1"
              >
                <span>ดู Drafts</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}

          {/* Variance / Risk Inspection Box */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              ผลการวิเคราะห์คำร้องที่เลือก ({selectedReportsArray.length} รายการ)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block text-[11px]">สถานที่เกิดเหตุ</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 mt-0.5 block truncate">
                  {varianceAnalysis.locations.join(", ") || "ไม่ระบุ"}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block text-[11px]">ช่วงเวลาที่เกิดเหตุ</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 mt-0.5 block">
                  {varianceAnalysis.timeSpanText}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block text-[11px]">จำนวนคำร้องที่เลือก</span>
                <span className="font-mono font-black text-primary text-sm mt-0.5 block">
                  {selectedReportsArray.length} รายการ
                </span>
              </div>
            </div>

            {/* Location Variance Warning Banner */}
            {varianceAnalysis.hasLocationVariance && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">ข้อสังเกต: ตรวจพบสถานที่เกิดเหตุที่แตกต่างกัน</span>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                    คำร้องมาจาก {varianceAnalysis.locations.length} จุด ({varianceAnalysis.locations.join(", ")}) กรุณาตรวจสอบให้แน่ใจว่าเป็นเหตุการณ์เดียวกันก่อนรวมกลุ่ม
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Incident Form Inputs */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  ข้อมูลกลุ่มเหตุการณ์
                </h2>
                <p className="text-xs text-slate-500">
                  ระบบได้เสนอชื่อกลุ่มจากคำร้องที่เลือกไว้ คุณสามารถแก้ไขได้ตามความเหมาะสม
                </p>
              </div>

              <button
                type="button"
                onClick={autoSuggestDetails}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>เสนอชื่อกลุ่มใหม่อีกครั้ง</span>
              </button>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                ชื่อกลุ่มเหตุการณ์ <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="เช่น ปัญหาน้ำท่วมขัง บริเวณทางเข้าอาคาร 1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-900 dark:text-slate-100 font-bold"
              />
            </div>

            {/* Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  หมวดหมู่เหตุการณ์ (ถ้ามี)
                </label>
                <AppSelect
                  value={groupCategoryId}
                  onChange={(val) => setGroupCategoryId(val as string)}
                  options={[
                    { label: "ไม่ระบุหมวดหมู่เฉพาะ", value: "" },
                    ...categories.map((c: { id: number; name_th: string }) => ({
                      label: c.name_th,
                      value: c.id.toString(),
                    })),
                  ]}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                รายละเอียดสรุป / บันทึกของเจ้าหน้าที่ (ทางเลือก)
              </label>
              <textarea
                rows={3}
                placeholder="ระบุบริบทเหตุการณ์ ผลกระทบ หรือคำชี้แจงสำหรับเจ้าหน้าที่ผู้เกี่ยวข้อง..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-800 dark:text-slate-100 font-medium"
              />
            </div>
          </div>

          {/* Selected Reports Review & Prune List */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                คำร้องที่จะนำเข้าร่วมกลุ่ม ({selectedReportsArray.length} รายการ)
              </span>
              <button
                type="button"
                onClick={() => setCurrentStep("select")}
                className="text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                + ค้นหาและเลือกเพิ่ม
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
              {selectedReportsArray.map((rep) => (
                <div key={rep.public_id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {rep.public_id}
                      </span>
                      {rep.categories?.name_th && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                          {rep.categories.name_th}
                        </span>
                      )}
                      {rep.location && (
                        <span className="text-[11px] text-slate-400 truncate max-w-xs">
                          • {rep.location}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-xl">
                      {rep.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeSelectedReport(rep.public_id)}
                    className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer shrink-0"
                    title="นำออกจากกลุ่ม"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep("select")}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              ย้อนกลับไปแก้ไขรายการคำร้อง
            </button>

            <button
              type="button"
              disabled={!title.trim() || selectedReportsArray.length === 0}
              onClick={handleProceedToConfirm}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:pointer-events-none text-white font-black text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-primary/15 cursor-pointer"
            >
              <span>ถัดไป: ตรวจสอบก่อนสร้างกลุ่ม</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: Final Review and Confirmation                                     */}
      {/* ========================================================================= */}
      {currentStep === "confirm" && (
        <div className="space-y-6 animate-fade-in">
          {/* Summary Confirmation Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                สรุปข้อมูลกลุ่มเหตุการณ์ที่จะสร้าง
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                {title}
              </h2>
              {description && (
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  {description}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block text-[11px]">หมวดหมู่กลุ่มเหตุการณ์</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 mt-0.5 block">
                  {categories.find((c: { id: number }) => String(c.id) === groupCategoryId)?.name_th || "ไม่ระบุหมวดหมู่เฉพาะ"}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block text-[11px]">จำนวนคำร้องที่จะรวม</span>
                <span className="font-mono font-black text-primary text-base mt-0.5 block">
                  {selectedReportsArray.length} รายการ
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block text-[11px]">สถานะเริ่มต้น</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  เปิดดำเนินการ (Open)
                </span>
              </div>
            </div>

            {/* Warning if location variance exists */}
            {varianceAnalysis.hasLocationVariance && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">แจ้งเตือน: คำร้องมีสถานที่แตกต่างกัน</span>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                    คุณกำลังจะรวมคำร้องจากหลายสถานที่ ({varianceAnalysis.locations.join(", ")}) ระบบจะบันทึกประวัติการสร้างกลุ่มตามข้อมูลจริง
                  </p>
                </div>
              </div>
            )}

            {/* List of reports to be added */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                รายการคำร้องสมาชิกที่จะรวมเข้ากลุ่ม:
              </span>
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 border border-slate-200 dark:border-slate-800 divide-y divide-slate-200/60 dark:divide-slate-800 max-h-64 overflow-y-auto">
                {selectedReportsArray.map((rep, idx) => (
                  <div key={rep.public_id} className="py-2 text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="w-5 text-slate-400 font-mono text-[11px]">{idx + 1}.</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0">
                        {rep.public_id}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300 truncate">
                        {rep.description}
                      </span>
                    </div>
                    {rep.location && (
                      <span className="text-[11px] text-slate-400 shrink-0">
                        📍 {rep.location}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Confirm Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setCurrentStep("details")}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              ย้อนกลับไปแก้ไข
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleFinalSubmit}
              className="inline-flex items-center gap-2 px-7 py-3 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:pointer-events-none text-white font-black text-sm rounded-xl transition-all shadow-md shadow-primary/20 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึกและสร้างกลุ่มเหตุการณ์...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ยืนยันสร้างกลุ่มเหตุการณ์</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: Success Screen with Direct Links                                  */}
      {/* ========================================================================= */}
      {currentStep === "success" && createdGroup && (
        <div className="bg-white dark:bg-slate-900 p-8 sm:p-10 rounded-3xl border border-emerald-200 dark:border-emerald-800/60 shadow-lg text-center space-y-6 max-w-2xl mx-auto animate-scale-up">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {createdGroup.group_code}
            </span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              สร้างกลุ่มเหตุการณ์สำเร็จเรียบร้อยแล้ว
            </h2>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              &ldquo;{createdGroup.title}&rdquo;
            </p>
            <p className="text-xs text-slate-400">
              รวมคำร้องสมาชิกทั้งหมด {createdGroup.memberCount} รายการเข้าร่วมกลุ่มเหตุการณ์แล้ว
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleResetForAnother}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>สร้างกลุ่มอื่นเพิ่มเติม</span>
            </button>

            <Link
              href={`/backoffice/incidents/${createdGroup.group_code}`}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-black text-xs transition-all shadow-md shadow-primary/20 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-4 h-4" />
              <span>ไปยังหน้ารายละเอียดกลุ่มเหตุการณ์</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
