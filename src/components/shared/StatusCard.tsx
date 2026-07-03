import React from 'react';
import { Report, STATUS_DETAILS, CATEGORY_DETAILS } from '@/types/report';

interface StatusCardProps {
  report: Report;
}

export function StatusCard({ report }: StatusCardProps) {
  const currentStatusInfo = STATUS_DETAILS[report.status] || STATUS_DETAILS.pending;
  const currentCategoryInfo = CATEGORY_DETAILS[report.category] || CATEGORY_DETAILS.Other;

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-950/40 p-4 space-y-3.5 shadow-sm">
      <div className="flex justify-between items-start gap-2">
        <div className="space-y-1">
          <span className="text-[10px] text-gray-400 font-bold block">หมายเลขอ้างอิง</span>
          <span className="text-sm font-extrabold text-gray-950 dark:text-white tracking-wide block">
            {report.public_id}
          </span>
          <h1 className="text-xs font-bold text-gray-550 dark:text-gray-300 leading-normal">
            📍 {report.location}
          </h1>
        </div>
        <span className={`px-3 py-1 rounded-full text-[10px] font-bold border shrink-0 ${currentStatusInfo.bgClass} ${currentStatusInfo.colorClass} ${currentStatusInfo.borderClass} flex items-center gap-1.5`}>
          <span className={`w-1.5 h-1.5 rounded-full ${currentStatusInfo.dotClass} ${report.status !== "resolved" && report.status !== "rejected" ? "animate-pulse" : ""}`}></span>
          {currentStatusInfo.label}
        </span>
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800 pt-2 flex flex-wrap gap-2 text-[10px] text-gray-500 font-bold">
        <span className="flex items-center gap-1">
          <span>📅 วันที่แจ้ง:</span>
          <span>{new Date(report.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </span>
        <span className="text-gray-300 dark:text-gray-700 font-normal">•</span>
        <span className="flex items-center gap-1">
          <span>📂 หมวดหมู่:</span>
          <span>{currentCategoryInfo.icon} {currentCategoryInfo.label}</span>
        </span>
      </div>
    </div>
  );
}
