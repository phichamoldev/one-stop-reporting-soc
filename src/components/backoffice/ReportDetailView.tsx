"use client";

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { supabase } from "@/lib/supabase";

import { 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  User, 
  Phone, 
  MessageSquare, 
  Maximize2,
  X,
  ImagePlus,
  Lock,
  Clock,
  FileText,
  AlertCircle,
  Send,
  Check,
  ImageOff,
  Tag
} from 'lucide-react';
import { AppSelect } from "@/components/ui/AppSelect";
import useSWR, { mutate as globalMutate } from 'swr';
import { fetcherWithAuth } from '@/lib/fetcher';
import dynamic from 'next/dynamic';
import { ReportStatus } from "@/types/report";

const ReportTimeline = dynamic(
  () => import('@/components/backoffice/ReportTimeline').then(mod => mod.ReportTimeline),
  { ssr: false }
);
import { SimilarReportsCard } from '@/components/backoffice/SimilarReportsCard';

interface ReportDetailViewProps {
  publicId: string;
  userRole: string | undefined;
  onClose?: () => void;
  isDrawer?: boolean;
}

import { StatusBadge } from "@/components/design-system/StatusBadge";

import { STATUS_DETAILS } from '@/types/report';

function generateUploadFileName(fileExt: string) {
  const randomFileToken = Math.random().toString(36).substring(2, 12);
  const isTestEnv = process.env.NEXT_PUBLIC_REPORT_DATA_SOURCE === "test";
  const folderPrefix = isTestEnv ? "test/" : "";
  return `${folderPrefix}${Date.now()}-${randomFileToken}.${fileExt}`;
}

export const ReportDetailView: React.FC<ReportDetailViewProps> = ({
  publicId,
  userRole,
  onClose,
  isDrawer = false,
}) => {
  const router = useRouter();
  
  const [selectedStatus, setSelectedStatus] = useState<string>('pending');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | ''>('');
  const [adminNotes, setAdminNotes] = useState('');
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [priorityModalOpen, setPriorityModalOpen] = useState(false);
  const [targetPriority, setTargetPriority] = useState<string>('normal');
  const [priorityReasonText, setPriorityReasonText] = useState('');
  const [isSavingPriority, setIsSavingPriority] = useState(false);
  const [prioritySaveMessage, setPrioritySaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  useEffect(() => {
    if (fullscreenImage || priorityModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [fullscreenImage, priorityModalOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (fullscreenImage) {
          setFullscreenImage(null);
        } else if (priorityModalOpen && !isSavingPriority) {
          setPriorityModalOpen(false);
        }
      }
    };
    if (fullscreenImage || priorityModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [fullscreenImage, priorityModalOpen, isSavingPriority]);

  const [isEditMode, setIsEditMode] = useState(false);

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
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const { data: reportRes, mutate: mutateReport, isLoading } = useSWR(
    publicId ? `/api/reports/${publicId}` : null,
    fetcherWithAuth
  );
  const reportData = reportRes?.report;
  const data = reportData;

  const { data: deptRes } = useSWR(
    userRole && userRole !== "staff" ? '/api/departments' : null,
    fetcherWithAuth,
    { dedupingInterval: 3600000 }
  );

  const departments: { id: number; name_th: string }[] = deptRes?.departments || [];

  // Sync state when reportData loads or changes
  const [prevReportVersion, setPrevReportVersion] = useState<string | null>(null);
  const currentVersion = reportData ? `${reportData.id}-${reportData.updated_at || reportData.status}-${reportData.admin_remark || ''}` : null;
  if (currentVersion && currentVersion !== prevReportVersion) {
    setPrevReportVersion(currentVersion);
    setSelectedStatus(reportData.status);
    setAdminNotes(reportData.admin_remark || '');
    setIsEditMode(reportData.status !== 'completed');
    setTargetPriority(reportData.priority || 'normal');
  }

  const handleStatusChange = (val: string) => {
    setSelectedStatus(val);
    if (val !== 'completed') {
      if (completionImage || completionImagePreview) {
        setCompletionImage(null);
        setCompletionImagePreview(null);
      }
    }
  };

  const handleSavePriority = async () => {
    if (!targetPriority || !priorityReasonText.trim()) {
      setPrioritySaveMessage({ type: 'error', text: 'กรุณาระบุเหตุผลในการปรับเปลี่ยนระดับความเร่งด่วน' });
      return;
    }
    setIsSavingPriority(true);
    setPrioritySaveMessage(null);
    try {
      const res = await fetcherWithAuth(`/api/reports/${publicId}/priority`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priority: targetPriority,
          reason: priorityReasonText.trim(),
        }),
      });

      if (res?.success) {
        setPrioritySaveMessage({ type: 'success', text: 'ปรับปรุงระดับความเร่งด่วนเรียบร้อยแล้ว' });
        mutateReport();
        setTimeout(() => {
          setPriorityModalOpen(false);
          setPrioritySaveMessage(null);
          setPriorityReasonText('');
        }, 1200);
      } else {
        setPrioritySaveMessage({ type: 'error', text: res?.error || 'ไม่สามารถปรับความเร่งด่วนได้' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึก';
      setPrioritySaveMessage({ type: 'error', text: msg });
    } finally {
      setIsSavingPriority(false);
    }
  };

  const isStatusChanged = Boolean(data && selectedStatus && selectedStatus !== '' && (selectedStatus === 'transfer' || selectedStatus !== data.status));
  const isRemarkChanged = Boolean(data && (adminNotes || "").trim() !== (data.admin_remark || "").trim());
  const hasImageChange = Boolean(completionImage);
  const hasAnyChange = isStatusChanged || isRemarkChanged || hasImageChange;

  const handleSaveStatus = async () => {
    if (!data) return;
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("ไม่พบเซสชัน กรุณาเข้าสู่ระบบใหม่");

      if (!hasAnyChange) {
        setSaveMessage({ type: 'error', text: 'กรุณาเลือกสถานะใหม่ หรือเพิ่มหมายเหตุ' });
        setIsSaving(false);
        return;
      }

      if (selectedStatus === 'transfer') {
        if (!selectedDepartmentId) {
          setSaveMessage({ type: 'error', text: 'กรุณาเลือกหน่วยงานปลายทาง' });
          setIsSaving(false);
          return;
        }
        if (!adminNotes.trim()) {
          setSaveMessage({ type: 'error', text: 'กรุณาระบุเหตุผลที่โอนเรื่อง' });
          setIsSaving(false);
          return;
        }
      } else if (selectedStatus === 'completed' && (!isEditMode || data.status !== 'completed')) {
        if (!adminNotes.trim()) {
          setSaveMessage({ type: 'error', text: 'กรุณาระบุหมายเหตุสรุปผล' });
          setIsSaving(false);
          return;
        }
      } else if (selectedStatus === 'rejected' && data.status !== 'rejected') {
        if (!adminNotes.trim()) {
          setSaveMessage({ type: 'error', text: 'กรุณาระบุเหตุผลที่ไม่สามารถดำเนินการได้' });
          setIsSaving(false);
          return;
        }
      }

      let publicUrl: string | null = null;
      if (!completionImage && completionImagePreview && completionImagePreview.startsWith('http')) {
        publicUrl = completionImagePreview;
      }
      
      if (completionImage) {
        const fileExt = completionImage.name.split('.').pop() || 'jpg';
        const fileName = generateUploadFileName(fileExt);
        const { error: uploadError } = await supabase.storage
          .from('report-images')
          .upload(fileName, completionImage, { cacheControl: '3600', upsert: false });
          
        if (uploadError) {
           throw new Error('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
        }
        const { data: imgData } = supabase.storage.from('report-images').getPublicUrl(fileName);
        publicUrl = imgData.publicUrl;
      }

      const res = await fetch(`/api/reports/${publicId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          reportId: data.id,
          status: isStatusChanged || selectedStatus === 'transfer' ? selectedStatus : undefined,
          remark: isRemarkChanged || selectedStatus === 'transfer' ? adminNotes : undefined,
          oldStatus: data.status,
          departmentId: selectedStatus === 'transfer' ? selectedDepartmentId : undefined,
          imageUrl: publicUrl
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 409 || errorData.code === 'CONCURRENT_MODIFICATION') {
          await mutateReport();
          throw new Error(errorData.error || "สถานะคำร้องถูกเปลี่ยนแปลงโดยผู้ใช้อื่นแล้ว ระบบกำลังโหลดข้อมูลล่าสุด...");
        }
        throw new Error(errorData.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }

      if (selectedStatus === 'transfer') {
        setSaveMessage({ type: 'success', text: 'โอนเรื่องเรียบร้อยแล้ว' });
      } else {
        setSaveMessage({ type: 'success', text: 'อัปเดตสถานะเรียบร้อยแล้ว' });
      }
      
      setAdminNotes('');
      // Revalidate this report
      await mutateReport();
      // Invalidate dashboard and incidents caches
      globalMutate(
        (key) => typeof key === 'string' && (key.startsWith('/api/backoffice/dashboard') || key.startsWith('/api/incidents')),
        undefined,
        { revalidate: true }
      );
      
      setCompletionImage(null);
      setCompletionImagePreview(null);
      if (selectedStatus === 'completed') {
        setIsEditMode(false);
      } else {
        setIsEditMode(true);
      }
      
      setTimeout(() => {
        setSaveMessage(null);
      }, 3000);

    } catch (err: unknown) {
      console.error("Save error:", err);
      setSaveMessage({ type: 'error', text: (err as Error)?.message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-6 animate-pulse p-4 sm:p-6 lg:p-8 w-full">
        <div className="h-10 w-40 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start w-full">
          <div className="col-span-1 lg:col-span-8 w-full min-w-0 h-[600px] bg-white dark:bg-slate-900 rounded-[20px]" />
          <div className="col-span-1 lg:col-span-4 w-full min-w-0 h-[600px] bg-white dark:bg-slate-900 rounded-[20px]" />
        </div>
      </div>
    );
  }

  const formatThaiDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' น.';
  };

  const logs = data.report_logs || [];

  const renderRequestSummary = () => (
    <div className={isDrawer ? "space-y-4 pb-6 border-b border-slate-100 dark:border-slate-800" : "bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow space-y-4"}>
      {/* Top row: Public ID and Status / Priority */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            ใบงานแจ้งซ่อมเลขที่
          </span>
          <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono tracking-tight">
            {data.public_id}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Priority Badge */}
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                data.priority === "emergency"
                  ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900 animate-pulse"
                  : data.priority === "needs_review"
                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900"
                  : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
              }`}
            >
              {data.priority === "emergency" && <span className="w-2 h-2 rounded-full bg-red-600" />}
              {data.priority === "emergency"
                ? "ฉุกเฉิน (Emergency)"
                : data.priority === "needs_review"
                ? "รอตรวจสอบ (Needs Review)"
                : "ปกติ (Normal)"}
            </span>
            {userRole && (
              <button
                type="button"
                onClick={() => setPriorityModalOpen(true)}
                className="text-xs text-primary hover:underline font-semibold cursor-pointer ml-0.5"
              >
                ปรับระดับ
              </button>
            )}
          </div>

          {/* Status Badge */}
          <div className="border-l border-slate-200 dark:border-slate-700 pl-2.5">
            <StatusBadge status={data.status} className="px-3 py-1 shadow-xs text-[11px]" />
          </div>
        </div>
      </div>

      {/* Dates: Received & Last Updated */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl text-xs text-slate-500 dark:text-slate-400 font-medium border border-slate-100/60 dark:border-slate-800/40">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          <span>วันที่รับเรื่องแจ้ง: {formatThaiDate(data.created_at)}</span>
        </div>
        <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-700 pt-2 sm:pt-0 sm:pl-3">
          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
          <span>อัปเดตล่าสุด: {formatThaiDate(data.updated_at || data.created_at)}</span>
        </div>
      </div>

      {/* Headline / Title */}
      <div>
        <p className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 leading-snug">
          {data.title || data.description}
        </p>
      </div>
    </div>
  );

  const renderRequestDetails = () => (
    <div className={isDrawer ? "space-y-5 pb-6 border-b border-slate-100 dark:border-slate-800" : "bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow space-y-5"}>
      <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        <span>รายละเอียดคำร้อง</span>
      </h4>

      {/* Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/40">
        <div>
          <h5 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
            หมวดหมู่หลัก
          </h5>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
            📂 {data.categories?.name_th || "-"}
          </span>
        </div>
        <div>
          <h5 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
            หมวดหมู่ย่อย
          </h5>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
            🔧 {data.subcategories?.name_th || "-"}
          </span>
        </div>
      </div>

      {/* Location */}
      <div className="pb-4 border-b border-slate-100 dark:border-slate-800/40">
        <h5 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
          สถานที่
        </h5>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <span>{data.location || data.room_number || "ไม่ระบุ"}</span>
        </p>
      </div>

      {/* Description */}
      <div>
        <h5 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
          รายละเอียดปัญหาและความเสียหาย
        </h5>
        <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800/40">
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-line">
            {data.description || "-"}
          </p>
        </div>
      </div>

      {/* Attachment */}
      {data.image_url && (
        <div className="pt-1">
          <h5 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
            ภาพประกอบที่แนบมา
          </h5>
          <div className="relative group overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800 max-w-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={data.image_url} 
              alt="ภาพประกอบคำร้อง" 
              className="w-full h-auto object-cover max-h-64 transition-transform duration-300 group-hover:scale-[1.02]"
            />
            <button
              type="button"
              onClick={() => setFullscreenImage(data.image_url)}
              className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-200 cursor-pointer text-xs font-bold gap-1.5"
            >
              <Maximize2 className="w-4 h-4" />
              <span>ขยายภาพขนาดเต็ม</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderReporterDetails = () => (
    <div className={isDrawer ? "space-y-4 pb-6 border-b border-slate-100 dark:border-slate-800" : "bg-white dark:bg-slate-900 p-6 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow space-y-4"}>
      <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
        <User className="w-4 h-4 text-primary" />
        <span>ข้อมูลผู้แจ้งเรื่อง</span>
      </h4>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm font-medium">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">ชื่อ-นามสกุล</p>
            <p className="text-slate-800 dark:text-slate-200 font-semibold truncate">{data.reporter_name || "ไม่ระบุ"}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
            <Tag className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">ประเภทผู้แจ้ง</p>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
              {data.reporter_type === 'อาจารย์' && '👨‍🏫 อาจารย์'}
              {data.reporter_type === 'บุคลากร' && '💼 บุคลากร'}
              {data.reporter_type === 'นิสิต' && '🎓 นิสิต'}
              {!['อาจารย์', 'บุคลากร', 'นิสิต'].includes(data.reporter_type || '') && (data.reporter_type || 'ทั่วไป')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
            <Phone className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">เบอร์โทรศัพท์</p>
            <p className="text-slate-800 dark:text-slate-200 font-semibold font-mono">{data.phone || data.reporter_phone || "-"}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStaffAction = () => {
    const sortedLogs = [...(logs || [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latestLog = sortedLogs[0];
    const isCompleted = data.status === 'completed';
    const staffActionImage = latestLog?.image_url || sortedLogs.find(l => l.image_url)?.image_url;
    const canEditCompleted = ['admin', 'super_admin', 'manager'].includes(userRole || '');

    return (
      <div className={isDrawer 
        ? "bg-slate-50/80 dark:bg-slate-800/40 p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-4" 
        : "bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow p-6 space-y-4 no-print"
      }>
        {/* Header: Title, Current Status Badge & Safety Note */}
        <div className="space-y-1.5 pb-3 border-b border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 truncate">
              <MessageSquare className="w-4 h-4 text-primary shrink-0" />
              <span>การดำเนินการของเจ้าหน้าที่และการตอบกลับ</span>
            </h4>
            <div className="shrink-0">
              {isEditMode && isCompleted ? (
                <span className="text-xs text-blue-700 bg-blue-100/60 dark:bg-blue-900/40 dark:text-blue-300 px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  กำลังแก้ไข
                </span>
              ) : (
                <StatusBadge status={data.status} label={STATUS_DETAILS[data.status as ReportStatus]?.label || data.status} />
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            การปรับปรุงสถานะหรือบันทึกข้อความตอบกลับจะมีผลเฉพาะคำร้องนี้เท่านั้น โดยไม่กระทบคำร้องอื่นในกลุ่มเหตุการณ์
          </p>
        </div>

        {/* Feedback message banner */}
        {saveMessage && (
          <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
            saveMessage.type === 'success' 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}>
            {saveMessage.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{saveMessage.text}</span>
          </div>
        )}

        {!isEditMode && isCompleted ? (
          // === COMPLETED VIEW MODE ===
          <div className="space-y-4 pt-1">
            {/* หมายเหตุสรุปผล / คำตอบที่ผ่านมา */}
            {(latestLog?.remark || data.admin_remark) && (
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">
                  หมายเหตุสรุปผล / ข้อความตอบกลับ
                </span>
                <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-xs sm:text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                  {latestLog?.remark || data.admin_remark}
                </div>
              </div>
            )}

            {/* ภาพประกอบการทำงาน */}
            {staffActionImage && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">
                  ภาพประกอบการทำงาน
                </span>
                <div 
                  onClick={() => setFullscreenImage(staffActionImage)} 
                  className="relative w-full max-h-52 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 hover:opacity-95 transition-opacity cursor-pointer group flex items-center justify-center"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={staffActionImage} 
                    alt="ภาพการดำเนินงาน" 
                    className="max-w-full max-h-52 object-contain rounded-xl" 
                  />
                  <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-200">
                    <div className="flex items-center gap-1.5 bg-black/70 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>ขยายภาพขนาดเต็ม</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Metadata: ดำเนินการโดย และ เวลา */}
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1.5 text-xs">
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-500 font-medium">ดำเนินการโดย</span>
                <div className="text-right">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block leading-tight">
                    {latestLog?.staff_users?.full_name || 'ระบบ'}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">เวลา</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                  {latestLog ? new Date(latestLog.created_at).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' น.' : '-'}
                </span>
              </div>
            </div>

            {/* Edit Button or Permission Notice */}
            {canEditCompleted ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedStatus(data.status);
                  setAdminNotes(latestLog?.remark || data.admin_remark || "");
                  setCompletionImage(null);
                  setCompletionImagePreview(latestLog?.image_url || null);
                  setIsEditMode(true);
                }}
                className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>แก้ไขข้อมูลการดำเนินการ</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-xs text-slate-500 font-medium">
                <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                <span>คำร้องนี้เสร็จสิ้นแล้ว เฉพาะผู้จัดการหรือผู้ดูแลระบบเท่านั้นที่สามารถแก้ไขข้อมูลได้</span>
              </div>
            )}
          </div>
        ) : (
          // === ACTION / EDIT FORM ===
          <div className="space-y-4 pt-1">
            {/* Previous Remark Callout (if exists) */}
            {data.admin_remark && !isEditMode && (
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-primary" />
                  <span>ข้อความตอบกลับเดิมที่เคยบันทึกไว้:</span>
                </span>
                <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-300 italic whitespace-pre-wrap">
                  &ldquo;{data.admin_remark}&rdquo;
                </div>
              </div>
            )}

            {/* 1. Status Dropdown */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  สถานะคำร้อง
                </label>
                <span className="text-[11px] text-slate-400 font-medium">ไม่จำเป็นต้องเปลี่ยนสถานะ หากต้องการบันทึกเฉพาะข้อความตอบกลับ</span>
              </div>
              <AppSelect
                value={selectedStatus}
                onChange={(val) => handleStatusChange(val as string)}
                disabled={isSaving}
                options={[
                  { label: `คงสถานะเดิม (${STATUS_DETAILS[data.status as ReportStatus]?.label || data.status})`, value: data.status },
                  { label: `เปลี่ยนเป็น: ${STATUS_DETAILS.pending.label}`, value: 'pending' },
                  { label: `เปลี่ยนเป็น: ${STATUS_DETAILS.received.label}`, value: 'received' },
                  { label: `เปลี่ยนเป็น: ${STATUS_DETAILS.in_progress.label}`, value: 'in_progress' },
                  { label: `เปลี่ยนเป็น: ${STATUS_DETAILS.completed.label}`, value: 'completed' },
                  { label: `เปลี่ยนเป็น: ${STATUS_DETAILS.rejected.label}`, value: 'rejected' },
                  { label: `เปลี่ยนเป็น: ${STATUS_DETAILS.cancelled.label}`, value: 'cancelled' },
                  ...(userRole !== 'staff' ? [{ label: 'โอนคำร้องไปยังหน่วยงานอื่น', value: 'transfer' }] : [])
                ].filter((opt, idx) => idx === 0 || opt.value !== data.status)}
              />
            </div>

            {/* Transfer Destination Department (if selected) */}
            {selectedStatus === 'transfer' && (
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  โอนคำร้องไปยังหน่วยงาน <span className="text-rose-500">*</span>
                </label>
                <AppSelect
                  value={selectedDepartmentId.toString()}
                  onChange={(val) => setSelectedDepartmentId(Number(val))}
                  disabled={isSaving}
                  options={[
                    { label: 'เลือกหน่วยงาน...', value: '' },
                    ...departments
                      .filter(d => d.id !== data.categories?.department_id)
                      .map(d => ({ label: d.name_th, value: d.id.toString() }))
                  ]}
                />
              </div>
            )}

            {/* 2. Reply Textarea */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  หมายเหตุสรุปผล / ข้อความตอบกลับ
                </label>
                <span className="text-[11px] text-slate-400 font-medium">รองรับข้อความยาวหลายบรรทัด</span>
              </div>
              <textarea
                rows={5}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="ระบุข้อความตอบกลับ เช่น เจ้าหน้าที่ได้เข้าตรวจสอบและดำเนินการแก้ไขเรียบร้อยแล้ว..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-xl p-3.5 sm:p-4 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 leading-relaxed transition-all outline-none resize-y min-h-[140px] sm:min-h-[160px]"
                disabled={isSaving}
              />
            </div>

            {/* 3. Image Attachments */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  รูปภาพแนบ <span className="text-slate-400 font-normal text-[11px] sm:text-xs">(ไม่บังคับ — แนบได้เฉพาะสถานะเสร็จสิ้น)</span>
                </label>
                {completionImagePreview && selectedStatus === 'completed' && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    ✓ มีรูปภาพแนบ
                  </span>
                )}
              </div>

              {selectedStatus !== 'completed' ? (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700/80 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-2.5">
                  <ImageOff className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>สามารถแนบรูปภาพได้เมื่อเลือกสถานะ &ldquo;เสร็จสิ้น&rdquo; เท่านั้น</span>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    className="hidden"
                    disabled={isSaving}
                  />

                  {!completionImagePreview ? (
                    <div 
                      onClick={() => !isSaving && fileInputRef.current?.click()}
                      className={`w-full h-28 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center gap-1.5 ${!isSaving ? 'cursor-pointer hover:bg-white dark:hover:bg-slate-900 hover:border-primary/50' : 'opacity-50'} transition-colors group`}
                    >
                      <ImagePlus className="w-6 h-6 text-slate-400 group-hover:scale-110 transition-transform" />
                      <div className="text-center px-2">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">คลิกเพื่ออัปโหลดรูปภาพแนบ</p>
                        <p className="text-[10px] text-slate-400">รองรับ JPG, PNG, WebP สูงสุด 5MB (ไม่บังคับ)</p>
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-full max-h-48 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={completionImagePreview} alt="Preview" className="w-full h-auto max-h-48 object-contain" />
                      {!isSaving && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1 bg-white text-slate-700 rounded-lg text-xs font-bold shadow-xs hover:bg-slate-50 cursor-pointer"
                          >
                            เปลี่ยนรูป
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCompletionImage(null);
                              setCompletionImagePreview(null);
                            }}
                            className="px-3 py-1 bg-rose-500 text-white rounded-lg text-xs font-bold shadow-xs hover:bg-rose-600 cursor-pointer"
                          >
                            ลบรูป
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Validation Helper Message */}
            {!hasAnyChange && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                • ปรับสถานะ หรือพิมพ์ข้อความตอบกลับ เพื่อบันทึกข้อมูล
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 pt-2">
              {isCompleted && isEditMode && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditMode(false);
                    setAdminNotes(latestLog?.remark || data.admin_remark || "");
                    setCompletionImage(null);
                    setCompletionImagePreview(latestLog?.image_url || null);
                    setSaveMessage(null);
                  }}
                  disabled={isSaving}
                  className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                >
                  ยกเลิก
                </button>
              )}

              <button
                type="button"
                onClick={handleSaveStatus}
                disabled={isSaving || !hasAnyChange || (selectedStatus === 'transfer' && !selectedDepartmentId)}
                className="flex-1 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>{isStatusChanged ? "บันทึกการปรับสถานะและตอบกลับ" : "บันทึกการตอบกลับ"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`space-y-6 animate-fade-in w-full ${isDrawer ? 'p-4 sm:p-6' : 'p-4 sm:p-6 lg:p-8'}`}>
      {/* Header and Controls: Only shown in standalone page (Drawer has its own header) */}
      {!isDrawer && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
          <button
            type="button"
            onClick={() => {
              if (onClose) {
                onClose();
              } else {
                router.back();
              }
            }}
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>ย้อนกลับ</span>
          </button>
        </div>
      )}

      {isDrawer ? (
        /* Minimal Streamlined Layout for Drawer (Structured 5-section layout without card nesting) */
        <div className="space-y-6 flex flex-col w-full min-w-0">
          {renderRequestSummary()}
          {renderRequestDetails()}
          {renderReporterDetails()}
          {renderStaffAction()}
          <ReportTimeline logs={logs} isDrawer={true} />
        </div>
      ) : (
        /* Original 2-column Desktop Layout for Standalone Page */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start w-full">
          {/* LEFT COLUMN: 70% width on Desktop */}
          <div className="col-span-1 lg:col-span-8 w-full min-w-0 space-y-6">
            {renderRequestSummary()}
            {renderRequestDetails()}
            {renderReporterDetails()}
            {/* Similar / Duplicate Reports Detection (Step 2) */}
            <SimilarReportsCard publicId={data.public_id || publicId} userRole={userRole} />
          </div>

          {/* RIGHT COLUMN: 30% width on Desktop */}
          <div className="col-span-1 lg:col-span-4 w-full min-w-0 space-y-6">
            {renderStaffAction()}
            <ReportTimeline logs={logs} isDrawer={false} />
          </div>
        </div>
      )}

      {/* Priority Adjustment Modal */}
      {mounted && priorityModalOpen && createPortal(
        <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-transparent"
            onClick={() => !isSavingPriority && setPriorityModalOpen(false)}
          />
          <div className="relative z-10 bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-100 dark:border-slate-800 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                ปรับระดับความเร่งด่วน (Priority Classification)
              </h3>
              <button
                onClick={() => setPriorityModalOpen(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {prioritySaveMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-bold ${
                  prioritySaveMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {prioritySaveMessage.text}
              </div>
            )}

            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  เลือกระดับความเร่งด่วนใหม่:
                </label>
                <AppSelect
                  value={targetPriority}
                  onChange={(val) => setTargetPriority(val as string)}
                  options={[
                    { label: "🔴 ฉุกเฉิน (Emergency) — เสี่ยงต่อชีวิตหรือทรัพย์สิน", value: "emergency" },
                    { label: "🟡 รอตรวจสอบ (Needs Review) — ข้อมูลไม่ชัดเจน", value: "needs_review" },
                    { label: "⚪ ปกติ (Normal) — ปัญหาการใช้งานทั่วไป", value: "normal" },
                  ]}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  เหตุผลในการปรับเปลี่ยน (จำเป็น):
                </label>
                <textarea
                  value={priorityReasonText}
                  onChange={(e) => setPriorityReasonText(e.target.value)}
                  placeholder="ระบุเหตุผล เช่น ตรวจสอบสถานที่จริงแล้วเป็นประกายไฟ หรือตรวจสอบแล้วเป็นเพียงหลอดไฟเสีย..."
                  rows={3}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPriorityModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-xs font-bold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isSavingPriority}
                onClick={handleSavePriority}
                className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-primary/20 cursor-pointer disabled:opacity-50"
              >
                {isSavingPriority ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {mounted && fullscreenImage && createPortal(
        <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center p-4 lg:p-8">
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
            <p className="text-white text-sm font-bold mt-4 px-4 py-2 bg-white/10 rounded-full text-center max-w-lg">
              {fullscreenImage === data.image_url ? `${data.title || data.description} • ${data.location || data.room_number || "ไม่ระบุ"}` : "ภาพประกอบการตอบกลับของเจ้าหน้าที่"}
            </p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
