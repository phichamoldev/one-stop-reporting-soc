"use client";

import React from "react";
import { useDashboardContext } from "@/contexts/DashboardContext";
import { AppSelect } from "@/components/ui/AppSelect";

export const DashboardHeaderControls: React.FC<{
  selectedDepartment: string;
  setSelectedDepartment: (v: string) => void;
  dateRange: string;
  setDateRange: (v: string) => void;
}> = ({ selectedDepartment, setSelectedDepartment, dateRange, setDateRange }) => {
  const { data, isLoading } = useDashboardContext();

  const DATE_RANGE_OPTIONS = [
    { label: "วันนี้", value: "today" },
    { label: "7 วันล่าสุด", value: "7days" },
    { label: "30 วันล่าสุด", value: "30days" },
    { label: "90 วันล่าสุด", value: "90days" },
  ];
  
  if (isLoading || !data) {
    return (
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="w-full sm:w-[180px] h-10 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl"></div>
        <div className="w-full sm:w-[150px] h-10 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl"></div>
      </div>
    );
  }

  const departments = data.filterOptions?.departments || [];

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      {/* Department Filter */}
      {departments.length <= 1 ? (
        <div className="flex items-center gap-2 text-xs font-semibold bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm text-slate-500 dark:text-slate-400 h-10">
          <span className="text-primary truncate max-w-[200px]">{departments[0] || "คณะสังคมศาสตร์"}</span>
        </div>
      ) : (
        <div className="w-full sm:w-[180px]">
          <AppSelect
            value={selectedDepartment}
            onChange={(val) => setSelectedDepartment(val as string)}
            options={[
              { label: "ดูหน่วยงานทั้งหมด", value: "all" },
              ...departments.map((d: string) => ({ label: d, value: d }))
            ]}
          />
        </div>
      )}

      {/* Date Range Filter */}
      <div className="w-full sm:w-[150px]">
        <AppSelect
          value={dateRange}
          onChange={(val) => setDateRange(val as string)}
          options={DATE_RANGE_OPTIONS}
        />
      </div>
    </div>
  );
};

