"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { AppNavbar } from "@/components/shared/AppNavbar";
import { AppContainer } from "@/components/design-system/AppContainer";
import { AppCard } from "@/components/design-system/AppCard";
import { StatusBadge } from "@/components/design-system/StatusBadge";
import { AppButton } from "@/components/design-system/AppButton";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Report, STATUS_DETAILS } from "@/types/report";
import { GlobalFooter } from "@/components/shared/GlobalFooter";
import { 
  Calendar, 
  RefreshCcw, 
  FileText, 
  Image as ImageIcon, 
  User, 
  Mail, 
  Phone,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Plus
} from "lucide-react";

interface TrackPageProps {
  params: Promise<{
    publicId: string;
  }>;
}

export default function TrackPage({ params }: TrackPageProps) {
  const { publicId } = use(params);

  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // สถานะการคัดลอกลิงก์
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    async function fetchReport() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/reports/${publicId}`);
        const result = await res.json();

        if (!res.ok) {
          throw new Error(result.error || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
        }

        if (!result.report) {
          setError("ไม่พบข้อมูลรายงาน");
          return;
        }

        setReport(result.report as Report);
      } catch (err: any) {
        setError(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
      } finally {
        setLoading(false);
      }
    }

    if (publicId) {
      fetchReport();
    }
  }, [publicId]);

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

  if (loading) {
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
              {error || "หมายเลขอ้างอิงที่คุณระบุไม่ถูกต้อง หรือถูกลบออกจากระบบแล้ว"}
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

  // Reduce timeline events to max 3 items
  const rawLogs = [...(report.report_logs || [])].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  
  const displayLogs: any[] = [];
  
  // 1. Created Event
  const createdLog = rawLogs.find(l => l.action === 'created');
  if (createdLog) {
    displayLogs.push({
      ...createdLog,
      custom_label: 'ส่งเรื่องเข้าระบบแล้ว'
    });
  }

  // 2. In Progress Event (combine received and in_progress)
  const inProgressLogs = rawLogs.filter(l => l.new_status === 'in_progress');
  if (inProgressLogs.length > 0) {
    const latestInProgress = inProgressLogs[inProgressLogs.length - 1];
    displayLogs.push({
      ...latestInProgress,
      new_status: 'in_progress',
      custom_label: 'กำลังดำเนินการ'
    });
  }

  // 3. Final Event
  const finalLogs = rawLogs.filter(l => ['completed', 'rejected', 'cancelled'].includes(l.new_status));
  if (finalLogs.length > 0) {
    const latestFinal = finalLogs[finalLogs.length - 1];
    let finalLabel = "เสร็จสิ้น";
    if (latestFinal.new_status === 'rejected') finalLabel = "ไม่สามารถดำเนินการได้";
    if (latestFinal.new_status === 'cancelled') finalLabel = "ยกเลิกรายการ";
    
    displayLogs.push({
      ...latestFinal,
      custom_label: finalLabel
    });
  }

  const sortedLogs = displayLogs.reverse();

  return (
    <AppContainer>
      <div className="flex-1 flex flex-col overflow-y-auto bg-[#F4F6F8] min-h-screen">
        
        {/* 1. Header Section (นอก Card ตาม Reference Image) */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-3xl mx-auto w-full p-6 md:p-6">
            <div className="flex items-center gap-4 mb-4">
               <button onClick={handleBack} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors border border-slate-100">
                  <ArrowLeft className="w-5 h-5" />
               </button>
               <div>
                 <span className="text-[13px] text-slate-400 font-medium block mb-0.5">รายงาน</span>
                 <h1 className="text-[20px] font-bold text-slate-800 tracking-tight leading-none">{report.public_id}</h1>
               </div>
               <div className="ml-auto">
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

        <div className="p-6 md:p-6 pb-12 space-y-6 max-w-3xl mx-auto w-full">
          
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

          

          {/* 6. TIMELINE SECTION */}
          <div className="mt-8">
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
                     const statusInfo = log.custom_label ? { label: log.custom_label } : (STATUS_DETAILS[log.new_status as keyof typeof STATUS_DETAILS] || { label: log.action || "อัปเดต" });
                     const staffName = log.action === "created" 
                       ? "ระบบ" 
                       : (log.staff_users?.full_name || "เจ้าหน้าที่");
                     
                     let Icon = Clock;
                     if (log.new_status === 'in_progress') Icon = RefreshCcw;
                     if (log.new_status === 'completed') Icon = CheckCircle2;
                     
                     const isLogCompleted = log.new_status === 'completed';
                     
                     let circleColorClass = 'border-slate-200 text-slate-400 bg-white';
                     let titleColorClass = 'text-slate-600';
                     let boxColorClass = 'bg-slate-50 text-slate-600 border border-transparent';
                     
                     if (isLogCompleted) {
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

          {/* 7. BOTTOM ACTIONS */}
          <div className="flex flex-col gap-3 pt-6 pb-6">
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
          
          <div className="pt-6">
            <GlobalFooter />
          </div>
        </div>
      </div>
    </AppContainer>
  );
}