"use client";

import React, { useEffect } from "react";

import { useStaffAuth } from "@/hooks/useStaffAuth";
import { SettingsLayout } from "@/components/backoffice/settings/SettingsLayout";

export default function BackofficeSettingsPage() {
  const { profile, loading } = useStaffAuth();

  if (loading || !profile || profile.role !== "super_admin") {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 animate-fade-in w-full pb-12">
      <SettingsLayout />
    </div>
  );
}
