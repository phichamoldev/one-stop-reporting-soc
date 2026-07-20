"use client";

import React, { useEffect } from "react";

import { useStaffAuth } from "@/hooks/useStaffAuth";
import StaffDashboardView from "@/components/backoffice/staff/StaffDashboardView";
import { hasAccess } from "@/lib/auth-helpers";

export default function BackofficeStaffPage() {
  const { profile, loading } = useStaffAuth();

  if (loading || !profile || !hasAccess(profile.role, "/backoffice/staff")) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full animate-fade-in">
      <StaffDashboardView />
    </div>
  );
}
