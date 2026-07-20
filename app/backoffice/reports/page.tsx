"use client";

import React, { useEffect } from "react";

import { useStaffAuth } from "@/hooks/useStaffAuth";
import useSWR from "swr";
import { fetcherWithAuth } from "@/lib/fetcher";
import { ReportsView } from "@/components/backoffice/ReportsView";

export default function BackofficeReportsPage() {
  const { user, loading: authLoading } = useStaffAuth();
  
  const params = new URLSearchParams({ dateRange: "all" });
  
  const { data, error, isLoading } = useSWR(
    user ? `/api/backoffice/dashboard?${params.toString()}` : null,
    fetcherWithAuth,
    { dedupingInterval: 60000 }
  );

  if (authLoading || isLoading) {
    return (
      <div className="flex-1 p-6 md:px-[50px] md:py-8 space-y-8 animate-pulse w-full">
        <div className="h-10 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="h-20 bg-white dark:bg-slate-900 rounded-[20px]" />
        <div className="h-[450px] bg-white dark:bg-slate-900 rounded-[20px]" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 md:px-[50px] md:py-8 space-y-8 animate-fade-in w-full pb-12">
      <ReportsView reports={data?.reports || []} filterOptions={data?.filterOptions || null} />
    </div>
  );
}
