"use client";

/**
 * Shared layout blocks for the public Track page (/track/[publicId]) and the
 * staff request detail page (/report/[publicId]).
 *
 * Layout reference: header card with horizontal status stepper, then a 66:34
 * two-column grid (details + timeline on the left, actions / reporter on the right).
 *
 * Long staff replies are always rendered in full: no fixed heights, no line clamp,
 * no ellipsis. Cards grow with their content.
 */

import React from "react";
import { ArrowLeft, Check, ChevronDown, ImageIcon, Maximize2 } from "lucide-react";
import { Report, ReportLog, ReportStatus, STATUS_DETAILS, getStatusLabel } from "@/types/report";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export function formatThaiDateTime(dateString?: string | null): string {
  if (!dateString) return "-";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "-";
  return (
    d.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" }) +
    ", " +
    d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) +
    " น."
  );
}

const INTERNAL_ACTIONS = new Set([
  "priority_classified",
  "priority_updated",
  "incident_detection_completed",
  "incident_detection_failed",
  "incident_group_added",
  "incident_group_removed",
  "draft_created",
  "draft_rejected",
]);

function isInternalRemark(text: string | null | undefined): boolean {
  if (!text) return false;
  return (
    text.includes("ความสัมพันธ์") ||
    text.includes("กลุ่มเหตุการณ์") ||
    text.includes("จัดประเภทความเร่งด่วน") ||
    text.includes("ตรวจจับเหตุการณ์") ||
    text.includes("คำร้องอื่น")
  );
}

export const REPORTER_TYPE_LABELS: Record<string, string> = {
  "อาจารย์": "👨‍🏫 อาจารย์",
  "บุคลากร": "💼 บุคลากร",
  "นิสิต": "🎓 นิสิต",
};

/* -------------------------------------------------------------------------- */
/* Timeline entries                                                           */
/* -------------------------------------------------------------------------- */

export interface TimelineEntry {
  key: string;
  status: string; // report status key or 'transfer'
  label: string;
  created_at: string;
  remark: string | null;
  image_url?: string | null;
  actorName: string;
  source: "staff" | "system" | "reporter";
  isNote?: boolean;
}

/**
 * Builds one timeline entry per log (newest first) so every staff reply is shown,
 * not only the latest one. Public mode hides internal/system audit entries.
 */
export function buildTimelineEntries(report: Report, opts: { includeInternal: boolean }): TimelineEntry[] {
  const logs = [...(report.report_logs || [])].filter((l): l is ReportLog => Boolean(l));
  const visible = opts.includeInternal
    ? logs
    : logs.filter((l) => !INTERNAL_ACTIONS.has(l.action) && !isInternalRemark(l.remark));

  const entries: TimelineEntry[] = visible.map((log) => {
    const isTransfer = log.action === "transfer";
    const isCreated = log.action === "created";
    const isNote = log.action === "note_updated" || log.action === "admin_note_added";
    const staffName = log.staff_users?.full_name;
    return {
      key: `log-${log.id}`,
      status: isTransfer ? "transfer" : log.new_status || "pending",
      label: isTransfer
        ? "โอนคำร้อง"
        : isCreated
        ? "ส่งเรื่องเข้าระบบแล้ว"
        : STATUS_DETAILS[log.new_status as ReportStatus]?.label || getStatusLabel(log.new_status),
      created_at: log.created_at,
      remark: log.remark,
      image_url: log.image_url || null,
      actorName: staffName || (isCreated ? "ผู้แจ้ง" : "ระบบ"),
      source: staffName ? "staff" : isCreated ? "reporter" : "system",
      isNote,
    };
  });

  // Always show the submission milestone, even when no 'created' log exists.
  if (!visible.some((l) => l.action === "created")) {
    entries.push({
      key: "submitted",
      status: "pending",
      label: "ส่งเรื่องเข้าระบบแล้ว",
      created_at: report.created_at,
      remark: null,
      actorName: "ผู้แจ้ง",
      source: "reporter",
    });
  }

  return entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/* -------------------------------------------------------------------------- */
/* Horizontal status stepper                                                  */
/* -------------------------------------------------------------------------- */

const STEP_ORDER: { status: ReportStatus; label: string }[] = [
  { status: "pending", label: "ส่งเรื่องเข้าระบบ" },
  { status: "received", label: "รับเรื่องแล้ว" },
  { status: "in_progress", label: "กำลังดำเนินการ" },
  { status: "completed", label: "เสร็จสิ้น" },
];

function StatusStepper({ report, step1Label }: { report: Report; step1Label?: string }) {
  const logs = report.report_logs || [];
  const isTerminatedNegative = report.status === "rejected" || report.status === "cancelled";

  const steps = STEP_ORDER.map((s, idx) => ({
    ...s,
    label: idx === 0 && step1Label ? step1Label : s.label,
  }));
  if (isTerminatedNegative) {
    steps[3] = { status: report.status, label: STATUS_DETAILS[report.status]?.label || report.status };
  }

  const currentIndex = isTerminatedNegative
    ? 3
    : Math.max(0, STEP_ORDER.findIndex((s) => s.status === report.status));

  const reachedAt = (status: ReportStatus): string | null => {
    if (status === "pending") return report.created_at;
    const hit = [...logs]
      .filter((l) => l && l.new_status === status && l.action !== "note_updated")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
    return hit?.created_at || (status === report.status ? (status === "completed" ? (report.completed_at || report.updated_at) : report.updated_at) : null);
  };

  return (
    <ol className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full pt-5 mt-5 border-t border-slate-100">
      {steps.map((step, idx) => {
        const date = reachedAt(step.status);
        const isCurrent = idx === currentIndex;
        const isDone = idx < currentIndex || (isCurrent && step.status === "completed");
        const isSkipped = idx < currentIndex && !date;
        const negative = isCurrent && isTerminatedNegative;

        let circle: React.ReactNode;
        if (negative) {
          circle = <span className="w-7 h-7 rounded-full bg-rose-500 ring-4 ring-rose-100 shrink-0" />;
        } else if (isDone && !isSkipped) {
          circle = (
            <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 ring-4 ring-emerald-50">
              <Check className="w-4 h-4" strokeWidth={3} />
            </span>
          );
        } else if (isCurrent) {
          circle = <span className="w-7 h-7 rounded-full bg-[#C2410C] ring-4 ring-orange-100 shrink-0" />;
        } else {
          circle = <span className="w-7 h-7 rounded-full border-2 border-dashed border-slate-300 bg-white shrink-0" />;
        }

        const labelColor = negative
          ? "text-rose-700"
          : isDone && !isSkipped
          ? "text-slate-800"
          : isCurrent
          ? "text-[#C2410C]"
          : "text-slate-500";

        return (
          <li key={step.status} className="flex items-start gap-2.5 min-w-0 w-full">
            {circle}
            <div className="min-w-0 flex-1">
              <p className={`text-[13px] sm:text-[14px] font-bold leading-tight truncate ${labelColor}`}>{step.label}</p>
              <p className="text-[11px] sm:text-[12px] text-slate-400 mt-1 leading-snug break-words">
                {date && !isSkipped ? formatThaiDateTime(date) : idx > currentIndex ? "รอดำเนินการ" : "ไม่มีบันทึก"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/* Header card                                                                */
/* -------------------------------------------------------------------------- */

interface HeaderCardProps {
  report: Report;
  eyebrow?: string;
  onBack?: () => void;
  topBar?: React.ReactNode;
  step1Label?: string;
}

export function ReportHeaderCard({ report, eyebrow = "เลขอ้างอิง", onBack, topBar, step1Label }: HeaderCardProps) {
  const statusInfo = STATUS_DETAILS[report.status] || STATUS_DETAILS.pending;
  return (
    <section className="bg-white rounded-[20px] border border-slate-100 shadow-sm overflow-hidden">
      {topBar && (
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-slate-100">
          {topBar}
        </div>
      )}
      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="ย้อนกลับ"
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="min-w-0">
              <span className="text-[12px] text-slate-400 font-medium block">{eyebrow}</span>
              <h1 className="text-[22px] sm:text-[26px] font-extrabold text-slate-800 tracking-tight leading-tight break-all">
                {report.public_id}
              </h1>
            </div>
          </div>
          <div className="flex flex-col sm:items-end gap-1.5">
            <span
              className={`self-start sm:self-end inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold border ${statusInfo.bgClass} ${statusInfo.colorClass} ${statusInfo.borderClass}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
              {statusInfo.label}
            </span>
            <span className="text-[11px] sm:text-[12px] text-slate-400">
              สร้าง {formatThaiDateTime(report.created_at)} · อัปเดตล่าสุด {formatThaiDateTime(report.updated_at)}
            </span>
          </div>
        </div>
        <StatusStepper report={report} step1Label={step1Label} />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Generic card shell                                                         */
/* -------------------------------------------------------------------------- */

export function DetailCard({
  title,
  accent,
  right,
  children,
  className = "",
}: {
  title: string;
  accent?: "orange" | "blue";
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const accentClass =
    accent === "orange" ? "border-t-[3px] border-t-[#C2410C]" : accent === "blue" ? "border-t-[3px] border-t-blue-600" : "";
  return (
    <section className={`w-full bg-white rounded-[20px] border border-slate-100 shadow-sm min-w-0 overflow-hidden ${accentClass} ${className}`}>
      <div className="px-5 sm:px-6 pt-5 pb-4 flex items-center justify-between gap-3 min-w-0">
        <h2 className="text-[16px] sm:text-[17px] font-bold text-slate-800 truncate">{title}</h2>
        {right}
      </div>
      <div className="px-5 sm:px-6 pb-5 sm:pb-6 min-w-0">{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Report info card                                                           */
/* -------------------------------------------------------------------------- */

export function ReportInfoCard({ report, onImageClick }: { report: Report; onImageClick?: (url: string) => void }) {
  return (
    <DetailCard title="รายละเอียดการแจ้ง" accent="orange">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 min-w-0">
        <div className="min-w-0">
          <p className="text-[11px] text-slate-400 font-medium mb-1">หมวดหมู่หลัก</p>
          <p className="text-[14px] font-bold text-slate-800 break-words">{report.categories?.name_th || "-"}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-slate-400 font-medium mb-1">หมวดหมู่ย่อย</p>
          <p className="text-[14px] font-bold text-slate-800 break-words">{report.subcategories?.name_th || "-"}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-slate-400 font-medium mb-1">สถานที่</p>
          <p className="text-[14px] font-bold text-slate-800 break-words whitespace-pre-wrap">
            {report.location?.trim() ? report.location : <span className="text-slate-400 font-normal">ไม่ได้ระบุสถานที่</span>}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-4 sm:p-5 min-w-0 w-full">
        <p className="w-full text-[14px] sm:text-[15px] text-slate-700 leading-[1.85] whitespace-pre-wrap break-words [overflow-wrap:anywhere] min-w-0">
          {report.description || "-"}
        </p>
      </div>

      {report.image_url && (
        <div className="mt-4">
          <p className="text-[11px] text-slate-400 font-medium mb-2 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" /> รูปภาพประกอบ
          </p>
          <button
            type="button"
            onClick={() => onImageClick?.(report.image_url as string)}
            className="relative group block w-full sm:w-auto rounded-xl overflow-hidden border border-slate-200 bg-slate-50 cursor-pointer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={report.image_url} alt="รูปภาพประกอบ" className="max-h-[320px] w-full sm:w-auto object-contain" />
            <span className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5">
              <Maximize2 className="w-4 h-4" /> ขยายภาพ
            </span>
          </button>
        </div>
      )}
    </DetailCard>
  );
}

export function ExpandableTimelineNote({
  remark,
  noteLabel,
  colorClass,
  bgClass,
  borderClass,
}: {
  remark: string;
  noteLabel: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [canExpand, setCanExpand] = React.useState(false);
  const textRef = React.useRef<HTMLParagraphElement>(null);

  React.useEffect(() => {
    const checkOverflow = () => {
      const el = textRef.current;
      if (!el) return;
      const lineBreaks = (remark.match(/\n/g) || []).length;
      const isLongChars = remark.trim().length > 130;
      const isHeightOverflow = el.scrollHeight > 90;
      setCanExpand(lineBreaks >= 2 || isLongChars || isHeightOverflow);
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [remark]);

  return (
    <div className={`mt-2 rounded-xl border p-3.5 sm:p-4 ${bgClass} ${borderClass} transition-colors w-full min-w-0`}>
      <p className={`text-[11px] font-bold mb-1.5 ${colorClass}`}>{noteLabel}</p>

      <div className="relative w-full min-w-0">
        <p
          ref={textRef}
          className={`w-full text-[14px] text-slate-700 leading-[1.8] whitespace-pre-wrap break-words [overflow-wrap:anywhere] min-w-0 transition-all duration-300 ${
            canExpand && !isExpanded ? "line-clamp-3 overflow-hidden" : ""
          }`}
        >
          {remark}
        </p>

        {canExpand && !isExpanded && (
          <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white/70 to-transparent pointer-events-none" />
        )}
      </div>

      {canExpand && (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-bold text-[#C2410C] hover:text-[#9A3412] transition-colors cursor-pointer select-none group focus:outline-none"
        >
          <span>{isExpanded ? "ย่อข้อความ" : "อ่านเพิ่มเติม"}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isExpanded ? "rotate-180" : "group-hover:translate-y-0.5"
            }`}
          />
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Activity timeline card                                                     */
/* -------------------------------------------------------------------------- */

const TRANSFER_STYLE = {
  colorClass: "text-purple-700",
  bgClass: "bg-purple-50",
  borderClass: "border-purple-200",
  dotClass: "bg-purple-500",
};

export function ActivityTimelineCard({
  entries,
  showUpcomingCompletion = false,
  onImageClick,
}: {
  entries: TimelineEntry[];
  showUpcomingCompletion?: boolean;
  onImageClick?: (url: string) => void;
}) {
  return (
    <DetailCard
      title="ประวัติการดำเนินงาน"
      right={
        <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full shrink-0">
          {entries.length} รายการ
        </span>
      }
    >
      <ol className="relative">
        {showUpcomingCompletion && (
          <li className="relative pl-8 pb-6">
            <span className="absolute left-[11px] top-5 bottom-0 w-px bg-slate-200" aria-hidden />
            <span className="absolute left-0 top-0.5 w-[23px] h-[23px] rounded-full border-2 border-dashed border-slate-300 bg-white" />
            <p className="text-[14px] font-bold text-slate-500">เสร็จสิ้น</p>
            <p className="text-[12px] text-slate-400 mt-0.5">รอดำเนินการ — โน้ตสรุปผลจะแสดงที่นี่เมื่อปิดเรื่อง</p>
          </li>
        )}

        {entries.length === 0 && <li className="text-[13px] text-slate-400">ยังไม่มีประวัติการดำเนินงาน</li>}

        {entries.map((entry, idx) => {
          const style =
            entry.status === "transfer"
              ? TRANSFER_STYLE
              : STATUS_DETAILS[entry.status as ReportStatus] || STATUS_DETAILS.pending;
          const isLast = idx === entries.length - 1;
          const noteLabel =
            entry.source === "staff" ? "โน้ตจากเจ้าหน้าที่" : entry.source === "reporter" ? "ข้อมูลจากผู้แจ้ง" : "โน้ตจากระบบ";
          const isFirst = idx === 0 && !showUpcomingCompletion;

          return (
            <li key={entry.key} className={`relative pl-8 ${isLast ? "" : "pb-6"}`}>
              {!isLast && <span className="absolute left-[11px] top-5 bottom-0 w-px bg-slate-200" aria-hidden />}
              <span
                className={`absolute left-[5px] top-1 w-3 h-3 rounded-full ${style.dotClass} ${
                  isFirst ? "ring-4 ring-offset-0 ring-slate-100" : ""
                }`}
              />

              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className={`text-[14px] font-bold ${style.colorClass}`}>{entry.label}</span>
                {entry.isNote && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">บันทึกเพิ่มเติม</span>
                )}
                <span className="text-[12px] text-slate-400">
                  {formatThaiDateTime(entry.created_at)} · โดย {entry.actorName}
                </span>
              </div>

              {entry.remark ? (
                <ExpandableTimelineNote
                  remark={entry.remark}
                  noteLabel={noteLabel}
                  colorClass={style.colorClass}
                  bgClass={style.bgClass}
                  borderClass={style.borderClass}
                />
              ) : (
                <p className="mt-1 text-[12px] text-slate-400">ไม่มีโน้ต</p>
              )}

              {entry.image_url && (
                <button
                  type="button"
                  onClick={() => onImageClick?.(entry.image_url as string)}
                  className="mt-2 block rounded-xl overflow-hidden border border-slate-200 bg-slate-50 cursor-pointer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={entry.image_url} alt="ภาพประกอบการทำงาน" className="max-h-[220px] w-auto object-contain" />
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </DetailCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Reporter info card                                                         */
/* -------------------------------------------------------------------------- */

export function ReporterInfoCard({ report }: { report: Report }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "ชื่อผู้แจ้ง", value: <span className="font-bold">{report.reporter_name || "-"}</span> },
    {
      label: "ประเภทผู้แจ้ง",
      value: report.reporter_type ? (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-bold bg-orange-50 text-[#C2410C] border border-orange-200">
          {REPORTER_TYPE_LABELS[report.reporter_type] || report.reporter_type}
        </span>
      ) : (
        <span className="text-slate-400">ไม่ระบุ</span>
      ),
    },
    { label: "อีเมล", value: <span className="break-all">{report.email || "-"}</span> },
    { label: "เบอร์โทรศัพท์", value: report.phone || report.reporter_phone || "-" },
  ];
  return (
    <DetailCard title="ข้อมูลผู้แจ้ง">
      <dl className="space-y-3.5 min-w-0">
        {rows.map((r) => (
          <div key={r.label} className="min-w-0">
            <dt className="text-[11px] text-slate-400 font-medium mb-0.5">{r.label}</dt>
            <dd className="text-[14px] text-slate-800 min-w-0 break-words">{r.value}</dd>
          </div>
        ))}
      </dl>
    </DetailCard>
  );
}

