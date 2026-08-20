"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useDashboardContext } from "@/contexts/DashboardContext";

import { STATUS_DETAILS } from "@/types/report";

export const DashboardTodayReports: React.FC = React.memo(() => {
  const router = useRouter();
  const { data, isLoading } = useDashboardContext();

  const getStatusBadgeCompact = (status: string) => {
    const config = STATUS_DETAILS[status as keyof typeof STATUS_DETAILS];
    if (!config) return null;

    return (
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${config.colorClass}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass} ${status === 'pending' || status === 'in_progress' ? 'animate-pulse-ring' : ''}`} />
        {config.label}
      </span>
    );
  };

  const formatTimeOnly = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
  };

  const reports = useMemo(() => {
    if (!data?.reports) return [];
    
    // Get beginning of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const statusPriority: Record<string, number> = {
      pending: 1,
      in_progress: 2,
      rejected: 3,
      cancelled: 3,
      completed: 4
    };

    return data.reports
      .filter((r: any) => new Date(r.created_at) >= today)
      .sort((a: any, b: any) => {
        const pA = statusPriority[a.status] || 5;
        const pB = statusPriority[b.status] || 5;
        
        // 1. Sort by Priority
        if (pA !== pB) return pA - pB;
        
        // 2. Sort by date desc
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [data?.reports]);

  if (isLoading || !data) return (
    <div className="h-[420px] bg-slate-50 dark:bg-slate-900 rounded-[20px] animate-pulse"></div>
  );

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow flex flex-col h-[420px]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50 dark:border-slate-800/60 shrink-0">
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>🆕</span> เรื่องใหม่วันนี้
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">คำร้องทั้งหมดที่เข้ามาภายในวันนี้</p>
        </div>
      </div>
      
      {/* Compact List Container */}
      <div className="flex-1 overflow-y-auto">
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="text-4xl mb-3">📭</div>
            <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300">วันนี้ยังไม่มีคำร้องใหม่</h4>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-slate-50 dark:divide-slate-800/60">
            {reports.map((report: any) => (
              <div 
                key={report.id} 
                onClick={() => router.push(`/backoffice/reports/${report.public_id}`)}
                className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors flex flex-col gap-1.5 cursor-pointer"
              >
                {/* Row 1: ID & Time */}
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                    {report.public_id}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {formatTimeOnly(report.created_at)}
                  </span>
                </div>
                
                {/* Row 2: Title */}
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 line-clamp-1">
                  {report.title || report.description}
                </div>

                {/* Row 3: Category & Status */}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[11px] text-slate-500 truncate max-w-[60%]">
                    {report.categories?.departments?.name_th || report.categories?.name_th || "ไม่ระบุหน่วยงาน"}
                  </span>
                  <div>
                    {getStatusBadgeCompact(report.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-slate-50 dark:border-slate-800/60 shrink-0">
        <button 
          onClick={() => router.push('/backoffice/reports?date=today')}
          className="w-full py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors inline-flex items-center justify-center gap-1"
        >
          ดูทั้งหมด
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
});

DashboardTodayReports.displayName = "DashboardTodayReports";
