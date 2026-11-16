"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { AppContainer } from "@/components/design-system/AppContainer";
import { AppNavbar } from "@/components/shared/AppNavbar";
import { PageShell, PAGE_SHELL_MAX_WIDTH } from "@/components/shared/PageShell";
import { AppCard } from "@/components/design-system/AppCard";
import { AppButton } from "@/components/design-system/AppButton";
import { StatusBadge } from "@/components/design-system/StatusBadge";
import { AppSelect } from "@/components/ui/AppSelect";
import { supabase } from "@/lib/supabase";
import { Report, DBCategory, DBSubcategory } from "@/types/report";
import { generatePublicId, generateTrackingToken, sortSubcategories } from "@/lib/utils";
import Image from "next/image";
import { GlobalFooter } from "@/components/shared/GlobalFooter";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { BookOpenText, Users, GraduationCap, Building2, Wrench, MonitorSmartphone, ShieldCheck, MessageSquareWarning, Monitor, MessageSquare, Briefcase } from 'lucide-react';

export function getCategoryIcon(categoryCode: string) {
  if (categoryCode.includes('วิชาการ')) return GraduationCap;
  if (categoryCode.includes('นิสิต')) return Users;
  if (categoryCode.includes('บริหารงานบุคคล') || categoryCode.includes('บริหารงานบุคคล')) return Briefcase;
  if (categoryCode.includes('กายภาพ') || categoryCode.includes('อาคาร')) return Building2;
  if (categoryCode.includes('ระบบดิจิทัล') || categoryCode.includes('IT') || categoryCode.includes('ระบบดิจิทัล')) return Monitor;
  if (categoryCode.includes('ห้องสมุด')) return BookOpenText;
  return MessageSquare; // general/fallback
}



export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // สถานะข้อมูลในฟอร์ม

  const [categoryId, setCategoryId] = useState<number | "">("");
  const [subcategoryId, setSubcategoryId] = useState<number | "">("");
  
  const { data: categoriesData } = useSWR("/api/categories", fetcher, { dedupingInterval: 3600000 });
  const categories: DBCategory[] = categoriesData?.categories || [];

  const { data: subcategoriesData } = useSWR(
    categoryId ? `/api/subcategories?categoryId=${categoryId}` : null,
    fetcher,
    { dedupingInterval: 3600000 }
  );
  const subcategories: DBSubcategory[] = sortSubcategories(subcategoriesData?.subcategories || []);

  const [location, setLocation] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [reporterName, setReporterName] = useState<string>("");
  const [reporterType, setReporterType] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // สถานะ UI
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitStep, setSubmitStep] = useState<string>("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState<boolean>(false);
  const [subcategoryDropdownOpen, setSubcategoryDropdownOpen] = useState<boolean>(false);

  // หลังส่งข้อมูลเสร็จสิ้น
  const [submittedReport, setSubmittedReport] = useState<Report | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // (Removed loadStats as it was unused and violates RLS)
  // (Removed loadStats as it was unused and violates RLS)

  // จัดการไฟล์ภาพ
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith("image/")) {
        setFormErrors(prev => ({ ...prev, image: "กรุณาอัปโหลดเฉพาะไฟล์รูปภาพเท่านั้น" }));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setFormErrors(prev => ({ ...prev, image: "ขนาดรูปภาพต้องไม่เกิน 5MB" }));
        return;
      }

      setFormErrors(prev => {
        const copy = { ...prev };
        delete copy.image;
        return copy;
      });

      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.type.startsWith("image/")) {
        setFormErrors(prev => ({ ...prev, image: "กรุณาอัปโหลดเฉพาะไฟล์รูปภาพเท่านั้น" }));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setFormErrors(prev => ({ ...prev, image: "ขนาดรูปภาพต้องไม่เกิน 5MB" }));
        return;
      }

      setFormErrors(prev => {
        const copy = { ...prev };
        delete copy.image;
        return copy;
      });

      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ตรวจทานฟอร์ม
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!categoryId) errors.categoryId = "กรุณาเลือกหมวดหมู่หลัก";
    if (!subcategoryId) errors.subcategoryId = "กรุณาเลือกหมวดหมู่ย่อย";
    if (!description.trim()) {
      errors.description = "กรุณากรอกรายละเอียดปัญหา";
    }
    
    if (!reporterType) errors.reporterType = "กรุณาเลือกประเภทผู้แจ้ง (อาจารย์, บุคลากร หรือนิสิต)";
    if (!reporterName.trim()) errors.reporterName = "กรุณาระบุชื่อ-นามสกุล";
    
    if (!email.trim()) {
      errors.email = "กรุณาระบุอีเมลติดต่อกลับ";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "รูปแบบอีเมลไม่ถูกต้อง";
    }
    
    if (!phone.trim()) {
      errors.phone = "กรุณาระบุเบอร์โทรศัพท์ติดต่อ";
    } else if (!/^[0-9]{9,10}$/.test(phone.replace(/[- ]/g, ""))) {
      errors.phone = "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ส่งแบบฟอร์ม
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    if (!validateForm()) {
      const firstErrorKey = Object.keys(formErrors)[0];
      const element = document.getElementsByName(firstErrorKey)[0] || document.getElementById(firstErrorKey);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    try {
      setIsSubmitting(true);

      let publicUrl: string | null = null;
      if (imageFile) {
        setSubmitStep("กำลังอัปโหลดรูปภาพหลักฐาน...");
        const fileExt = imageFile.name.split(".").pop();
        const randomFileToken = Math.random().toString(36).substring(2, 12);
        const isTestEnv = process.env.NEXT_PUBLIC_REPORT_DATA_SOURCE === "test";
        const folderPrefix = isTestEnv ? "test/" : "";
        const fileName = `${folderPrefix}${Date.now()}-${randomFileToken}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("report-images")
          .upload(fileName, imageFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("report-images")
          .getPublicUrl(fileName);
        
        publicUrl = data.publicUrl;
      }

      setSubmitStep("กำลังเตรียมข้อมูลแจ้งซ่อม...");

      setSubmitStep("กำลังลงทะเบียนข้อมูลเข้าระบบ...");
      const publicId = generatePublicId();
      const trackingToken = generateTrackingToken();

      const newReportData = {
        public_id: publicId,
        tracking_token: trackingToken,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        location: location.trim(),
        description: description.trim(),
        image_url: publicUrl,
        reporter_name: reporterName.trim(),
        reporter_type: reporterType,
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        status: "pending",
        priority: "low",
        admin_remark: null,
      };

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newReportData),
      });

      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || "การลงข้อมูลล้มเหลว");

      setSubmitStep("เสร็จสิ้นการส่งเรื่องสำเร็จ!");
      setSubmittedReport(resJson.data || (newReportData as unknown as Report));
      setIsSubmitting(false);

    } catch (err: unknown) {
      console.error("เกิดข้อผิดพลาดการร้องเรียน:", err);
      const errorMessage = err instanceof Error ? err.message : "การเชื่อมต่อฐานข้อมูลล้มเหลว กรุณาลองใหม่อีกครั้ง";
      setGlobalError(errorMessage);
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined" && submittedReport) {
      const trackingUrl = `${window.location.origin}/track/${submittedReport.public_id}`;
      navigator.clipboard.writeText(trackingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetForm = () => {

    setCategoryId("");
    setSubcategoryId("");
    setLocation("");
    setDescription("");
    setReporterName("");
    setReporterType("");
    setEmail("");
    setPhone("");
    setImageFile(null);
    setImagePreview(null);
    setSubmittedReport(null);
    setFormErrors({});
    setGlobalError(null);
  };

  if (submittedReport) {
    return (
      <main className="min-h-screen w-full bg-[#F4F6F8] dark:bg-slate-950 flex flex-col items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-[600px] flex flex-col items-center space-y-8 my-auto animate-scale-up relative z-10">
          {/* 1. Header (Success Icon & Text) */}
          <div className="text-center space-y-5 w-full">
            {/* Concentric Glow Icon */}
            <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-[#EBF7F2] flex items-center justify-center mx-auto shadow-sm">
              <div className="w-20 h-20 rounded-full bg-[#D1F0E0] flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-[#24C270] text-white flex items-center justify-center shadow-md">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-[22px] md:text-[26px] font-extrabold text-slate-800 dark:text-white">ส่งข้อมูลเรียบร้อยแล้ว!</h2>
              <p className="text-[13px] md:text-[14px] text-slate-500 font-medium leading-relaxed max-w-[420px] mx-auto">
                ระบบได้รับข้อมูลของท่านแล้ว เจ้าหน้าที่จะดำเนินการโดยเร็วที่สุด
              </p>
            </div>
          </div>

          <div className="w-full space-y-6">
            {/* 2. Reference Card */}
            <AppCard className="!p-5 border-[#EDF0F4] shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-4 rounded-full bg-[#D1350F] shrink-0"></div>
                  <span className="text-[16px] font-bold text-slate-800">หมายเลขการแจ้ง</span>
                </div>
                <StatusBadge status="pending" label="รับเรื่องแล้ว" />
              </div>

              <div className="bg-[#FFF6F3] border-[1.5px] border-dashed border-[#FCA5A5] rounded-[16px] p-5 text-center">
                <span className="text-[26px] font-black text-[#A93311] tracking-[0.12em] font-mono block leading-none pt-1 pb-2">
                  {submittedReport.public_id}
                </span>
                <span className="text-[11px] font-semibold text-slate-400 block mt-1.5">
                  วันที่แจ้ง: {(new Date()).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.
                </span>
              </div>

              <div className="bg-[#EDF9F1] border border-[#BCE6CA] rounded-xl p-2.5 mt-3.5 flex items-center justify-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 text-[#24C270]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-[11px] font-semibold text-[#189B55]">
                  บันทึกหมายเลขนี้ไว้ เพื่อใช้ติดตามสถานะในภายหลัง
                </span>
              </div>
            </AppCard>

            {/* 3. Tracking Card */}
            <AppCard className="!p-5 border-[#EDF0F4] shadow-sm">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-1 h-4 rounded-full bg-[#D1350F] shrink-0"></div>
                <span className="text-[16px] font-bold text-slate-800">ลิงก์ติดตามสถานะ</span>
              </div>

              <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#EDF0F4] rounded-[16px] p-1 pl-3 mb-4">
                <input
                  type="text"
                  readOnly
                  value={typeof window !== 'undefined' ? `${window.location.origin}/track/${submittedReport.public_id}` : ''}
                  className="bg-transparent border-none focus:ring-0 text-[11px] text-slate-500 w-full truncate font-medium p-0"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="shrink-0 px-3 py-1.5 flex items-center gap-1.5 bg-[#FFF0E5] text-[#A93311] font-bold rounded-[8px] border border-[#FCA5A5] text-[11px] hover:bg-[#FFE4D6] transition-colors cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                  </svg>
                  {copied ? "คัดลอกแล้ว" : "คัดลอก"}
                </button>
              </div>

              <Link href={`/track/${submittedReport.public_id}`} className="w-full flex items-center justify-center gap-2 py-3.5 border border-[#EDF0F4] rounded-[18px] text-[13px] font-bold text-slate-700 bg-[#F8FAFC] hover:bg-slate-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-[#D1431A]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                ดูสถานะการแจ้งปัญหา
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3 text-[#D1431A]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </AppCard>

            {/* 4. Bottom CTA */}
            <div className="pt-2 w-full">
              <button
                type="button"
                onClick={resetForm}
                className="w-full py-4 rounded-[18px] bg-[#A83210] hover:bg-[#8D280B] text-white font-bold transition-all text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-[#A83210]/20 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                แจ้งปัญหาใหม่
              </button>
            </div>
          </div>
        </div>
        
        <div className="mt-8 mb-4">
          <GlobalFooter />
        </div>
      </main>
    );
  }

  return (
    <AppContainer>
      {/* 1. Header แถบขาว sticky top-0 พร้อมปุ่มติดตามเรื่อง */}
      <AppNavbar
        rightAction={
          <Link
            href="/track/lookup"
            className="h-11 sm:h-12 px-4 sm:px-5 rounded-[14px] inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 bg-[#FFF1E8] border border-[#F5C4A8] text-[#B4360A] font-semibold text-[14px] sm:text-[15px] hover:bg-[#C2410C] hover:border-[#C2410C] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FFD9C4] cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.9} stroke="currentColor" className="w-[19px] h-[19px] sm:w-5 sm:h-5 shrink-0" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <span>ติดตามเรื่องที่แจ้งไว้</span>
          </Link>
        }
      />

      {/* ฟอร์มแจ้งปัญหา */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col w-full min-w-0">
        <PageShell className="pb-6">
          {/* ตรวจสอบข้อผิดพลาดสากล */}
          {globalError && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2 animate-fade-in shrink-0 z-10">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4.5 h-4.5 shrink-0 mt-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <div>
                <span className="font-bold block">บันทึกล้มเหลว</span>
                {globalError}
              </div>
            </div>
          )}

          {/* สถานะประมวลผลการส่งข้อมูล */}
          {isSubmitting ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6 animate-scale-up">
              <div className="relative w-14 h-14">
                <div className="w-14 h-14 rounded-full border-4 border-[#C2410C]/20 border-t-[#C2410C] animate-spin"></div>
              </div>
              <div className="text-center space-y-1.5">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">กำลังดำเนินการ</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">{submitStep}</p>
              </div>
            </div>
          ) : (
            <>
              {/* 2. Hero Banner: ความสูง ~196px (ไม่เกิน 220px) พร้อมภาพประกอบเดิม hero-bg2.png */}
              <div className="relative overflow-hidden rounded-3xl text-white min-h-[196px] max-h-[220px] bg-[linear-gradient(90deg,#B4360A_0%,#C1340A_25%,#CA320A_43%,#D7310B_58%,#EC3D12_100%)] shadow-[0_8px_24px_rgba(180,54,10,.22)] flex items-center">
                {/* ภาพประกอบเดิมด้านขวา ไล่เฉดกลืนกับพื้นส้ม ตัวการ์ตูนถือโทรโข่ง อาคาร การ์ด ไม่ถูกตัด */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/hero-bg2.png"
                  alt="ภาพประกอบระบบรับแจ้งปัญหา SOC STATION"
                  className="absolute right-0 top-0 h-full w-auto max-w-[55%] lg:max-w-[48%] object-cover object-right pointer-events-none select-none [-webkit-mask-image:linear-gradient(to_right,transparent_0,#000_38%)] [mask-image:linear-gradient(to_right,transparent_0,#000_38%)]"
                />

                {/* ข้อความฝั่งซ้าย */}
                <div className="relative max-w-[68%] sm:max-w-[62%] px-6 sm:px-8 md:px-10 py-5 sm:py-6 md:py-7 flex flex-col justify-center gap-1.5 sm:gap-2 z-10">
                  <span className="text-[11px] sm:text-[12px] font-bold tracking-[0.2em] uppercase text-white/80 block leading-none">
                    SOC STATION
                  </span>
                  <h1 className="text-xl sm:text-2xl md:text-[32px] font-extrabold leading-tight text-white">
                    ระบบรับแจ้งปัญหา
                  </h1>
                  <p className="text-[12px] sm:text-[13px] md:text-[14px] text-white/90 font-normal leading-relaxed line-clamp-1 sm:line-clamp-none">
                    ศูนย์กลางการแจ้งปัญหาและติดตามสถานะการดำเนินงานของคณะสังคมศาสตร์
                  </p>
                  <div className="flex flex-wrap gap-2 pt-0.5 sm:pt-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-[12px] md:text-[13px] font-semibold bg-black/25 text-white border border-white/10 backdrop-blur-sm">
                      ⚡ แจ้งปัญหาภายใน 1 นาที
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-[12px] md:text-[13px] font-semibold bg-black/25 text-white border border-white/10 backdrop-blur-sm">
                      📍 ติดตามแบบ Real-time
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. ฟอร์ม 70/30 Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-6 items-start w-full min-w-0">
                {/* การ์ดที่ 1 (ซ้าย 70%): รายละเอียดปัญหา */}
                <div className="w-full min-w-0">
                  <div className="rounded-3xl bg-white dark:bg-slate-900 shadow-[0_1px_2px_rgba(0,0,0,.04),0_8px_24px_rgba(41,37,36,.06)] p-6 sm:p-8 border border-[#EDF0F4] dark:border-slate-800 space-y-5">
                    {/* หัวการ์ดพร้อมกล่องเลขขั้น 1 (40x40 rounded-xl) */}
                    <div className="border-b border-[#F0EDEA] dark:border-slate-800 pb-[18px] mb-6 flex items-start gap-3.5">
                      <div className="w-10 h-10 min-w-10 rounded-xl bg-[#FFF1E8] text-[#B4360A] font-bold text-base flex items-center justify-center shrink-0">
                        1
                      </div>
                      <div>
                        <h2 className="text-[19px] font-bold text-slate-800 dark:text-white leading-tight">
                          รายละเอียดปัญหา
                        </h2>
                        <p className="text-[13px] text-gray-500 mt-1 leading-tight">
                          กรุณากรอกข้อมูลปัญหาและสถานที่ให้ครบถ้วน
                        </p>
                      </div>
                    </div>

                    {/* หมวดหมู่หลัก และหมวดหมู่ย่อย */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* หมวดหมู่หลัก */}
                      <div>
                        <label htmlFor="categoryId" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          หมวดหมู่หลัก <span className="text-[#B91C1C]">*</span>
                        </label>
                        <AppSelect
                          id="categoryId"
                          options={categories.map(c => ({ label: c.name_th, value: c.id }))}
                          value={categoryId}
                          onChange={(val) => {
                            setCategoryId(Number(val));
                            setSubcategoryId("");
                            setFormErrors(prev => {
                              const copy = { ...prev };
                              delete copy.categoryId;
                              return copy;
                            });
                          }}
                          placeholder="เลือกหมวดหมู่หลัก"
                          error={!!formErrors.categoryId}
                          mobileUX={true}
                          buttonClassName="h-12 text-base md:text-sm rounded-[14px]"
                        />
                        {formErrors.categoryId && (
                          <p className="text-xs text-[#B91C1C] font-medium mt-1.5">{formErrors.categoryId}</p>
                        )}
                      </div>

                      {/* หมวดหมู่ย่อย */}
                      <div>
                        <label htmlFor="subcategoryId" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          หมวดหมู่ย่อย <span className="text-[#B91C1C]">*</span>
                        </label>
                        <AppSelect
                          id="subcategoryId"
                          options={subcategories.map(s => ({ label: s.name_th, value: s.id }))}
                          value={subcategoryId}
                          onChange={(val) => {
                            setSubcategoryId(Number(val));
                            setFormErrors(prev => {
                              const copy = { ...prev };
                              delete copy.subcategoryId;
                              return copy;
                            });
                          }}
                          placeholder="เลือกหมวดหมู่ย่อย"
                          disabled={!categoryId || subcategories.length === 0}
                          error={!!formErrors.subcategoryId}
                          mobileUX={true}
                          buttonClassName="h-12 text-base md:text-sm rounded-[14px]"
                        />
                        {formErrors.subcategoryId && (
                          <p className="text-xs text-[#B91C1C] font-medium mt-1.5">{formErrors.subcategoryId}</p>
                        )}
                      </div>
                    </div>

                    {/* สถานที่ */}
                    <div>
                      <label htmlFor="location" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        สถานที่ <span className="text-slate-400 font-normal text-xs">(ไม่บังคับ)</span>
                      </label>
                      <input
                        type="text"
                        id="location"
                        name="location"
                        value={location}
                        onChange={(e) => {
                          setLocation(e.target.value);
                          if (formErrors.location) {
                            setFormErrors(prev => {
                              const copy = { ...prev };
                              delete copy.location;
                              return copy;
                            });
                          }
                        }}
                        placeholder="เช่น อาคาร 1 ห้อง 1104 หรือบริเวณที่พบปัญหา"
                        className="w-full h-12 px-4 rounded-[14px] border border-[#E5E7EB] dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-50 focus:bg-white dark:focus:bg-slate-900 text-base md:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2410C] focus-visible:border-transparent transition-all"
                      />
                    </div>

                    {/* รายละเอียดปัญหา */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="description" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                          รายละเอียดปัญหา <span className="text-[#B91C1C]">*</span>
                        </label>
                        <span className="text-xs text-slate-400 font-normal">รองรับข้อความยาวหลายบรรทัด</span>
                      </div>
                      <textarea
                        id="description"
                        name="description"
                        rows={5}
                        value={description}
                        onChange={(e) => {
                          setDescription(e.target.value);
                          if (e.target.value.trim().length >= 10) {
                            setFormErrors(prev => {
                              const copy = { ...prev };
                              delete copy.description;
                              return copy;
                            });
                          }
                        }}
                        placeholder="อธิบายรายละเอียดปัญหาที่พบ เช่น เกิดขึ้นเมื่อไหร่ ส่งผลกระทบอย่างไร รายละเอียดสถานที่เพิ่มเติม"
                        className={`w-full min-h-[120px] p-3.5 rounded-[14px] border ${
                          formErrors.description ? "border-[#B91C1C]" : "border-[#E5E7EB] dark:border-slate-700"
                        } bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-50 focus:bg-white dark:focus:bg-slate-900 text-base md:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2410C] focus-visible:border-transparent transition-all resize-y break-words`}
                      />
                      {formErrors.description && (
                        <p className="text-xs text-[#B91C1C] font-medium mt-1.5">{formErrors.description}</p>
                      )}
                    </div>

                    {/* รูปภาพประกอบ: Dropzone แนวตั้ง ขนาดมาตรฐาน */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        รูปภาพประกอบ <span className="text-slate-400 font-normal text-xs">(ไม่บังคับ)</span>
                      </label>

                      <input
                        type="file"
                        id="imageUpload"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/jpeg,image/png"
                        className="hidden"
                      />

                      {imagePreview ? (
                        <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50">
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-slate-200 shrink-0 bg-white shadow-xs">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={imagePreview}
                                alt="Preview"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm sm:text-[15px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {imageFile?.name || "รูปภาพที่เลือก"}
                              </p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {imageFile ? `${(imageFile.size / (1024 * 1024)).toFixed(2)} MB` : "แนบรูปภาพแล้ว"}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={removeImage}
                            className="min-h-[44px] min-w-[44px] p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                            title="ลบรูปภาพ"
                            aria-label="ลบรูปภาพ"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div
                          onDragEnter={handleDrag}
                          onDragOver={handleDrag}
                          onDragLeave={handleDrag}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={`group w-full min-h-[150px] sm:min-h-[168px] py-6 px-4 rounded-2xl border-2 border-dashed ${
                            dragActive
                              ? "border-[#C2410C] bg-[#FFF1E8]/70 ring-4 ring-[#FFD9C4]/50"
                              : formErrors.image
                              ? "border-rose-300 bg-rose-50/30"
                              : "border-[#E5E7EB] dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 hover:bg-[#FFF8F5]/70 dark:hover:bg-slate-800/50 hover:border-[#C2410C]/60"
                          } flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer select-none`}
                        >
                          <div className="w-11 h-11 rounded-full bg-[#FFF1E8] dark:bg-slate-800 border border-[#F5C4A8] dark:border-slate-700 flex items-center justify-center text-[#B4360A] shrink-0 mb-0.5 group-hover:scale-105 transition-transform shadow-xs">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-6 h-6" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                            </svg>
                          </div>
                          <p className="text-[15px] sm:text-[16px] font-semibold text-slate-700 dark:text-slate-200 group-hover:text-[#B4360A] transition-colors leading-snug">
                            เลือกรูปภาพประกอบ หรือ ลากรูปภาพมาวางที่นี่
                          </p>
                          <p className="text-[12px] sm:text-[13px] text-slate-400 dark:text-slate-500 font-normal leading-normal">
                            PNG, JPG, HEIC ขนาดไม่เกิน 5MB
                          </p>
                        </div>
                      )}

                      {formErrors.image && (
                        <p className="text-xs text-[#B91C1C] font-medium mt-1.5">{formErrors.image}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* การ์ดที่ 2 (ขวา 30%): ข้อมูลผู้แจ้ง */}
                <aside className="space-y-4 lg:sticky lg:top-6 w-full min-w-0">
                  <div className="rounded-3xl bg-white dark:bg-slate-900 shadow-[0_1px_2px_rgba(0,0,0,.04),0_8px_24px_rgba(41,37,36,.06)] p-6 sm:p-7 border border-[#EDF0F4] dark:border-slate-800 space-y-4">
                    {/* หัวการ์ดพร้อมกล่องเลขขั้น 2 (40x40 rounded-xl) */}
                    <div className="border-b border-[#F0EDEA] dark:border-slate-800 pb-[18px] mb-5 flex items-start gap-3.5">
                      <div className="w-10 h-10 min-w-10 rounded-xl bg-[#FFF1E8] text-[#B4360A] font-bold text-base flex items-center justify-center shrink-0">
                        2
                      </div>
                      <div>
                        <h2 className="text-[19px] font-bold text-slate-800 dark:text-white leading-tight">
                          ข้อมูลผู้แจ้ง
                        </h2>
                        <p className="text-[13px] text-gray-500 mt-1 leading-tight">
                          เพื่อให้เจ้าหน้าที่ติดต่อกลับ
                        </p>
                      </div>
                    </div>

                    {/* ประเภทผู้แจ้ง (Radio Group แท้) */}
                    <div>
                      <span id="reporterType-label" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        ประเภทผู้แจ้ง <span className="text-[#B91C1C]">*</span>
                      </span>
                      <div role="radiogroup" aria-labelledby="reporterType-label" className="grid grid-cols-3 gap-2">
                        {[
                          { value: 'อาจารย์', label: 'อาจารย์', icon: '👨‍🏫' },
                          { value: 'บุคลากร', label: 'บุคลากร', icon: '💼' },
                          { value: 'นิสิต', label: 'นิสิต', icon: '🎓' },
                        ].map((item) => {
                          const isChecked = reporterType === item.value;
                          return (
                            <label
                              key={item.value}
                              className={`relative flex items-center justify-center gap-1.5 h-12 px-2 rounded-[14px] text-xs sm:text-sm font-bold transition-all border cursor-pointer select-none ${
                                isChecked
                                  ? 'bg-[#C2410C] text-white border-[#C2410C] shadow-sm shadow-[#C2410C]/20'
                                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-[#E5E7EB] dark:border-slate-700 hover:bg-slate-50 hover:border-slate-300'
                              } focus-within:ring-2 focus-within:ring-[#C2410C] focus-within:ring-offset-1`}
                            >
                              <input
                                type="radio"
                                name="reporterType"
                                value={item.value}
                                checked={isChecked}
                                onChange={() => {
                                  setReporterType(item.value);
                                  setFormErrors(prev => {
                                    const copy = { ...prev };
                                    delete copy.reporterType;
                                    return copy;
                                  });
                                }}
                                className="sr-only"
                              />
                              <span className="text-sm sm:text-base leading-none">{item.icon}</span>
                              <span className="leading-none">{item.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      {formErrors.reporterType && (
                        <p className="text-xs text-[#B91C1C] font-medium mt-1.5">{formErrors.reporterType}</p>
                      )}
                    </div>

                    {/* ชื่อ-นามสกุล */}
                    <div>
                      <label htmlFor="reporterName" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        ชื่อ-นามสกุล <span className="text-[#B91C1C]">*</span>
                      </label>
                      <input
                        type="text"
                        id="reporterName"
                        name="reporterName"
                        autoComplete="name"
                        value={reporterName}
                        onChange={(e) => {
                          setReporterName(e.target.value);
                          if (e.target.value.trim()) {
                            setFormErrors(prev => {
                              const copy = { ...prev };
                              delete copy.reporterName;
                              return copy;
                            });
                          }
                        }}
                        placeholder="ระบุชื่อ-นามสกุล"
                        className="w-full h-12 px-4 rounded-[14px] border border-[#E5E7EB] dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-50 focus:bg-white dark:focus:bg-slate-900 text-base md:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2410C] focus-visible:border-transparent transition-all"
                      />
                      {formErrors.reporterName && (
                        <p className="text-xs text-[#B91C1C] font-medium mt-1.5">{formErrors.reporterName}</p>
                      )}
                    </div>

                    {/* อีเมลติดต่อกลับ */}
                    <div>
                      <label htmlFor="email" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        อีเมลติดต่อกลับ <span className="text-[#B91C1C]">*</span>
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (e.target.value.trim()) {
                            setFormErrors(prev => {
                              const copy = { ...prev };
                              delete copy.email;
                              return copy;
                            });
                          }
                        }}
                        placeholder="ระบุอีเมลติดต่อกลับ"
                        className="w-full h-12 px-4 rounded-[14px] border border-[#E5E7EB] dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-50 focus:bg-white dark:focus:bg-slate-900 text-base md:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2410C] focus-visible:border-transparent transition-all"
                      />
                      {formErrors.email && (
                        <p className="text-xs text-[#B91C1C] font-medium mt-1.5">{formErrors.email}</p>
                      )}
                    </div>

                    {/* เบอร์โทรศัพท์ติดต่อ */}
                    <div>
                      <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        เบอร์โทรศัพท์ติดต่อ <span className="text-[#B91C1C]">*</span>
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        inputMode="numeric"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          if (e.target.value.trim()) {
                            setFormErrors(prev => {
                              const copy = { ...prev };
                              delete copy.phone;
                              return copy;
                            });
                          }
                        }}
                        placeholder="ระบุเบอร์โทรศัพท์ 10 หลัก"
                        className="w-full h-12 px-4 rounded-[14px] border border-[#E5E7EB] dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-50 focus:bg-white dark:focus:bg-slate-900 text-base md:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2410C] focus-visible:border-transparent transition-all"
                      />
                      {formErrors.phone && (
                        <p className="text-xs text-[#B91C1C] font-medium mt-1.5">{formErrors.phone}</p>
                      )}
                    </div>
                  </div>

                  {/* ปุ่มแจ้งปัญหา Desktop (อยู่ใต้การ์ดข้อมูลผู้แจ้ง) */}
                  <div className="hidden lg:block pt-1">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-[52px] rounded-[14px] bg-[#C2410C] hover:bg-[#9A3412] active:scale-[0.99] text-white font-bold text-base flex items-center justify-center gap-2 shadow-md shadow-[#C2410C]/25 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#C2410C] focus-visible:ring-offset-2 outline-none"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          <span>กำลังส่งข้อมูล...</span>
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                          </svg>
                          <span>แจ้งปัญหา</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* ลิงก์ตรวจสอบสถานะ */}
                  <div className="text-center pt-1">
                    <Link
                      href="/track/lookup"
                      className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-500 hover:text-[#C2410C] transition-colors"
                    >
                      มีปัญหาที่แจ้งไว้แล้ว? <span className="text-[#C2410C] font-bold">ตรวจสอบสถานะ &rarr;</span>
                    </Link>
                  </div>
                </aside>
              </div>

              {/* 7. Footer ใน wrapper เดียวกัน */}
              <div className="pt-4 pb-2">
                <GlobalFooter />
              </div>
            </>
          )}
        </PageShell>

        {/* 6. แถบปุ่มล่าง "แจ้งปัญหา" (Sticky Bottom Bar) สำหรับ Mobile/Tablet (<lg) */}
        {!isSubmitting && (
          <div className="sticky bottom-0 z-30 w-full lg:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
            <div className={`mx-auto w-full ${PAGE_SHELL_MAX_WIDTH} px-4 sm:px-6 lg:px-8 flex items-center justify-end`}>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full md:w-80 md:ml-auto h-[52px] rounded-[14px] bg-[#C2410C] hover:bg-[#9A3412] active:scale-[0.99] text-white font-bold text-base flex items-center justify-center gap-2 shadow-md shadow-[#C2410C]/25 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#C2410C] focus-visible:ring-offset-2 outline-none"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>กำลังส่งข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                    </svg>
                    <span>แจ้งปัญหา</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </form>
    </AppContainer>
  );
}
