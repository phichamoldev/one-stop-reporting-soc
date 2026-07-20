"use client";

import React, { useEffect } from "react";

import { useStaffAuth } from "@/hooks/useStaffAuth";
import { hasAccess } from "@/lib/auth-helpers";
import dynamic from 'next/dynamic';

const AnalyticsDashboardView = dynamic(
  () => import('@/components/backoffice/analytics/AnalyticsDashboardView').then(mod => mod.AnalyticsDashboardView),
  { 
    ssr: false, 
    loading: () => (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D1350F]"></div>
      </div>
    )
  }
);

export default function BackofficeAnalyticsPage() {
  const { profile, loading } = useStaffAuth();

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
