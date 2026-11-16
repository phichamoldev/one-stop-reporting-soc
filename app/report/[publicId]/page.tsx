"use client";

import React, { use, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AppNavbar } from "@/components/shared/AppNavbar";
import { AppContainer } from "@/components/design-system/AppContainer";
import { PageShell } from "@/components/shared/PageShell";
import { AppButton } from "@/components/design-system/AppButton";
import { supabase } from "@/lib/supabase";
import { Report } from "@/types/report";
import { GlobalFooter } from "@/components/shared/GlobalFooter";
import { usePublicStaffAuth } from "@/hooks/usePublicStaffAuth";
import {
  ReportHeaderCard,
  ReportInfoCard,
  ActivityTimelineCard,
  ReporterInfoCard,
  buildTimelineEntries,
} from "@/components/report-detail/ReportDetailBlocks";
import { StaffActionCard } from "@/components/report-detail/StaffActionCard";
import { FileText, X } from "lucide-react";

interface ReportDetailPageProps {
  params: Promise<{
    publicId: string;
  }>;
}

export default function ReportDetailPage({ params }: ReportDetailPageProps) {
  const { publicId } = use(params);

  const [report, setReport] = useState<Report | null>(null);
  const [canManage, setCanManage] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { user, profile, loading: authLoading } = usePublicStaffAuth();
  const [isStaffModeDismissed, setIsStaffModeDismissed] = useState(false);
  const isStaffActive = Boolean(user && profile && !isStaffModeDismissed);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [updateStatus, setUpdateStatus] = useState<string>("pending");
  const [departments, setDepartments] = useState<{ id: number; name_th: string }[]>([]);
  const [updateDepartmentId, setUpdateDepartmentId] = useState<number | "">("");
  const [updateRemark, setUpdateRemark] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [completionImage, setCompletionImage] = useState<File | null>(null);
  const [completionImagePreview, setCompletionImagePreview] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(true);

  const fetchReport = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`/api/reports/${publicId}`, { headers });
      const result = await res.json();

      if (!res.ok) {
        console.error("เกิดข้อผิดพลาดจาก API:", result.error);
        setError("ไม่พบข้อมูลรายงานที่สืบค้น กรุณาตรวจสอบรหัสติดตามอีกครั้ง");
        return;
      }

      const data = result.report;
      if (!data) {
        setError("ไม่พบข้อมูลรายงานที่สืบค้น กรุณาตรวจสอบรหัสติดตามอีกครั้ง");
        setReport(null);
        return;
      }

      setReport(data as Report);
      setCanManage(result.canManage || false);
    } catch (err: any) {
      console.error("เกิดข้อผิดพลาดในการดึงข้อมูล:", err);
      setError("การเชื่อมต่อฐานข้อมูลล้มเหลว กรุณาลองใหม่อีกครั้ง");
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [publicId]);

  useEffect(() => {
    if (publicId) {
      fetchReport();
    }
  }, [publicId, fetchReport]);

  useEffect(() => {
    if (user && publicId) {
      fetchReport(true);
    }
  }, [user, publicId, fetchReport]);

  useEffect(() => {
    if (profile && profile.role !== "staff" && departments.length === 0) {
      fetch("/api/departments")
        .then((r) => r.json())
        .then((d) => {
          if (d.departments) setDepartments(d.departments);
        })
        .catch(console.error);
    }
  }, [profile, departments.length]);

  useEffect(() => {
    if (report) {
      setUpdateStatus(report.status);
      setUpdateRemark("");
      setIsEditMode(true);
    }
  }, [report?.id]);

  const handleLogin = async () => {
    setLoginError(null);
    if (!loginEmail || !loginPassword) {
      setLoginError("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }
    setIsLoggingIn(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) throw error;
      setIsStaffModeDismissed(false);
      setLoginPassword("");
      await fetchReport(true);
    } catch (err: any) {
      setLoginError(err.message || "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const isStatusChanged = Boolean(
    report && updateStatus && updateStatus !== "" && (updateStatus === "transfer" || updateStatus !== report.status)
  );
  const isRemarkChanged = Boolean(report && (updateRemark || "").trim() !== (report.admin_remark || "").trim());
  const hasImageChange = Boolean(completionImage);
  const hasRemark = Boolean((updateRemark || "").trim().length > 0);
  const hasAnyChange = isStatusChanged || isRemarkChanged || hasRemark || hasImageChange;

  const handleSave = async () => {
    if (!report) return;

    if (!isStaffActive) {
      if (user && profile) {
        setIsStaffModeDismissed(false);
      }
      return;
    }

    if (!hasAnyChange) {
      setSaveMessage({ type: "error", text: "กรุณาเลือกสถานะใหม่ หรือพิมพ์ข้อความตอบกลับ" });
      return;
    }

    if (updateStatus === "transfer" && !updateDepartmentId) {
      setSaveMessage({ type: "error", text: "กรุณาเลือกหน่วยงานปลายทาง" });
      return;
    }

    setSaveMessage(null);
    setIsSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      let publicUrl: string | null = null;
      if (updateStatus === "completed") {
        if (!completionImage && completionImagePreview && completionImagePreview.startsWith("http")) {
          publicUrl = completionImagePreview;
        }

        if (completionImage) {
          const fileExt = completionImage.name.split(".").pop();
          const randomFileToken = Math.random().toString(36).substring(2, 12);
          const fileName = `${Date.now()}-${randomFileToken}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from("report-images")
            .upload(fileName, completionImage, { cacheControl: "3600", upsert: false });

          if (uploadError) throw new Error("อัปโหลดรูปภาพไม่สำเร็จ: " + uploadError.message);

          const { data: { publicUrl: url } } = supabase.storage
            .from("report-images")
            .getPublicUrl(fileName);

          publicUrl = url;
        }
      }

      const res = await fetch(`/api/reports/${publicId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          reportId: report.id,
          status: isStatusChanged || (updateStatus as string) === "transfer" ? updateStatus : undefined,
          remark: updateRemark,
          oldStatus: report.status,
          departmentId: (updateStatus as string) === "transfer" ? updateDepartmentId : undefined,
          imageUrl: updateStatus === "completed" ? publicUrl : undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update report");
      }

      setSaveMessage({ type: "success", text: "บันทึกข้อมูลเรียบร้อยแล้ว" });
      setUpdateDepartmentId("");
      setUpdateRemark("");
      if (updateStatus !== "completed") {
        setCompletionImage(null);
        setCompletionImagePreview(null);
      }
      await fetchReport(true);

      setTimeout(() => {
        setSaveMessage(null);
      }, 3000);
    } catch (err: any) {
      console.error("Save error:", err?.message || JSON.stringify(err) || err);
      setSaveMessage({
        type: "error",
        text: `เกิดข้อผิดพลาดในการบันทึกข้อมูล: ${err?.message || "Unknown Error"}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (report) {
      setUpdateStatus(report.status);
      setUpdateRemark("");
      setCompletionImage(null);
      setCompletionImagePreview(null);
      setSaveMessage(null);
    }
  };

  if (loading) {
    return (
      <AppContainer className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
          <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-xs text-slate-500 animate-pulse">กำลังโหลดข้อมูลคำร้อง...</p>
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
              <FileText className="w-7 h-7" />
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

  const timelineEntries = buildTimelineEntries(report, { includeInternal: true });

  const staffTopBar = isStaffActive ? (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
          {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "H"}
        </div>
        <div className="leading-tight">
          <span className="text-[13px] sm:text-[14px] font-bold text-slate-800 block">
            {profile?.full_name || "ผู้ดูแลระบบสูงสุด"}
          </span>
          <span className="text-[11px] sm:text-[12px] text-slate-400 font-medium">
            โหมดเจ้าหน้าที่
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          setIsStaffModeDismissed(true);
          setCanManage(false);
          setIsEditMode(false);
        }}
        className="text-[12px] sm:text-[13px] text-rose-600 hover:text-rose-700 font-medium cursor-pointer transition-colors"
      >
        ออกจากโหมดเจ้าหน้าที่
      </button>
    </div>
  ) : user && profile && isStaffModeDismissed ? (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">ออกจากโหมดเจ้าหน้าที่แล้ว</span>
      <button
        type="button"
        onClick={() => {
          setIsStaffModeDismissed(false);
          fetchReport(true);
        }}
        className="text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
      >
        กลับเข้าสู่โหมดเจ้าหน้าที่ ({profile.full_name})
      </button>
    </div>
  ) : null;

  return (
    <AppContainer>
      <AppNavbar />
      <PageShell>
        {/* Top Header Card matching Reference Image 2 */}
        <ReportHeaderCard
          report={report}
          eyebrow="เลขอ้างอิง"
          topBar={staffTopBar}
          step1Label="รอรับเรื่อง"
        />

        {/* 2-Column Grid (70/30 split) */}
        <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-5 items-start w-full min-w-0">
          {/* LEFT COLUMN (70%): Details + Timeline */}
          <div className="space-y-5 min-w-0 w-full">
            <ReportInfoCard report={report} onImageClick={setFullscreenImage} />
            <ActivityTimelineCard
              entries={timelineEntries}
              onImageClick={setFullscreenImage}
            />
          </div>

          {/* RIGHT COLUMN (30%): Action Card + Reporter Info */}
          <aside className="space-y-5 min-w-0 w-full lg:sticky lg:top-6">
            <StaffActionCard
              report={report}
              isStaffActive={isStaffActive}
              authLoading={authLoading}
              canManage={canManage}
              userRole={profile?.role}
              updateStatus={updateStatus}
              setUpdateStatus={setUpdateStatus}
              updateRemark={updateRemark}
              setUpdateRemark={setUpdateRemark}
              completionImage={completionImage}
              setCompletionImage={setCompletionImage}
              completionImagePreview={completionImagePreview}
              setCompletionImagePreview={setCompletionImagePreview}
              departments={departments}
              updateDepartmentId={updateDepartmentId}
              setUpdateDepartmentId={setUpdateDepartmentId}
              isSaving={isSaving}
              saveMessage={saveMessage}
              onSave={handleSave}
              onCancel={handleCancel}
              loginEmail={loginEmail}
              setLoginEmail={setLoginEmail}
              loginPassword={loginPassword}
              setLoginPassword={setLoginPassword}
              loginError={loginError}
              isLoggingIn={isLoggingIn}
              onLogin={handleLogin}
              isEditMode={isEditMode}
            />
            <ReporterInfoCard report={report} />
          </aside>
        </div>

        <div className="pt-2">
          <GlobalFooter />
        </div>
      </PageShell>

      {fullscreenImage &&
        createPortal(
          <div className="fixed inset-0 z-[1200] flex flex-col items-center justify-center p-4 lg:p-8">
            <div
              className="absolute inset-0 bg-black/95 backdrop-blur-sm"
              onClick={() => setFullscreenImage(null)}
            />
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute top-4 right-4 z-10 p-3 bg-white/10 hover:bg-white/25 text-white rounded-full transition-colors"
              title="ปิดรูปภาพ (Esc)"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="relative w-full h-full max-w-5xl flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fullscreenImage}
                alt="Report image"
                className="max-w-full max-h-[85vh] md:max-h-[90vh] object-contain rounded-lg shadow-2xl"
              />
            </div>
          </div>,
          document.body
        )}
    </AppContainer>
  );
}
