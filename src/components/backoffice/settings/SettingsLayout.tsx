"use client";

import React, { useState } from "react";
import UserManagementTab from "./UserManagementTab";

export function SettingsLayout() {
  const [activeTab, setActiveTab] = useState<"users">("users");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">การตั้งค่าระบบ (System Settings)</h1>
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
            activeTab === "users" 
              ? "bg-primary text-white shadow-md shadow-primary/20" 
              : "bg-slate-50 text-slate-600 hover:bg-slate-100"
          }`}
        >
          ผู้ใช้งาน (Users)
        </button>
      </div>

      <div>
        {activeTab === "users" && <UserManagementTab />}
      </div>
    </div>
  );
}
