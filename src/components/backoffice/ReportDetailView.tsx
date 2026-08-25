"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
  History,
  ImagePlus,
  CheckCircle,
  Lock,
  Clock,
  FileText
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

interface ReportDetailViewProps {
  publicId: string;
  userRole: string | undefined;
}

import { StatusBadge } from "@/components/design-system/StatusBadge";

import { STATUS_DETAILS, getStatusLabel } from '@/types/report';

export const ReportDetailView: React.FC<ReportDetailViewProps> = ({
  publicId,
  userRole
}) => {
  const router = useRouter();
  
  const [data, setData] = useState<any>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('pending');
  const [departments, setDepartments] = useState<{id: number, name_th: string}[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | ''>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (fullscreenImage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [fullscreenImage]);

  const [isEditMode, setIsEditMode] = useState(false);

  const handleEditCompleted = () => {
    const sortedLogs = [...(logs || [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latestLog = sortedLogs[0];
    if (latestLog) {
      if (latestLog.remark) setAdminNotes(latestLog.remark);
      if (latestLog.image_url) setCompletionImagePreview(latestLog.image_url);
    }
    setIsEditMode(true);
  };

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

  const { data: reportRes, error: reportError, mutate: mutateReport, isLoading } = useSWR(
    publicId ? `/api/reports/${publicId}` : null,
    fetcherWithAuth,
    {
      onSuccess: (data) => {
        if (data?.report && data.report.status !== selectedStatus && selectedStatus === 'pending') {
           setSelectedStatus(data.report.status);
        }
      }
    }
  );
  const reportData = reportRes?.report;

  const { data: deptRes } = useSWR(
    userRole && userRole !== "staff" ? '/api/departments' : null,
    fetcherWithAuth,
    { dedupingInterval: 3600000 }
  );

  useEffect(() => {
    if (deptRes?.departments) {
      setDepartments(deptRes.departments);
    }
  }, [deptRes]);

  useEffect(() => {
    if (reportData) {
      setData(reportData);
      setSelectedStatus(reportData.status);
      setAdminNotes(reportData.admin_remark || '');
      setIsEditMode(reportData.status !== 'completed');
    }
  }, [reportData]);

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
        if (!completionImage && !completionImagePreview) {
          setSaveMessage({ type: 'error', text: 'กรุณาแนบรูปภาพตอบกลับเมื่อเลือกสถานะเสร็จสิ้น' });
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
      
      if (selectedStatus === 'completed' && completionImage) {
        const fileExt = completionImage.name.split('.').pop();
        const randomFileToken = Math.random().toString(36).substring(2, 12);
        const fileName = `${Date.now()}-${randomFileToken}.${fileExt}`;
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
        throw new Error(errorData.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }

      if (selectedStatus === 'transfer') {
        setSaveMessage({ type: 'success', text: 'โอนเรื่องเรียบร้อยแล้ว' });
      } else {
        setSaveMessage({ type: 'success', text: 'อัปเดตสถานะเรียบร้อยแล้ว' });
      }
      
      setAdminNotes('');
      setIsDropdownOpen(false);
      // Revalidate this report
      await mutateReport();
      // Invalidate dashboard caches
      globalMutate(
        (key) => typeof key === 'string' && key.startsWith('/api/backoffice/dashboard'),
        undefined,
        { revalidate: true }
      );
      
      if (selectedStatus === 'completed') {
        setIsEditMode(false);
        setCompletionImage(null);
        setCompletionImagePreview(null);
      } else {
        setIsEditMode(false);
      }
      
      setTimeout(() => {
        setSaveMessage(null);
      }, 3000);

    } catch (err: any) {
      console.error("Save error:", err);
      setSaveMessage({ type: 'error', text: err.message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
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

  return (
    <div className="space-y-6 animate-fade-in p-4 sm:p-6 lg:p-8 w-full">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>ย้อนกลับ</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start w-full">
        
        {/* LEFT COLUMN: 70% width on Desktop */}
        <div className="col-span-1 lg:col-span-8 w-full min-w-0 space-y-6">
          
          <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-50 dark:border-slate-800/60 pb-5 mb-6 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">ใบงานแจ้งซ่อมเลขที่</span>
                </div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono tracking-tight">
                  {data.public_id}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-bold">สถานะปัจจุบัน:</span>
                <StatusBadge status={data.status} className="px-3 py-1 shadow-sm text-[11px]" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl mb-6 text-xs text-slate-500 dark:text-slate-400 font-semibold border border-slate-100/50 dark:border-slate-800/20">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span>วันที่รับเรื่องแจ้ง: {formatThaiDate(data.created_at)}</span>
              </div>
              <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 pt-2.5 md:pt-0 md:pl-4">
                <History className="w-4 h-4 text-slate-400 shrink-0" />
                <span>อัปเดตล่าสุด: {formatThaiDate(data.updated_at || data.created_at)}</span>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-lg font-black text-slate-800 dark:text-slate-100 leading-snug">
                  {data.title || data.description}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-5 border-b border-slate-50 dark:border-slate-800/30">
                <div>
                  <h5 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">หมวดหมู่หลัก</h5>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    📂 {data.categories?.name_th || "-"}
                  </span>
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">หมวดหมู่ย่อย</h5>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    🔧 {data.subcategories?.name_th || "-"}
                  </span>
                </div>
              </div>

              <div className="pb-5 border-b border-slate-50 dark:border-slate-800/30">
                <h5 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">สถานที่</h5>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-5 h-5 text-primary shrink-0" />
                  {data.location || data.room_number || "ไม่ระบุ"}
                </p>
              </div>

              <div>
                <h5 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">รายละเอียดความชำรุดเสียหาย</h5>
                <div className="bg-slate-50 dark:bg-slate-800/30 p-5 rounded-2xl border border-slate-100/60 dark:border-slate-800/40">
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-line">
                    {data.description || "-"}
                  </p>
                </div>
              </div>

              {data.image_url && (
                <div className="pt-2">
                  <h5 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">ภาพประกอบที่แนบมา</h5>
                  <div className="relative group overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 max-w-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={data.image_url} 
                      alt="Report image" 
                      className="w-full h-auto object-cover max-h-72 transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                    <button
                      onClick={() => setFullscreenImage(data.image_url)}
                      className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-200 cursor-pointer text-xs font-bold gap-1.5"
                    >
                      <Maximize2 className="w-5 h-5" />
                      ขยายภาพขนาดเต็ม
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-50 dark:border-slate-800/40 pb-4 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              ข้อมูลและรายละเอียดผู้แจ้งเรื่อง
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm font-medium">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">ชื่อ-นามสกุล</p>
                  <p className="text-slate-800 dark:text-slate-200 font-semibold">{data.reporter_name || "ไม่ระบุ"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">เบอร์โทรศัพท์</p>
                  <p className="text-slate-800 dark:text-slate-200 font-semibold font-mono">{data.phone || data.reporter_phone || "-"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 30% width on Desktop */}
        <div className="col-span-1 lg:col-span-4 w-full min-w-0 space-y-6">
          
          {(() => {
            const sortedLogs = [...(logs || [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            const latestLog = sortedLogs[0];
            const isCompleted = data.status === 'completed';
            const staffActionImage = latestLog?.image_url || sortedLogs.find(l => l.image_url)?.image_url;
            
            return (
              <div className="w-full bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow space-y-0 no-print overflow-hidden min-w-0">
                {/* Header Container */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/40 p-4 sm:p-5 bg-white dark:bg-slate-900 gap-2 min-w-0">
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 min-w-0 truncate">
                    การดำเนินการของเจ้าหน้าที่
                  </h4>
                  <div className="shrink-0">
                    {isEditMode && isCompleted ? (
                      <span className="text-[11px] sm:text-[12px] text-blue-700 bg-blue-100/60 dark:bg-blue-900/40 dark:text-blue-300 px-2.5 sm:px-3 py-1 rounded-full font-bold flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        กำลังแก้ไข
                      </span>
                    ) : (
                      <StatusBadge status={data.status} label={STATUS_DETAILS[data.status as ReportStatus]?.label || data.status} />
                    )}
                  </div>
                </div>

                <div className="p-4 sm:p-5 w-full min-w-0">
                  {!isEditMode && isCompleted ? (
                    // === BACKOFFICE STATE 3: COMPLETED VIEW MODE ===
                    <div className="space-y-4">
                      {/* 1. หมายเหตุสรุปผล */}
                      {latestLog?.remark && (
                        <div className="space-y-1">
                          <span className="text-[12px] font-bold text-slate-400 block uppercase tracking-wider">
                            หมายเหตุสรุปผล
                          </span>
                          <p className="text-[14px] text-slate-700 dark:text-slate-300 break-words whitespace-pre-wrap leading-relaxed">
                            {latestLog.remark}
                          </p>
                        </div>
                      )}

                      {/* 2. ภาพประกอบการทำงาน (ถ้ามี) */}
                      {staffActionImage && (
                        <div className="space-y-2 pt-1">
                          <span className="text-[12px] font-bold text-slate-400 block uppercase tracking-wider">
                            ภาพประกอบการทำงาน
                          </span>
                          <div 
                            onClick={() => setFullscreenImage(staffActionImage)} 
                            className="relative w-full max-h-[240px] bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 hover:opacity-95 transition-opacity cursor-pointer group flex items-center justify-center"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={staffActionImage} 
                              alt="ภาพการดำเนินงาน" 
                              className="max-w-full max-h-[240px] object-contain rounded-xl transition-transform duration-200 group-hover:scale-[1.01]" 
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

                      <div className="border-t border-slate-100 dark:border-slate-800 my-4"></div>

                      {/* 3. ดำเนินการโดย */}
                      <div className="flex justify-between items-center text-[13px]">
                        <span className="text-slate-500 font-medium shrink-0">ดำเนินการโดย</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 break-words text-right">
                          {latestLog?.staff_users?.full_name || 'ระบบ'}
                        </span>
                      </div>

                      <div className="border-t border-slate-100 dark:border-slate-800 my-4"></div>

                      {/* 4. เวลา */}
                      <div className="flex justify-between items-center text-[13px] mb-4">
                        <span className="text-slate-500 font-medium shrink-0">เวลา</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 break-words text-right font-mono text-[12px] sm:text-[13px]">
                          {latestLog ? new Date(latestLog.created_at).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' น.' : '-'}
                        </span>
                      </div>

                      {/* 5. ปุ่ม แก้ไขข้อมูล */}
                      {(userRole === 'admin' || userRole === 'super_admin' || userRole === 'manager' || userRole === 'staff') && (
                        <button
                          onClick={() => {
                            setSelectedStatus(data.status);
                            setAdminNotes(latestLog?.remark || "");
                            setCompletionImage(null);
                            setCompletionImagePreview(latestLog?.image_url || null);
                            setIsEditMode(true);
                          }}
                          className="w-full text-[14px] flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary-hover text-white font-black rounded-xl transition-all shadow-md shadow-primary/10 hover:shadow-primary/25 cursor-pointer mt-4"
                        >
                          <FileText className="w-4 h-4" /> แก้ไขข้อมูล
                        </button>
                      )}
                    </div>
                  ) : (
                    // === BACKOFFICE STATE 1, 2, 4: EDIT / ACTION FORM ===
                    <div className="space-y-4 sm:space-y-5 w-full min-w-0">
                      {saveMessage && (
                        <div className={`p-3.5 rounded-xl text-xs font-bold ${
                          saveMessage.type === 'success' 
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                            : 'bg-rose-50 text-rose-600 border border-rose-200'
                        }`}>
                          {saveMessage.text}
                        </div>
                      )}

                      <div className="space-y-1.5 relative">
                        <label className="block text-[12px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          สถานะคำร้อง
                        </label>
                        <div className="relative">
                          <AppSelect
                            value={selectedStatus}
                            onChange={(val) => setSelectedStatus(val as string)}
                            disabled={isSaving}
                            options={[
                              { label: 'เลือกสถานะ...', value: '' },
                              ...(data.status === 'pending' ? [{ label: STATUS_DETAILS.pending.label, value: 'pending' }] : []),
                              { label: STATUS_DETAILS.received.label, value: 'received' },
                              { label: STATUS_DETAILS.in_progress.label, value: 'in_progress' },
                              { label: STATUS_DETAILS.completed.label, value: 'completed' },
                              { label: STATUS_DETAILS.rejected.label, value: 'rejected' },
                              { label: STATUS_DETAILS.cancelled.label, value: 'cancelled' },
                              ...(userRole !== 'staff' ? [{ label: 'โอนคำร้อง', value: 'transfer' }] : [])
                            ]}
                          />
                          {!hasAnyChange && (
                            <p className="text-[12px] text-rose-500 font-medium mt-1.5 animate-fade-in">
                              กรุณาเลือกสถานะใหม่ หรือเพิ่มหมายเหตุ
                            </p>
                          )}
                        </div>
                      </div>

                      {selectedStatus === 'transfer' && (
                        <div className="space-y-1.5 relative mt-1">
                          <label className="block text-[12px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            โอนคำร้องไปยังหน่วยงาน
                          </label>
                          <div className="relative">
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
                        </div>
                      )}

                      {selectedStatus === 'completed' && (
                        <div className="space-y-1.5 mt-2 w-full min-w-0">
                          <label className="block text-[12px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between mb-1">
                            <span>ภาพประกอบการทำงาน <span className="text-rose-500">*</span></span>
                          </label>
                          
                          <div className="mt-1 w-full min-w-0">
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
                                className={`w-full h-32 sm:h-36 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center gap-2 ${!isSaving ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-primary/50' : 'opacity-50'} transition-colors group box-border`}
                              >
                                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                  <ImagePlus className="w-5 h-5 text-slate-400" />
                                </div>
                                <div className="text-center px-2">
                                  <p className="text-[13px] font-bold text-slate-700 dark:text-slate-300">คลิกเพื่ออัปโหลดรูปภาพ</p>
                                  <p className="text-[11px] text-slate-500 mt-0.5">รองรับ JPG, PNG สูงสุด 5MB</p>
                                </div>
                              </div>
                            ) : (
                              <div className="relative w-full max-h-52 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden group border border-slate-200 flex items-center justify-center box-border">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={completionImagePreview} alt="Preview" className="w-full h-auto max-h-52 object-contain" />
                                {!isSaving && (
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
                                    <button
                                      type="button"
                                      onClick={() => fileInputRef.current?.click()}
                                      className="px-3.5 py-1.5 bg-white text-slate-700 rounded-lg text-xs font-bold shadow-sm hover:bg-slate-50 cursor-pointer"
                                    >
                                      เปลี่ยนรูป
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCompletionImage(null);
                                        setCompletionImagePreview(null);
                                      }}
                                      className="px-3.5 py-1.5 bg-rose-500 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-rose-600 cursor-pointer"
                                    >
                                      ลบรูป
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5 mt-2">
                        <label className="block text-[12px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          หมายเหตุสรุปผล
                        </label>
                        <textarea
                          rows={4}
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          placeholder="ระบุรายละเอียดการดำเนินงานหรือผลการแก้ไข..."
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary/20 rounded-xl p-3.5 text-[14px] font-medium text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition-all outline-none resize-y min-h-[90px] disabled:opacity-50"
                          disabled={isSaving}
                        />
                      </div>

                      <div className="flex gap-2.5 sm:gap-3 pt-2">
                        {isCompleted && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditMode(false);
                              setAdminNotes(latestLog?.remark || "");
                              setCompletionImage(null);
                              setCompletionImagePreview(latestLog?.image_url || null);
                              setSaveMessage(null);
                            }}
                            disabled={isSaving}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[14px] rounded-xl cursor-pointer transition-colors shadow-sm disabled:opacity-50 disabled:pointer-events-none"
                          >
                            ยกเลิก
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleSaveStatus}
                          disabled={isSaving || !hasAnyChange}
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:pointer-events-none text-white font-black text-[14px] rounded-xl cursor-pointer transition-all shadow-md shadow-primary/10 hover:shadow-primary/25"
                        >
                          {isSaving ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>กำลังบันทึก...</span>
                            </>
                          ) : (
                            <span>บันทึกข้อมูล</span>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          <ReportTimeline logs={logs} />
        </div>
      </div>

      {mounted && fullscreenImage && createPortal(
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
