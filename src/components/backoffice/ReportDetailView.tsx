"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
  History
} from 'lucide-react';
import { AppSelect } from "@/components/ui/AppSelect";
import useSWR, { mutate as globalMutate } from 'swr';
import { fetcherWithAuth } from '@/lib/fetcher';
import dynamic from 'next/dynamic';

const ReportTimeline = dynamic(
  () => import('@/components/backoffice/ReportTimeline').then(mod => mod.ReportTimeline),
  { ssr: false }
);

interface ReportDetailViewProps {
  publicId: string;
  userRole: string | undefined;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "text-slate-600 bg-slate-100 border-slate-200",
  in_progress: "text-[#F59E0B] bg-amber-50 border-amber-200",
  completed: "text-[#22C55E] bg-green-50 border-green-200",
  cancelled: "text-[#EF4444] bg-red-50 border-red-200"
};

const STATUS_LABELS: Record<string, string> = {
  pending: "รับเรื่องแล้ว",
  in_progress: "กำลังดำเนินการ",
  completed: "เสร็จสิ้น",
  cancelled: "ไม่สามารถดำเนินการได้"
};

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
  const [isFullscreenImage, setIsFullscreenImage] = useState(false);
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
    }
  }, [reportData]);

  const handleSaveStatus = async () => {
    if (!data) return;
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("ไม่พบเซสชัน กรุณาเข้าสู่ระบบใหม่");

      const isStatusChanged = selectedStatus !== data.status;
      const isRemarkChanged = adminNotes.trim().length > 0;

      if (selectedStatus === 'transfer') {
        if (!selectedDepartmentId) {
          setSaveMessage({ type: 'error', text: 'กรุณาเลือกหน่วยงานปลายทาง' });
          setIsSaving(false);
          return;
        }
      } else if (!isStatusChanged && !isRemarkChanged) {
        setSaveMessage({ type: 'error', text: 'กรุณาเลือกสถานะใหม่ หรือระบุหมายเหตุ' });
        setIsSaving(false);
        return;
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
          departmentId: selectedStatus === 'transfer' ? selectedDepartmentId : undefined
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
      mutateReport();
      // Invalidate dashboard caches
      globalMutate(
        (key) => typeof key === 'string' && key.startsWith('/api/backoffice/dashboard'),
        undefined,
        { revalidate: true }
      );
      
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
      <div className="space-y-6 animate-pulse p-6 md:px-[50px] md:py-8 w-full">
        <div className="h-10 w-40 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
          <div className="col-span-1 lg:col-span-7 h-[600px] bg-white dark:bg-slate-900 rounded-[20px]" />
          <div className="col-span-1 lg:col-span-3 h-[600px] bg-white dark:bg-slate-900 rounded-[20px]" />
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

  const getStatusColorClass = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-blue-500 text-white dark:bg-blue-600';
      case 'in_progress':
        return 'bg-amber-500 text-white dark:bg-amber-600';
      case 'completed':
        return 'bg-emerald-500 text-white dark:bg-emerald-600';
      case 'cancelled':
        return 'bg-rose-500 text-white dark:bg-rose-600';
      default:
        return 'bg-slate-500 text-white';
    }
  };

  const logs = data.report_logs || [];

  return (
    <div className="space-y-6 animate-fade-in p-6 md:px-[50px] md:py-8 w-full">
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

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
        
        {/* LEFT COLUMN: 70% width on Desktop */}
        <div className="col-span-1 lg:col-span-7 space-y-6">
          
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
                <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${getStatusColorClass(data.status)} shadow-sm`}>
                  {STATUS_LABELS[data.status] || data.status}
                </span>
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
                <h5 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">สถานที่ชำรุด</h5>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-5 h-5 text-primary shrink-0" />
                  {data.room_number || "ไม่ระบุ"}
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
                      onClick={() => setIsFullscreenImage(true)}
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
                  <p className="text-slate-800 dark:text-slate-200 font-semibold font-mono">{data.reporter_phone || "-"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 30% width on Desktop */}
        <div className="col-span-1 lg:col-span-3 space-y-6">
          
          <div className="bg-white dark:bg-slate-900 p-6 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow space-y-5 no-print">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-50 dark:border-slate-800/40 pb-3 mb-1 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              การจัดการสถานะและมอบหมาย
            </h4>

            {saveMessage && (
              <div className={`p-3 rounded-xl text-xs font-bold ${
                saveMessage.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                  : 'bg-rose-50 text-rose-600 border border-rose-200'
              }`}>
                {saveMessage.text}
              </div>
            )}

            <div className="space-y-1.5 relative">
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                ปรับปรุงสถานะคำร้อง
              </label>
              
              <div className="relative">
                <AppSelect
                  value={selectedStatus}
                  onChange={(val) => setSelectedStatus(val as string)}
                  options={[
                    { label: 'รับเรื่องแล้ว', value: 'pending' },
                    { label: 'กำลังดำเนินการ', value: 'in_progress' },
                    { label: 'เสร็จสิ้น', value: 'completed' },
                    { label: 'ไม่สามารถดำเนินการได้', value: 'cancelled' },
                    ...(userRole !== 'staff' ? [{ label: 'โอนคำร้อง', value: 'transfer' }] : [])
                  ]}
                />
              </div>
            </div>

            {selectedStatus === 'transfer' && (
              <div className="space-y-1.5 relative mt-1">
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  โอนคำร้องไปยังหน่วยงาน
                </label>
                <div className="relative">
                  <AppSelect
                    value={selectedDepartmentId.toString()}
                    onChange={(val) => setSelectedDepartmentId(Number(val))}
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

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                หมายเหตุจากเจ้าหน้าที่ปฏิบัติงาน
              </label>
              <textarea
                rows={4}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="เพิ่มรายละเอียดการดำเนินงาน ขั้นตอนการเข้าซ่อม อะไหล่ หรือข้อติดขัดต่างๆ..."
                className="w-full bg-slate-50 dark:bg-slate-800 border-0 focus:ring-2 focus:ring-primary/20 rounded-xl p-3.5 text-xs font-medium text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition-all outline-none resize-none"
              />
            </div>

            <button
              onClick={handleSaveStatus}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:pointer-events-none text-white font-black text-sm rounded-xl cursor-pointer transition-all shadow-md shadow-primary/10 hover:shadow-primary/25"
            >
              {isSaving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>กำลังบันทึกข้อมูล...</span>
                </>
              ) : (
                <span>บันทึกความคืบหน้า</span>
              )}
            </button>
          </div>

          <ReportTimeline logs={logs} />
        </div>
      </div>

      {isFullscreenImage && data.image_url && (
        <div 
          className="fixed inset-0 bg-black/90 z-[200] flex flex-col items-center justify-center p-4"
          onClick={() => setIsFullscreenImage(false)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              onClick={() => setIsFullscreenImage(false)}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={data.image_url} 
            alt="Report image" 
            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
          />
          <p className="text-white text-sm font-bold mt-4 px-4 py-2 bg-white/10 rounded-full text-center max-w-lg">
            {data.title || data.description} • {data.room_number || "ไม่ระบุ"}
          </p>
        </div>
      )}
    </div>
  );
};
