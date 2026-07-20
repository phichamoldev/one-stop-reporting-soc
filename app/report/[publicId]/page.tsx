"use client";

import React, { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AppNavbar } from "@/components/shared/AppNavbar";
import { AppContainer } from "@/components/design-system/AppContainer";
import { AppCard } from "@/components/design-system/AppCard";
import { StatusBadge } from "@/components/design-system/StatusBadge";
import { AppButton } from "@/components/design-system/AppButton";
import { supabase } from "@/lib/supabase";
import { Report, STATUS_DETAILS } from "@/types/report";
import { GlobalFooter } from "@/components/shared/GlobalFooter";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { AppSelect } from "@/components/ui/AppSelect";
import {
  Calendar,
  RefreshCcw,
  FileText,
  Tag,
  MapPin,
  Image as ImageIcon,
  User,
  Mail,
  Phone,
  Lock,
  CheckCircle2,
  Clock,
  X,
  LogOut,
  ArrowRightLeft
} from "lucide-react";

import { StaffAuthProvider } from "@/contexts/StaffAuthContext";

interface ReportDetailPageProps {
  params: Promise<{
    publicId: string;
  }>;
}

function ReportDetailPageContent({ params }: ReportDetailPageProps) {
  const { publicId } = use(params);

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { user, profile, loading: authLoading, signIn, signOut } = useStaffAuth();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setLoginError(null);
    if (!loginEmail || !loginPassword) {
      setLoginError("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }
    setIsLoggingIn(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) throw error;
      setShowLoginModal(false);
      setIsEditMode(true);
    } catch (err: any) {
      setLoginError(err.message);
    }
    setIsLoggingIn(false);
  };

  const [updateStatus, setUpdateStatus] = useState<string>("pending");
  const [departments, setDepartments] = useState<{id: number, name_th: string}[]>([]);
  const [updateDepartmentId, setUpdateDepartmentId] = useState<number | ''>('');
  const [updateRemark, setUpdateRemark] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [completedByProfile, setCompletedByProfile] = useState<{ full_name?: string, departments?: { name_th: string } } | null>(null);

  const fetchReport = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setError(null);

      const res = await fetch(`/api/reports/${publicId}`);
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
      if (data) {
        setReport(data as Report);
        if (data.completed_by) {
          try {
             // For now, we fetch staff via a secure endpoint or if not available, we can skip it.
             // I'll add GET /api/staff/[id] next
             const staffRes = await fetch(`/api/staff/${data.completed_by}`);
             if (staffRes.ok) {
                const staffData = await staffRes.json();
                if (staffData.profile) setCompletedByProfile(staffData.profile);
             }
          } catch (e) {
             console.error(e);
          }
        }
      }
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
    if (profile && profile.role !== "staff" && departments.length === 0) {
      fetch('/api/departments').then(r => r.json()).then(d => {
        if (d.departments) setDepartments(d.departments);
      }).catch(console.error);
    }
  }, [profile, departments.length]);

  useEffect(() => {
    if (report) {
      setUpdateStatus(report.status);
      setUpdateRemark(report.admin_remark || "");
    }
  }, [report]);

  const handleSave = async () => {
    if (!report || !user) return;

    const isStatusChanged = report.status !== updateStatus;
    const isRemarkChanged = (report.admin_remark || "") !== (updateRemark || "");

    if (updateStatus === 'transfer') {
      if (!updateDepartmentId) {
        setSaveMessage({ type: 'error', text: 'กรุณาเลือกหน่วยงานปลายทาง' });
        setIsSaving(false);
        return;
      }
    } else if (!isStatusChanged && !isRemarkChanged) {
      setIsEditMode(false);
      return;
    }

    setSaveMessage(null);
    setIsSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const res = await fetch(`/api/reports/${publicId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          reportId: report.id,
          status: isStatusChanged || (updateStatus as string) === 'transfer' ? updateStatus : undefined,
          remark: isRemarkChanged || (updateStatus as string) === 'transfer' ? updateRemark : undefined,
          oldStatus: report.status,
          departmentId: (updateStatus as string) === 'transfer' ? updateDepartmentId : undefined
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update report");
      }

      setSaveMessage({ type: 'success', text: 'บันทึกข้อมูลเรียบร้อยแล้ว' });
      setUpdateDepartmentId("");
      await fetchReport(true);

      setIsEditMode(false);

      setTimeout(() => {
        setSaveMessage(null);
      }, 3000);

    } catch (err: any) {
      console.error("Save error:", err?.message || JSON.stringify(err) || err);
      setSaveMessage({
        type: 'error',
        text: `เกิดข้อผิดพลาดในการบันทึกข้อมูล: ${err?.message || 'Unknown Error'}`
      });
    } finally {
      setIsSaving(false);
    }
  };

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

  const currentStatusInfo = STATUS_DETAILS[report.status] || STATUS_DETAILS.pending;
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      day: '2-digit', month: 'short', year: 'numeric',
    }) + ', ' + new Date(dateString).toLocaleTimeString('th-TH', {
      hour: '2-digit', minute: '2-digit'
    }) + ' น.';
  };

  const isCompleted = report.status === 'completed';

  const sortedLogs = [...(report.report_logs || [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <AppContainer maxWidthClass="lg:max-w-6xl">
      <div className="flex-1 flex flex-col overflow-y-auto bg-[#F4F6F8] min-h-screen">

        {/* 1. Header Section (นอก Card ตาม Reference Image) */}
        <div className="bg-white border-b border-slate-200">
          <div className="w-full p-6 md:p-8">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-[13px] text-slate-400 font-medium block mb-0.5">เลขอ้างอิง</span>
                <h1 className="text-[20px] font-bold text-slate-800 tracking-tight leading-none">{report.public_id}</h1>
              </div>
              <StatusBadge status={report.status} label={currentStatusInfo.label} />
            </div>

            <div className="flex flex-row items-center gap-4 pt-1 text-[11px] text-slate-400 font-normal">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                สร้าง: {formatDate(report.created_at)}
              </span>
              <span className="flex items-center gap-1.5">
                <RefreshCcw className="w-3 h-3" />
                อัปเดต: {formatDate(report.updated_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8 pb-12 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            
            {/* LEFT COLUMN */}
            <div className="lg:col-span-8 space-y-6">

              {/* 2. รายละเอียดการแจ้ง (Main Card with top border accent) */}
              <AppCard className="!p-0 border-[#EDF0F4] shadow-sm overflow-hidden border-t-[4px] border-t-primary rounded-[8px]">

            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-primary shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <h2 className="text-[16px] font-bold text-slate-800">รายละเอียดการแจ้ง</h2>
            </div>

            <div className="p-4 border-b border-slate-100 space-y-4">
              <div>
                <span className="text-[12px] text-slate-400 font-medium flex items-center gap-1.5 mb-1.5">

                  หมวดหมู่หลัก
                </span>
                <span className="text-[14px] font-medium text-slate-800 block ">{report.categories?.name_th || "-"}</span>
              </div>

              <div className="pt-1">
                <span className="text-[12px] text-slate-400 font-medium flex items-center gap-1.5 mb-1.5">

                  หมวดหมู่ย่อย
                </span>
                <span className="text-[14px] font-medium text-slate-800 block ">{report.subcategories?.name_th || "-"}</span>
              </div>
            </div>

            <div className="p-4 border-b border-slate-100">
              <div>
                <span className="text-[12px] text-slate-400 font-medium flex items-center gap-1.5 mb-1.5">

                  สถานที่
                </span>
                <span className="text-[14px] font-normal text-slate-700 block  leading-relaxed">{report.location || "-"}</span>
              </div>
            </div>

            <div className="p-4">
              <span className="text-[12px] text-slate-400 font-medium flex items-center gap-1.5 mb-2.5">

                รายละเอียด
              </span>
              <div className="bg-slate-50 rounded-xl p-4 ml-0 mt-2">
                <p className="text-[14px] font-normal text-slate-700 leading-loose whitespace-pre-wrap">
                  {report.description || "-"}
                </p>
              </div>
            </div>
          </AppCard>

          {/* 3. รูปภาพประกอบ */}
          {report.image_url && (
            <AppCard className="!p-0 border-[#EDF0F4] shadow-sm overflow-hidden rounded-[16px]">
              <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <h2 className="text-[16px] font-bold text-slate-800">รูปภาพประกอบ</h2>
              </div>
              <div className="p-4">
                <div className="relative rounded-xl overflow-hidden ring-1 ring-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={report.image_url} alt="รูปภาพประกอบ" className="w-full h-auto object-cover max-h-[500px]" />
                </div>
              </div>
            </AppCard>
          )}

          {/* 4. ข้อมูลผู้แจ้ง */}
          <AppCard className="!p-0 border-[#EDF0F4] shadow-sm overflow-hidden rounded-[16px]">
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                <User className="w-4 h-4" />
              </div>
              <h2 className="text-[16px] font-bold text-slate-800">ข้อมูลผู้แจ้ง</h2>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 shrink-0 border border-slate-100">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block mb-0.5">ชื่อผู้แจ้ง</span>
                  <span className="text-[14px] font-medium text-slate-700">{report.reporter_name || "-"}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 shrink-0 border border-slate-100">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block mb-0.5">อีเมล</span>
                  <span className="text-[14px] font-medium text-slate-700">{report.email || "-"}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 shrink-0 border border-slate-100">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block mb-0.5">เบอร์โทรศัพท์</span>
                  <span className="text-[14px] font-medium text-slate-700">{report.phone || "-"}</span>
                </div>
              </div>
            </div>
          </AppCard>
            </div>

            {/* RIGHT COLUMN */}
            <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6 lg:self-start">

              {/* 5. การดำเนินการของเจ้าหน้าที่ (STAFF SECTION) */}
              <div>
                <h3 className="text-[16px] font-bold text-slate-800 mb-4 px-1">
              {isCompleted && !isEditMode ? "ผลการดำเนินงาน" : "การดำเนินการของเจ้าหน้าที่"}
            </h3>

            {authLoading ? (
              <AppCard className="!p-4 border-[#EDF0F4] shadow-sm bg-white text-center rounded-[16px]">
                <div className="animate-pulse space-y-3 pt-2 pb-2">
                  <div className="w-12 h-12 bg-slate-100 rounded-full mx-auto"></div>
                  <div className="h-4 bg-slate-100 rounded w-1/3 mx-auto"></div>
                  <div className="h-3 bg-slate-100 rounded w-1/2 mx-auto mb-4"></div>
                  <div className="h-10 bg-slate-100 rounded-xl mx-auto max-w-xs mt-4"></div>
                </div>
              </AppCard>
            ) : isCompleted && !isEditMode ? (
              // COMPLETED SUMMARY CARD
              <div className="space-y-4">
                <AppCard className="!p-5 border-emerald-200 shadow-sm bg-white rounded-[16px]">
                  <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <span className="text-[14px] font-bold text-emerald-700 block">ดำเนินการเสร็จสิ้นแล้ว</span>
                      <span className="text-[12px] text-slate-500">
                        {formatDate(report.completed_at || report.updated_at)}
                      </span>
                    </div>
                    <div className="shrink-0">
                      {!user || !profile ? (
                        <button onClick={() => setShowLoginModal(true)} className="text-[12px] text-slate-400 hover:text-slate-600 font-medium flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                          <Lock className="w-3.5 h-3.5" /> เข้าสู่ระบบ
                        </button>
                      ) : (
                        <button onClick={() => setIsEditMode(true)} className="text-[12px] text-slate-500 hover:text-slate-700 font-medium flex items-center justify-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                          [ แก้ไขข้อมูล ]
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <span className="text-[11px] text-slate-400 font-medium block mb-1">ผู้ดำเนินการ</span>
                      <span className="text-[13px] font-bold text-slate-700 block">{completedByProfile?.full_name || "เจ้าหน้าที่"}</span>
                      <span className="text-[12px] text-slate-500">{completedByProfile?.departments?.name_th || "-"}</span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 font-medium block mb-2">หมายเหตุสรุปผล</span>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-[13px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {report.admin_remark || <span className="italic text-slate-400">ไม่มีการระบุหมายเหตุเพิ่มเติม</span>}
                      </div>
                    </div>
                  </div>
                </AppCard>
              </div>
            ) : !user || !profile ? (
              // Mode A: Not Authenticated
              <AppCard className="!p-4 border-[#EDF0F4] shadow-sm bg-white text-center rounded-[16px]">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-slate-100 mt-2">
                  <Lock className="w-5 h-5 text-slate-400" />
                </div>
                <h4 className="text-[16px] font-bold text-slate-800 mb-1">เข้าสู่ระบบสำหรับเจ้าหน้าที่</h4>
                <p className="text-[13px] text-slate-500 mb-5">กรุณายืนยันตัวตนก่อนดำเนินการจัดการคำร้อง</p>

                {loginError && (
                  <div className="max-w-xs mx-auto mb-4 p-3 bg-red-50 text-red-600 text-[12px] font-medium rounded-xl border border-red-100 text-left">
                    {loginError}
                  </div>
                )}

                <div className="max-w-xs mx-auto space-y-3 mb-5 text-left">
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="อีเมล"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-[14px] bg-slate-50 outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="รหัสผ่าน"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-[14px] bg-slate-50 outline-none focus:ring-2 focus:ring-primary/20"
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                </div>

                <div className="max-w-xs mx-auto mb-2">
                  <AppButton fullWidth onClick={handleLogin} variant="primary" disabled={isLoggingIn}>
                    {isLoggingIn ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
                  </AppButton>
                </div>
              </AppCard>
            ) : (
              <AppCard className="!p-0 border-primary/20 shadow-sm overflow-hidden ring-1 ring-primary/10 rounded-[16px]">
                {/* Mode B Profile Header */}
                <div className="p-3 bg-primary/5 border-b border-primary/10 flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold text-[13px] uppercase">
                    {profile.full_name ? profile.full_name.substring(0, 2) : "จน"}
                  </div>
                  <div>
                    <span className="text-[13px] font-bold text-slate-800 block leading-tight">{profile.full_name}</span>
                    <span className="text-[11px] text-primary font-medium">{profile.departments?.name_th } {profile.role}</span>
                  </div>
                  <button onClick={() => { signOut(); setIsEditMode(false); }} className="ml-auto text-[11px] text-slate-500 hover:text-slate-700 underline font-medium px-2">
                    ออกจากระบบ
                  </button>
                </div>

                <div className="p-4 space-y-5 bg-white">
                  {!(["super_admin", "admin", "manager"].includes(profile.role) || profile.department_id === report.categories?.department_id) ? (
                    <div className="bg-red-50 text-red-800 p-4 rounded-xl border border-red-200 text-[13px] font-medium flex items-center gap-3">
                      <Lock className="w-5 h-5 text-red-600 shrink-0" />
                      คุณไม่มีสิทธิ์จัดการคำร้องนี้ เนื่องจากไม่ได้อยู่ในหน่วยงานที่รับผิดชอบ
                    </div>
                  ) : (
                    // Mode B: Authenticated / Editing
                    <div className="space-y-4 animate-fade-in">
                      {isCompleted && (
                        <div className="bg-amber-50 text-amber-800 p-3 rounded-xl border border-amber-200 text-[13px] font-medium flex items-start gap-2.5">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-amber-600 shrink-0 mt-0.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div>
                            <span className="block font-bold mb-0.5">คำร้องนี้เสร็จสิ้นแล้ว</span>
                            คุณกำลังแก้ไขข้อมูลคำร้องที่ถูกทำเครื่องหมายว่าเสร็จสิ้นไปแล้ว การเปลี่ยนสถานะอาจมีผลกับไทม์ไลน์
                          </div>
                        </div>
                      )}
                      {saveMessage && (
                        <div className={`p-3 rounded-xl text-[13px] font-medium border ${saveMessage.type === 'success'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                          {saveMessage.text}
                        </div>
                      )}
                      <div>
                        <label className="text-[12px] text-slate-700 font-bold block mb-2">เปลี่ยนสถานะคำร้อง</label>
                        <AppSelect
                          value={updateStatus}
                          onChange={(val) => setUpdateStatus(val as string)}
                          disabled={isSaving}
                          options={[
                            { label: "รอรับเรื่อง", value: "pending" },
                            { label: "กำลังดำเนินการ", value: "in_progress" },
                            { label: "ดำเนินการเสร็จสิ้น", value: "completed" },
                            { label: "ปฏิเสธคำร้อง", value: "rejected" },
                            { label: "ยกเลิกรายการ", value: "cancelled" },
                            ...(profile?.role !== 'staff' ? [{ label: 'โอนคำร้อง', value: 'transfer' }] : [])
                          ]}
                        />
                      </div>
                      
                      {updateStatus === 'transfer' && (
                        <div>
                          <label className="text-[12px] text-slate-700 font-bold block mb-2">โอนคำร้องไปยังหน่วยงาน</label>
                          <AppSelect
                            value={updateDepartmentId.toString()}
                            onChange={(val) => setUpdateDepartmentId(Number(val))}
                            disabled={isSaving}
                            options={[
                              { label: 'เลือกหน่วยงาน...', value: '' },
                              ...departments
                                .filter(d => d.id !== report.categories?.department_id)
                                .map(d => ({ label: d.name_th, value: d.id.toString() }))
                            ]}
                          />
                        </div>
                      )}
                      
                      <div>
                        <label className="text-[12px] text-slate-700 font-bold block mb-2">บันทึกข้อความภายใน</label>
                        <textarea
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[14px] bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none min-h-[100px] resize-y disabled:opacity-50"
                          placeholder="เพิ่มรายละเอียดการดำเนินการ หรือหมายเหตุสำหรับเจ้าหน้าที่..."
                          value={updateRemark}
                          onChange={(e) => setUpdateRemark(e.target.value)}
                          disabled={isSaving}
                        ></textarea>
                      </div>
                      <div className="sticky bottom-4 z-10 pt-1">
                        <AppButton
                          fullWidth
                          variant="primary"
                          className="shadow-md shadow-primary/10 text-[14px] py-2.5"
                          onClick={handleSave}
                          disabled={isSaving}
                        >
                          {isSaving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                        </AppButton>
                      </div>
                    </div>
                  )}
                </div>
              </AppCard>
            )}
          </div>

              {/* 6. TIMELINE SECTION */}
              <AppCard className="!p-5 md:!p-6 border-[#EDF0F4] shadow-sm bg-white rounded-[16px]">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <h3 className="text-[16px] font-bold text-slate-800">ประวัติการดำเนินงาน</h3>
                </div>
                <div className="bg-slate-100 text-slate-500 text-[11px] px-3 py-1 rounded-full font-medium shrink-0">
                  {sortedLogs.length} รายการ
                </div>
              </div>

              <div className="pl-2 pr-1">
                <div className="relative border-l-[1px] border-slate-200 ml-[15px] space-y-8 pb-4">
                  {sortedLogs.length === 0 ? (
                    <p className="text-[13px] text-slate-400 pl-8">ยังไม่มีประวัติการดำเนินงาน</p>
                  ) : sortedLogs.map((log, idx) => {
                    const isActive = idx === 0;
                    const statusInfo = log.action === 'transfer' ? { label: "โอนคำร้อง" } : (STATUS_DETAILS[log.new_status] || { label: log.action || "อัปเดต" });
                    // Use the actual staff full_name if available
                    const staffName = log.action === "created" 
                      ? "ระบบ" 
                      : (log.staff_users?.full_name || "เจ้าหน้าที่");

                    let Icon = Clock;
                    if (log.new_status === 'in_progress') Icon = RefreshCcw;
                    if (log.new_status === 'completed') Icon = CheckCircle2;
                    if (log.action === 'transfer') Icon = ArrowRightLeft;

                    const isLogCompleted = log.new_status === 'completed';
                    const isTransfer = log.action === 'transfer';

                    let circleColorClass = 'border-slate-200 text-slate-400 bg-white';
                    let titleColorClass = 'text-slate-600';
                    let boxColorClass = 'bg-slate-50 text-slate-600 border border-transparent';

                    if (isTransfer) {
                      circleColorClass = 'border-purple-400 bg-purple-50 text-purple-600 shadow-[0_0_10px_rgba(168,85,247,0.15)]';
                      titleColorClass = 'text-purple-700';
                      boxColorClass = 'bg-purple-50 border border-purple-200 text-purple-800';
                    } else if (isLogCompleted) {
                      circleColorClass = 'border-emerald-400 bg-emerald-50 text-emerald-700 shadow-[0_0_10px_rgba(52,211,153,0.15)]';
                      titleColorClass = 'text-emerald-700';
                      boxColorClass = 'bg-emerald-50 border border-emerald-400 text-emerald-800';
                    } else if (isActive) {
                      circleColorClass = 'border-primary/40 text-primary shadow-[0_0_10px_rgba(209,53,15,0.1)] bg-white';
                      titleColorClass = 'text-primary';
                      boxColorClass = 'bg-primary/5 border border-primary/30 text-primary/90';
                    }

                    return (
                      <div key={log.id} className="relative pl-10">
                        {/* Circle Icon Indicator */}
                        <div className={`absolute -left-[16px] top-0 w-8 h-8 rounded-full border flex items-center justify-center ${circleColorClass}`}>
                          <Icon className={`w-3.5 h-3.5 ${isActive && log.new_status === 'in_progress' ? 'animate-spin-slow' : ''}`} />
                        </div>

                        <div className="flex flex-col pt-1">
                          <h4 className={`text-[14px] font-bold mb-2 ${titleColorClass}`}>
                            {statusInfo.label}
                          </h4>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium mb-3">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />
                              {formatDate(log.created_at)}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5" />
                              {staffName}
                            </span>
                          </div>

                          <div className={`rounded-xl p-4 text-[13px] leading-relaxed ${boxColorClass}`}>
                            {log.remark || <span className="italic opacity-70">ไม่มีหมายเหตุเพิ่มเติม</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </AppCard>
            </div>
            {/* End Right Column */}
          </div>
          {/* End Grid */}

          <div className="pt-6">
            <GlobalFooter />
          </div>
        </div>
      </div>

      {/* Login Modal for Completed State */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[20px] w-full max-w-sm shadow-xl overflow-hidden animate-slide-up">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">เข้าสู่ระบบเจ้าหน้าที่</h3>
              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(false);
                  setLoginError("");
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                aria-label="ปิด"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 text-center">

              {loginError && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-[12px] font-medium rounded-xl border border-red-100 text-left">
                  {loginError}
                </div>
              )}

              <div className="space-y-3 mb-6 text-left">
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="อีเมล"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[14px] bg-slate-50 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="รหัสผ่าน"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[14px] bg-slate-50 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>

              <AppButton fullWidth onClick={handleLogin} variant="primary" disabled={isLoggingIn} className="py-3">
                {isLoggingIn ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
              </AppButton>
            </div>
          </div>
        </div>
      )}

    </AppContainer>
  );
}

export default function ReportDetailPage(props: ReportDetailPageProps) {
  return (
    <StaffAuthProvider>
      <ReportDetailPageContent {...props} />
    </StaffAuthProvider>
  );
}
