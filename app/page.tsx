"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Report, ReportCategory, CATEGORY_DETAILS } from "@/types/report";
import { generatePublicId, generateTrackingToken } from "@/lib/utils";

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // สถานะข้อมูลในฟอร์ม
  const [category, setCategory] = useState<ReportCategory | "">("");
  const [location, setLocation] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [reporterName, setReporterName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // สถิติระบบเบื้องหลัง (ดึงข้อมูลเงียบๆ)
  const [totalCount, setTotalCount] = useState<number>(0);
  const [resolvedCount, setResolvedCount] = useState<number>(0);

  // สถานะ UI
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitStep, setSubmitStep] = useState<string>("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);

  // หลังส่งข้อมูลเสร็จสิ้น
  const [submittedReport, setSubmittedReport] = useState<Report | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // โหลดสถิติด้านหลัง
  useEffect(() => {
    async function loadStats() {
      try {
        const { data, error } = await supabase
          .from("reports")
          .select("status");
        if (data) {
          setTotalCount(data.length);
          setResolvedCount(data.filter(r => r.status === "resolved").length);
        }
      } catch (err) {
        console.error("ไม่สามารถโหลดสถิติได้:", err);
      }
    }
    loadStats();
  }, [submittedReport]); // โหลดสถิติใหม่เมื่อมีการส่งเรื่องสำเร็จ

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

    if (!category) errors.category = "กรุณาเลือกหมวดหมู่ของปัญหา";
    if (!location.trim()) errors.location = "กรุณาระบุสถานที่เกิดเหตุหรือจุดสังเกต";
    if (!description.trim()) {
      errors.description = "กรุณากรอกรายละเอียดปัญหา";
    } else if (description.trim().length < 10) {
      errors.description = "กรุณากรอกรายละเอียดอย่างน้อย 10 ตัวอักษร";
    }
    if (!reporterName.trim()) errors.reporterName = "กรุณากรอกชื่อผู้แจ้ง";
    if (!email.trim()) {
      errors.email = "กรุณากรอกอีเมล";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "รูปแบบอีเมลไม่ถูกต้อง";
    }
    if (!imageFile) errors.image = "กรุณาอัปโหลดรูปถ่ายสถานที่เกิดเหตุ";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ส่งแบบฟอร์ม
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    if (!validateForm()) {
      // เลื่อนหน้าฟอร์มไปยังจุดผิดพลาดแรกสุด
      const firstErrorKey = Object.keys(formErrors)[0];
      const element = document.getElementsByName(firstErrorKey)[0] || document.getElementById(firstErrorKey);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    try {
      setIsSubmitting(true);
      
      // 1. อัปโหลดรูปภาพไปยัง Supabase Storage
      setSubmitStep("กำลังอัปโหลดรูปภาพหลักฐาน...");
      const fileExt = imageFile!.name.split(".").pop();
      const randomFileToken = Math.random().toString(36).substring(2, 12);
      const fileName = `${Date.now()}-${randomFileToken}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("report-images")
        .upload(fileName, imageFile!, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 2. ดึงที่อยู่รูปภาพ URL สาธารณะ
      setSubmitStep("กำลังเตรียมข้อมูลแจ้งซ่อม...");
      const { data: { publicUrl } } = supabase.storage
        .from("report-images")
        .getPublicUrl(fileName);

      // 3. สร้างข้อมูลลงตาราง reports
      setSubmitStep("กำลังลงทะเบียนข้อมูลเข้าระบบ...");
      const publicId = generatePublicId();
      const trackingToken = generateTrackingToken();

      const newReportData = {
        public_id: publicId,
        tracking_token: trackingToken,
        category,
        location: location.trim(),
        description: description.trim(),
        image_url: publicUrl,
        reporter_name: reporterName.trim(),
        email: email.trim().toLowerCase(),
        status: "pending",
        priority: "low",
        admin_remark: null,
      };

      // POST to server-side API which uses the service role key to bypass RLS
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newReportData),
      });

      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || "การลงข้อมูลล้มเหลว");

      setSubmitStep("เสร็จสิ้นการส่งเรื่องสำเร็จ!");
      // อัปเดตข้อมูลสถานะเสร็จสิ้นการยื่นเรื่อง
      setSubmittedReport(resJson.data || (newReportData as unknown as Report));
      setIsSubmitting(false);

    } catch (err: any) {
      console.error("เกิดข้อผิดพลาดการร้องเรียน:", err);
      setGlobalError(err.message || "การเชื่อมต่อฐานข้อมูลล้มเหลว กรุณาลองใหม่อีกครั้ง");
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
    setCategory("");
    setLocation("");
    setDescription("");
    setReporterName("");
    setEmail("");
    setImageFile(null);
    setImagePreview(null);
    setSubmittedReport(null);
    setFormErrors({});
    setGlobalError(null);
  };

  return (
    <main className="min-h-screen w-full bg-slate-100 dark:bg-slate-950 flex items-center justify-center py-0 md:py-8 transition-colors duration-300">
      {/* อุปกรณ์จำลอง Mobile Mockup ในจอคอมพิวเตอร์ และแสดงผลเต็มจอปกติในจอโมบายล์ */}
      <div className="w-full max-w-md min-h-screen md:min-h-[820px] md:max-h-[880px] md:rounded-[36px] bg-slate-50 dark:bg-gray-900 md:shadow-2xl border-0 md:border-6 md:border-slate-800 dark:md:border-slate-800 overflow-y-auto flex flex-col relative animate-scale-up">
        
        {/* ตรวจสอบข้อผิดพลาดสากล */}
        {globalError && (
          <div className="mx-6 mt-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2 animate-fade-in shrink-0 z-10">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4.5 h-4.5 shrink-0 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <div>
              <span className="font-bold block">บันทึกล้มเหลว</span>
              {globalError}
            </div>
          </div>
        )}

        {/* 1. สถานะประมวลผลการส่งข้อมูล */}
        {isSubmitting ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6 animate-scale-up">
            <div className="relative w-14 h-14">
              <div className="w-14 h-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">กำลังดำเนินการ</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">{submitStep}</p>
            </div>
          </div>
        ) : submittedReport ? (
          
          /* 2. หน้าแจ้งเรื่องสำเร็จ (Success Details State) */
          <div className="flex-1 flex flex-col p-6 animate-scale-up justify-between space-y-6">
            <div className="space-y-6">
              {/* สัญลักษณ์ความสำเร็จ */}
              <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              
              <div className="text-center space-y-2">
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white">ส่งข้อมูลเรียบร้อยแล้ว</h2>
                <p className="text-xs text-gray-400 leading-normal max-w-[280px] mx-auto">
                  เจ้าหน้าที่ได้รับข้อมูลของคุณแล้ว จะดำเนินการตรวจสอบและแก้ไขโดยเร็วที่สุด
                </p>
              </div>

              {/* การ์ดแสดงรายละเอียดปัญหาที่ส่งสำเร็จ */}
              <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-950/40 p-4.5 text-left space-y-3.5 shadow-sm">
                
                {/* รหัสการยื่นคำร้อง */}
                <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-2.5">
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold block">หมายเลขอ้างอิง</span>
                    <span className="font-extrabold text-base text-gray-900 dark:text-white tracking-wide">{submittedReport.public_id}</span>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                      กำลังดำเนินการ
                    </span>
                  </div>
                </div>

                {/* วันที่แจ้ง */}
                <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                  </svg>
                  <span>วันที่แจ้ง: {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>

                {/* กล่องรหัสติดตาม (Tracking Token) */}
                <div className="p-3 bg-slate-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl space-y-1.5 text-center relative">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">TRACKING TOKEN</span>
                  <div className="flex items-center justify-between bg-white dark:bg-slate-950 px-3 py-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
                    <span className="font-extrabold text-sm text-gray-900 dark:text-white font-mono tracking-widest">{submittedReport.public_id}</span>
                    <button
                      onClick={handleCopyLink}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold text-white transition-all flex items-center gap-1 cursor-pointer ${
                        copied 
                          ? "bg-emerald-600 shadow-md shadow-emerald-500/10" 
                          : "bg-primary hover:bg-primary-hover shadow-md shadow-primary/10"
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z" />
                      </svg>
                      <span>{copied ? "คัดลอกแล้ว" : "คัดลอก"}</span>
                    </button>
                  </div>
                  <span className="text-[10px] text-gray-400 block font-semibold">เก็บ Token นี้ไว้เพื่อติดตามสถานะภายหลัง</span>
                </div>

              </div>
            </div>

            {/* ปุ่มนำทางและดำเนินการเพิ่มเติม */}
            <div className="space-y-3 pt-4 border-t border-gray-150 dark:border-gray-800 shrink-0">
              <Link
                href={`/track/${submittedReport.public_id}`}
                className="w-full block py-3.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold transition-all text-xs cursor-pointer text-center shadow-lg shadow-primary/15"
              >
                ดูสถานะการแจ้งปัญหา
              </Link>

              <button
                onClick={handleCopyLink}
                className="w-full py-3.5 px-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 font-bold transition-all text-xs cursor-pointer text-center flex items-center justify-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z" />
                </svg>
                คัดลอกลิงก์ติดตาม
              </button>
              
              <div className="text-center pt-2">
                <button
                  onClick={resetForm}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-primary transition-colors cursor-pointer"
                >
                  + แจ้งปัญหาใหม่
                </button>
              </div>
            </div>
          </div>
        ) : (
          
          /* 3. หน้าฟอร์มหลักสำหรับการแจ้งปัญหา (Form State) */
          <>
            {/* ส่วนหัวคณะและตราสัญลักษณ์คณะสังคมศาสตร์ (Hero Section) */}
            <div className="relative bg-gradient-to-br from-[#D1350F] to-[#E35F3A] pt-8 pb-10 px-6 rounded-b-[40px] text-white shrink-0 shadow-lg">
              {/* Logo and Pill Button "One Stop Service" */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-primary shadow-sm font-bold text-xs select-none">
                    KU
                  </div>
                  <div>
                    <span className="text-[10px] leading-none font-extrabold block text-white/90">คณะสังคมศาสตร์ มก.</span>
                    <span className="text-[8px] leading-none text-white/70 block uppercase tracking-wider font-semibold">Faculty of Social Sciences</span>
                  </div>
                </div>
                
                <span className="px-3 py-1 rounded-full border border-white/30 text-[10px] font-bold text-white uppercase tracking-wider bg-white/10 backdrop-blur-sm">
                  One Stop Service
                </span>
              </div>
              
              {/* Titles */}
              <div className="mt-6 space-y-1">
                <h1 className="text-xl font-extrabold tracking-tight">ระบบรับแจ้งปัญหา</h1>
                <h2 className="text-2xl font-black tracking-tight leading-none text-white/95">One Stop Service</h2>
                <p className="text-[11px] text-white/80 font-medium leading-relaxed max-w-[300px] pt-1">
                  ศูนย์กลางการแจ้งปัญหาและติดตามสถานะการดำเนินงานของคณะสังคมศาสตร์
                </p>
              </div>
              
              {/* Floating Badges */}
              <div className="mt-5 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-black/15 text-white/95 border border-white/10 backdrop-blur-sm">
                  ⚡ แจ้งปัญหาภายใน 1 นาที
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-black/15 text-white/95 border border-white/10 backdrop-blur-sm">
                  📍 ติดตามสถานะแบบ Real-time
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-black/15 text-white/95 border border-white/10 backdrop-blur-sm">
                  🔔 รับการแจ้งเตือน
                </span>
              </div>
              
              {/* Lookup Link */}
              <div className="mt-5">
                <Link
                  href="/track/lookup"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-white hover:text-white/80 transition-colors bg-white/10 backdrop-blur-sm px-3.5 py-1.5 rounded-full border border-white/10"
                >
                  <span>&rsaquo; ติดตามปัญหาที่แจ้งไว้แล้ว</span>
                </Link>
              </div>
            </div>

            {/* ส่วนสถิติย่อย */}
            <div className="mx-5 mt-5 px-3.5 py-2.5 bg-primary-light dark:bg-primary-light/5 rounded-xl border border-primary/10 flex items-center justify-between text-[10px] shrink-0">
              <span className="text-gray-500 font-semibold">สถิติคณะสังคมศาสตร์</span>
              <span className="font-extrabold text-primary">
                ยื่นแล้ว {totalCount} เรื่อง • แก้ไขเสร็จสิ้น {resolvedCount} เรื่อง
              </span>
            </div>

            {/* แบบฟอร์มกรอกข้อมูล */}
            <form onSubmit={handleSubmit} className="flex-1 px-5 py-5 space-y-5 overflow-y-auto">
              
              {/* รายละเอียดปัญหา Header */}
              <div className="flex items-center gap-2 pb-1">
                <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white leading-none">รายละเอียดปัญหา</h3>
                  <span className="text-[10px] text-gray-400 font-medium block">กรุณากรอกข้อมูลให้ครบถ้วน</span>
                </div>
              </div>

              {/* ช่องเลือกหมวดหมู่ปัญหา Custom Dropdown */}
              <div className="space-y-2 shrink-0">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  ประเภทปัญหา <span className="text-primary">*</span>
                </label>
                
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className={`w-full px-3.5 py-3 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all bg-white dark:bg-gray-900 text-xs font-semibold ${
                      formErrors.category ? "border-error" : "border-gray-200 dark:border-gray-800"
                    } focus:ring-2 focus:ring-primary/20 focus:border-primary`}
                  >
                    <span className="flex items-center gap-2">
                      {category ? (
                        <>
                          <span className="text-lg shrink-0">{CATEGORY_DETAILS[category]?.icon}</span>
                          <span className="text-gray-900 dark:text-white">{CATEGORY_DETAILS[category]?.label}</span>
                        </>
                      ) : (
                        <span className="text-gray-400">เลือกประเภทปัญหา</span>
                      )}
                    </span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2.5}
                      stroke="currentColor"
                      className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  
                  {dropdownOpen && (
                    <div className="absolute z-30 mt-1 w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-150 dark:border-gray-800 shadow-xl overflow-hidden animate-scale-up">
                      <ul className="py-1">
                        {Object.entries(CATEGORY_DETAILS).map(([key, details]) => {
                          const isSelected = category === key;
                          return (
                            <li key={key}>
                              <button
                                type="button"
                                onClick={() => {
                                  setCategory(key as ReportCategory);
                                  setDropdownOpen(false);
                                  setFormErrors(prev => {
                                    const copy = { ...prev };
                                    delete copy.category;
                                    return copy;
                                  });
                                }}
                                className={`w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between transition-colors cursor-pointer ${
                                  isSelected ? "bg-primary/5 dark:bg-primary/10 text-primary font-bold" : "text-gray-700 dark:text-gray-300"
                                }`}
                              >
                                <span className="flex items-center gap-2.5 text-xs">
                                  <span className="text-lg shrink-0">{details.icon}</span>
                                  <div>
                                    <span className="block">{details.label}</span>
                                  </div>
                                </span>
                                {isSelected && (
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4 text-primary">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                  </svg>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
                
                {formErrors.category && (
                  <p className="text-[10px] text-primary font-bold flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                    {formErrors.category}
                  </p>
                )}
              </div>

              {/* สถานที่เกิดเหตุ */}
              <div className="space-y-1.5">
                <label htmlFor="location" className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  สถานที่ <span className="text-primary">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={location}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      if (e.target.value.trim()) {
                        setFormErrors(prev => {
                          const copy = { ...prev };
                          delete copy.location;
                          return copy;
                        });
                      }
                    }}
                    placeholder="เช่น อาคาร 1 ห้อง 1104"
                    className={`w-full pl-10 pr-3.5 py-3 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${
                      formErrors.location ? "border-error" : "border-gray-200 dark:border-gray-800"
                    }`}
                  />
                </div>
                {formErrors.location && (
                  <p className="text-[10px] text-primary font-bold flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                    {formErrors.location}
                  </p>
                )}
              </div>

              {/* คำอธิบายเรื่องร้องเรียน */}
              <div className="space-y-1.5">
                <label htmlFor="description" className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  รายละเอียดปัญหา <span className="text-primary">*</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
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
                  placeholder="อธิบายรายละเอียดปัญหาที่พบ เช่น เกิดขึ้นเมื่อไหร่ ส่งผลกระทบอย่างไร"
                  className={`w-full px-3.5 py-3 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white dark:bg-gray-900 text-gray-900 dark:text-white resize-none min-h-[90px] ${
                    formErrors.description ? "border-error" : "border-gray-200 dark:border-gray-800"
                  }`}
                />
                {formErrors.description && (
                  <p className="text-[10px] text-primary font-bold flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                    {formErrors.description}
                  </p>
                )}
              </div>

              {/* กล่องอัปโหลดรูปหลักฐาน */}
              <div className="space-y-2 shrink-0">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  รูปภาพประกอบ <span className="text-primary">*</span>
                </label>
                
                {imagePreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-gray-250 dark:border-gray-800 bg-slate-50 dark:bg-gray-950 aspect-video group shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="ภาพจำลองปัญหา"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2.5 right-2.5 p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full transition-colors shadow shadow-rose-900/10 cursor-pointer"
                      title="เปลี่ยนรูปภาพ"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
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
                    className={`border border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 bg-white dark:bg-gray-900 ${
                      dragActive 
                        ? "border-primary bg-primary/5" 
                        : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                    } ${formErrors.image ? "border-error bg-error/5" : ""}`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-100 dark:border-slate-850">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                      </svg>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-gray-750 dark:text-gray-300">
                        <span className="text-primary">เลือกรูปภาพ</span> หรือลากมาวางที่นี่
                      </p>
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">PNG, JPG, HEIC ขนาดไม่เกิน 5MB</p>
                    </div>
                  </div>
                )}
                {formErrors.image && (
                  <p className="text-[10px] text-primary font-bold flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                    {formErrors.image}
                  </p>
                )}
              </div>

              {/* ส่วนข้อมูลติดต่อส่วนตัวผู้แจ้ง */}
              <div className="p-4.5 rounded-2xl border border-gray-100 dark:border-gray-800 bg-[#F5F6F8]/60 dark:bg-slate-950/20 space-y-4 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-primary/10 text-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                  </span>
                  <div>
                    <span className="text-xs font-bold text-gray-900 dark:text-white block leading-none">ข้อมูลผู้แจ้ง</span>
                    <span className="text-[9px] text-gray-400 block font-semibold pt-0.5">ไม่บังคับ — เพื่อให้เจ้าหน้าที่ติดต่อกลับ</span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                        </svg>
                      </span>
                      <input
                        type="text"
                        id="reporterName"
                        name="reporterName"
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
                        placeholder="ชื่อ-นามสกุล"
                        className="w-full pl-10 pr-3.5 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                    {formErrors.reporterName && (
                      <p className="text-[10px] text-primary font-bold mt-1">{formErrors.reporterName}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                        </svg>
                      </span>
                      <input
                        type="email"
                        id="email"
                        name="email"
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
                        placeholder="อีเมลติดต่อกลับ (email@ku.th)"
                        className="w-full pl-10 pr-3.5 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                    {formErrors.email && (
                      <p className="text-[10px] text-primary font-bold mt-1">{formErrors.email}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* ปุ่มสำหรับยืนยันและส่งเรื่องร้องเรียน */}
              <button
                type="submit"
                className="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold transition-all text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary/10 hover:shadow-primary/20 shrink-0 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
                แจ้งปัญหา
              </button>
              
              {/* ลิงก์ตรวจสอบสถานะด้านล่างสุด */}
              <div className="text-center pt-1 pb-2">
                <Link
                  href="/track/lookup"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-primary transition-colors"
                >
                  มีปัญหาที่แจ้งไว้แล้ว? <span className="text-primary">ตรวจสอบสถานะ &rarr;</span>
                </Link>
              </div>
            </form>
          </>
        )}

      </div>
    </main>
  );
}