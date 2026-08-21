"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AppContainer } from "@/components/design-system/AppContainer";
import { AppNavbar } from "@/components/shared/AppNavbar";
import { AppCard } from "@/components/design-system/AppCard";
import { AppButton } from "@/components/design-system/AppButton";
import { StatusBadge } from "@/components/design-system/StatusBadge";
import { GlobalFooter } from "@/components/shared/GlobalFooter";
import { SearchMethod, ReportLookupSummary } from "@/types/report";
import { Search, SearchX, ArrowLeft, ArrowRight } from "lucide-react";

export default function TrackLookupPage() {
  const router = useRouter();

  const [searchMethod, setSearchMethod] = useState<SearchMethod>("soc");
  const [inputValue, setInputValue] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // States: 'form' | 'results' | 'empty'
  const [pageState, setPageState] = useState<"form" | "results" | "empty">("form");
  const [phoneResults, setPhoneResults] = useState<ReportLookupSummary[]>([]);
  const [maskedPhone, setMaskedPhone] = useState<string>("");

  const maskPhoneNumber = (phoneDigits: string): string => {
    if (phoneDigits.length === 10) {
      return `${phoneDigits.slice(0, 3)}-${phoneDigits.charAt(3)}XX-${phoneDigits.slice(6)}`;
    } else if (phoneDigits.length === 9) {
      return `${phoneDigits.slice(0, 2)}-${phoneDigits.charAt(2)}XX-${phoneDigits.slice(5)}`;
    }
    return `${phoneDigits.slice(0, 3)}XXXX${phoneDigits.slice(-2)}`;
  };

  const formatThaiDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `แจ้งเมื่อ ${d.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric"
    })}`;
  };

  const handleSwitchMethod = (method: SearchMethod) => {
    setSearchMethod(method);
    setInputValue("");
    setError(null);
    setPageState("form");
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (searchMethod === "soc") {
      const publicId = inputValue.trim().toUpperCase();

      if (!publicId) {
        setError("กรุณากรอกเลขที่แจ้งปัญหา");
        return;
      }

      router.push(`/track/${publicId}`);
    } else {
      const digitsOnly = inputValue.replace(/\D/g, "");

      if (!digitsOnly || digitsOnly.length < 9 || digitsOnly.length > 10 || !digitsOnly.startsWith("0")) {
        setError("กรุณากรอกเบอร์โทรศัพท์ที่ถูกต้อง (ตัวเลข 9-10 หลัก เช่น 0812345678)");
        return;
      }

      setIsSearching(true);
      try {
        const res = await fetch("/api/reports/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: digitsOnly })
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "เกิดข้อผิดพลาดในการค้นหา");
          setIsSearching(false);
          return;
        }

        if (data.found && Array.isArray(data.reports) && data.reports.length > 0) {
          setPhoneResults(data.reports);
          setMaskedPhone(data.maskedPhone || maskPhoneNumber(digitsOnly));
          setPageState("results");
        } else {
          setPhoneResults([]);
          setMaskedPhone(data.maskedPhone || maskPhoneNumber(digitsOnly));
          setPageState("empty");
        }
      } catch (err: any) {
        console.error("Phone lookup request error:", err);
        setError("ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง");
      } finally {
        setIsSearching(false);
      }
    }
  };

  const handleResetToSearch = () => {
    setPageState("form");
    setInputValue("");
    setError(null);
  };

  return (
    <AppContainer>
      <AppNavbar />

      <main className="flex-1 flex flex-col p-5 sm:p-6 space-y-6 overflow-y-auto bg-slate-50 dark:bg-slate-950">
        
        {/* === STATE 1: SEARCH FORM === */}
        {pageState === "form" && (
          <div className="space-y-6 animate-fade-in">
            {/* Header Section */}
            <div className="text-center space-y-2.5 pt-4 sm:pt-6 pb-1">
              <h1 className="text-[18px] sm:text-[20px] font-extrabold text-slate-900 dark:text-white">
                ค้นหาและติดตามสถานะ
              </h1>
              <p className="text-[12px] sm:text-[13px] text-slate-500 dark:text-slate-400 font-medium">
                กรอกเลขที่แจ้งปัญหาหรือเบอร์โทรเพื่อตรวจสอบสถานะการดำเนินงาน
              </p>
            </div>

            {/* Form Card */}
            <AppCard>
              {/* Segmented Control 2 buttons */}
              <div className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl grid grid-cols-2 gap-1 mb-5">
                <button
                  type="button"
                  onClick={() => handleSwitchMethod("soc")}
                  className={`py-2.5 px-3 rounded-xl text-[13px] sm:text-[14px] transition-all cursor-pointer ${
                    searchMethod === "soc"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400 font-medium"
                  }`}
                >
                  เลขที่แจ้งปัญหา
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchMethod("phone")}
                  className={`py-2.5 px-3 rounded-xl text-[13px] sm:text-[14px] transition-all cursor-pointer ${
                    searchMethod === "phone"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400 font-medium"
                  }`}
                >
                  เบอร์โทรศัพท์
                </button>
              </div>

              <form onSubmit={handleSearch} className="space-y-5">
                <div>
                  <label
                    htmlFor="searchInput"
                    className="block text-[12px] font-bold text-slate-700 dark:text-slate-300 mb-2"
                  >
                    {searchMethod === "soc" ? "กรอกเลขที่แจ้งปัญหา" : "กรอกเบอร์โทรศัพท์"}{" "}
                    <span className="text-primary">*</span>
                  </label>

                  <input
                    type={searchMethod === "phone" ? "tel" : "text"}
                    id="searchInput"
                    value={inputValue}
                    onChange={(e) => {
                      if (searchMethod === "soc") {
                        setInputValue(e.target.value.toUpperCase());
                      } else {
                        setInputValue(e.target.value);
                      }

                      if (e.target.value.trim()) {
                        setError(null);
                      }
                    }}
                    placeholder={searchMethod === "soc" ? "เช่น SOC-98469" : "เช่น 0812345678"}
                    className={`w-full text-[14px] font-normal placeholder-slate-400 bg-slate-100/50 dark:bg-slate-900/50 border px-4 py-3.5 rounded-[16px] text-center tracking-wider focus:ring-2 focus:ring-primary/20 ${
                      error
                        ? "border-rose-500 text-rose-500"
                        : "border-[#EDF0F4] dark:border-slate-700 text-slate-900 dark:text-white"
                    }`}
                  />

                  {error && (
                    <p className="text-xs text-rose-500 font-medium mt-2 text-center">
                      {error}
                    </p>
                  )}
                </div>

                <AppButton
                  type="submit"
                  variant="primary"
                  fullWidth
                  size="lg"
                  disabled={isSearching}
                  isLoading={isSearching}
                  className="shadow-primary cursor-pointer"
                >
                  {!isSearching && <Search className="w-5 h-5" />}
                  <span>ค้นหาสถานะการแจ้งปัญหา</span>
                </AppButton>
              </form>
            </AppCard>

            {/* Helper Footer */}
            <div className="text-center px-4 py-3 text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              {searchMethod === "soc" ? (
                <p>
                  หากไม่ทราบเลขที่แจ้งปัญหา
                  <br />
                  กรุณาติดต่อสำนักงานคณะสังคมศาสตร์เพื่อขอความช่วยเหลือ
                </p>
              ) : (
                <p>ระบบจะแสดงคำร้องทั้งหมดที่ลงทะเบียนด้วยเบอร์โทรศัพท์นี้</p>
              )}
            </div>
          </div>
        )}

        {/* === STATE 2: RESULTS FOUND === */}
        {pageState === "results" && (
          <div className="space-y-4 animate-fade-in">
            {/* Header with Title & Back Button */}
            <div className="flex items-center justify-between pb-1">
              <div>
                <h2 className="text-[16px] sm:text-[18px] font-extrabold text-slate-800 dark:text-white">
                  พบ {phoneResults.length} คำร้อง
                </h2>
                <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                  เบอร์โทรศัพท์ {maskedPhone} • เรียงจากรายการล่าสุด
                </p>
              </div>

              <button
                type="button"
                onClick={handleResetToSearch}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer shrink-0 py-1.5 px-2.5 rounded-lg hover:bg-primary/5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>ค้นหาใหม่</span>
              </button>
            </div>

            {/* List of Report Cards */}
            <div className="space-y-3">
              {phoneResults.map((report) => (
                <div
                  key={report.public_id}
                  onClick={() => router.push(`/track/${report.public_id}`)}
                  className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800 p-4 sm:p-5 hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer group flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-black text-slate-800 dark:text-slate-100 text-[15px] sm:text-[16px] tracking-tight group-hover:text-primary transition-colors">
                      {report.public_id}
                    </span>
                    <StatusBadge status={report.status} />
                  </div>

                  <p className="text-[13px] sm:text-[14px] font-bold text-slate-700 dark:text-slate-300 line-clamp-1 leading-snug">
                    {report.title || report.description}
                  </p>

                  <div className="flex items-center justify-between pt-1 text-[11px] sm:text-[12px] text-slate-400 dark:text-slate-500">
                    <span>{formatThaiDate(report.created_at)}</span>
                    <span className="font-bold text-primary flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform text-[12px]">
                      ดู <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === STATE 3: EMPTY STATE (NO RESULTS) === */}
        {pageState === "empty" && (
          <div className="space-y-6 animate-fade-in pt-4">
            <AppCard className="text-center py-10 px-6 sm:py-12 sm:px-8 space-y-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500">
                <SearchX className="w-7 h-7 sm:w-8 sm:h-8 stroke-[1.5]" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-[16px] sm:text-[18px] font-extrabold text-slate-800 dark:text-white">
                  ไม่พบคำร้อง
                </h2>
                <p className="text-[12px] sm:text-[13px] text-slate-500 dark:text-slate-400 font-medium max-w-xs mx-auto leading-relaxed">
                  ไม่พบคำร้องที่ลงทะเบียนด้วย
                  <br />
                  เบอร์โทรศัพท์ {maskedPhone}
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleResetToSearch}
                  className="w-full max-w-xs mx-auto py-3.5 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[13px] sm:text-[14px] transition-colors cursor-pointer"
                >
                  ค้นหาใหม่
                </button>
              </div>
            </AppCard>
          </div>
        )}

        <div className="mt-auto pt-6">
          <GlobalFooter />
        </div>
      </main>
    </AppContainer>
  );
}
