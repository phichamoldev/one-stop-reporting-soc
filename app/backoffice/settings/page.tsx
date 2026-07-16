"use client";

import React from "react";
import { SettingsView } from "@/components/backoffice/SettingsView";

export default function BackofficeSettingsPage() {
  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 animate-fade-in w-full mx-auto max-w-7xl pb-12">
      <SettingsView />
    </div>
  );
}
