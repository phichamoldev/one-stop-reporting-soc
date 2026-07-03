"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
    <main className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center py-0 md:py-8 transition-colors duration-300">
      <div className="w-full max-w-md min-h-screen md:min-h-[820px] md:max-h-[880px] md:rounded-[36px] bg-white dark:bg-gray-900 md:shadow-2xl border-0 md:border-6 md:border-slate-800 dark:md:border-slate-800 overflow-y-auto flex flex-col justify-between relative p-6 animate-scale-up">

        <div className="space-y-8">

          {/* Back */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-3.5 h-3.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
              />
            </svg>
            ย้อนกลับหน้าแรก
          </Link>

          {/* Header */}
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto text-primary">
              <svg
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-8 h-8"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeDasharray="3 3"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="1"
                />
                <path
                  d="M50 20C33.4315 20 20 33.4315 20 50C20 66.5685 33.4315 80 50 80C66.5685 80 80 66.5685 80 50C80 33.4315 66.5685 20 50 20Z"
                  stroke="currentColor"
                  strokeWidth="2.5"
                />
                <path
                  d="M20 50H80"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M30 35H70"
                  stroke="currentColor"
                  strokeWidth="1"
                />
                <path
                  d="M30 65H70"
                  stroke="currentColor"
                  strokeWidth="1"
                />
                <path
                  d="M50 20C55 30 58 40 58 50C58 60 55 70 50 80C45 70 42 60 42 50C42 40 45 30 50 20Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="10"
                  fill="currentColor"
                  fillOpacity="0.1"
                />
              </svg>
            </div>

            <div className="space-y-1">
              <h1 className="text-base font-extrabold text-gray-900 dark:text-white">
                ค้นหาและติดตามสถานะ
              </h1>

              <p className="text-xs text-gray-400">
                กรอกเลขที่แจ้งปัญหาเพื่อตรวจสอบสถานะการดำเนินงาน
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="space-y-1.5">
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
                className="w-full px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-950 text-gray-950 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-center"
              />

              {error && (
                <p className="text-[10px] text-primary font-bold flex items-center justify-center gap-1.5 mt-1.5">
                  <span className="w-1 h-1 rounded-full bg-primary animate-ping"></span>
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold transition-all text-xs shadow-md shadow-primary/10 hover:shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className="w-3.5 h-3.5"
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
        <div className="text-center pt-8 border-t border-gray-50 dark:border-gray-800/50">
          <p className="text-[10px] text-gray-400">
            หากไม่ทราบเลขที่แจ้งปัญหา
            <br />
            กรุณาติดต่อสำนักงานคณะสังคมศาสตร์เพื่อขอความช่วยเหลือ
          </p>
        </div>

      </div>
    </main>
  );
}
