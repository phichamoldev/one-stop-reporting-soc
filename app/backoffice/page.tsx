"use client";

import React, { useState, Suspense } from "react";
import { Calendar } from "lucide-react";
import dynamic from 'next/dynamic';
import { AppSelect } from "@/components/ui/AppSelect";
import { useStaffAuth } from "@/hooks/useStaffAuth";

import { DashboardProvider } from "@/contexts/DashboardContext";

// Dynamic Imports for Independent Streaming
const DashboardKPIs = dynamic(
  () => import('@/components/backoffice/DashboardKPIs').then(mod => mod.DashboardKPIs)
);

const DashboardTodayReports = dynamic(
  () => import('@/components/backoffice/DashboardTodayReports').then(mod => mod.DashboardTodayReports)
);

const DashboardLatestReports = dynamic(
  () => import('@/components/backoffice/DashboardLatestReports').then(mod => mod.DashboardLatestReports)
);

const DashboardActionableReports = dynamic(
  () => import('@/components/backoffice/DashboardActionableReports').then(mod => mod.DashboardActionableReports)
);

const DashboardHeaderControls = dynamic(
  () => import('@/components/backoffice/DashboardHeaderControls').then(mod => mod.DashboardHeaderControls)
);

// Skeletons
const KPIsSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="h-32 bg-slate-50 dark:bg-slate-900 rounded-[20px] animate-pulse"></div>
    ))}
  </div>
);

const ReportsSkeleton = () => (
  <div className="h-[400px] bg-slate-50 dark:bg-slate-900 rounded-[20px] animate-pulse"></div>
);

export default function BackofficeDashboard() {
  const { profile } = useStaffAuth();
  const [dateRange, setDateRange] = useState("7days");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 animate-fade-in w-full pb-12">
      <DashboardProvider dateRange={dateRange} department={selectedDepartment}>
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
              👋 สวัสดี, {profile?.full_name || 'ไม่ระบุชื่อ'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
              ภาพรวมงานที่ต้องดำเนินการของคุณ
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <Suspense fallback={<div className="w-[180px] h-10 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl"></div>}>
              <DashboardHeaderControls 
                selectedDepartment={selectedDepartment} 
                setSelectedDepartment={setSelectedDepartment} 
              />
            </Suspense>
            <div className="flex items-center gap-2 text-xs font-semibold bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm text-slate-500 dark:text-slate-400 h-10">
              <Calendar className="w-4 h-4 text-primary shrink-0" />
              <span>อัปเดตล่าสุด: {mounted ? new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'กำลังโหลด...'} น.</span>
            </div>
          </div>
        </div>

        {/* Independent Suspense Boundaries */}
        <Suspense fallback={<KPIsSkeleton />}>
          <DashboardKPIs />
        </Suspense>

        {/* 50:50 Grid for Today and Actionable */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
          <Suspense fallback={<ReportsSkeleton />}>
            <DashboardTodayReports />
          </Suspense>

          <Suspense fallback={<ReportsSkeleton />}>
            <DashboardActionableReports />
          </Suspense>
        </div>

        {/* 10 Latest Reports Table */}
        <div className="mt-8">
          <Suspense fallback={<ReportsSkeleton />}>
            <DashboardLatestReports />
          </Suspense>
        </div>
      </DashboardProvider>
    </div>
  );
}
