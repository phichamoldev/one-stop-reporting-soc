"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { AppNavbar } from "@/components/shared/AppNavbar";
import { AppContainer } from "@/components/design-system/AppContainer";
import { AppCard } from "@/components/design-system/AppCard";
import { StatusBadge } from "@/components/design-system/StatusBadge";
import { AppButton } from "@/components/design-system/AppButton";
import { TimelineStepper } from "@/components/design-system/TimelineStepper";
import { supabase } from "@/lib/supabase";
import { Report, STATUS_DETAILS } from "@/types/report";
import { GlobalFooter } from "@/components/shared/GlobalFooter";

interface TrackPageProps {
  params: Promise<{
    publicId: string;
  }>;
}

export default function TrackPage({ params }: TrackPageProps) {
  const { publicId } = use(params);

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // สถานะการคัดลอกลิงก์
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    async function fetchReport() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: supabaseError } = await supabase
          .from("reports")
          .select(`
            *,
            categories (
              id,
              name_th
            ),
            subcategories (
              id,
              name_th
            )
          `)
          .eq("public_id", publicId)
          .maybeSingle(); // FIX: Use maybeSingle() instead of single() to avoid throwing on 0 rows

        console.log("PUBLIC ID:", publicId);
        console.log("DATA:", data);
        console.log("ERROR DETAILS:", JSON.stringify(supabaseError, null, 2));

        if (supabaseError) {
          console.error("เกิดข้อผิดพลาดจาก Supabase:", supabaseError);
          setError("ไม่พบข้อมูลรายงานที่สืบค้น กรุณาตรวจสอบรหัสติดตามอีกครั้ง");
          return;
        }

        if (!data) {
          setError("ไม่พบข้อมูลรายงานที่สืบค้น กรุณาตรวจสอบรหัสติดตามอีกครั้ง");
          setReport(null);
          return;
        }

        setReport(data);
      } catch (err) {
        console.error("เกิดข้อผิดพลาดในการดึงข้อมูล:", err);
        setError("การเชื่อมต่อฐานข้อมูลล้มเหลว กรุณาลองใหม่อีกครั้ง");
      } finally {
        setLoading(false);
      }
    }

    if (publicId) {
      fetchReport();
    }
  }, [publicId]);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <AppContainer className="flex items-center justify-center">
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
          <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
          <p className="text-xs text-slate-500 dark:text-slate-400 animate-pulse">กำลังสืบค้นข้อมูลสถานะคำร้อง...</p>
        </div>
      </AppContainer>
    );
  }

  if (error || !report) {
    return (
      <AppContainer>
        <AppNavbar />
        <div className="p-6 flex flex-col justify-between items-center text-center animate-scale-up h-[calc(100vh-72px)]">
          <div className="space-y-6 pt-24">
            <div className="w-16 h-16 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mx-auto border border-slate-100">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="text-[17px] font-bold text-slate-800">ไม่พบรายงานปัญหาที่ค้นหา</h2>
              <p className="text-[13px] text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                {error || "รหัสติดตามที่ระบุใน URL ไม่ถูกต้องหรือข้อมูลอาจถูกลบไปแล้ว"}
              </p>
            </div>
          </div>
          <div className="w-full flex flex-col gap-3 mt-auto pt-6 pb-6">
            <Link href="/" className="block">
              <AppButton fullWidth variant="primary">
                กลับหน้าหลักเพื่อแจ้งเรื่องใหม่
              </AppButton>
            </Link>
            <Link href="/track/lookup" className="block">
              <AppButton fullWidth variant="secondary">
                ลองค้นหาด้วยรหัสติดตามใหม่อีกครั้ง
              </AppButton>
            </Link>
          </div>
          <GlobalFooter />
        </div>
      </AppContainer>
    );
  }

  const currentStatusInfo = STATUS_DETAILS[report.status] || STATUS_DETAILS.pending;
  // Use new relations if available, fallback to old category string
  const displayCategory = report.categories?.name_th;
  const displaySubcategory = report.subcategories?.name_th;


  return (
    <AppContainer>
      <AppNavbar />

      {/* คอนเทนต์หลักแบบ Scroll */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-[#F8FAFC]">
        
        {/* 1. Summary Card */}
        <div className="p-5 pb-2">
          <AppCard className="!p-6 border-[#EDF0F4] shadow-sm">
            {/* Top row */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[12px] text-slate-400 font-bold block mb-1">หมายเลขอ้างอิง</span>
                <span className="text-[28px] font-black text-[#0B2E59] tracking-wide block leading-none">
                  {report.public_id}
                </span>
              </div>
              <StatusBadge 
                status={report.status} 
                label={currentStatusInfo.label} 
              />
            </div>
            
            <div className="h-px bg-[#EDF0F4] my-4" />
            
            {/* Bottom row */}
            <div className="flex items-center gap-6 text-[12px] text-slate-500 font-medium">
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
                {new Date(report.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                </svg>
                {displayCategory}
              </span>
            </div>
          </AppCard>
        </div>

        <div className="px-5 pb-5 space-y-4">
          
          {/* 2. ไทม์ไลน์สถานะ (Timeline Card) */}
          <AppCard className="!p-5 border-[#EDF0F4] shadow-sm">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-1 h-4 rounded-full bg-[#D1350F] shrink-0"></div>
              <h3 className="text-[16px] font-bold text-slate-800 leading-none">ความคืบหน้า</h3>
            </div>
            <TimelineStepper report={report} />
          </AppCard>

          {/* 3. รายละเอียดการแจ้ง (Detail Card) */}
          <AppCard className="!p-5 border-[#EDF0F4] shadow-sm">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-1 h-4 rounded-full bg-[#D1350F] shrink-0"></div>
              <h3 className="text-[16px] font-bold text-slate-800 leading-none">รายละเอียดการแจ้ง</h3>
            </div>
            
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400 shrink-0 mt-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                </svg>
                <div>
                  <span className="text-[12px] text-slate-400 font-medium block mb-1">หมวดหมู่หลัก</span>
                  <span className="text-[12px] font-normal text-slate-700">{displayCategory}</span>
                </div>
              </div>

              {displaySubcategory && (
                <div className="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400 shrink-0 mt-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                  </svg>
                  <div>
                    <span className="text-[12px] text-slate-400 font-medium block mb-1">หมวดหมู่ย่อย</span>
                    <span className="text-[12px] font-normal text-slate-700">{displaySubcategory}</span>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400 shrink-0 mt-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
                <div>
                  <span className="text-[12px] text-slate-400 font-medium block mb-1">สถานที่</span>
                  <span className="text-[12px] font-normal text-slate-700">{report.location}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400 shrink-0 mt-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                <div>
                  <span className="text-[12px] text-slate-400 font-medium block mb-1">รายละเอียด</span>
                  <p className="text-[12px] font-normal text-slate-700 leading-relaxed pr-2">
                    {report.description}
                  </p>
                </div>
              </div>

              <div className="border-t border-[#EDF0F4] my-2" />
              
              {report.reporter_name && (
                <div className="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400 shrink-0 mt-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                  <div>
                    <span className="text-[12px] text-slate-400 font-medium block mb-1">ชื่อผู้แจ้ง</span>
                    <span className="text-[12px] font-normal text-slate-700">{report.reporter_name}</span>
                  </div>
                </div>
              )}

              {report.email && (
                <div className="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400 shrink-0 mt-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                  <div>
                    <span className="text-[12px] text-slate-400 font-medium block mb-1">อีเมล</span>
                    <span className="text-[12px] font-normal text-slate-700">{report.email}</span>
                  </div>
                </div>
              )}

              {report.phone && (
                <div className="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400 shrink-0 mt-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.896-1.596-5.54-4.24-7.136-7.136l1.292-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                  </svg>
                  <div>
                    <span className="text-[12px] text-slate-400 font-medium block mb-1">เบอร์โทรศัพท์</span>
                    <span className="text-[12px] font-normal text-slate-700">{report.phone}</span>
                  </div>
                </div>
              )}
            </div>
          </AppCard>

          {/* 4. แสดงรูปถ่าย (Attachment Card) */}
          {report.image_url && (
            <AppCard className="!p-5 border-[#EDF0F4] shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-1 h-4 rounded-full bg-[#D1350F] shrink-0"></div>
                <h3 className="text-[16px] font-bold text-slate-800 leading-none">รูปภาพประกอบ</h3>
              </div>
              <div className="relative rounded-[16px] overflow-hidden bg-slate-50 dark:bg-slate-950 ring-1 ring-[#EDF0F4] dark:ring-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={report.image_url}
                  alt={`รูปปัญหา ${report.public_id}`}
                  className="w-full h-auto object-cover max-h-[300px]"
                />
              </div>
            </AppCard>
          )}

          {/* 5. ความเห็นจากแอดมินเจ้าหน้าที่ (Staff Comment Card) */}
          {report.admin_remark && (
            <div className="bg-[#FFF8E6] border border-[#FDE3A7] rounded-3xl p-5 shadow-sm">
              <div className="flex items-start gap-2.5 mb-2">
                <div className="w-1 h-4 rounded-full bg-[#D1350F] shrink-0 mt-0.5"></div>
                <h3 className="text-[16px] font-bold text-slate-800 leading-none">หมายเหตุจากเจ้าหน้าที่</h3>
              </div>
              <p className="text-[12px] font-normal text-[#A67C00] leading-relaxed pr-1 ml-[14px]">
                {report.admin_remark}
              </p>
            </div>
          )}
          
          {/* 6. BOTTOM ACTIONS */}
          <div className="flex flex-col gap-3 pt-6 pb-6">
            {/* Primary Action: แจ้งปัญหาใหม่ */}
            <Link href="/" className="block">
              <button 
                type="button" 
                className="w-full h-[52px] rounded-[18px] bg-[#D1350F] text-white font-bold text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-[#D1350F]/20 active:scale-[0.98] transition-transform"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                แจ้งปัญหาใหม่
              </button>
            </Link>
            
            {/* Secondary Action: คัดลอกลิงก์ */}
            <button 
              type="button" 
              onClick={handleCopyLink}
              className="w-full h-[52px] rounded-[18px] bg-[#F3F4F6] border border-[#E5E7EB] text-slate-700 font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:bg-[#E5E7EB]"
            >
              {copied ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-[#10B981]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  <span className="text-[#10B981]">คัดลอกลิงก์สำเร็จแล้ว</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                  </svg>
                  คัดลอกลิงก์
                </>
              )}
            </button>
          </div>
          
          <GlobalFooter />
        </div>
      </div>
      
    </AppContainer>
  );
}
