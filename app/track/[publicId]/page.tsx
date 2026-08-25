"use client";

import React, { use, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AppNavbar } from "@/components/shared/AppNavbar";
import { AppContainer } from "@/components/design-system/AppContainer";
import { AppCard } from "@/components/design-system/AppCard";
import { StatusBadge } from "@/components/design-system/StatusBadge";
import { AppButton } from "@/components/design-system/AppButton";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Report, ReportStatus, STATUS_DETAILS, getStatusLabel } from "@/types/report";
import { GlobalFooter } from "@/components/shared/GlobalFooter";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { 
  Calendar, 
  RefreshCcw, 
  FileText, 
  Image as ImageIcon, 
  User, 
  Mail, 
  Phone,
  CheckCircle2,
  Maximize2,
  X,
  Clock,
  ArrowLeft,
  ArrowRightLeft,
  Plus,
  Inbox,
  AlertTriangle
} from "lucide-react";

export interface PublicTimelineMilestone {
  key: string;
  status: string;
  label: string;
  created_at: string;
  remark: string | null;
  image_url?: string | null;
  staff_users?: { full_name: string } | null;
}

export function extractPublicMilestones(report?: Report | null): PublicTimelineMilestone[] {
  if (!report) return [];

  const rawLogs = [...(report.report_logs || [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const milestones: PublicTimelineMilestone[] = [];

  // 1. Initial Submission Milestone (ส่งเรื่องเข้าระบบแล้ว)
  const createdLog = rawLogs.find(l => l.action === 'created');
  milestones.push({
    key: 'created',
    status: 'pending',
    label: 'ส่งเรื่องเข้าระบบแล้ว',
    created_at: createdLog?.created_at || report.created_at,
    remark: createdLog?.remark || null,
    image_url: createdLog?.image_url || null,
    staff_users: createdLog?.staff_users || null
  });

  // 2. Track seen statuses to prevent duplicate status entries
  const seenStatuses = new Set<string>(['pending']);

  for (const log of rawLogs) {
    if (log.action === 'created') continue;

    // Note-only updates (without status change) are internal logs -> do not create duplicate public milestone
    if (log.action === 'note_updated') {
      const existing = milestones.find(m => m.status === log.new_status);
      if (existing && log.remark) {
        existing.remark = log.remark;
      }
      if (existing && log.staff_users) {
        existing.staff_users = log.staff_users;
      }
      continue;
    }

    if (log.action === 'transfer') {
      milestones.push({
        key: `transfer-${log.id}`,
        status: 'transfer',
        label: 'โอนคำร้อง',
        created_at: log.created_at,
        remark: log.remark || null,
        image_url: log.image_url || null,
        staff_users: log.staff_users || null
      });
      continue;
    }

    // Status change event
    const targetStatus = log.new_status;
    if (!targetStatus) continue;

    // Prevent duplicate milestone if the status hasn't changed or has already been recorded
    if (seenStatuses.has(targetStatus)) {
      const existing = milestones.find(m => m.status === targetStatus);
      if (existing && log.remark) {
        existing.remark = log.remark;
      }
      if (existing && log.staff_users) {
        existing.staff_users = log.staff_users;
      }
      continue;
    }

    seenStatuses.add(targetStatus);
    const statusConfig = STATUS_DETAILS[targetStatus as ReportStatus];
    milestones.push({
      key: `status-${targetStatus}-${log.id}`,
      status: targetStatus,
      label: statusConfig?.label || getStatusLabel(targetStatus),
      created_at: log.created_at,
      remark: log.remark || null,
      image_url: log.image_url || null,
      staff_users: log.staff_users || null
    });
  }

  // Sort descending (latest milestone on top)
  return milestones.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

interface TrackPageProps {
  params: Promise<{
    publicId: string;
  }>;
}

export default function TrackPage({ params }: TrackPageProps) {
  const { publicId } = use(params);

  const router = useRouter();
  
  const { data, error, isLoading } = useSWR(
    publicId ? `/api/reports/${publicId}` : null,
    fetcher
  );
  
  const report = data?.report as Report | undefined;
  
  // สถานะการคัดลอกลิงก์
  const [copied, setCopied] = useState<boolean>(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // ฟังก์ชันสำหรับการคัดลอกลิงก์
  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // รีเซ็ตกลับเป็นปกติหลัง 2 วินาที
    }).catch(err => {
      console.error('Failed to copy link: ', err);
    });
  };

  if (isLoading) {
    return (
      <AppContainer>
        <AppNavbar />
        <div className="flex-1 p-5 md:p-8 flex items-center justify-center bg-[#F8FAFC]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500 font-medium">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      </AppContainer>
    );
  }

  if (error || !report) {
    return (
      <AppContainer>
        <AppNavbar />
        <div className="flex-1 p-5 md:p-8 flex items-center justify-center bg-[#F8FAFC]">
          <AppCard className="max-w-md w-full text-center py-10 shadow-sm border-[#EDF0F4]">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-red-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">ไม่พบข้อมูล</h2>
            <p className="text-slate-500 mb-6 px-4">
              {error?.message || "หมายเลขอ้างอิงที่คุณระบุไม่ถูกต้อง หรือถูกลบออกจากระบบแล้ว"}
            </p>
            <Link href="/">
              <AppButton variant="primary">กลับสู่หน้าหลัก</AppButton>
            </Link>
          </AppCard>
        </div>
      </AppContainer>
    );
  }

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  const currentStatusInfo = STATUS_DETAILS[report.status] || STATUS_DETAILS.pending;
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', { 
      day: '2-digit', month: 'short', year: 'numeric',
    }) + ', ' + new Date(dateString).toLocaleTimeString('th-TH', {
      hour: '2-digit', minute: '2-digit'
    }) + ' น.';
  };

  const sortedLogs = extractPublicMilestones(report);
  const completionLog = sortedLogs.find(log => log.status === 'completed');
  const isCompleted = report.status === 'completed';

  return (
    <AppContainer maxWidthClass="lg:max-w-6xl">
      <div className="flex-1 flex flex-col overflow-y-auto bg-[#F4F6F8] min-h-screen">
        
        {/* 1. Header Section (นอก Card ตาม Reference Image) */}
        <div className="bg-white border-b border-slate-200">
          <div className="w-full p-6 md:p-8">
            <div className="flex items-center gap-4 mb-4">
               <button onClick={handleBack} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors border border-slate-100 shrink-0">
                  <ArrowLeft className="w-5 h-5" />
               </button>
               <div>
                 <span className="text-[13px] text-slate-400 font-medium block mb-0.5">รายงาน</span>
                 <h1 className="text-[20px] font-bold text-slate-800 tracking-tight leading-none break-all">{report.public_id}</h1>
               </div>
               <div className="ml-auto shrink-0">
                 <StatusBadge status={report.status} label={currentStatusInfo.label} />
               </div>
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

              {isCompleted && completionLog && (
                <div className="space-y-4">
                  <AppCard className="!p-0 border-emerald-200 shadow-sm bg-white rounded-[16px] overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50 rounded-t-[16px]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <h3 className="text-[16px] font-bold text-emerald-800 tracking-wide">การตอบกลับของเจ้าหน้าที่</h3>
                      </div>
                    </div>
                    
                    <div className="space-y-4 p-5">
                      {completionLog.remark && (
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">หมายเหตุสรุปผล</span>
                          <p className="text-[13px] text-slate-700 whitespace-pre-wrap">{completionLog.remark}</p>
                        </div>
                      )}
                      {completionLog.image_url && (
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block mb-2 uppercase tracking-wider">ภาพประกอบการทำงาน</span>
                          <div onClick={() => setFullscreenImage(completionLog.image_url || null)} className="relative w-full h-[180px] sm:h-[200px] bg-slate-50 rounded-xl overflow-hidden border border-slate-200 hover:opacity-90 transition-opacity cursor-pointer group flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={completionLog.image_url} alt="ภาพผลการดำเนินงาน" className="max-w-full max-h-full object-contain" />
                            <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-200">
                              <div className="flex items-center gap-1.5 bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-sm">
                                <Maximize2 className="w-4 h-4" />
                                <span className="text-xs font-bold">ขยายภาพขนาดเต็ม</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500">
                        <span>ดำเนินการโดย: <span className="font-semibold text-slate-600">{completionLog.staff_users?.full_name || 'เจ้าหน้าที่'}</span></span>
                        <span>เวลา: <span className="font-semibold text-slate-600">{new Date(completionLog.created_at).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.</span></span>
                      </div>
                    </div>
                  </AppCard>
                </div>
              )}

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
                     const config = log.status === 'transfer' 
                       ? {
                           label: 'โอนคำร้อง',
                           colorClass: 'text-purple-700 dark:text-purple-400',
                           bgClass: 'bg-purple-50 dark:bg-purple-950/20',
                           borderClass: 'border-purple-200 dark:border-purple-900/50',
                           dotClass: 'bg-purple-500',
                           icon: 'ArrowRightLeft'
                         }
                       : STATUS_DETAILS[log.status as ReportStatus] || STATUS_DETAILS.pending;

                     let Icon = Clock;
                     if (config.icon === 'Inbox') Icon = Inbox;
                     else if (config.icon === 'Play') Icon = RefreshCcw;
                     else if (config.icon === 'CheckCircle2') Icon = CheckCircle2;
                     else if (config.icon === 'XCircle') Icon = X;
                     else if (config.icon === 'AlertTriangle') Icon = AlertTriangle;
                     else if (log.status === 'transfer') Icon = ArrowRightLeft;

                     return (
                       <div key={log.key || log.status} className="relative pl-10">
                         {/* Circle Icon Indicator styled with System Design System */}
                         <div className={`absolute -left-[16px] top-0 w-8 h-8 rounded-full border-2 flex items-center justify-center ${config.bgClass} ${config.colorClass} ${config.borderClass}`}>
                            <Icon className={`w-3.5 h-3.5 ${isActive && log.status === 'in_progress' ? 'animate-spin-slow' : ''}`} />
                         </div>
                         
                         <div className="flex flex-col pt-1">
                            <h4 className={`text-[14px] font-bold mb-1.5 ${config.colorClass}`}>
                              {log.label}
                            </h4>
                            
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium mb-2">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>{formatDate(log.created_at)}</span>
                            </div>
                            
                            {log.remark && (
                              <div className={`rounded-xl p-3.5 text-[13px] leading-relaxed border ${config.bgClass} ${config.colorClass} ${config.borderClass}`}>
                                {log.remark}
                              </div>
                            )}
                         </div>
                       </div>
                     );
                   })}
                </div>
              </div>
            </AppCard>

            {/* 7. BOTTOM ACTIONS */}
            <div className="flex flex-col gap-3">
              <Link href="/" className="block">
                <button 
                  type="button" 
                  className="w-full h-[52px] rounded-[18px] bg-[#D1350F] text-white font-bold text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-[#D1350F]/20 active:scale-[0.98] transition-transform"
                >
                  <Plus className="w-5 h-5" />
                  แจ้งปัญหาใหม่
                </button>
              </Link>
              
              <button 
                type="button" 
                onClick={handleCopyLink}
                className="w-full h-[52px] rounded-[18px] bg-[#F3F4F6] border border-[#E5E7EB] text-slate-700 font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:bg-[#E5E7EB]"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                    <span className="text-[#10B981]">คัดลอกลิงก์สำเร็จแล้ว</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5 text-slate-500" />
                    คัดลอกลิงก์
                  </>
                )}
              </button>
            </div>
          </div>
          {/* End of Right Column */}
          
          </div>
          {/* End of Grid */}
          
          <div className="pt-6">
            <GlobalFooter />
          </div>
        </div>
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