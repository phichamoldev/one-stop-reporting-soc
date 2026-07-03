"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
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
    <main className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center py-0 md:py-8 transition-colors duration-300">
      <div className="w-full max-w-md min-h-screen md:min-h-[820px] md:max-h-[880px] md:rounded-[36px] bg-white dark:bg-gray-900 md:shadow-2xl border-0 md:border-6 md:border-slate-800 dark:md:border-slate-800 overflow-y-auto flex flex-col justify-between relative p-5 animate-scale-up space-y-5">
        
        {/* คอนเทนต์หลักแบบ Scroll */}
        <div className="space-y-4 flex-1">
          {/* แถบย้อนกลับและหัวข้อ */}
          <div className="flex items-center justify-between border-b border-gray-50 dark:border-gray-800 pb-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary transition-colors font-bold"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              หน้าหลัก
            </Link>
            <span className="text-[10px] text-gray-400">
              แจ้งเมื่อ: {formatDateTime(report.created_at)}
            </span>
          </div>

          {/* การ์ดหัวเรื่องของรายงาน */}
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-slate-950/40 p-4 space-y-3.5">
            <div className="flex justify-between items-start gap-2">
              <div className="space-y-0.5">
                <span className="text-[9px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded">
                  {report.public_id}
                </span>
                <h1 className="text-sm font-extrabold text-gray-950 dark:text-white leading-normal pt-1">
                  {report.location}
                </h1>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border shrink-0 ${currentStatusInfo.bgClass} ${currentStatusInfo.colorClass} ${currentStatusInfo.borderClass} flex items-center gap-1.5`}>
                <span className={`w-1.5 h-1.5 rounded-full ${currentStatusInfo.dotClass} ${report.status !== "resolved" && report.status !== "rejected" ? "animate-pulse" : ""}`}></span>
                {currentStatusInfo.label}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 text-[10px]">
              <span className="font-semibold text-gray-500 dark:text-gray-400">
                หมวดหมู่: {currentCategoryInfo.icon} {currentCategoryInfo.label}
              </span>
              <span className="text-gray-300 dark:text-gray-700">•</span>
              <span className={`font-semibold ${currentPriorityInfo.textClass}`}>
                ความสำคัญ: {currentPriorityInfo.label}
              </span>
            </div>
          </div>

          {/* ไทม์ไลน์สถานะ */}
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-4 shadow-sm">
            <h2 className="text-xs font-bold text-gray-900 dark:text-white pb-1.5 border-b border-gray-50 dark:border-gray-800">
              สถานะการดำเนินงาน
            </h2>
            
            {isRejected ? (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 space-y-1.5">
                <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  คำร้องไม่ถูกรับเรื่อง
                </div>
                <p className="text-[10px] text-rose-600 dark:text-rose-400/90 leading-relaxed">
                  เนื่องจากข้อมูลไม่สอดคล้องกับเป้าหมายการแจ้งซ่อมของคณะ หรือรายละเอียดหลักฐานไม่เพียงพอ
                </p>
              </div>
            ) : (
              <div className="relative pl-5 space-y-5 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[1.5px] before:bg-gray-100 dark:before:bg-gray-800">
                {TRACKING_STEPS.map((step, idx) => {
                  const stepConfig = STATUS_DETAILS[step.status];
                  const isCompleted = idx <= currentStepIndex;
                  const isCurrent = idx === currentStepIndex;

                  return (
                    <div key={step.status} className="relative flex items-start gap-3">
                      <span 
                        className={`absolute -left-[18px] w-3 h-3 rounded-full border-2 transition-colors duration-300 z-10 ${
                          isCurrent
                            ? "bg-primary border-primary-light dark:border-primary-light/5 shadow"
                            : isCompleted
                              ? "bg-primary border-primary"
                              : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                        }`}
                      />
                      <div className="space-y-0.5">
                        <h3 className={`text-xs font-bold ${
                          isCurrent ? "text-primary" : isCompleted ? "text-gray-900 dark:text-white" : "text-gray-400"
                        }`}>
                          {step.label}
                        </h3>
                        <p className="text-[10px] text-gray-400 leading-tight">
                          {isCurrent 
                            ? `ขณะนี้อยู่ขั้นตอน: ${stepConfig.label}` 
                            : isCompleted 
                              ? "เสร็จสิ้น" 
                              : "รอดำเนินการ"
                          }
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* รายละเอียดเนื้อหารายงานปัญหาสาธารณะ */}
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3 shadow-sm">
            <h2 className="text-xs font-bold text-gray-900 dark:text-white pb-1.5 border-b border-gray-50 dark:border-gray-800">
              รายละเอียดเรื่องร้องทุกข์
            </h2>
            
            <div className="space-y-1 text-xs">
              <span className="text-gray-400 block text-[10px]">รายละเอียดความเสียหาย</span>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {report.description}
              </p>
            </div>

            {/* แสดงรูปถ่าย */}
            {report.image_url && (
              <div className="space-y-1">
                <span className="text-gray-400 block text-[10px]">ภาพถ่ายจุดเกิดเหตุ</span>
                <div className="relative rounded-xl overflow-hidden border border-gray-100 dark:border-slate-800 bg-slate-50 dark:bg-gray-950 aspect-video shadow-inner">
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
            <div className="p-3 bg-slate-50 dark:bg-slate-950/30 rounded-xl text-[10px] space-y-1 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-700 dark:text-slate-350 block">ข้อมูลผู้ยื่นคำร้อง</span>
              <div>ชื่อผู้แจ้ง: <span className="font-medium text-slate-800 dark:text-slate-200">{report.reporter_name}</span></div>
              <div>อีเมลติดต่อกลับ: <span className="font-medium text-slate-800 dark:text-slate-200">{report.email}</span></div>
            </div>
          </div>

          {/* ความเห็นจากแอดมินเจ้าหน้าที่ */}
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-2 shadow-sm">
            <h2 className="text-xs font-bold text-gray-900 dark:text-white">ความเห็นและความคืบหน้าจากเจ้าหน้าที่</h2>
            {report.admin_remark ? (
              <div className="p-3 rounded-xl bg-primary-light dark:bg-primary-light/5 border border-primary/10 text-gray-800 dark:text-gray-250 text-xs leading-relaxed whitespace-pre-wrap">
                {report.admin_remark}
              </div>
            ) : (
              <div className="p-4 text-center text-[10px] text-gray-400 italic">
                ยังไม่มีการลงบันทึกความเห็นเพิ่มเติมจากเจ้าหน้าที่
              </div>
            )}
          </div>
        </div>

        {/* ปุ่มคัดลอกลิงก์และนำทางด้านล่าง */}
        <div className="space-y-2 pt-4 border-t border-gray-50 dark:border-gray-800 shrink-0">
          <button
            onClick={handleCopyLink}
            className={`w-full py-3 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              copied
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/10"
                : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200"
            }`}
          >
            {copied ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                คัดลอกลิงก์ติดตามสำเร็จแล้ว
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z" />
                </svg>
                คัดลอกลิงก์สำหรับเปิดดูภายหลัง
              </>
            )}
          </button>

          <Link
            href="/"
            className="w-full block py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold transition-all text-xs text-center shadow-md shadow-primary/10 cursor-pointer"
          >
            กลับสู่หน้าหลักเพื่อแจ้งปัญหาใหม่
          </Link>
        </div>

      </div>
    </main>
  );
}
