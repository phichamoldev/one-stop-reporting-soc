"use client";

import React from "react";
import { useDashboardContext } from "@/contexts/DashboardContext";
import { AppSelect } from "@/components/ui/AppSelect";

export const DashboardHeaderControls: React.FC<{
  selectedDepartment: string;
  setSelectedDepartment: (v: string) => void;
}> = ({ selectedDepartment, setSelectedDepartment }) => {
  const { data, isLoading } = useDashboardContext();
  
  if (isLoading || !data) {
    return <div className="w-[180px] h-10 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl"></div>;
  }

  const departments = data.filterOptions?.departments || [];

  if (departments.length <= 1) {
    return (
      <div className="flex items-center gap-2 text-xs font-semibold bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm text-slate-500 dark:text-slate-400 h-10">
        <span className="text-primary truncate max-w-[200px]">{departments[0] || "คณะสังคมศาสตร์"}</span>
      </div>
    );
  }

  return (
    <div className="w-[180px]">
      <AppSelect
        value={selectedDepartment}
        onChange={(val) => setSelectedDepartment(val as string)}
        options={[
          { label: "ดูหน่วยงานทั้งหมด", value: "all" },
          ...departments.map((d: string) => ({ label: d, value: d }))
        ]}
      />
    </div>
  );
};
