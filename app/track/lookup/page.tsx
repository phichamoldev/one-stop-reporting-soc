"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppContainer } from "@/components/design-system/AppContainer";
import { AppNavbar } from "@/components/shared/AppNavbar";
import { AppCard } from "@/components/design-system/AppCard";
import { AppButton } from "@/components/design-system/AppButton";
import { SectionHeader } from "@/components/design-system/SectionHeader";

export default function TrackLookupPage() {
  const router = useRouter();

  const [publicIdInput, setPublicIdInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);

    const publicId = publicIdInput.trim().toUpperCase();

    if (!publicId) {
      setError("กรุณากรอกเลขที่แจ้งปัญหา");
      return;
    }

    router.push(`/track/${publicId}`);
  };

  return (
    <AppContainer>
      <AppNavbar />

      <div className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto bg-slate-50 dark:bg-slate-950">
        
        {/* Header Section */}
        <div className="text-center space-y-3 pt-6 pb-2">
          <h1 className="text-[18px] font-extrabold text-slate-900 dark:text-white">
            ค้นหาและติดตามสถานะ
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            กรอกเลขที่แจ้งปัญหาเพื่อตรวจสอบสถานะการดำเนินงาน
          </p>
        </div>

        {/* Form Card */}
        <AppCard>
          <form onSubmit={handleSearch} className="space-y-5">
            <div>
              <label
                htmlFor="publicId"
                className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                กรอกเลขที่แจ้งปัญหา <span className="text-primary">*</span>
              </label>

              <input
                type="text"
                id="publicId"
                value={publicIdInput}
                onChange={(e) => {
                  setPublicIdInput(e.target.value.toUpperCase());

                  if (e.target.value.trim()) {
                    setError(null);
                  }
                }}
                placeholder="เช่น SOC-98469"
                className={`w-full text-[12px] font-normal placeholder-slate-400 bg-slate-100/50 dark:bg-slate-900/50 border px-4 py-3.5 rounded-[16px] text-center tracking-wider focus:ring-2 focus:ring-primary/20 ${
                  error ? "border-rose-500 text-rose-500" : "border-[#EDF0F4] dark:border-slate-700 text-slate-900 dark:text-white"
                }`}
              />

              {error && (
                <p className="text-xs text-rose-500 font-medium mt-2 text-center">
                  {error}
                </p>
              )}
            </div>

            <AppButton type="submit" variant="primary" fullWidth size="lg" className="shadow-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z"
                />
              </svg>
              ค้นหาสถานะการแจ้งปัญหา
            </AppButton>
          </form>
        </AppCard>

        {/* Footer */}
        <div className="text-center p-6 text-xs text-slate-400 font-medium leading-relaxed mt-auto">
          <p>
            หากไม่ทราบเลขที่แจ้งปัญหา
            <br />
            กรุณาติดต่อสำนักงานคณะสังคมศาสตร์เพื่อขอความช่วยเหลือ
          </p>
        </div>
        
      </div>
    </AppContainer>
  );
}
