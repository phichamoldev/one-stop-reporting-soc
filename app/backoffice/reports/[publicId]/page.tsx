"use client";

import React, { use } from "react";
import { ReportDetailView } from "@/components/backoffice/ReportDetailView";
import { useStaffAuth } from "@/hooks/useStaffAuth";

export default function ReportDetailPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = use(params);
  const { profile } = useStaffAuth();
  return <ReportDetailView publicId={publicId} userRole={profile?.role} />;
}
