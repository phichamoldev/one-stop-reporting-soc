"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { AppContainer } from "@/components/design-system/AppContainer";
import { AppCard } from "@/components/design-system/AppCard";
import { AppButton } from "@/components/design-system/AppButton";
import { StatusBadge } from "@/components/design-system/StatusBadge";
import { AppSelect } from "@/components/ui/AppSelect";
import { supabase } from "@/lib/supabase";
import { Report, DBCategory, DBSubcategory } from "@/types/report";
import { generatePublicId, generateTrackingToken } from "@/lib/utils";
import Image from "next/image";
import { GlobalFooter } from "@/components/shared/GlobalFooter";
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
  
  const [categories, setCategories] = useState<DBCategory[]>([]);
  const [subcategories, setSubcategories] = useState<DBSubcategory[]>([]);

  const [location, setLocation] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [reporterName, setReporterName] = useState<string>("");
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

  // โหลด categories
  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch("/api/categories");
        if (res.ok) {
          const { categories } = await res.json();
          setCategories(categories || []);
        }
      } catch (err) {
        console.error("ไม่สามารถโหลดหมวดหมู่ได้:", err);
      }
    }
    loadCategories();
  }, []);

  // โหลด subcategories เมื่อ categoryId เปลี่ยน
  useEffect(() => {
    async function loadSubcategories() {
      if (!categoryId) {
        setSubcategories([]);
        return;
      }
      try {
        const res = await fetch(`/api/subcategories?categoryId=${categoryId}`);
        if (res.ok) {
          const { subcategories } = await res.json();
          setSubcategories(subcategories || []);
        }
      } catch (err) {
        console.error("ไม่สามารถโหลดหมวดหมู่ย่อยได้:", err);
      }
    }
    loadSubcategories();
  }, [categoryId]);

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
    if (!location.trim()) errors.location = "กรุณาระบุสถานที่เกิดเหตุหรือจุดสังเกต";
    if (!description.trim()) {
      errors.description = "กรุณากรอกรายละเอียดปัญหา";
    }
    
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
        const fileName = `${Date.now()}-${randomFileToken}.${fileExt}`;

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
    setEmail("");
    setPhone("");
    setImageFile(null);
    setImagePreview(null);
    setSubmittedReport(null);
    setFormErrors({});
    setGlobalError(null);
  };

  return (
    <AppContainer>
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
        /* 2. หน้าแจ้งเรื่องสำเร็จ (Success Details State) */
        <div className="flex-1 flex flex-col p-6 animate-scale-up justify-between bg-[#F8FAFC] dark:bg-slate-900 overflow-y-auto">
          <div className="space-y-6">

            {/* 1. Header (Success Icon & Text) */}
            <div className="text-center space-y-5 pt-4">
              {/* Concentric Glow Icon */}
              <div className="w-28 h-28 rounded-full bg-[#EBF7F2] flex items-center justify-center mx-auto shadow-sm">
                <div className="w-20 h-20 rounded-full bg-[#D1F0E0] flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-[#24C270] text-white flex items-center justify-center shadow-md">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <h2 className="text-[22px] font-extrabold text-slate-800 dark:text-white">ส่งข้อมูลเรียบร้อยแล้ว!</h2>
                <p className="text-[13px] text-slate-500 font-medium leading-relaxed max-w-[260px] mx-auto">
                  ระบบได้รับข้อมูลของท่านแล้ว เจ้าหน้าที่จะดำเนินการโดยเร็วที่สุด
                </p>
              </div>
            </div>

            {/* 2. Reference Card */}
            <AppCard className="!p-5 border-[#EDF0F4] shadow-sm">
              {/* Top row */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-4 rounded-full bg-[#D1350F] shrink-0"></div>
                  <span className="text-[16px] font-bold text-slate-800">หมายเลขการแจ้ง</span>
                </div>
                <StatusBadge status="pending" label="รับเรื่องแล้ว" />
              </div>

              {/* Box */}
              <div className="bg-[#FFF6F3] border-[1.5px] border-dashed border-[#FCA5A5] rounded-[16px] p-5 text-center">
                <span className="text-[26px] font-black text-[#A93311] tracking-[0.12em] font-mono block leading-none pt-1 pb-2">
                  {submittedReport.public_id}
                </span>
                <span className="text-[11px] font-semibold text-slate-400 block mt-1.5">
                  วันที่แจ้ง: {(new Date()).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.
                </span>
              </div>

              {/* Notice */}
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

          </div>

          {/* 4. Bottom CTA */}
          <div className="pt-8 pb-4 shrink-0 mt-auto">
            <button
              type="button"
              onClick={resetForm}
              className="w-full py-4 rounded-[18px] bg-[#A83210] hover:bg-[#8D280B] text-white font-bold transition-all text-[15px] flex items-center justify-center gap-1.5 shadow-lg shadow-[#A83210]/20 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              แจ้งปัญหาใหม่
            </button>
          </div>
          
          <GlobalFooter />
        </div>
      ) : (

        /* 3. หน้าฟอร์มหลักสำหรับการแจ้งปัญหา (Form State) */
        <>
          {/* ส่วนหัวคณะและตราสัญลักษณ์คณะสังคมศาสตร์ (Hero Section) */}
          <div
            className="relative pt-8 pb-10 px-6 rounded-b-[40px] text-white shrink-0 shadow-lg z-10 overflow-hidden"
            style={{
              backgroundImage: "url('/images/hero-bg2.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          >
            {/* Logo and Pill Button "One Stop Service" */}
            <div className="flex items-center justify-between">

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-white p-1 shadow-md flex items-center justify-center">
                  <Image
                    src="/images/ku-logo.png"
                    alt="Kasetsart University"
                    width={20}
                    height={20}
                    className="object-contain w-auto h-auto"
                    priority
                  />
                </div>
                <div>
                  <span className="text-[12px] leading-none font-extrabold block text-white/90">คณะสังคมศาสตร์</span>
                  <span className="text-[10px] leading-none text-white/70 block uppercase tracking-wider font-semibold mt-0.5">Faculty of Social Sciences</span>
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
                ศูนย์กลางการแจ้งปัญหาและติดตามสถานะ
                <br />
                การดำเนินงานของคณะสังคมศาสตร์
              </p>
            </div>

            {/* Floating Badges */}
            <div className="mt-5 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-black/15 text-white/95 border border-white/10 backdrop-blur-sm">
                ⚡ แจ้งปัญหาภายใน 1 นาที
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-black/15 text-white/95 border border-white/10 backdrop-blur-sm">
                📍 ติดตามแบบ Real-time
              </span>
            </div>

            {/* Lookup Link */}
            <div className="mt-5">
              <Link
                href="/track/lookup"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-white hover:text-white/80 transition-colors bg-white/10 backdrop-blur-sm px-3.5 py-1.5 rounded-full border border-white/10"
              >
                <span> ติดตามปัญหาที่แจ้งไว้แล้ว</span>
              </Link>
            </div>
          </div>

          {/* แบบฟอร์มกรอกข้อมูล */}
          <form onSubmit={handleSubmit} className="flex-1 px-4 md:px-5 py-6 space-y-6 overflow-y-auto bg-slate-50 dark:bg-slate-900">

            {/* รายละเอียดปัญหา Section */}
            <AppCard>
              <div className="flex items-start gap-2.5 mb-5">
                <div className="w-1 h-4 rounded-full bg-[#D1350F] shrink-0 mt-1"></div>
                <div>
                  <h3 className="text-[16px] font-bold text-slate-800 dark:text-white leading-none mb-1.5">รายละเอียดปัญหา</h3>
                  <p className="text-[11px] text-slate-500 leading-none">กรุณากรอกข้อมูลให้ครบถ้วน</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Category */}
                <div className="relative">
                  <label className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-2">
                    หมวดหมู่หลัก <span className="text-primary">*</span>
                  </label>
                  <AppSelect 
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
                  />
                  {formErrors.categoryId && (
                    <p className="text-xs text-rose-500 font-medium mt-2">{formErrors.categoryId}</p>
                  )}
                </div>

                {/* Subcategory */}
                <div className="relative mt-4">
                  <label className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-2">
                    หมวดหมู่ย่อย <span className="text-primary">*</span>
                  </label>
                  <AppSelect 
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
                  />
                  {formErrors.subcategoryId && (
                    <p className="text-xs text-rose-500 font-medium mt-2">{formErrors.subcategoryId}</p>
                  )}
                </div>

                {/* Location */}
                <div>
                  <label htmlFor="location" className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-2">
                    สถานที่ <span className="text-primary">*</span>
                  </label>
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
                    className={`w-full text-[12px] font-normal placeholder-slate-400 bg-slate-100/50 dark:bg-slate-900/50 border px-4 py-3.5 rounded-[16px] focus:ring-2 focus:ring-primary/20 ${formErrors.location ? "border-rose-500 text-rose-500" : "border-[#EDF0F4] dark:border-slate-700 text-slate-900 dark:text-white"
                      }`}
                  />
                  {formErrors.location && (
                    <p className="text-xs text-rose-500 font-medium mt-2">{formErrors.location}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-2">
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
                    className={`w-full text-[12px] font-normal placeholder-slate-400 bg-slate-100/50 dark:bg-slate-900/50 border px-4 py-3.5 rounded-[16px] resize-none focus:ring-2 focus:ring-primary/20 ${formErrors.description ? "border-rose-500 text-rose-500" : "border-[#EDF0F4] dark:border-slate-700 text-slate-900 dark:text-white"
                      }`}
                  />
                  {formErrors.description && (
                    <p className="text-xs text-rose-500 font-medium mt-2">{formErrors.description}</p>
                  )}
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-2">
                    รูปภาพประกอบ
                  </label>

                  {imagePreview ? (
                    <div className="relative rounded-[16px] overflow-hidden border border-[#EDF0F4] dark:border-slate-700 bg-slate-50 dark:bg-slate-900 aspect-video group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview}
                        alt="ภาพจำลองปัญหา"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white rounded-full transition-colors cursor-pointer"
                        title="เปลี่ยนรูปภาพ"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
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
                      className={`border-2 border-dashed rounded-[16px] p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 bg-slate-100/30 dark:bg-slate-900/30 ${dragActive
                        ? "border-primary bg-primary/5"
                        : "border-[#EDF0F4] dark:border-slate-700 hover:border-primary/50 dark:hover:border-primary/50"
                        } ${formErrors.image ? "border-rose-300 bg-rose-50" : ""}`}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                      />
                      <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 shadow-sm border border-[#EDF0F4] dark:border-slate-700">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                        </svg>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          <span className="text-primary">เลือกรูปภาพ</span> หรือลากมาวางที่นี่
                        </p>
                        <p className="text-xs text-slate-500 font-medium">PNG, JPG, HEIC ขนาดไม่เกิน 5MB</p>
                      </div>
                    </div>
                  )}
                  {formErrors.image && (
                    <p className="text-xs text-rose-500 font-medium mt-2">{formErrors.image}</p>
                  )}
                </div>
              </div>
            </AppCard>

            {/* ข้อมูลผู้แจ้ง Section */}
            <AppCard>
              <div className="flex items-start gap-2.5 mb-5">
                <div className="w-1 h-4 rounded-full bg-[#D1350F] shrink-0 mt-1"></div>
                <div>
                  <h3 className="text-[16px] font-bold text-slate-800 dark:text-white leading-none mb-1.5">ข้อมูลผู้แจ้ง</h3>
                  <p className="text-[11px] text-slate-500 leading-none">เพื่อให้เจ้าหน้าที่ติดต่อกลับ</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label htmlFor="reporterName" className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-2">ชื่อ-นามสกุล <span className="text-primary">*</span></label>
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
                    placeholder="ระบุชื่อ-นามสกุล"
                    className={`w-full text-[12px] font-normal text-slate-900 dark:text-white placeholder-slate-400 bg-slate-100/50 dark:bg-slate-900/50 border px-4 py-3.5 rounded-[16px] focus:ring-2 focus:ring-primary/20 ${formErrors.reporterName ? "border-rose-500 text-rose-500" : "border-[#EDF0F4] dark:border-slate-700"}`}
                  />
                  {formErrors.reporterName && (
                    <p className="text-xs text-rose-500 font-medium mt-2">{formErrors.reporterName}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="email" className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-2">อีเมลติดต่อกลับ <span className="text-primary">*</span></label>
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
                    placeholder="ระบุอีเมลติดต่อกลับ"
                    className={`w-full text-[12px] font-normal text-slate-900 dark:text-white placeholder-slate-400 bg-slate-100/50 dark:bg-slate-900/50 border px-4 py-3.5 rounded-[16px] focus:ring-2 focus:ring-primary/20 ${formErrors.email ? "border-rose-500 text-rose-500" : "border-[#EDF0F4] dark:border-slate-700"}`}
                  />
                  {formErrors.email && (
                    <p className="text-xs text-rose-500 font-medium mt-2">{formErrors.email}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="phone" className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-2">เบอร์โทรศัพท์ติดต่อ <span className="text-primary">*</span></label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
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
                    className={`w-full text-[12px] font-normal text-slate-900 dark:text-white placeholder-slate-400 bg-slate-100/50 dark:bg-slate-900/50 border px-4 py-3.5 rounded-[16px] focus:ring-2 focus:ring-primary/20 ${formErrors.phone ? "border-rose-500 text-rose-500" : "border-[#EDF0F4] dark:border-slate-700"}`}
                  />
                  {formErrors.phone && (
                    <p className="text-xs text-rose-500 font-medium mt-2">{formErrors.phone}</p>
                  )}
                </div>
              </div>
            </AppCard>

            {/* Submit Section */}
            <div className="pt-2 pb-6">
              <AppButton
                type="submit"
                variant="primary"
                fullWidth
                size="lg"
                isLoading={isSubmitting}
                className="shadow-primary"
              >
                {isSubmitting ? (
                  "กำลังส่งข้อมูล..."
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                    </svg>
                    แจ้งปัญหา
                  </>
                )}
              </AppButton>

              {/* ลิงก์ตรวจสอบสถานะด้านล่างสุด */}
              <div className="text-center mt-6">
                <Link
                  href="/track/lookup"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-primary transition-colors"
                >
                  มีปัญหาที่แจ้งไว้แล้ว? <span className="text-primary font-bold">ตรวจสอบสถานะ &rarr;</span>
                </Link>
              </div>
            </div>

            <GlobalFooter />
          </form>
        </>
      )}
    </AppContainer>
  );
}