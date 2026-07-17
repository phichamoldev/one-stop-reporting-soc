"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { AnalyticsDashboardView } from "@/components/backoffice/analytics/AnalyticsDashboardView";
import { hasAccess } from "@/lib/auth-helpers";

export default function BackofficeAnalyticsPage() {
  const router = useRouter();
  const { profile, loading } = useStaffAuth();

  useEffect(() => {
    if (!loading) {
      if (!profile) {
        router.replace("/backoffice/login");
      } else if (!hasAccess(profile.role, "/backoffice/analytics")) {
        router.replace("/backoffice/reports");
      }
    }
  }, [profile, loading, router]);

  if (loading || !profile || !hasAccess(profile.role, "/backoffice/analytics")) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 md:px-[50px] md:py-8 space-y-8 animate-fade-in w-full pb-12">
      <AnalyticsDashboardView profile={profile} />
    </div>
  );
}
