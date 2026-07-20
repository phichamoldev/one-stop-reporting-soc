"use client";

import React from 'react';
import { Clock, Play, Check, AlertTriangle, ArrowRightLeft, X, History } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  pending: "รับเรื่องแล้ว",
  in_progress: "กำลังดำเนินการ",
  completed: "เสร็จสิ้น",
  cancelled: "ไม่สามารถดำเนินการได้"
};

const getTimelineIcon = (status: string) => {
  switch (status) {
    case 'pending':
      return (
        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center border-4 border-white dark:border-slate-900 z-10 shrink-0">
          <Clock className="w-5 h-5" />
        </div>
      );
    case 'in_progress':
      return (
        <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 flex items-center justify-center border-4 border-white dark:border-slate-900 z-10 shrink-0">
          <Play className="w-5 h-5 rotate-90" />
        </div>
      );
    case 'completed':
      return (
        <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center justify-center border-4 border-white dark:border-slate-900 z-10 shrink-0">
          <Check className="w-5 h-5" />
        </div>
      );
    case 'cancelled':
      return (
        <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 flex items-center justify-center border-4 border-white dark:border-slate-900 z-10 shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
      );
    case 'transfer':
      return (
        <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 flex items-center justify-center border-4 border-white dark:border-slate-900 z-10 shrink-0">
          <ArrowRightLeft className="w-5 h-5" />
        </div>
      );
    default:
      return (
        <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 flex items-center justify-center border-4 border-white dark:border-slate-900 z-10 shrink-0">
          <X className="w-5 h-5" />
        </div>
      );
  }
};

interface ReportTimelineProps {
  logs: any[];
}

export const ReportTimeline: React.FC<ReportTimelineProps> = ({ logs }) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow">
      <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-50 dark:border-slate-800/40 pb-4 mb-5 flex items-center gap-2">
        <History className="w-5 h-5 text-primary" />
        บันทึกประวัติการดำเนินงาน (Logs)
      </h4>

      {logs.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">ไม่มีประวัติการบันทึกงาน</p>
      ) : (
        <div className="relative pl-2.5 space-y-6 before:absolute before:left-6 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 dark:before:bg-slate-800">
          {logs.map((log: any) => (
            <div key={log.id} className="relative flex gap-4 items-start">
              {getTimelineIcon(log.action === 'transfer' ? 'transfer' : log.new_status)}
              <div className="flex-1 bg-slate-50/50 dark:bg-slate-800/20 p-3.5 rounded-2xl border border-slate-100/50 dark:border-slate-800/20 text-xs">
                <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                  <span className="font-extrabold text-slate-800 dark:text-slate-200">
                    {log.action === 'transfer' ? 'โอนคำร้อง' : `เปลี่ยนสถานะเป็น ${STATUS_LABELS[log.new_status] || log.new_status}`}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  </span>
                </div>
                
                <p className="text-[10px] text-slate-400 font-bold mb-2">
                  ผู้ดำเนินการ: {log.staff_profiles?.full_name || "ระบบ"}
                </p>

                {log.remark && (
                  <div className="bg-white dark:bg-slate-800/60 p-2.5 rounded-xl text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed border border-slate-50 dark:border-slate-700/40 whitespace-pre-line">
                    {log.remark}
                  </div>
                )}

                <div className="mt-2 text-[10px] font-semibold text-slate-400">
                  {new Date(log.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
