"use client";

import React from "react";
import { Inbox, Clock, Play, CheckCircle2, XCircle } from "lucide-react";
import { useDashboardContext } from "@/contexts/DashboardContext";

export const DashboardKPIs: React.FC = React.memo(() => {
  const { data, isLoading } = useDashboardContext();

  if (isLoading || !data) return (
    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-32 bg-slate-50 dark:bg-slate-900 rounded-[20px] animate-pulse"></div>
      ))}
    </div>
  );

  const { totalCount, newCount, inProgressCount, completedCount, failedCount, todayNewCount } = React.useMemo(() => {
    const kpis = data.kpis || {};
    return {
      totalCount: kpis.total || 0,
      newCount: kpis.pending || 0,
      inProgressCount: kpis.inProgress || 0,
      completedCount: kpis.completed || 0,
      failedCount: kpis.cancelled || 0,
      todayNewCount: kpis.todayNew || 0
    };
  }, [data.kpis]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {/* Card 0: Today New */}
      <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 card-shadow transition-all hover:translate-y-[-2px] border-l-4 border-l-purple-500">
        <div className="flex justify-between items-start">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">คำร้องใหม่วันนี้</p>
          <div className="p-1.5 bg-purple-50 dark:bg-purple-950/40 rounded-lg text-purple-600 dark:text-purple-400">
            <Inbox className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{todayNewCount}</h3>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 mt-3.5 rounded-full overflow-hidden">
            <div 
              className="bg-purple-500 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${totalCount > 0 ? Math.min(100, Math.round((todayNewCount / totalCount) * 100)) : 0}%` }}
            />
          </div>
          <p className="text-[9px] text-slate-400 font-bold mt-1 text-right">
            {totalCount > 0 ? Math.round((todayNewCount / totalCount) * 100) : 0}% ของทั้งหมด
          </p>
        </div>
      </div>

      {/* Card 1: New */}
      <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 card-shadow transition-all hover:translate-y-[-2px] border-l-4 border-l-blue-500">
        <div className="flex justify-between items-start">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">รับเรื่องแล้ว</p>
          <div className="p-1.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{newCount}</h3>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 mt-3.5 rounded-full overflow-hidden">
            <div 
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${totalCount > 0 ? Math.min(100, Math.round((newCount / totalCount) * 100)) : 0}%` }}
            />
          </div>
          <p className="text-[9px] text-slate-400 font-bold mt-1 text-right">
            {totalCount > 0 ? Math.round((newCount / totalCount) * 100) : 0}% ของทั้งหมด
          </p>
        </div>
      </div>

      {/* Card 2: In Progress */}
      <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 card-shadow transition-all hover:translate-y-[-2px] border-l-4 border-l-orange-500">
        <div className="flex justify-between items-start">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">กำลังดำเนินการ</p>
          <div className="p-1.5 bg-orange-50 dark:bg-orange-950/40 rounded-lg text-orange-600 dark:text-orange-400">
            <Play className="w-4 h-4 rotate-90" />
          </div>
        </div>
        <div className="mt-3">
          <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{inProgressCount}</h3>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 mt-3.5 rounded-full overflow-hidden">
            <div 
              className="bg-orange-500 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${totalCount > 0 ? Math.min(100, Math.round((inProgressCount / totalCount) * 100)) : 0}%` }}
            />
          </div>
          <p className="text-[9px] text-slate-400 font-bold mt-1 text-right">
            {totalCount > 0 ? Math.round((inProgressCount / totalCount) * 100) : 0}% ของทั้งหมด
          </p>
        </div>
      </div>

      {/* Card 3: Completed */}
      <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 card-shadow transition-all hover:translate-y-[-2px] border-l-4 border-l-green-500">
        <div className="flex justify-between items-start">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">ดำเนินการเสร็จสิ้น</p>
          <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{completedCount}</h3>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 mt-3.5 rounded-full overflow-hidden">
            <div 
              className="bg-green-500 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${totalCount > 0 ? Math.min(100, Math.round((completedCount / totalCount) * 100)) : 0}%` }}
            />
          </div>
          <p className="text-[9px] text-slate-400 font-bold mt-1 text-right">
            {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}% ของทั้งหมด
          </p>
        </div>
      </div>

      {/* Card 4: Unresolvable */}
      <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 card-shadow transition-all hover:translate-y-[-2px] border-l-4 border-l-red-500">
        <div className="flex justify-between items-start">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">ไม่สามารถดำเนินการ</p>
          <div className="p-1.5 bg-rose-50 dark:bg-rose-950/40 rounded-lg text-rose-600 dark:text-rose-400">
            <XCircle className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{failedCount}</h3>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 mt-3.5 rounded-full overflow-hidden">
            <div 
              className="bg-red-500 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${totalCount > 0 ? Math.min(100, Math.round((failedCount / totalCount) * 100)) : 0}%` }}
            />
          </div>
          <p className="text-[9px] text-slate-400 font-bold mt-1 text-right">
            {totalCount > 0 ? Math.round((failedCount / totalCount) * 100) : 0}% ของทั้งหมด
          </p>
        </div>
      </div>
    </div>
  );
});

DashboardKPIs.displayName = "DashboardKPIs";
