"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/shared/Navbar";
import { supabase } from "@/lib/supabase";
import { Report, STATUS_DETAILS, CATEGORY_DETAILS, PRIORITY_DETAILS, TRACKING_STEPS } from "@/types/report";
import { formatDateTime } from "@/lib/utils";

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
          .select("*")
          .eq("public_id", publicId)
          .single();

        if (supabaseError) {
          console.error("เกิดข้อผิดพลาดจาก Supabase:", supabaseError);
          setError("ไม่พบข้อมูลรายงานที่สืบค้น กรุณาตรวจสอบรหัสติดตามอีกครั้ง");
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
      <main className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center py-0 md:py-8 transition-colors duration-300">
        <div className="w-full max-w-md min-h-screen md:min-h-[820px] md:max-h-[880px] md:rounded-[36px] bg-white dark:bg-gray-900 md:shadow-2xl border-0 md:border-6 md:border-slate-800 dark:md:border-slate-800 flex flex-col items-center justify-center p-8 space-y-4">
          <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
          <p className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">กำลังสืบค้นข้อมูลสถานะคำร้อง...</p>
        </div>
      </main>
    );
  }

  if (error || !report) {
    return (
      <main className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center py-0 md:py-8 transition-colors duration-300">
        <div className="w-full max-w-md min-h-screen md:min-h-[820px] md:max-h-[880px] md:rounded-[36px] bg-white dark:bg-gray-900 md:shadow-2xl border-0 md:border-6 md:border-slate-800 dark:md:border-slate-800 p-6 flex flex-col justify-between items-center text-center animate-scale-up">
          <div className="space-y-6 pt-12">
            <div className="w-14 h-14 rounded-full bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-100 dark:border-rose-900/50">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">ไม่พบรายงานปัญหาที่ค้นหา</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[280px] mx-auto leading-relaxed">
                {error || "รหัสติดตามที่ระบุใน URL ไม่ถูกต้องหรือข้อมูลอาจถูกลบไปแล้ว"}
              </p>
            </div>
          </div>
          <div className="w-full space-y-2.5">
            <Link
              href="/"
              className="w-full block py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold transition-all text-xs text-center cursor-pointer shadow-md shadow-primary/10"
            >
              กลับหน้าหลักเพื่อแจ้งเรื่องใหม่
            </Link>
            <Link
              href="/track/lookup"
              className="w-full block py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold transition-all text-xs text-center cursor-pointer"
            >
              ลองค้นหาด้วยรหัสติดตามใหม่อีกครั้ง
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const currentStatusInfo = STATUS_DETAILS[report.status] || STATUS_DETAILS.pending;
  const currentCategoryInfo = CATEGORY_DETAILS[report.category] || CATEGORY_DETAILS.Other;
  const currentPriorityInfo = PRIORITY_DETAILS[report.priority] || PRIORITY_DETAILS.low;

  const currentStepIndex = currentStatusInfo.stepIndex;
  const isRejected = report.status === "rejected";

  return (
    <main className="min-h-screen w-full bg-slate-100 dark:bg-slate-950 flex items-center justify-center py-0 md:py-8 transition-colors duration-300">
      <div className="w-full max-w-md min-h-screen md:min-h-[820px] md:max-h-[880px] md:rounded-[36px] bg-slate-50 dark:bg-gray-900 md:shadow-2xl border-0 md:border-6 md:border-slate-800 dark:md:border-slate-800 overflow-y-auto flex flex-col relative animate-scale-up">
        
        <Navbar />

        {/* คอนเทนต์หลักแบบ Scroll */}
        <div className="p-5 space-y-5 flex-1 flex flex-col">


          {/* การ์ดหัวเรื่องของรายงาน */}
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-950/40 p-4 space-y-3.5 shadow-sm">
            <div className="flex justify-between items-start gap-2">
              <div className="space-y-1">
                <span className="text-[10px] text-gray-400 font-bold block">หมายเลขอ้างอิง</span>
                <span className="text-sm font-extrabold text-gray-950 dark:text-white tracking-wide block">
                  {report.public_id}
                </span>
                <h1 className="text-xs font-bold text-gray-550 dark:text-gray-300 leading-normal">
                  📍 {report.location}
                </h1>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold border shrink-0 ${currentStatusInfo.bgClass} ${currentStatusInfo.colorClass} ${currentStatusInfo.borderClass} flex items-center gap-1.5`}>
                <span className={`w-1.5 h-1.5 rounded-full ${currentStatusInfo.dotClass} ${report.status !== "resolved" && report.status !== "rejected" ? "animate-pulse" : ""}`}></span>
                {currentStatusInfo.label}
              </span>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-800 pt-2 flex flex-wrap gap-2 text-[10px] text-gray-500 font-bold">
              <span className="flex items-center gap-1">
                <span>📅 วันที่แจ้ง:</span>
                <span>{new Date(report.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </span>
              <span className="text-gray-300 dark:text-gray-700 font-normal">•</span>
              <span className="flex items-center gap-1">
                <span>📂 หมวดหมู่:</span>
                <span>{currentCategoryInfo.icon} {currentCategoryInfo.label}</span>
              </span>
            </div>
          </div>

          {/* ไทม์ไลน์สถานะ */}
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4.5 space-y-4 shadow-sm">
            <h2 className="text-xs font-bold text-gray-900 dark:text-white pb-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-primary rounded-full"></span>
              ความคืบหน้า
            </h2>
            
            {isRejected ? (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 space-y-1.5 animate-scale-up">
                <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  คำร้องไม่ถูกรับเรื่อง
                </div>
                <p className="text-[10px] text-rose-600 dark:text-rose-400/90 leading-relaxed font-semibold">
                  เนื่องจากข้อมูลไม่สอดคล้องกับเป้าหมายการแจ้งซ่อมของคณะ หรือรายละเอียดหลักฐานไม่เพียงพอ
                </p>
              </div>
            ) : (
              <div className="relative py-2 space-y-5">
                {/* Vertical Line Background */}
                <div className="absolute left-[11px] top-4 bottom-6 w-[2px] bg-slate-150 dark:bg-slate-800 rounded-full"></div>

                {/* STEP 1 */}
                <div className="relative flex items-start gap-3.5">
                  <div className="relative z-10 w-6 h-6 shrink-0 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-500/20">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3.5 h-3.5 text-white">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div className="space-y-1 pt-0.5">
                    <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100">รับเรื่อง</h3>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium leading-relaxed">เรื่องเข้าระบบแล้ว อยู่ระหว่างการรอคัดกรอง</p>
                  </div>
                </div>

                {/* STEP 2 */}
                <div className="relative flex items-start gap-3.5">
                  {report.status === "resolved" ? (
                    <div className="relative z-10 w-6 h-6 shrink-0 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-500/20">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3.5 h-3.5 text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </div>
                  ) : report.status === "in_progress" ? (
                    <div className="relative z-10 w-6 h-6 shrink-0 rounded-full bg-orange-500 flex items-center justify-center shadow-sm shadow-orange-500/20">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 0 1-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 1 1-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 0 1 6.336-4.486l-3.276 3.276a3.004 3.004 0 0 0 2.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.846Z" />
                      </svg>
                    </div>
                  ) : (
                    <div className="relative z-10 w-6 h-6 shrink-0 rounded-full bg-slate-50 dark:bg-slate-900 border-[1.5px] border-slate-200 dark:border-slate-700 flex items-center justify-center">
                    </div>
                  )}
                  <div className="space-y-1 pt-0.5">
                    <h3 className={`text-xs font-bold ${report.status === "resolved" || report.status === "in_progress" ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"}`}>กำลังดำเนินการ</h3>
                    <p className={`text-[10px] font-medium leading-relaxed ${report.status === "resolved" || report.status === "in_progress" ? "text-gray-500 dark:text-gray-400" : "text-gray-400 dark:text-gray-600"}`}>ดำเนินการแจ้งไปยังหน่วยที่เกี่ยวข้องแล้ว</p>
                  </div>
                </div>

                {/* STEP 3 */}
                <div className="relative flex items-start gap-3.5">
                  {report.status === "resolved" ? (
                    <div className="relative z-10 w-6 h-6 shrink-0 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-500/20">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3.5 h-3.5 text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </div>
                  ) : (
                    <div className="relative z-10 w-6 h-6 shrink-0 rounded-full bg-slate-50 dark:bg-slate-900 border-[1.5px] border-slate-200 dark:border-slate-700 flex items-center justify-center">
                    </div>
                  )}
                  <div className="space-y-1 pt-0.5">
                    <h3 className={`text-xs font-bold ${report.status === "resolved" ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"}`}>เสร็จสิ้น</h3>
                    <p className={`text-[10px] font-medium leading-relaxed ${report.status === "resolved" ? "text-gray-500 dark:text-gray-400" : "text-gray-400 dark:text-gray-600"}`}>แก้ไขเรียบร้อยแล้ว ขอบคุณที่ช่วยกันพัฒนาคณะของเรา</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* รายละเอียดเนื้อหารายงานปัญหาสาธารณะ */}
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4.5 space-y-4 shadow-sm">
            <h2 className="text-xs font-bold text-gray-900 dark:text-white pb-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-primary rounded-full"></span>
              รายละเอียดการแจ้ง
            </h2>
            
            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <span className="text-gray-400 block text-[10px] font-bold">ประเภท</span>
                <span className="font-extrabold text-gray-800 dark:text-gray-200">
                  {currentCategoryInfo.icon} {currentCategoryInfo.label}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-gray-400 block text-[10px] font-bold">สถานที่</span>
                <span className="font-extrabold text-gray-800 dark:text-gray-200">
                  📍 {report.location}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-gray-400 block text-[10px] font-bold">รายละเอียด</span>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-semibold bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800/80">
                  {report.description}
                </p>
              </div>
            </div>

            {/* แสดงรูปถ่าย */}
            {report.image_url && (
              <div className="space-y-1.5">
                <span className="text-gray-400 block text-[10px] font-bold">ภาพถ่ายจุดเกิดเหตุ</span>
                <div className="relative rounded-2xl overflow-hidden border border-gray-150 dark:border-slate-800 bg-slate-50 dark:bg-gray-950 aspect-video shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={report.image_url}
                    alt={`รูปปัญหา ${report.public_id}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* ข้อมูลติดต่อผู้แจ้งแบบย่อ */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950/30 rounded-xl text-[10px] space-y-1.5 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800 font-semibold">
              <span className="font-extrabold text-slate-700 dark:text-slate-350 block uppercase tracking-wide">ข้อมูลผู้ยื่นคำร้อง</span>
              <div>ชื่อผู้แจ้ง: <span className="font-bold text-slate-800 dark:text-slate-200">{report.reporter_name}</span></div>
              <div>อีเมลติดต่อกลับ: <span className="font-bold text-slate-800 dark:text-slate-200">{report.email}</span></div>
            </div>
          </div>

          {/* ความเห็นจากแอดมินเจ้าหน้าที่ */}
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4.5 space-y-3 shadow-sm">
            <h2 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-primary rounded-full"></span>
              ความเห็นและความคืบหน้าจากเจ้าหน้าที่
            </h2>
            {report.admin_remark ? (
              <div className="p-3.5 rounded-xl bg-primary/5 dark:bg-primary/5 border border-primary/10 text-gray-800 dark:text-gray-250 text-xs leading-relaxed font-semibold">
                {report.admin_remark}
              </div>
            ) : (
              <div className="p-4 text-center text-[10px] text-gray-400 font-bold italic">
                ยังไม่มีการลงบันทึกความเห็นเพิ่มเติมจากเจ้าหน้าที่
              </div>
            )}
          </div>
        </div>

        {/* ปุ่มคัดลอกลิงก์และนำทางด้านล่าง */}
        <div className="space-y-3 pt-4 border-t border-gray-150 dark:border-gray-800 shrink-0">
          <button
            onClick={handleCopyLink}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
              copied
                ? "bg-emerald-600 text-white shadow-emerald-500/10"
                : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200"
            }`}
          >
            {copied ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                คัดลอกลิงก์ติดตามสำเร็จแล้ว
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z" />
                </svg>
                คัดลอกลิงก์สำหรับเปิดดูภายหลัง
              </>
            )}
          </button>

          <Link
            href="/"
            className="w-full block py-3.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold transition-all text-xs text-center shadow-lg shadow-primary/10 hover:shadow-primary/20 cursor-pointer"
          >
            กลับสู่หน้าหลักเพื่อแจ้งปัญหาใหม่
          </Link>
        </div>

      </div>
    </main>
  );
}
