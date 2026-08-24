"use client";

import React, { use, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AppNavbar } from "@/components/shared/AppNavbar";
import { AppContainer } from "@/components/design-system/AppContainer";
import { AppCard } from "@/components/design-system/AppCard";
import { StatusBadge } from "@/components/design-system/StatusBadge";
import { AppButton } from "@/components/design-system/AppButton";
import { supabase } from "@/lib/supabase";
import { Report, STATUS_DETAILS, getStatusLabel } from "@/types/report";
import { GlobalFooter } from "@/components/shared/GlobalFooter";
import { usePublicStaffAuth } from "@/hooks/usePublicStaffAuth";
import { getRoleDisplayName } from "@/lib/role-config";
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
  CheckCircle,
  Clock,
  ImagePlus,
  Maximize2,
  X,
  LogOut,
  ArrowRightLeft
} from "lucide-react";


interface ReportDetailPageProps {
  params: Promise<{
    publicId: string;
  }>;
}

function ReportDetailPageContent({ params }: ReportDetailPageProps) {
  const { publicId } = use(params);

  const [report, setReport] = useState<Report | null>(null);
  const [canManage, setCanManage] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { user, profile, loading: authLoading, signOut } = usePublicStaffAuth();
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
      // Do NOT auto-enter edit mode — stay in Viewing State
      // User must explicitly click [แก้ไข] to enter Edit State
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
  
  const [completionImage, setCompletionImage] = useState<File | null>(null);
  const [completionImagePreview, setCompletionImagePreview] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        setSaveMessage({ type: 'error', text: 'รูปภาพมีขนาดใหญ่เกินไป (สูงสุด 5MB)' });
        return;
      }
      setCompletionImage(file);
      setCompletionImagePreview(URL.createObjectURL(file));
    }
  };

  const handleEditCompleted = () => {
    if (completionLog) {
      if (completionLog.remark) setUpdateRemark(completionLog.remark);
      if (completionLog.image_url) setCompletionImagePreview(completionLog.image_url);
    }
    setUpdateStatus('completed');
    setIsEditMode(true);
  };
const [mounted, setMounted] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  useEffect(() => {
    setMounted(true);
  }, []);
  const [isEditMode, setIsEditMode] = useState(false);
  const [completedByProfile, setCompletedByProfile] = useState<{ full_name?: string, departments?: { name_th: string } } | null>(null);

  const fetchReport = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
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
      if (data) {
        setReport(data as Report);
        setCanManage(result.canManage || false);
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

  // Re-fetch report when user auth changes to update canManage
  useEffect(() => {
    if (user && publicId) {
      fetchReport(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
      setIsEditMode(report.status !== 'completed');
      if (report.status !== 'completed') {
        setCompletionImage(null);
        setCompletionImagePreview(null);
      }
    }
  }, [report]);

  const handleSave = async () => {
    if (!report) return;
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    const isStatusChanged = report.status !== updateStatus;
    const isRemarkChanged = (report.admin_remark || "") !== (updateRemark || "");

    if (updateStatus === 'transfer') {
      if (!updateDepartmentId) {
        setSaveMessage({ type: 'error', text: 'กรุณาเลือกหน่วยงานปลายทาง' });
        setIsSaving(false);
        return;
      }
    } else if (updateStatus === 'completed' && !completionImage && !completionImagePreview) {
      setSaveMessage({ type: 'error', text: 'กรุณาแนบรูปภาพตอบกลับเมื่อเลือกสถานะเสร็จสิ้น' });
      return;
    } else if (!isStatusChanged && !isRemarkChanged && !completionImage && !completionImagePreview) {
      setIsEditMode(report.status !== 'completed');
      return;
    }

    setSaveMessage(null);
    setIsSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      let publicUrl: string | null = null;
      if (updateStatus === 'completed') {
        if (!completionImage && completionImagePreview && completionImagePreview.startsWith('http')) {
          publicUrl = completionImagePreview;
        }
        
        if (completionImage) {
          const fileExt = completionImage.name.split('.').pop();
          const randomFileToken = Math.random().toString(36).substring(2, 12);
          const fileName = `${Date.now()}-${randomFileToken}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('report-images')
            .upload(fileName, completionImage, { cacheControl: '3600', upsert: false });
            
          if (uploadError) throw new Error("อัปโหลดรูปภาพไม่สำเร็จ: " + uploadError.message);
          
          const { data: { publicUrl: url } } = supabase.storage
            .from('report-images')
            .getPublicUrl(fileName);
            
          publicUrl = url;
        }
      }

      const res = await fetch(`/api/reports/${publicId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          reportId: report.id,
          status: isStatusChanged || (updateStatus as string) === 'transfer' ? updateStatus : undefined,
          remark: updateRemark,
          oldStatus: report.status,
          departmentId: (updateStatus as string) === 'transfer' ? updateDepartmentId : undefined,
          imageUrl: updateStatus === 'completed' ? publicUrl : undefined
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update report");
      }

      setSaveMessage({ type: 'success', text: 'บันทึกข้อมูลเรียบร้อยแล้ว' });
      setUpdateDepartmentId("");
      if (updateStatus !== 'completed') {
        setCompletionImage(null);
        setCompletionImagePreview(null);
      }
      await fetchReport(true);

      setIsEditMode(updateStatus !== 'completed');

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
            {fullscreenImage && createPortal(
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
  const completionLog = sortedLogs.find(log => log.new_status === 'completed');
  const staffActionImage = isCompleted ? (completionLog?.image_url || sortedLogs[0]?.image_url || null) : null;

  // VIEW !== EDIT: canManage = department access, canEditCompleted = management right
  const canEditCompleted = canManage && profile?.role !== 'staff';

  return (
    <AppContainer maxWidthClass="max-w-full md:max-w-5xl lg:max-w-6xl xl:max-w-[1280px]">
      <div className="flex-1 flex flex-col overflow-y-auto bg-[#F4F6F8] min-h-screen">

        {/* 1. Header Section (นอก Card ตาม Reference Image) */}
        <div className="bg-white border-b border-slate-200">
          <div className="w-full p-4 sm:p-6 md:p-8">
            <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-3 mb-2">
              <div>
                <span className="text-[12px] sm:text-[13px] text-slate-400 font-medium block mb-0.5">เลขอ้างอิง</span>
                <h1 className="text-[18px] sm:text-[20px] font-bold text-slate-800 tracking-tight leading-none break-all">{report.public_id}</h1>
              </div>
              <div className="self-start xs:self-center">
                <StatusBadge status={report.status} label={currentStatusInfo.label} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-[11px] text-slate-400 font-normal">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3 h-3 shrink-0" />
                สร้าง: {formatDate(report.created_at)}
              </span>
              <span className="flex items-center gap-1.5">
                <RefreshCcw className="w-3 h-3 shrink-0" />
                อัปเดต: {formatDate(report.updated_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 md:p-8 pb-12 w-full max-w-full overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(300px,3fr)] gap-6 items-start">
            
            {/* LEFT COLUMN (70%) */}
            <div className="w-full space-y-6">

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

            {/* RIGHT COLUMN (30%) */}
            <div className="w-full space-y-6 lg:sticky lg:top-6 lg:self-start">

                            {/* 5. การดำเนินการของเจ้าหน้าที่ (STAFF SECTION) */}
              <AppCard className="!p-0 border-[#EDF0F4] shadow-sm overflow-hidden rounded-[16px]">
                {/* Header Container */}
                <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-50 gap-2">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <h3 className="text-[15px] font-bold text-slate-800 leading-tight">
                      การดำเนินการ
                    </h3>
                  </div>
                  <div className="shrink-0">
                    {isEditMode && isCompleted ? (
                      <span className="text-[11px] sm:text-[12px] text-blue-700 bg-blue-100/60 px-2.5 sm:px-3 py-1 rounded-full font-bold flex items-center gap-1.5">
                        <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        กำลังแก้ไข
                      </span>
                    ) : (
                      <StatusBadge status={report.status} label={currentStatusInfo.label} />
                    )}
                  </div>
                </div>

                {/* Profile Block (State 3 Only: isCompleted, not edit mode, user logged in) */}
                {!isEditMode && isCompleted && user && profile && (
                  <div className="px-4 sm:px-5 py-3.5 sm:py-4 bg-slate-50/70 border-b border-slate-100 flex items-center gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-[13px] sm:text-[14px] uppercase shrink-0">
                      {profile.full_name ? profile.full_name.substring(0, 2) : "จน"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[13px] sm:text-[14px] font-bold text-slate-800 block leading-tight">{profile.full_name}</span>
                      <span className="text-[11px] sm:text-[12px] text-slate-500 font-medium truncate block">{getRoleDisplayName(profile.role)}</span>
                    </div>
                    <div className="ml-auto shrink-0">
                      <button 
                        onClick={() => { signOut(); setIsEditMode(report?.status !== 'completed'); }} 
                        className="text-[11px] sm:text-[12px] text-red-600 hover:text-red-700 underline font-medium px-1.5 decoration-red-600/30 underline-offset-4 cursor-pointer"
                      >
                        ออกจากระบบ
                      </button>
                    </div>
                  </div>
                )}

                <div className="p-4 sm:p-5">
                  {authLoading ? (
                    <div className="animate-pulse space-y-3 pt-2 pb-2">
                      <div className="w-10 h-10 bg-slate-100 rounded-full mx-auto"></div>
                      <div className="h-4 bg-slate-100 rounded w-1/3 mx-auto"></div>
                      <div className="h-3 bg-slate-100 rounded w-1/2 mx-auto mb-4"></div>
                    </div>
                  ) : !isEditMode && isCompleted ? (
                    // === VIEW MODE (COMPLETED READ-ONLY SUMMARY) ===
                    <div className="space-y-4">
                      {sortedLogs[0] ? (
                        <>
                          {/* 1. หมายเหตุสรุปผล */}
                          {sortedLogs[0].remark && (
                            <div className="space-y-1">
                              <span className="text-[11px] sm:text-[12px] font-bold text-slate-400 block uppercase tracking-wider">
                                หมายเหตุสรุปผล
                              </span>
                              <p className="text-[14px] sm:text-[15px] font-medium text-slate-800 break-words whitespace-pre-wrap leading-relaxed">
                                {sortedLogs[0].remark}
                              </p>
                            </div>
                          )}

                          {/* 2. ภาพประกอบการทำงาน (แสดงเฉพาะเมื่อมีรูปภาพ) */}
                          {staffActionImage && (
                            <div className="space-y-2 pt-1">
                              <span className="text-[11px] sm:text-[12px] font-bold text-slate-400 block uppercase tracking-wider">
                                ภาพประกอบการทำงาน
                              </span>
                              <div 
                                onClick={() => setFullscreenImage(staffActionImage)} 
                                className="relative w-full max-h-[240px] sm:max-h-[260px] bg-slate-50 rounded-xl overflow-hidden border border-slate-200 hover:opacity-95 transition-opacity cursor-pointer group flex items-center justify-center"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img 
                                  src={staffActionImage} 
                                  alt="ภาพประกอบการทำงาน" 
                                  className="w-full h-auto max-h-[240px] sm:max-h-[260px] object-contain rounded-xl transition-transform duration-200 group-hover:scale-[1.01]" 
                                />
                                <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-200 backdrop-blur-[1px]">
                                  <div className="flex items-center gap-1.5 bg-black/70 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-lg">
                                    <Maximize2 className="w-3.5 h-3.5" />
                                    <span>ขยายภาพขนาดเต็ม</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="border-t border-slate-100 my-4"></div>

                          {/* 3. ดำเนินการโดย */}
                          <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1 text-[13px]">
                            <span className="text-slate-500 font-medium shrink-0">ดำเนินการโดย</span>
                            <span className="font-bold text-slate-800 break-words text-left xs:text-right">
                              {sortedLogs[0].staff_users?.full_name || 'ระบบ'}
                            </span>
                          </div>

                          <div className="border-t border-slate-100 my-4"></div>

                          {/* 4. เวลา */}
                          <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1 text-[13px] mb-4">
                            <span className="text-slate-500 font-medium shrink-0">เวลา</span>
                            <span className="font-bold text-slate-800 break-words text-left xs:text-right font-mono text-[12px] sm:text-[13px]">
                              {new Date(sortedLogs[0].created_at).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.
                            </span>
                          </div>
                          
                          {/* 5. ปุ่ม Action */}
                          {user && profile ? (
                            canManage && profile.role !== 'staff' && (
                              <AppButton
                                fullWidth
                                variant="primary"
                                className="text-[14px] sm:text-[15px] py-3 sm:py-3.5 shadow-md shadow-primary/10 flex items-center justify-center gap-2 mt-4 cursor-pointer"
                                onClick={() => {
                                  setUpdateStatus(report.status);
                                  setUpdateRemark("");
                                  setCompletionImage(null);
                                  setCompletionImagePreview(null);
                                  if (report.status === 'completed' && completionLog) {
                                    setUpdateRemark(completionLog.remark || "");
                                    setCompletionImagePreview(completionLog.image_url || null);
                                  }
                                  setIsEditMode(true);
                                }}
                              >
                                <FileText className="w-4 h-4" /> แก้ไขข้อมูล
                              </AppButton>
                            )
                          ) : (
                            <AppButton
                              fullWidth
                              variant="secondary"
                              className="text-[14px] sm:text-[15px] py-3 sm:py-3.5 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 mt-4 cursor-pointer"
                              onClick={() => setShowLoginModal(true)}
                            >
                              <Lock className="w-4 h-4" /> เข้าสู่ระบบเพื่อแก้ไข
                            </AppButton>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-6">
                          <p className="text-[13px] text-slate-400 italic mb-4">ยังไม่มีประวัติการดำเนินการจากเจ้าหน้าที่</p>
                          {user && profile ? (
                            canManage && profile.role !== 'staff' && (
                              <AppButton
                                fullWidth
                                variant="primary"
                                className="text-[14px] py-3 shadow-md shadow-primary/10 flex items-center justify-center gap-2 cursor-pointer"
                                onClick={() => {
                                  setUpdateStatus(report.status);
                                  setUpdateRemark("");
                                  setIsEditMode(true);
                                }}
                              >
                                <FileText className="w-4 h-4" /> เริ่มการดำเนินการ
                              </AppButton>
                            )
                          ) : (
                            <AppButton
                              fullWidth
                              variant="secondary"
                              className="text-[14px] py-3 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 cursor-pointer"
                              onClick={() => setShowLoginModal(true)}
                            >
                              <Lock className="w-4 h-4" /> เข้าสู่ระบบเพื่อดำเนินการ
                            </AppButton>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    // === EDIT MODE ===
                    <div className="space-y-4 sm:space-y-5 animate-fade-in">
                      {saveMessage && (
                        <div className={`p-3 rounded-xl text-[13px] font-medium border ${saveMessage.type === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                          {saveMessage.text}
                        </div>
                      )}
                      
                      <div>
                        <label className="text-[12px] sm:text-[13px] text-slate-500 font-medium block mb-1.5">สถานะคำร้อง</label>
                        <AppSelect
                          value={updateStatus}
                          onChange={(val) => {
                            const newStatus = val as string;
                            setUpdateStatus(newStatus);
                            if (newStatus !== 'completed') {
                              setCompletionImage(null);
                              setCompletionImagePreview(null);
                            }
                          }}
                          disabled={isSaving}
                          options={[
                            { label: STATUS_DETAILS.pending.label, value: 'pending' },
                            { label: STATUS_DETAILS.received.label, value: 'received' },
                            { label: STATUS_DETAILS.in_progress.label, value: 'in_progress' },
                            { label: STATUS_DETAILS.completed.label, value: 'completed' },
                            { label: STATUS_DETAILS.rejected.label, value: 'rejected' },
                            { label: STATUS_DETAILS.cancelled.label, value: 'cancelled' },
                            ...(profile?.role !== 'staff' ? [{ label: 'โอนคำร้อง', value: 'transfer' }] : [])
                          ]}
                        />
                      </div>
                      
                      {updateStatus === 'transfer' && (
                        <div>
                          <label className="text-[12px] sm:text-[13px] text-slate-500 font-medium block mb-1.5">โอนคำร้องไปยังหน่วยงาน</label>
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
                      
                      {updateStatus === 'completed' && (
                        <div>
                          <label className="text-[12px] sm:text-[13px] text-slate-500 font-medium block mb-1.5">
                            ภาพประกอบการทำงาน <span className="text-rose-500">*</span>
                          </label>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            ref={fileInputRef} 
                            onChange={handleImageChange} 
                            disabled={isSaving}
                          />
                          {!completionImagePreview ? (
                            <button 
                              type="button"
                              onClick={() => fileInputRef.current?.click()} 
                              className="w-full h-32 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer"
                              disabled={isSaving}
                            >
                              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                <ImagePlus className="w-5 h-5" />
                              </div>
                              <div className="text-center">
                                <span className="text-[13px] font-bold text-slate-700 block">คลิกเพื่ออัปโหลดรูปภาพ</span>
                                <span className="text-[11px] text-slate-500">รองรับ JPG, PNG สูงสุด 5MB</span>
                              </div>
                            </button>
                          ) : (
                            <div className="relative group rounded-xl overflow-hidden border border-slate-200 max-h-56 bg-slate-50 flex items-center justify-center">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={completionImagePreview} alt="Preview" className="w-full h-auto max-h-56 object-contain" />
                              {!isSaving && (
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                  <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-white text-slate-700 text-[12px] font-bold rounded-lg hover:bg-slate-50 shadow-sm cursor-pointer">เปลี่ยนรูป</button>
                                  <button type="button" onClick={() => { setCompletionImage(null); setCompletionImagePreview(null); }} className="px-3 py-1.5 bg-rose-500 text-white text-[12px] font-bold rounded-lg hover:bg-rose-600 shadow-sm cursor-pointer">ลบรูป</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div>
                        <label className="text-[12px] sm:text-[13px] text-slate-500 font-medium block mb-1.5">หมายเหตุสรุปผล</label>
                        <textarea
                          className="w-full border border-slate-200 rounded-xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-[13px] sm:text-[14px] bg-white focus:ring-2 focus:ring-primary/20 outline-none min-h-[90px] sm:min-h-[100px] resize-y disabled:opacity-50 text-slate-800 font-medium"
                          placeholder="ระบุรายละเอียดการดำเนินงานหรือผลการแก้ไข..."
                          value={updateRemark}
                          onChange={(e) => setUpdateRemark(e.target.value)}
                          disabled={isSaving}
                        ></textarea>
                      </div>
                      
                      <div className="pt-2 flex flex-row gap-2.5 sm:gap-3">
                        <AppButton
                          fullWidth
                          variant="secondary"
                          className="text-[13px] sm:text-[14px] py-3 sm:py-3.5 flex-1 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold cursor-pointer shrink-0"
                          onClick={() => {
                            if (isCompleted) {
                              setIsEditMode(false);
                              setUpdateStatus(report.status);
                              setUpdateRemark(report.admin_remark || "");
                              setCompletionImage(null);
                              if (completionLog) {
                                setCompletionImagePreview(completionLog.image_url || null);
                              } else {
                                setCompletionImagePreview(null);
                              }
                            } else {
                              setUpdateStatus(report.status);
                              setUpdateRemark(report.admin_remark || "");
                              setCompletionImage(null);
                              setCompletionImagePreview(null);
                            }
                            setSaveMessage(null);
                          }}
                          disabled={isSaving}
                        >
                          ยกเลิก
                        </AppButton>
                        <AppButton
                          fullWidth
                          variant="primary"
                          className="shadow-md shadow-primary/10 text-[13px] sm:text-[14px] py-3 sm:py-3.5 flex-1 font-bold cursor-pointer shrink-0"
                          onClick={handleSave}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              กำลังบันทึก...
                            </span>
                          ) : (
                            "บันทึกข้อมูล"
                          )}
                        </AppButton>
                      </div>
                    </div>
                  )}
                </div>
              </AppCard>
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
                    const statusInfo = log.action === 'transfer' ? { label: "โอนคำร้อง" } : (STATUS_DETAILS[log.new_status] || { label: getStatusLabel(log.new_status) });
                    // Use the actual staff full_name if available
                    const staffName = log.staff_users?.full_name || "ระบบ";

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

                          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-[11px] text-slate-400 font-medium mb-3">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{formatDate(log.created_at)}</span>
                            </span>
                            <span className="flex items-start sm:items-center gap-1.5">
                              <User className="w-3.5 h-3.5 shrink-0 mt-0.5 sm:mt-0" />
                              <span className="break-words line-clamp-2">{staffName}</span>
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
      {mounted && showLoginModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 flex items-end md:items-center justify-center p-0 md:p-4 z-[9999] backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full md:max-w-sm rounded-t-[24px] rounded-b-none md:rounded-[20px] shadow-2xl flex flex-col max-h-[90dvh] animate-slide-up overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-bold text-slate-800">เข้าสู่ระบบเจ้าหน้าที่</h3>
              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(false);
                  setLoginError("");
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors shrink-0"
                aria-label="ปิด"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 text-center overflow-y-auto custom-scrollbar pb-[calc(1.5rem+env(safe-area-inset-bottom))]">

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
        </div>,
        document.body
      )}

    </AppContainer>
  );
}

export default function ReportDetailPage(props: ReportDetailPageProps) {
  return (
    <ReportDetailPageContent {...props} />
  );
}
