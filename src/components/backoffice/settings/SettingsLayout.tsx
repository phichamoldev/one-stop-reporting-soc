"use client";

import React, { useState } from "react";
import UserManagementTab from "./UserManagementTab";
import { BaselineNotificationTestTab } from "./BaselineNotificationTestTab";

export function SettingsLayout() {
  const [activeTab, setActiveTab] = useState<"users" | "baseline-test">("users");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">การตั้งค่าระบบ (System Settings)</h1>
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
            activeTab === "users" 
              ? "bg-primary text-white shadow-md shadow-primary/20" 
              : "bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          ผู้ใช้งาน (Users)
        </button>

        <button
          onClick={() => setActiveTab("baseline-test")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "baseline-test" 
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/20" 
              : "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400"
          }`}
        >
          🧪 Baseline Test (AS-IS)
        </button>
      </div>

      <div>
        {activeTab === "users" && <UserManagementTab />}
        {activeTab === "baseline-test" && <BaselineNotificationTestTab />}
      </div>
    </div>
  );
}
