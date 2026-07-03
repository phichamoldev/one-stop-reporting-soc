"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Report, ReportCategory, CATEGORY_DETAILS } from "@/types/report";
import { generatePublicId, generateTrackingToken } from "@/lib/utils";

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // เธชเธ–เธฒเธเธฐเธเนเธญเธกเธนเธฅเนเธเธเธญเธฃเนเธก
  const [category, setCategory] = useState<ReportCategory | "">("");
  const [location, setLocation] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [reporterName, setReporterName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // เธชเธ–เธดเธ•เธดเธฃเธฐเธเธเน€เธเธทเนเธญเธเธซเธฅเธฑเธ (เธ”เธถเธเธเนเธญเธกเธนเธฅเน€เธเธตเธขเธเน)
  const [totalCount, setTotalCount] = useState<number>(0);
  const [resolvedCount, setResolvedCount] = useState<number>(0);

  // เธชเธ–เธฒเธเธฐ UI
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitStep, setSubmitStep] = useState<string>("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // เธซเธฅเธฑเธเธชเนเธเธเนเธญเธกเธนเธฅเน€เธชเธฃเนเธเธชเธดเนเธ
  const [submittedReport, setSubmittedReport] = useState<Report | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // เนเธซเธฅเธ”เธชเธ–เธดเธ•เธดเธ”เนเธฒเธเธซเธฅเธฑเธ
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
        console.error("เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เนเธซเธฅเธ”เธชเธ–เธดเธ•เธดเนเธ”เน:", err);
      }
    }
    loadStats();
  }, [submittedReport]); // เนเธซเธฅเธ”เธชเธ–เธดเธ•เธดเนเธซเธกเนเน€เธกเธทเนเธญเธกเธตเธเธฒเธฃเธชเนเธเน€เธฃเธทเนเธญเธเธชเธณเน€เธฃเนเธ

  // เธเธฑเธ”เธเธฒเธฃเนเธเธฅเนเธ เธฒเธ
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith("image/")) {
        setFormErrors(prev => ({ ...prev, image: "เธเธฃเธธเธ“เธฒเธญเธฑเธเนเธซเธฅเธ”เน€เธเธเธฒเธฐเนเธเธฅเนเธฃเธนเธเธ เธฒเธเน€เธ—เนเธฒเธเธฑเนเธ" }));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setFormErrors(prev => ({ ...prev, image: "เธเธเธฒเธ”เธฃเธนเธเธ เธฒเธเธ•เนเธญเธเนเธกเนเน€เธเธดเธ 5MB" }));
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
        setFormErrors(prev => ({ ...prev, image: "เธเธฃเธธเธ“เธฒเธญเธฑเธเนเธซเธฅเธ”เน€เธเธเธฒเธฐเนเธเธฅเนเธฃเธนเธเธ เธฒเธเน€เธ—เนเธฒเธเธฑเนเธ" }));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setFormErrors(prev => ({ ...prev, image: "เธเธเธฒเธ”เธฃเธนเธเธ เธฒเธเธ•เนเธญเธเนเธกเนเน€เธเธดเธ 5MB" }));
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

  // เธ•เธฃเธงเธเธ—เธฒเธเธเธญเธฃเนเธก
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!category) errors.category = "เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธซเธกเธงเธ”เธซเธกเธนเนเธเธญเธเธเธฑเธเธซเธฒ";
    if (!location.trim()) errors.location = "เธเธฃเธธเธ“เธฒเธฃเธฐเธเธธเธชเธ–เธฒเธเธ—เธตเนเน€เธเธดเธ”เน€เธซเธ•เธธเธซเธฃเธทเธญเธเธธเธ”เธชเธฑเธเน€เธเธ•";
    if (!description.trim()) {
      errors.description = "เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธเธฑเธเธซเธฒ";
    } else if (description.trim().length < 10) {
      errors.description = "เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธญเธขเนเธฒเธเธเนเธญเธข 10 เธ•เธฑเธงเธญเธฑเธเธฉเธฃ";
    }
    if (!reporterName.trim()) errors.reporterName = "เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธเธทเนเธญเธเธนเนเนเธเนเธ";
    if (!email.trim()) {
      errors.email = "เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธญเธตเน€เธกเธฅ";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "เธฃเธนเธเนเธเธเธญเธตเน€เธกเธฅเนเธกเนเธ–เธนเธเธ•เนเธญเธ";
    }
    if (!imageFile) errors.image = "เธเธฃเธธเธ“เธฒเธญเธฑเธเนเธซเธฅเธ”เธฃเธนเธเธ–เนเธฒเธขเธชเธ–เธฒเธเธ—เธตเนเน€เธเธดเธ”เน€เธซเธ•เธธ";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // เธชเนเธเนเธเธเธเธญเธฃเนเธก
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    if (!validateForm()) {
      // เน€เธฅเธทเนเธญเธเธซเธเนเธฒเธเธญเธฃเนเธกเนเธเธขเธฑเธเธเธธเธ”เธเธดเธ”เธเธฅเธฒเธ”เนเธฃเธเธชเธธเธ”
      const firstErrorKey = Object.keys(formErrors)[0];
      const element = document.getElementsByName(firstErrorKey)[0] || document.getElementById(firstErrorKey);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    try {
      setIsSubmitting(true);
      
      // 1. เธญเธฑเธเนเธซเธฅเธ”เธฃเธนเธเธ เธฒเธเนเธเธขเธฑเธ Supabase Storage
      setSubmitStep("เธเธณเธฅเธฑเธเธญเธฑเธเนเธซเธฅเธ”เธฃเธนเธเธ เธฒเธเธซเธฅเธฑเธเธเธฒเธ...");
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

      // 2. เธ”เธถเธเธ—เธตเนเธญเธขเธนเนเธฃเธนเธเธ เธฒเธ URL เธชเธฒเธเธฒเธฃเธ“เธฐ
      setSubmitStep("เธเธณเธฅเธฑเธเน€เธ•เธฃเธตเธขเธกเธเนเธญเธกเธนเธฅเนเธเนเธเธเนเธญเธก...");
      const { data: { publicUrl } } = supabase.storage
        .from("report-images")
        .getPublicUrl(fileName);

      // 3. เธชเธฃเนเธฒเธเธเนเธญเธกเธนเธฅเธฅเธเธ•เธฒเธฃเธฒเธ reports
      setSubmitStep("เธเธณเธฅเธฑเธเธฅเธเธ—เธฐเน€เธเธตเธขเธเธเนเธญเธกเธนเธฅเน€เธเนเธฒเธฃเธฐเธเธ...");
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
      if (!res.ok) throw new Error(resJson.error || "เธเธฒเธฃเธฅเธเธเนเธญเธกเธนเธฅเธฅเนเธกเน€เธซเธฅเธง");

      setSubmitStep("เน€เธชเธฃเนเธเธชเธดเนเธเธเธฒเธฃเธชเนเธเน€เธฃเธทเนเธญเธเธชเธณเน€เธฃเนเธ!");
      // เธญเธฑเธเน€เธ”เธ•เธเนเธญเธกเธนเธฅเธชเธ–เธฒเธเธฐเน€เธชเธฃเนเธเธชเธดเนเธเธเธฒเธฃเธขเธทเนเธเน€เธฃเธทเนเธญเธ
      setSubmittedReport(resJson.data || (newReportData as unknown as Report));
      setIsSubmitting(false);

    } catch (err: any) {
      console.error("เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”เธเธฒเธฃเธฃเนเธญเธเน€เธฃเธตเธขเธ:", err);
      setGlobalError(err.message || "เธเธฒเธฃเน€เธเธทเนเธญเธกเธ•เนเธญเธเธฒเธเธเนเธญเธกเธนเธฅเธฅเนเธกเน€เธซเธฅเธง เธเธฃเธธเธ“เธฒเธฅเธญเธเนเธซเธกเนเธญเธตเธเธเธฃเธฑเนเธ");
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
    <main className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center py-0 md:py-8 transition-colors duration-300">
      {/* เธญเธธเธเธเธฃเธ“เนเธเธณเธฅเธญเธ Mobile Mockup เนเธเธเธญเธเธญเธกเธเธดเธงเน€เธ•เธญเธฃเน เนเธฅเธฐเนเธชเธ”เธเธเธฅเน€เธ•เนเธกเธเธญเธเธเธ•เธดเนเธเธเธญเนเธกเธเธฒเธขเธฅเน */}
      <div className="w-full max-w-md min-h-screen md:min-h-[820px] md:max-h-[880px] md:rounded-[36px] bg-white dark:bg-gray-900 md:shadow-2xl border-0 md:border-6 md:border-slate-800 dark:md:border-slate-800 overflow-y-auto flex flex-col relative animate-scale-up">
        
        {/* เธชเนเธงเธเธซเธฑเธงเธเธ“เธฐเนเธฅเธฐเธ•เธฃเธฒเธชเธฑเธเธฅเธฑเธเธฉเธ“เนเธเธ“เธฐเธชเธฑเธเธเธกเธจเธฒเธชเธ•เธฃเน */}
        <header className="flex flex-col items-center pt-8 pb-5 px-6 text-center border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
          {/* เธ•เธฃเธฒเธชเธฑเธเธฅเธฑเธเธฉเธ“เนเน€เธงเธเน€เธ•เธญเธฃเน SVG เธเธ“เธฐเธชเธฑเธเธเธกเธจเธฒเธชเธ•เธฃเน */}
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3 shadow-inner text-primary">
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
              <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="2.5" strokeDasharray="3 3"/>
              <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="1" />
              <path d="M50 20C33.4315 20 20 33.4315 20 50C20 66.5685 33.4315 80 50 80C66.5685 80 80 66.5685 80 50C80 33.4315 66.5685 20 50 20Z" stroke="currentColor" strokeWidth="2.5" />
              <path d="M20 50H80" stroke="currentColor" strokeWidth="1.5" />
              <path d="M30 35H70" stroke="currentColor" strokeWidth="1" />
              <path d="M30 65H70" stroke="currentColor" strokeWidth="1" />
              <path d="M50 20C55 30 58 40 58 50C58 60 55 70 50 80C45 70 42 60 42 50C42 40 45 30 50 20Z" stroke="currentColor" strokeWidth="1.5" />
              <path d="M50 35V65" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
              <circle cx="50" cy="30" r="4" fill="currentColor" />
            </svg>
          </div>
          
          <span className="text-[10px] tracking-widest font-bold text-primary uppercase">Faculty of Social Sciences</span>
          <h1 className="text-base font-extrabold text-gray-900 dark:text-white mt-0.5">เธเธ“เธฐเธชเธฑเธเธเธกเธจเธฒเธชเธ•เธฃเน</h1>
          <p className="text-[10px] text-gray-400">SOC One Stop Reporting System</p>
          <div className="text-[10px] text-gray-600 dark:text-gray-300 mt-2 font-bold bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-gray-100 dark:border-slate-800 shadow-sm">
            เธฃเธฐเธเธเนเธเนเธเธเนเธญเธกเนเธฅเธฐเธฃเธฒเธขเธเธฒเธเธเธฑเธเธซเธฒเธญเธญเธเนเธฅเธเน
          </div>
        </header>

        {/* เธ•เธฃเธงเธเธชเธญเธเธเนเธญเธเธดเธ”เธเธฅเธฒเธ”เธชเธฒเธเธฅ */}
        {globalError && (
          <div className="mx-6 mt-4 p-4.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2 animate-fade-in shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4.5 h-4.5 shrink-0 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <div>
              <span className="font-bold block">เธเธฑเธเธ—เธถเธเธฅเนเธกเน€เธซเธฅเธง</span>
              {globalError}
            </div>
          </div>
        )}

        {/* 1. เธชเธ–เธฒเธเธฐเธเธฃเธฐเธกเธงเธฅเธเธฅเธเธฒเธฃเธชเนเธเธเนเธญเธกเธนเธฅ */}
        {isSubmitting ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6 animate-scale-up">
            <div className="relative w-14 h-14">
              <div className="w-14 h-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">เธเธณเธฅเธฑเธเธ”เธณเน€เธเธดเธเธเธฒเธฃ</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">{submitStep}</p>
            </div>
          </div>
        ) : submittedReport ? (
          
          /* 2. เธชเธ–เธฒเธเธฐเธขเธทเนเธเน€เธฃเธทเนเธญเธเธชเธณเน€เธฃเนเธเน€เธชเธฃเนเธเธชเธดเนเธ (Success Details State) */
          <div className="flex-1 flex flex-col p-6 animate-scale-up justify-between">
            <div className="space-y-5">
              {/* เธชเธฑเธเธฅเธฑเธเธฉเธ“เนเธเธงเธฒเธกเธชเธณเน€เธฃเนเธ */}
              <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              
              <div className="text-center space-y-1">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">เธชเนเธเน€เธฃเธทเนเธญเธเนเธเนเธเธเนเธญเธกเน€เธชเธฃเนเธเธชเธดเนเธ!</h2>
                <p className="text-xs text-gray-400 leading-normal">
                  เน€เธฃเธทเนเธญเธเธเธญเธเธเธธเธ“เธ–เธนเธเธชเนเธเนเธเธขเธฑเธเธเนเธฒเธขเธชเธเธฑเธเธชเธเธธเธเธญเธฒเธเธฒเธฃเธชเธ–เธฒเธเธ—เธตเนเธเธญเธเธเธ“เธฐเธชเธฑเธเธเธกเธจเธฒเธชเธ•เธฃเนเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง
                </p>
              </div>

              {/* เธเธฒเธฃเนเธ”เนเธชเธ”เธเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธเธฑเธเธซเธฒเธ—เธตเนเธชเนเธเธชเธณเน€เธฃเนเธ */}
              <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-slate-950/40 p-4.5 text-left space-y-3.5 shadow-sm">
                
                {/* เธฃเธซเธฑเธชเธเธฒเธฃเธขเธทเนเธเธเธณเธฃเนเธญเธ */}
                <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-2">
                  <div>
                    <span className="text-[10px] text-gray-400 block">เธฃเธซเธฑเธชเธฃเธฑเธเน€เธฃเธทเนเธญเธ</span>
                    <span className="font-extrabold text-sm text-gray-900 dark:text-white">{submittedReport.public_id}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 block">เธชเธ–เธฒเธเธฐเธเธฑเธเธเธธเธเธฑเธ</span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">
                      <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse"></span>
                      เธขเธทเนเธเน€เธฃเธทเนเธญเธเนเธฅเนเธง
                    </span>
                  </div>
                </div>

                {/* เธฃเธนเธเธ•เธฑเธงเธญเธขเนเธฒเธ */}
                {submittedReport.image_url && (
                  <div className="relative rounded-xl overflow-hidden aspect-video border border-gray-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={submittedReport.image_url} alt="เธฃเธนเธเธ เธฒเธเธซเธฅเธฑเธเธเธฒเธเธ—เธตเนเธญเธฑเธเนเธซเธฅเธ”" className="w-full h-full object-cover" />
                  </div>
                )}

                {/* เธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เน€เธเธทเนเธญเธซเธฒเนเธเธเธญเธฃเนเธกเธชเธณเน€เธฃเนเธ */}
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-gray-400 block">เธซเธกเธงเธ”เธซเธกเธนเนเธเธฑเธเธซเธฒ</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      {CATEGORY_DETAILS[submittedReport.category]?.icon} {CATEGORY_DETAILS[submittedReport.category]?.label}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">เธชเธ–เธฒเธเธ—เธตเนเน€เธเธดเธ”เน€เธซเธ•เธธ</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200 leading-snug">{submittedReport.location}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">เธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธเธญเธเธเธฑเธเธซเธฒ</span>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3 bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-100 dark:border-slate-800 mt-0.5">
                      {submittedReport.description}
                    </p>
                  </div>
                  
                  <div className="border-t border-gray-100 dark:border-slate-800 pt-2 grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <span className="text-gray-400 block">เธเธทเนเธญเธเธนเนเนเธเนเธ</span>
                      <span className="font-medium text-gray-700 dark:text-gray-300 truncate block">{submittedReport.reporter_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">เธญเธตเน€เธกเธฅเธ•เธดเธ”เธ•เนเธญเธเธฅเธฑเธ</span>
                      <span className="font-medium text-gray-700 dark:text-gray-300 truncate block">{submittedReport.email}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* เธชเนเธงเธเธเธฑเธ”เธฅเธญเธเนเธ—เน€เธเนเธเธชเธณเธซเธฃเธฑเธเธ•เธดเธ”เธ•เธฒเธกเธ—เธตเธซเธฅเธฑเธ */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-gray-400 font-bold block text-left">เธฅเธดเธเธเนเธ•เธฃเธงเธเธชเธญเธเธชเธ–เธฒเธเธฐเธขเนเธญเธเธซเธฅเธฑเธ</span>
                <div className="flex gap-2">
                  <div className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-mono text-left text-slate-700 dark:text-slate-300 select-all truncate flex items-center">
                    {submittedReport.public_id}
                  </div>
                  <button
                    onClick={handleCopyLink}
                    className={`px-3 py-2 rounded-xl text-xs font-bold text-white transition-all shrink-0 cursor-pointer ${
                      copied 
                        ? "bg-emerald-600 shadow-md shadow-emerald-500/10" 
                        : "bg-primary hover:bg-primary-hover shadow-md shadow-primary/10"
                    }`}
                  >
                    {copied ? "เธเธฑเธ”เธฅเธญเธเธชเธณเน€เธฃเนเธ" : "เธเธฑเธ”เธฅเธญเธเธฅเธดเธเธเน"}
                  </button>
                </div>
              </div>
            </div>

            {/* เธเธธเนเธกเธเธณเธ—เธฒเธเธขเนเธญเธเธเธฅเธฑเธ */}
            <div className="space-y-2.5 pt-4 mt-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
              <button
                onClick={resetForm}
                className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold transition-all text-xs cursor-pointer text-center"
              >
                เธขเธทเนเธเธฃเธฒเธขเธเธฒเธเธเนเธญเธกเธเธฑเธเธซเธฒเน€เธเธดเนเธกเธญเธตเธเน€เธฃเธทเนเธญเธ
              </button>
              
              <Link
                href={`/track/${submittedReport.public_id}`}
                className="w-full block py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold transition-all text-xs cursor-pointer text-center shadow-md shadow-primary/15"
              >
                เธ”เธนเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธเธงเธฒเธกเธเธทเธเธซเธเนเธฒเน€เธเธดเธเธฅเธถเธ
              </Link>
            </div>
          </div>
        ) : (
          
          /* 3. เธซเธเนเธฒเธเธญเธฃเนเธกเธซเธฅเธฑเธเธชเธณเธซเธฃเธฑเธเธเธฒเธฃเนเธเนเธเธเธฑเธเธซเธฒ (Form State) */
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
            
            {/* เธชเนเธงเธเธชเธ–เธดเธ•เธดเธขเนเธญเธขเนเธเธเน€เธเธตเธขเธเน */}
            <div className="px-3.5 py-2.5 bg-primary-light dark:bg-primary-light/5 rounded-xl border border-primary/10 flex items-center justify-between text-[10px] shrink-0">
              <span className="text-gray-500">เธชเธ–เธดเธ•เธดเธเธ“เธฐเธชเธฑเธเธเธกเธจเธฒเธชเธ•เธฃเน</span>
              <span className="font-semibold text-primary">
                เธขเธทเนเธเนเธฅเนเธง {totalCount} เน€เธฃเธทเนเธญเธ โ€ข เนเธเนเนเธเน€เธชเธฃเนเธเธชเธดเนเธ {resolvedCount} เน€เธฃเธทเนเธญเธ
              </span>
            </div>

            {/* เธเธฅเนเธญเธเธญเธฑเธเนเธซเธฅเธ”เธฃเธนเธเธซเธฅเธฑเธเธเธฒเธ */}
            <div className="space-y-2 shrink-0">
              <label className="block text-xs font-bold text-gray-900 dark:text-white">
                เธญเธฑเธเนเธซเธฅเธ”เธฃเธนเธเธ–เนเธฒเธขเธซเธฅเธฑเธเธเธฒเธเธเธธเธ”เน€เธเธดเธ”เน€เธซเธ•เธธ <span className="text-primary">*</span>
              </label>
              
              {imagePreview ? (
                <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-950 aspect-video group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="เธ เธฒเธเธเธณเธฅเธญเธเธเธฑเธเธซเธฒ"
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2.5 right-2.5 p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full transition-colors shadow shadow-rose-900/10 cursor-pointer"
                    title="เน€เธเธฅเธตเนเธขเธเธฃเธนเธเธ เธฒเธ"
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
                  className={`border border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                    dragActive 
                      ? "border-primary bg-primary-light dark:bg-primary-light/5" 
                      : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-slate-50/20"
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                    </svg>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">เธเธ”เธญเธฑเธเนเธซเธฅเธ” เธซเธฃเธทเธญเธงเธฒเธเนเธเธฅเนเธฃเธนเธเธ เธฒเธเธซเธฅเธฑเธเธเธฒเธ</p>
                    <p className="text-[10px] text-slate-400">เธฃเธนเธเธ เธฒเธเธเธเธฒเธ”เนเธกเนเน€เธเธดเธ 5MB</p>
                  </div>
                </div>
              )}
              {formErrors.image && (
                <p className="text-[10px] text-primary font-bold flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-primary"></span>
                  {formErrors.image}
                </p>
              )}
            </div>

            {/* เธชเนเธงเธเน€เธฅเธทเธญเธเธซเธกเธงเธ”เธซเธกเธนเน */}
            <div className="space-y-2 shrink-0">
              <label className="block text-xs font-bold text-gray-900 dark:text-white">
                เน€เธฅเธทเธญเธเธซเธกเธงเธ”เธซเธกเธนเนเธเธฑเธเธซเธฒ <span className="text-primary">*</span>
              </label>
              
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(CATEGORY_DETAILS).map(([key, details]) => {
                  const isSelected = category === key;
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => {
                        setCategory(key as ReportCategory);
                        setFormErrors(prev => {
                          const copy = { ...prev };
                          delete copy.category;
                          return copy;
                        });
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary-light dark:bg-primary-light/5 ring-1 ring-primary shadow-sm"
                          : "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-200 dark:hover:border-gray-800"
                      }`}
                    >
                      <span className="text-xl shrink-0">{details.icon}</span>
                      <div className="truncate">
                        <span className="text-[11px] font-bold text-gray-900 dark:text-white block">
                          {details.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {formErrors.category && (
                <p className="text-[10px] text-primary font-bold flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-primary"></span>
                  {formErrors.category}
                </p>
              )}
            </div>

            {/* เธชเนเธงเธเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธชเธ–เธฒเธเธ—เธตเนเนเธฅเธฐเน€เธซเธ•เธธเธเธฒเธฃเธ“เน */}
            <div className="space-y-4">
              {/* เธชเธ–เธฒเธเธ—เธตเนเน€เธเธดเธ”เน€เธซเธ•เธธ */}
              <div className="space-y-1.5">
                <label htmlFor="location" className="block text-xs font-bold text-gray-900 dark:text-white">
                  เธชเธ–เธฒเธเธ—เธตเนเน€เธเธดเธ”เน€เธซเธ•เธธ / เธฃเธฐเธเธธเธเธดเธเธฑเธ”เนเธเธเธ“เธฐ <span className="text-primary">*</span>
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
                  placeholder="เน€เธเนเธ เธ•เธถเธ 1 เธเธฑเนเธ 3 เธซเนเธญเธเธเนเธณเธเธฑเนเธเธ•เธฐเธงเธฑเธเธญเธญเธ เธซเธฃเธทเธญเธฅเธฒเธเธเธญเธ”เธฃเธ–เนเธ•เนเธ”เธดเธ..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-950 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                {formErrors.location && (
                  <p className="text-[10px] text-primary font-bold flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-primary"></span>
                    {formErrors.location}
                  </p>
                )}
              </div>

              {/* เธเธณเธญเธเธดเธเธฒเธขเน€เธฃเธทเนเธญเธเธฃเนเธญเธเน€เธฃเธตเธขเธ */}
              <div className="space-y-1.5">
                <label htmlFor="description" className="block text-xs font-bold text-gray-900 dark:text-white">
                  เธฃเธฐเธเธธเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธชเธดเนเธเธเธณเธฃเธธเธ”เธซเธฃเธทเธญเน€เธฃเธทเนเธญเธเธฃเนเธญเธเธ—เธธเธเธเน <span className="text-primary">*</span>
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
                  placeholder="เน€เธเนเธ เธซเธฅเธญเธ”เนเธเธเธฃเธฐเธเธฃเธดเธเนเธกเนเธชเธงเนเธฒเธเธ•เธฅเธญเธ”เน€เธงเธฅเธฒ, เธเธฒเธเธฃเธญเธเธ—เนเธญเธชเธฑเนเธเธเธฅเธญเธเธเธฅเธฑเธงเนเธ•เธเธซเธฑเธเธเธณเธฃเธธเธ”เธ•เธญเธเธฃเธ–เธ—เธฑเธ..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-950 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none min-h-[90px]"
                />
                {formErrors.description && (
                  <p className="text-[10px] text-primary font-bold flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-primary"></span>
                    {formErrors.description}
                  </p>
                )}
              </div>
            </div>

            {/* เธชเนเธงเธเธเธฃเธญเธเธเนเธญเธกเธนเธฅเธชเนเธงเธเธ•เธฑเธงเธเธนเนเนเธเนเธ (เธเธงเธฒเธกเธฅเธฑเธ) */}
            <div className="p-4 rounded-2xl border border-gray-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 space-y-3 shrink-0">
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block">
                เธเนเธญเธกเธนเธฅเธ•เธดเธ”เธ•เนเธญเธเธนเนเธฃเธฒเธขเธเธฒเธ (เธเนเธญเธกเธนเธฅเธเธฐเธ–เธนเธเธเธดเธ”เน€เธเนเธเธเธงเธฒเธกเธฅเธฑเธ)
              </span>
              
              <div className="space-y-2.5">
                <div className="space-y-1">
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
                    placeholder="เธเธฃเธญเธเธเธทเนเธญ-เธเธฒเธกเธชเธเธธเธฅ เธเธญเธเธ—เนเธฒเธ"
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 text-xs focus:outline-none focus:border-primary"
                  />
                  {formErrors.reporterName && (
                    <p className="text-[10px] text-primary font-medium">{formErrors.reporterName}</p>
                  )}
                </div>

                <div className="space-y-1">
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
                    placeholder="เธเธฃเธญเธเธญเธตเน€เธกเธฅเธชเธณเธซเธฃเธฑเธเธชเนเธเธฅเธดเธเธเนเนเธฅเธฐเนเธเนเธเธชเธ–เธฒเธเธฐ"
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 text-xs focus:outline-none focus:border-primary"
                  />
                  {formErrors.email && (
                    <p className="text-[10px] text-primary font-medium">{formErrors.email}</p>
                  )}
                </div>
              </div>
            </div>

            {/* เธเธธเนเธกเธชเธณเธซเธฃเธฑเธเธขเธทเธเธขเธฑเธเนเธฅเธฐเธชเนเธเน€เธฃเธทเนเธญเธเธฃเนเธญเธเน€เธฃเธตเธขเธ */}
            <button
              type="submit"
              className="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold transition-all text-xs flex items-center justify-center gap-2 shadow-md shadow-primary/10 hover:shadow-primary/20 shrink-0 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
              เธขเธทเนเธเน€เธฃเธทเนเธญเธเนเธเนเธเธเนเธญเธกเน€เธเนเธฒเธฃเธฐเธเธ
            </button>
          </form>
        )}

        {/* เนเธ–เธเธฅเธดเธเธเนเธ•เธฃเธงเธเธชเธญเธเธชเธ–เธฒเธเธฐเธ”เนเธฒเธเธฅเนเธฒเธเธชเธธเธ”เธเธญเธเน€เธเธฃเธกเธกเธทเธญเธ–เธทเธญ */}
        {!submittedReport && !isSubmitting && (
          <footer className="pt-2 pb-4 text-center shrink-0 border-t border-gray-50 dark:border-gray-800">
            <Link
              href="/track/lookup"
              className="inline-flex items-center gap-1.5 text-[10px] font-bold text-gray-500 hover:text-primary transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.375M9 9h3.75M16.5 12A8.25 8.25 0 1 1 8.25 3.75 8.25 8.25 0 0 1 16.5 12Z" />
              </svg>
              เธกเธตเธฃเธซเธฑเธชเธ•เธดเธ”เธ•เธฒเธกเธญเธขเธนเนเนเธฅเนเธง? เธ•เธฃเธงเธเธชเธญเธเธชเธ–เธฒเธเธฐเธขเนเธญเธเธซเธฅเธฑเธ
            </Link>
          </footer>
        )}

      </div>
    </main>
  );
}
