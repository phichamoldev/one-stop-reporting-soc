"use client";

import React from "react";
import { Inbox, Clock, Play, CheckCircle2, XCircle } from "lucide-react";
import { useDashboardContext } from "@/contexts/DashboardContext";
import { STATUS_DETAILS } from "@/types/report";

export const DashboardKPIs: React.FC = React.memo(() => {
  const { data, isLoading } = useDashboardContext();

  const { totalCount, newCount, inProgressCount, completedCount, failedCount, todayNewCount } = React.useMemo(() => {
    const kpis = data?.kpis || {};
    return {
      totalCount: kpis.total || 0,
      newCount: kpis.pending || 0,
      inProgressCount: kpis.inProgress || 0,
      completedCount: kpis.completed || 0,
      failedCount: (kpis.cancelled || 0) + (kpis.rejected || 0),
      todayNewCount: kpis.todayNew || 0
    };
  }, [data?.kpis]);

  if (isLoading || !data) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-5">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-32 bg-slate-50 dark:bg-slate-900 rounded-[20px] animate-pulse"></div>
      ))}
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-5">
      {/* Card 0: Today New */}
      <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 card-shadow transition-all hover:translate-y-[-2px] border-l-4 border-l-purple-500">
        <div className="flex justify-between items-start">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">เรื่องใหม่วันนี้</p>
          <div className="p-1.5 bg-purple-50 dark:bg-purple-950/40 rounded-lg text-purple-600 dark:text-purple-400">
            <Inbox className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{todayNewCount}</h3>
        </div>
      </div>

      {/* Card 1: New */}
      <div className={`bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 card-shadow transition-all hover:translate-y-[-2px] border-l-4 ${STATUS_DETAILS.pending.borderLeftClass}`}>
        <div className="flex justify-between items-start">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">{STATUS_DETAILS.pending.label}</p>
          <div className={`p-1.5 ${STATUS_DETAILS.pending.bgClass} rounded-lg ${STATUS_DETAILS.pending.colorClass}`}>
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{newCount}</h3>
        </div>
      </div>

      {/* Card 2: In Progress */}
      <div className={`bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 card-shadow transition-all hover:translate-y-[-2px] border-l-4 ${STATUS_DETAILS.in_progress.borderLeftClass}`}>
        <div className="flex justify-between items-start">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">{STATUS_DETAILS.in_progress.label}</p>
          <div className={`p-1.5 ${STATUS_DETAILS.in_progress.bgClass} rounded-lg ${STATUS_DETAILS.in_progress.colorClass}`}>
            <Play className="w-4 h-4 rotate-90" />
          </div>
        </div>
        <div className="mt-3">
          <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{inProgressCount}</h3>
        </div>
      </div>

      {/* Card 3: Completed */}
      <div className={`bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 card-shadow transition-all hover:translate-y-[-2px] border-l-4 ${STATUS_DETAILS.completed.borderLeftClass}`}>
        <div className="flex justify-between items-start">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">{STATUS_DETAILS.completed.label}</p>
          <div className={`p-1.5 ${STATUS_DETAILS.completed.bgClass} rounded-lg ${STATUS_DETAILS.completed.colorClass}`}>
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{completedCount}</h3>
        </div>
      </div>

      {/* Card 4: Unresolvable */}
      <div className={`bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 card-shadow transition-all hover:translate-y-[-2px] border-l-4 ${STATUS_DETAILS.rejected.borderLeftClass}`}>
        <div className="flex justify-between items-start">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">{STATUS_DETAILS.rejected.label}</p>
          <div className={`p-1.5 ${STATUS_DETAILS.rejected.bgClass} rounded-lg ${STATUS_DETAILS.rejected.colorClass}`}>
            <XCircle className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{failedCount}</h3>
        </div>
      </div>
    </div>
  );
});

DashboardKPIs.displayName = "DashboardKPIs";
