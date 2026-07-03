"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/shared/Navbar";

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
    <main className="min-h-screen w-full bg-slate-100 dark:bg-slate-950 flex items-center justify-center py-0 md:py-8 transition-colors duration-300">
      <div className="w-full max-w-md min-h-screen md:min-h-[820px] md:max-h-[880px] md:rounded-[36px] bg-slate-50 dark:bg-gray-900 md:shadow-2xl border-0 md:border-6 md:border-slate-800 dark:md:border-slate-800 overflow-y-auto flex flex-col justify-between relative animate-scale-up">

        <Navbar />

        <div className="p-6 space-y-8 flex-1">
          {/* Header */}
          <div className="text-center space-y-4 pt-4">

            <div className="space-y-1">
              <h1 className="text-base font-extrabold text-gray-900 dark:text-white">
                ค้นหาและติดตามสถานะ
              </h1>

              <p className="text-xs text-gray-400 font-medium">
                กรอกเลขที่แจ้งปัญหาเพื่อตรวจสอบสถานะการดำเนินงาน
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="publicId"
                className="block text-xs font-bold text-gray-700 dark:text-gray-300"
              >
                กรอกเลขที่แจ้งปัญหา
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
                className="w-full px-3.5 py-3 rounded-xl border border-gray-250 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-950 dark:text-white text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-center tracking-wider"
              />

              {error && (
                <p className="text-[10px] text-primary font-bold flex items-center justify-center gap-1.5 mt-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold transition-all text-xs shadow-lg shadow-primary/10 hover:shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z"
                />
              </svg>

              ค้นหาสถานะการแจ้งปัญหา
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center p-6 border-t border-gray-150 dark:border-gray-800/50">
          <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">
            หากไม่ทราบเลขที่แจ้งปัญหา
            <br />
            กรุณาติดต่อสำนักงานคณะสังคมศาสตร์เพื่อขอความช่วยเหลือ
          </p>
        </div>

      </div>
    </main>
  );
}
