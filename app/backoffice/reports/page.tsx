"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { supabase } from "@/lib/supabase";
import { ReportsView } from "@/components/backoffice/ReportsView";

export default function BackofficeReportsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useStaffAuth();
  
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams({
        dateRange: "all"
      });

      const res = await fetch(`/api/backoffice/dashboard?${params.toString()}`, {
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      });
      
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.replace("/backoffice/login");
        }
        throw new Error("Failed to fetch data");
      }

      const result = await res.json();
      setReports(result.reports || []);
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  }, [user, router]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/backoffice/login");
    } else if (user) {
      fetchReports();
    }
  }, [user, authLoading, fetchReports, router]);

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="space-y-8 animate-pulse w-full max-w-6xl p-8">
          <div className="h-10 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-20 bg-white dark:bg-slate-900 rounded-[20px]" />
          <div className="h-[450px] bg-white dark:bg-slate-900 rounded-[20px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 animate-fade-in w-full mx-auto max-w-7xl pb-12">
      <ReportsView reports={reports} />
    </div>
  );
}
