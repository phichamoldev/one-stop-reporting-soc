"use client";

import React, { useState, Suspense } from "react";
import { Calendar } from "lucide-react";
import dynamic from 'next/dynamic';
import { AppSelect } from "@/components/ui/AppSelect";

import { DashboardProvider } from "@/contexts/DashboardContext";

// Dynamic Imports for Independent Streaming
const DashboardKPIs = dynamic(
  () => import('@/components/backoffice/DashboardKPIs').then(mod => mod.DashboardKPIs)
);

const DashboardCharts = dynamic(
  () => import('@/components/backoffice/DashboardCharts').then(mod => mod.DashboardCharts),
  { ssr: false }
);

const DashboardRecentReports = dynamic(
  () => import('@/components/backoffice/DashboardRecentReports').then(mod => mod.DashboardRecentReports)
);

// Skeletons
const KPIsSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="h-32 bg-slate-50 dark:bg-slate-900 rounded-[20px] animate-pulse"></div>
    ))}
  </div>
);

const ChartsSkeleton = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
    <div className="h-[360px] bg-slate-50 dark:bg-slate-900 rounded-[20px] animate-pulse"></div>
    <div className="h-[360px] bg-slate-50 dark:bg-slate-900 rounded-[20px] animate-pulse"></div>
  </div>
);

const ReportsSkeleton = () => (
  <div className="h-[400px] bg-slate-50 dark:bg-slate-900 rounded-[20px] animate-pulse mt-8"></div>
);

export default function BackofficeDashboard() {
  const [dateRange, setDateRange] = useState("7days");

  return (
    <div className="flex-1 p-6 md:px-[50px] md:py-8 space-y-8 animate-fade-in w-full pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
            📊 สถิติและการบริหารจัดการ
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            ภาพรวมและแผงควบคุมหลักสำหรับเจ้าหน้าที่ดูแลระบบ คณะสังคมศาสตร์
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <div className="w-[150px]">
            <AppSelect
              value={dateRange}
              onChange={(val) => setDateRange(val as string)}
              options={[
                { label: "วันนี้", value: "today" },
                { label: "7 วันล่าสุด", value: "7days" },
                { label: "30 วันล่าสุด", value: "30days" },
                { label: "ทั้งหมด", value: "all" },
              ]}
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm text-slate-500 dark:text-slate-400">
            <Calendar className="w-4 h-4 text-primary shrink-0" />
            <span>อัปเดตล่าสุด: {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} น.</span>
          </div>
        </div>
      </div>

      <DashboardProvider dateRange={dateRange}>
        {/* Independent Suspense Boundaries */}
        <Suspense fallback={<KPIsSkeleton />}>
          <DashboardKPIs />
        </Suspense>

        <Suspense fallback={<ChartsSkeleton />}>
          <DashboardCharts />
        </Suspense>

        <Suspense fallback={<ReportsSkeleton />}>
          <DashboardRecentReports />
        </Suspense>
      </DashboardProvider>
    </div>
  );
}
