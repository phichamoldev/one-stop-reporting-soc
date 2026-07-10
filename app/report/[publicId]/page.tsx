"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { AppNavbar } from "@/components/shared/AppNavbar";
import { AppContainer } from "@/components/design-system/AppContainer";
import { AppCard } from "@/components/design-system/AppCard";
import { StatusBadge } from "@/components/design-system/StatusBadge";
import { AppButton } from "@/components/design-system/AppButton";
import { supabase } from "@/lib/supabase";
import { Report, STATUS_DETAILS } from "@/types/report";
import { GlobalFooter } from "@/components/shared/GlobalFooter";

interface ReportDetailPageProps {
  params: Promise<{
    publicId: string;
  }>;
}

export default function ReportDetailPage({ params }: ReportDetailPageProps) {
  const { publicId } = use(params);

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReport() {
      try {
        setLoading(true);
        setError(null);

        // Fetch report with relations
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
          .maybeSingle();

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

  if (loading) {
    return (
      <AppContainer className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
          <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
          <p className="text-xs text-slate-500 dark:text-slate-400 animate-pulse">กำลังโหลดข้อมูลคำร้อง...</p>
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
                {error || "รหัสอ้างอิงที่ระบุใน URL ไม่ถูกต้องหรือข้อมูลอาจถูกลบไปแล้ว"}
              </p>
            </div>
          </div>
          <div className="w-full flex flex-col gap-3 mt-auto pt-6 pb-6">
            <Link href="/" className="block">
              <AppButton fullWidth variant="primary">
                กลับหน้าหลัก
              </AppButton>
            </Link>
          </div>
          <GlobalFooter />
        </div>
      </AppContainer>
    );
  }

  const currentStatusInfo = STATUS_DETAILS[report.status] || STATUS_DETAILS.pending;
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', { 
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <AppContainer>
      <AppNavbar />

      <div className="flex-1 flex flex-col overflow-y-auto bg-[#F8FAFC]">
        <div className="p-5 pb-8 space-y-4">
          
          {/* Section 1: ข้อมูลคำร้อง */}
          <AppCard className="!p-5 border-[#EDF0F4] shadow-sm">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-1 h-4 rounded-full bg-primary shrink-0"></div>
              <h3 className="text-[16px] font-bold text-slate-800 leading-none">ข้อมูลคำร้อง</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-start border-b border-[#EDF0F4] pb-4">
                <div>
                  <span className="text-[12px] text-slate-400 font-medium block mb-1">เลขอ้างอิง</span>
                  <span className="text-[18px] font-bold text-slate-800">{report.public_id}</span>
                </div>
                <StatusBadge 
                  status={report.status} 
                  label={currentStatusInfo.label} 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[12px] text-slate-400 font-medium block mb-1">วันที่แจ้ง</span>
                  <span className="text-[13px] font-normal text-slate-700">{formatDate(report.created_at)}</span>
                </div>
                <div>
                  <span className="text-[12px] text-slate-400 font-medium block mb-1">วันที่อัปเดต</span>
                  <span className="text-[13px] font-normal text-slate-700">{formatDate(report.updated_at)}</span>
                </div>
              </div>
            </div>
          </AppCard>

          {/* Section 2: หมวดหมู่ */}
          <AppCard className="!p-5 border-[#EDF0F4] shadow-sm">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-1 h-4 rounded-full bg-primary shrink-0"></div>
              <h3 className="text-[16px] font-bold text-slate-800 leading-none">หมวดหมู่</h3>
            </div>
            
            <div className="space-y-4">
              {report.categories?.name_th && (
                <div>
                  <span className="text-[12px] text-slate-400 font-medium block mb-1">หมวดหมู่หลัก</span>
                  <span className="text-[14px] font-normal text-slate-700">{report.categories.name_th}</span>
                </div>
              )}
              {report.subcategories?.name_th && (
                <div>
                  <span className="text-[12px] text-slate-400 font-medium block mb-1">หมวดหมู่ย่อย</span>
                  <span className="text-[14px] font-normal text-slate-700">{report.subcategories.name_th}</span>
                </div>
              )}
              {!report.categories && !report.subcategories && (
                <span className="text-[13px] italic text-slate-400">ไม่ระบุหมวดหมู่</span>
              )}
            </div>
          </AppCard>

          {/* Section 3: รายละเอียด */}
          <AppCard className="!p-5 border-[#EDF0F4] shadow-sm">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-1 h-4 rounded-full bg-primary shrink-0"></div>
              <h3 className="text-[16px] font-bold text-slate-800 leading-none">รายละเอียด</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <span className="text-[12px] text-slate-400 font-medium block mb-1">สถานที่</span>
                <span className="text-[14px] font-normal text-slate-700">{report.location || "-"}</span>
              </div>
              
              <div>
                <span className="text-[12px] text-slate-400 font-medium block mb-2">รายละเอียดปัญหา</span>
                <p className="text-[14px] font-normal text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-[#EDF0F4]">
                  {report.description || "-"}
                </p>
              </div>

              {report.image_url && (
                <div>
                  <span className="text-[12px] text-slate-400 font-medium block mb-2">รูปภาพแนบ</span>
                  <div className="relative rounded-[16px] overflow-hidden bg-slate-50 ring-1 ring-[#EDF0F4]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={report.image_url}
                      alt={`รูปปัญหา ${report.public_id}`}
                      className="w-full h-auto object-cover max-h-[300px]"
                    />
                  </div>
                </div>
              )}
            </div>
          </AppCard>

          {/* Section 4: ข้อมูลผู้แจ้ง */}
          <AppCard className="!p-5 border-[#EDF0F4] shadow-sm">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-1 h-4 rounded-full bg-primary shrink-0"></div>
              <h3 className="text-[16px] font-bold text-slate-800 leading-none">ข้อมูลผู้แจ้ง</h3>
            </div>
            
            <div className="space-y-4">
              {report.reporter_name && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 font-medium block">ชื่อผู้แจ้ง</span>
                    <span className="text-[14px] font-normal text-slate-700">{report.reporter_name}</span>
                  </div>
                </div>
              )}

              {report.email && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 font-medium block">อีเมล</span>
                    <span className="text-[14px] font-normal text-slate-700">{report.email}</span>
                  </div>
                </div>
              )}

              {report.phone && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-500 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.896-1.596-5.54-4.24-7.136-7.136l1.292-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 font-medium block">เบอร์โทรศัพท์</span>
                    <span className="text-[14px] font-normal text-slate-700">{report.phone}</span>
                  </div>
                </div>
              )}
            </div>
          </AppCard>

          {/* Section 5: เจ้าหน้าที่ */}
          {report.admin_remark && (
            <div className="bg-[#FFF8E6] border border-[#FDE3A7] rounded-3xl p-5 shadow-sm">
              <div className="flex items-start gap-2.5 mb-2">
                <div className="w-1 h-4 rounded-full bg-[#D1350F] shrink-0 mt-0.5"></div>
                <h3 className="text-[16px] font-bold text-slate-800 leading-none">หมายเหตุจากเจ้าหน้าที่</h3>
              </div>
              <p className="text-[13px] font-normal text-[#A67C00] leading-relaxed pr-1 ml-[14px] mt-2 bg-white/50 p-3 rounded-xl border border-[#FDE3A7]/50">
                {report.admin_remark}
              </p>
            </div>
          )}

          <div className="pt-4">
            <GlobalFooter />
          </div>
        </div>
      </div>
    </AppContainer>
  );
}
