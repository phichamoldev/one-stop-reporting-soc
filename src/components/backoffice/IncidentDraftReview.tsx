"use client";

import React, { useState, useMemo } from "react";
import {
  Sparkles,
  MapPin,
  Clock,
  Tag,
  Layers,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Check,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { localizeConflictReason } from "@/lib/conflictLocalization";

export interface DraftReportItem {
  id: string;
  public_id: string;
  description?: string | null;
  location?: string | null;
  category_id?: number | null;
  subcategory_id?: number | null;
  priority?: "emergency" | "normal" | "needs_review";
  status?: string;
  created_at: string;
}

export interface CandidateExistingGroupItem {
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

export interface IncidentDraftData {
  draftId: string;
  proposedTitle: string;
  proposedDescription?: string;
  priority: "emergency" | "normal" | "needs_review";
  priorityReason: string;
  category_id?: number | null;
  subcategory_id?: number | null;
  categoryName?: string;
  subcategoryName?: string;
  reportCount: number;
  reports?: DraftReportItem[];
  earliestReportDate?: string;
  latestReportDate?: string;
  timeSpanHours: number;
  correlationScore: number;
  reasons: string[];
  evidence?: string[];
  differences?: string[];
  locationSummary?: string;
  spatialGranularity?: string;
  sharedRootCause?: string | null;
  conflicts: string[];
  isEmergency?: boolean;
}

export interface IncidentDraftReviewProps {
  draft: IncidentDraftData;
  className?: string;
}

export interface SupportingCategoryGroup {
  key: "location" | "time" | "category" | "system" | "content" | "other";
  title: string;
  summary: string;
  subSummary?: string;
  items: string[];
  icon: React.ElementType;
  badgeClass: string;
}

export interface DifferenceCategoryGroup {
  key: "sub_location" | "phrasing" | "time_gap" | "existing_group" | "other";
  title: string;
  summary: string;
  items: string[];
  icon: React.ElementType;
}

function getSpatialGranularityText(granularity?: string): string {
  switch (granularity) {
    case "room":
    case "exact_spot":
      return "ระดับห้อง/จุดย่อย";
    case "floor":
    case "floor_area":
      return "ระดับชั้น";
    case "building":
      return "ระดับอาคาร";
    case "campus_area":
      return "ระดับพื้นที่ภายนอก";
    default:
      return "สถานที่ทางกายภาพ";
  }
}

function getRootCauseText(cause?: string | null): string {
  if (!cause) return "";
  switch (cause) {
    case "power_grid_failure":
      return "ไฟฟ้าดับวงกว้าง";
    case "storm_heavy_rain":
      return "พายุฝน/น้ำหลาก";
    case "commencement_event":
      return "งานพิธีการ/กิจกรรมส่วนกลาง";
    default:
      return cause;
  }
}

export function IncidentDraftReview({ draft, className = "" }: IncidentDraftReviewProps) {
  // Main Accordion state for "รายละเอียดการวิเคราะห์กลุ่มเหตุการณ์" (Default: Collapsed)
  const [isAnalysisDetailsOpen, setIsAnalysisDetailsOpen] = useState(false);

  // Per-category mini expand states (within Supporting and Difference panels)
  const [expandedSupportingKeys, setExpandedSupportingKeys] = useState<Record<string, boolean>>({});
  const [expandedDifferenceKeys, setExpandedDifferenceKeys] = useState<Record<string, boolean>>({});

  const toggleSupportingKey = (key: string) => {
    setExpandedSupportingKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleDifferenceKey = (key: string) => {
    setExpandedDifferenceKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ---------------------------------------------------------------------------
  // 1. Supporting Evidence: Presentation-layer Categorization & Deduplication
  // ---------------------------------------------------------------------------
  const supportingCategories = useMemo<SupportingCategoryGroup[]>(() => {
    const combinedSupporting = Array.from(
      new Set([...(draft.reasons || []), ...(draft.evidence || [])].map((s) => s.trim()).filter(Boolean))
    );

    const buckets: Record<SupportingCategoryGroup["key"], string[]> = {
      location: [],
      time: [],
      category: [],
      system: [],
      content: [],
      other: [],
    };

    for (const item of combinedSupporting) {
      if (/(?:เวลา|นาที|ชั่วโมง|ชม\.|วันเดียวกัน|ต่อเนื่อง|กรอบเวลา)/i.test(item)) {
        buckets.time.push(item);
      } else if (/(?:สถานที่|จุดเกิดเหตุ|บริเวณ|อาคาร|ชั้น|ห้อง|ทางเดิน|บ่อปลา|ลานจอดรถ|พื้นที่)/i.test(item)) {
        buckets.location.push(item);
      } else if (/(?:หมวดหมู่|ลักษณะปัญหา|ปัญหาประเภท)/i.test(item)) {
        buckets.category.push(item);
      } else if (/(?:ระบบ|อุปกรณ์|สาเหตุร่วม|ต้นเหตุ|เครือข่าย|ไฟฟ้า|ท่อระบาย|แอร์)/i.test(item)) {
        buckets.system.push(item);
      } else if (/(?:เนื้อหา|คำสำคัญ|ถ้อยคำ|คำร้องสอดคล้อง|ตรงกับกลุ่ม)/i.test(item)) {
        buckets.content.push(item);
      } else {
        buckets.other.push(item);
      }
    }

    const groups: SupportingCategoryGroup[] = [];

    // Category 1: Location
    if (buckets.location.length > 0) {
      let summaryText = "สถานที่เกิดเหตุทางกายภาพบริเวณเดียวกัน";
      if (buckets.location.some((s) => /ตรงกันเป๊ะ|จุดเกิดเหตุตรงกัน/i.test(s))) {
        summaryText = "ระบุจุดเกิดเหตุเฉพาะตำแหน่งตรงกันเป๊ะ";
      } else if (buckets.location.some((s) => /ชั้นเดียวกัน/i.test(s))) {
        summaryText = "สถานที่เดียวกันและชั้นเดียวกันในอาคาร";
      } else if (draft.locationSummary) {
        summaryText = `สถานที่เกิดเหตุบริเวณเดียวกัน (${draft.locationSummary})`;
      }

      groups.push({
        key: "location",
        title: "สถานที่และพื้นที่เกิดเหตุ",
        summary: summaryText,
        subSummary: `${buckets.location.length} รายการหลักฐานสถานที่${
          draft.spatialGranularity ? ` • ${getSpatialGranularityText(draft.spatialGranularity)}` : ""
        }`,
        items: buckets.location,
        icon: MapPin,
        badgeClass: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
      });
    }

    // Category 2: Time
    if (buckets.time.length > 0) {
      let timeSummary = "พบคำร้องเกิดขึ้นในช่วงเวลาที่ใกล้เคียงกัน";
      if (draft.timeSpanHours > 0) {
        timeSummary = `เกิดขึ้นต่อเนื่องในช่วงเวลาใกล้เคียงกัน (ห่างกันไม่เกิน ${draft.timeSpanHours} ชม.)`;
      }

      groups.push({
        key: "time",
        title: "กรอบเวลาและความต่อเนื่อง",
        summary: timeSummary,
        subSummary: `${buckets.time.length} จุดตรวจสอบเวลาที่บันทึกไว้`,
        items: buckets.time,
        icon: Clock,
        badgeClass: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
      });
    }

    // Category 3: Category / Subcategory
    if (buckets.category.length > 0) {
      const catSummary = draft.categoryName
        ? `หมวดหมู่หลักตรงกัน: ${draft.categoryName}${draft.subcategoryName ? ` • ${draft.subcategoryName}` : ""}`
        : "หมวดหมู่หลักและลักษณะปัญหาตรงกัน";

      groups.push({
        key: "category",
        title: "ประเภทและหมวดหมู่งาน",
        summary: catSummary,
        subSummary: "ลักษณะปัญหาที่รายงานจัดอยู่ในกลุ่มงานเดียวกัน",
        items: buckets.category,
        icon: Tag,
        badgeClass: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800",
      });
    }

    // Category 4: System / Equipment / Root Cause
    if (buckets.system.length > 0) {
      let sysSummary = "ปัญหาเกิดขึ้นกับระบบหรืออุปกรณ์บริการประเภทเดียวกัน";
      if (draft.sharedRootCause) {
        sysSummary = `ได้รับผลกระทบจากสาเหตุร่วม (${getRootCauseText(draft.sharedRootCause)})`;
      }

      groups.push({
        key: "system",
        title: "ระบบ อุปกรณ์ หรือต้นเหตุร่วม",
        summary: sysSummary,
        subSummary: `${buckets.system.length} หลักฐานเชื่อมโยงเชิงระบบหรือสาเหตุ`,
        items: buckets.system,
        icon: Layers,
        badgeClass: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border-teal-200 dark:border-teal-800",
      });
    }

    // Category 5: Content Similarity
    if (buckets.content.length > 0) {
      groups.push({
        key: "content",
        title: "ความสอดคล้องของเนื้อหาคำร้อง",
        summary: "เนื้อหาคำร้องและสาระสำคัญของปัญหาสอดคล้องกัน",
        subSummary: `${buckets.content.length} รายการตรวจพบคีย์เวิร์ดและประเด็นตรงกัน`,
        items: buckets.content,
        icon: FileText,
        badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
      });
    }

    // Category 6: Other
    if (buckets.other.length > 0) {
      groups.push({
        key: "other",
        title: "ข้อสนับสนุนเพิ่มเติม",
        summary: "พบข้อสนับสนุนเพิ่มเติมจากการวิเคราะห์เหตุการณ์",
        subSummary: `${buckets.other.length} รายการ`,
        items: buckets.other,
        icon: Sparkles,
        badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
      });
    }

    return groups;
  }, [draft]);

  // ---------------------------------------------------------------------------
  // 2. Conflicting Evidence: Presentation-layer Categorization & Deduplication
  // ---------------------------------------------------------------------------
  const differenceCategories = useMemo<DifferenceCategoryGroup[]>(() => {
    const combinedDiffs = Array.from(
      new Set([...(draft.conflicts || []), ...(draft.differences || [])].map((s) => s.trim()).filter(Boolean))
    );

    if (combinedDiffs.length === 0) return [];

    const buckets: Record<DifferenceCategoryGroup["key"], string[]> = {
      existing_group: [],
      sub_location: [],
      phrasing: [],
      time_gap: [],
      other: [],
    };

    for (const item of combinedDiffs) {
      if (/(?:อยู่ในกลุ่ม|ซ้ำซ้อนกับกลุ่ม|กลุ่มเหตุการณ์อื่น)/i.test(item)) {
        buckets.existing_group.push(item);
      } else if (/(?:จุดย่อยต่างกัน|สถานที่ย่อย|ต่างกันเล็กน้อย|คนละห้อง|คนละชั้น|คนละจุด)/i.test(item)) {
        buckets.sub_location.push(item);
      } else if (/(?:ถ้อยคำและมุมมอง|สำนวน|คำบรรยายต่าง)/i.test(item)) {
        buckets.phrasing.push(item);
      } else if (/(?:เวลาห่างกัน|เวลาต่างกัน)/i.test(item)) {
        buckets.time_gap.push(item);
      } else {
        buckets.other.push(item);
      }
    }

    const groups: DifferenceCategoryGroup[] = [];

    if (buckets.existing_group.length > 0) {
      groups.push({
        key: "existing_group",
        title: "สังกัดกลุ่มเหตุการณ์อื่นอยู่แล้ว",
        summary: `มีคำร้อง ${buckets.existing_group.length} รายการที่อยู่ในกลุ่มอื่นแล้ว (ต้องยืนยันการย้ายกลุ่มก่อน)`,
        items: buckets.existing_group,
        icon: AlertTriangle,
      });
    }

    if (buckets.sub_location.length > 0) {
      groups.push({
        key: "sub_location",
        title: "ตำแหน่งหรือจุดเกิดเหตุย่อยต่างกัน",
        summary: `ผู้แจ้งระบุจุดเฉพาะต่างกันในบริเวณเดียวกัน เช่น คนละห้องหรือตำแหน่งย่อย (${buckets.sub_location.length} รายการ)`,
        items: buckets.sub_location,
        icon: MapPin,
      });
    }

    if (buckets.phrasing.length > 0) {
      groups.push({
        key: "phrasing",
        title: "สำนวนหรือมุมมองการบรรยายต่างกัน",
        summary: "ผู้แจ้งแต่ละคนอธิบายปัญหาด้วยถ้อยคำของตนเอง แต่มีสาระสำคัญของปัญหาไปในทิศทางเดียวกัน",
        items: buckets.phrasing,
        icon: FileText,
      });
    }

    if (buckets.time_gap.length > 0) {
      groups.push({
        key: "time_gap",
        title: "ช่วงเวลาเกิดเหตุมีระยะห่าง",
        summary: `เวลาที่เกิดเหตุมีช่วงห่างกันพอสมควรสำหรับปัญหาลักษณะนี้ (${buckets.time_gap.length} รายการ)`,
        items: buckets.time_gap,
        icon: Clock,
      });
    }

    // Keep distinctly individual items for other conflicts so genuine distinctions are never hidden
    if (buckets.other.length > 0) {
      groups.push({
        key: "other",
        title: "ข้อสังเกตเฉพาะอื่น ๆ",
        summary: `พบข้อสังเกตเพิ่มเติม ${buckets.other.length} รายการที่ควรตรวจสอบก่อนรวมกลุ่ม`,
        items: buckets.other,
        icon: AlertCircle,
      });
    }

    return groups;
  }, [draft]);

  // Sanitize and clean priority reason to ensure NO SOC-T-... or reference lists leak into summary
  const cleanPriorityReason = useMemo(() => {
    let raw = draft.priorityReason || "";
    // Strip any raw ID lists like (SOC-T-00001, SOC-T-00002, ...) or (SOC-0001, ...)
    raw = raw.replace(/\s*\((?:SOC(?:-T)?-[\w-]+(?:,\s*)?)+\)/gi, "");
    if (raw.includes("พบคำร้องระดับฉุกเฉินในกลุ่ม") || raw.includes("พบคำร้องระดับฉุกเฉิน")) {
      const emergCount = draft.reports?.filter((r) => r.priority === "emergency").length || 0;
      if (emergCount > 0) {
        return `พบคำร้องระดับฉุกเฉิน ${emergCount} จาก ${draft.reportCount} รายการ`;
      }
      return "พบคำร้องระดับฉุกเฉินในกลุ่ม";
    }
    return raw.trim() || (draft.priority === "emergency" ? "ระดับฉุกเฉินเร่งด่วน" : "เรื่องทั่วไป");
  }, [draft.priorityReason, draft.priority, draft.reports, draft.reportCount]);

  const locationDisplay = useMemo(() => {
    return draft.locationSummary || draft.reports?.[0]?.location || "ระบุในรายละเอียดคำร้อง";
  }, [draft.locationSummary, draft.reports]);

  // Key observation from analysis (if any)
  const keyObservation = useMemo(() => {
    if (differenceCategories.length > 0) {
      return differenceCategories[0].summary;
    }
    if (draft.sharedRootCause) {
      return `สาเหตุร่วม: ${getRootCauseText(draft.sharedRootCause)}`;
    }
    return null;
  }, [differenceCategories, draft.sharedRootCause]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* ========================================================================= */}
      {/* SECTION A: INCIDENT SUMMARY BANNER                                       */}
      {/* ========================================================================= */}
      <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
        {/* Top Header & Metrics Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              สรุปการวิเคราะห์กลุ่มเหตุการณ์ (Incident Analysis Summary)
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              ร่างรอเจ้าหน้าที่ยืนยัน
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <div className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>คะแนนประเมิน: {draft.correlationScore}/100</span>
            </div>
            <div className="px-2.5 py-1 rounded-lg bg-slate-200/70 text-slate-700 dark:bg-slate-700 dark:text-slate-200 font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>คำร้อง {draft.reportCount} รายการ • ช่วงเวลา {draft.timeSpanHours} ชม.</span>
            </div>
          </div>
        </div>

        {/* Structured Decision Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1 text-xs">
          {/* 1. Incident Name */}
          <div className="bg-white dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-700/60 flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              ชื่อเหตุการณ์
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-100 truncate mt-0.5 text-xs sm:text-sm" title={draft.proposedTitle}>
              {draft.proposedTitle}
            </span>
          </div>

          {/* 2. Location */}
          <div className="bg-white dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-700/60 flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              สถานที่เกิดเหตุ
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-200 truncate mt-0.5 text-xs sm:text-sm" title={locationDisplay}>
              {locationDisplay}
            </span>
          </div>

          {/* 3. Priority & Severity */}
          <div className="bg-white dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-700/60 flex flex-col justify-center sm:col-span-2 lg:col-span-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              ระดับความรุนแรง
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                draft.priority === 'emergency' 
                  ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800'
                  : draft.priority === 'needs_review'
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}>
                {draft.priority === 'emergency' ? 'ฉุกเฉิน (Emergency)' : draft.priority === 'needs_review' ? 'รอตรวจสอบ (Needs Review)' : 'ปกติ (Normal)'}
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-[11px] truncate" title={cleanPriorityReason}>
                {cleanPriorityReason}
              </span>
            </div>
          </div>
        </div>

        {/* 4. Analysis Observation (if any) */}
        {keyObservation && (
          <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-900/40 px-3 py-1.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="font-semibold text-slate-700 dark:text-slate-200">ข้อสังเกตจากการวิเคราะห์:</span>
            <span className="truncate">{keyObservation}</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ACCORDION: รายละเอียดการวิเคราะห์กลุ่มเหตุการณ์ (SUPPORTING & CONFLICTING)    */}
      {/* Defaults to collapsed. When expanded, reveals 2-column layout on Desktop. */}
      {/* ========================================================================= */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => setIsAnalysisDetailsOpen((prev) => !prev)}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm">
              รายละเอียดการวิเคราะห์กลุ่มเหตุการณ์
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Supporting Evidence Count Badge */}
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
              {supportingCategories.length} หมวดหลักฐาน
            </span>

            {/* Conflicting Evidence Count Badge */}
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                differenceCategories.length > 0
                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              }`}
            >
              {differenceCategories.length > 0
                ? `${differenceCategories.length} ข้อสังเกต`
                : "ไม่พบข้อขัดแย้ง"}
            </span>

            <span className="text-[11px] font-normal text-slate-400 hidden sm:inline ml-1">
              {isAnalysisDetailsOpen ? "ย่อกลับ" : "คลิกเพื่อดูรายละเอียด"}
            </span>

            {isAnalysisDetailsOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400 ml-0.5" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400 ml-0.5" />
            )}
          </div>
        </button>

        {isAnalysisDetailsOpen && (
          <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in">
            {/* ======================================================================= */}
            {/* SECTION B: SUPPORTING EVIDENCE (หลักฐานสนับสนุน)                         */}
            {/* ======================================================================= */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        หลักฐานสนับสนุนความเป็นเหตุการณ์เดียวกัน (Supporting Evidence)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        ประเด็นหลักที่ระบบตรวจพบความสอดคล้องตามเกณฑ์
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                    {supportingCategories.length} หมวดหลักฐาน
                  </span>
                </div>

                {/* Structured Compact Cards */}
                {supportingCategories.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    ไม่พบหลักฐานสนับสนุนเพิ่มเติม
                  </div>
                ) : (
                  <div className="space-y-2">
                    {supportingCategories.map((cat) => {
                      const Icon = cat.icon;
                      const isExpanded = Boolean(expandedSupportingKeys[cat.key]);
                      const hasMultiple = cat.items.length > 1;

                      return (
                        <div
                          key={cat.key}
                          className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <div className="mt-0.5 p-1 rounded-md bg-white dark:bg-slate-700 shadow-2xs shrink-0 text-slate-600 dark:text-slate-300">
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <div className="space-y-0.5 min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-700 dark:text-slate-200">
                                    {cat.title}:
                                  </span>
                                  <span className="text-slate-800 dark:text-slate-100 font-medium">
                                    {localizeConflictReason(cat.summary)}
                                  </span>
                                </div>
                                {cat.subSummary && (
                                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                    {cat.subSummary}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Expandable detail trigger for individual category */}
                            {hasMultiple && (
                              <button
                                type="button"
                                onClick={() => toggleSupportingKey(cat.key)}
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0"
                                title={isExpanded ? "ย่อรายละเอียด" : `ดูทั้งหมด ${cat.items.length} รายการ`}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* Dropdown list of items for this category */}
                          {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 pl-6 space-y-1">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                รายการที่ตรวจพบ ({cat.items.length} รายการ):
                              </p>
                              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                                {cat.items.map((it, idx) => (
                                  <li key={idx} className="leading-relaxed">
                                    {localizeConflictReason(it)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ======================================================================= */}
            {/* SECTION C: CONFLICTING EVIDENCE (ความแตกต่างและข้อสังเกต)                 */}
            {/* ======================================================================= */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        ความแตกต่างและข้อสังเกตที่ควรตรวจสอบ (Conflicting Evidence)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        จุดแตกต่างที่เจ้าหน้าที่ควรพิจารณาก่อนกดรวมกลุ่ม
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                      differenceCategories.length > 0
                        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                    }`}
                  >
                    {differenceCategories.length > 0
                      ? `${differenceCategories.length} ประเด็นข้อสังเกต`
                      : "ไม่พบข้อขัดแย้ง"}
                  </span>
                </div>

                {/* Content: Clean card if no conflicts, or structured cards if conflicts exist */}
                {differenceCategories.length === 0 ? (
                  <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-dashed border-emerald-200 dark:border-emerald-900/60 flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-300">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-bold">ไม่พบข้อขัดแย้งของเหตุการณ์ (No Conflicts Detected)</p>
                      <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                        คำร้องทุกใบในกลุ่มนี้ระบุสถานที่ ระบบบริการ และกรอบเวลาที่สอดคล้องกันทั้งหมด
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {differenceCategories.map((diff) => {
                      const Icon = diff.icon;
                      const isExpanded = Boolean(expandedDifferenceKeys[diff.key]);
                      const hasMultiple = diff.items.length > 1;

                      return (
                        <div
                          key={diff.key}
                          className="p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <div className="mt-0.5 p-1 rounded-md bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-2xs shrink-0">
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <div className="space-y-0.5 min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-amber-900 dark:text-amber-200">
                                    {diff.title}:
                                  </span>
                                </div>
                                <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                  {localizeConflictReason(diff.summary)}
                                </p>
                              </div>
                            </div>

                            {hasMultiple && (
                              <button
                                type="button"
                                onClick={() => toggleDifferenceKey(diff.key)}
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0"
                                title={isExpanded ? "ย่อรายละเอียด" : `ดูทั้งหมด ${diff.items.length} รายการ`}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* Dropdown list of specific differences */}
                          {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-amber-200/60 dark:border-amber-800/60 pl-6 space-y-1">
                              <p className="text-[10px] font-bold text-amber-800/80 dark:text-amber-300/80 uppercase tracking-wider">
                                รายละเอียดที่บันทึกไว้ ({diff.items.length} รายการ):
                              </p>
                              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-950/90 dark:text-amber-200/90">
                                {diff.items.map((it, idx) => (
                                  <li key={idx} className="leading-relaxed">
                                    {localizeConflictReason(it)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
