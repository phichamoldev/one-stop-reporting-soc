"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  User, 
  Mail, 
  Phone, 
  MessageSquare, 
  Check, 
  Clock, 
  Printer,
  Maximize2,
  X,
  History,
  AlertTriangle,
  Play,
  ChevronDown
} from 'lucide-react';

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedStatus, setSelectedStatus] = useState<string>('pending');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [isFullscreenImage, setIsFullscreenImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!publicId) return;
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${publicId}`);
      const resData = await res.json();
      if (resData.error) throw new Error(resData.error);
      setData(resData.report);
      setSelectedStatus(resData.report.status);
    } catch (err: any) {
      console.error(err);
      setError("ไม่สามารถโหลดข้อมูลคำร้องได้");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [publicId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveStatus = async () => {
    if (!data) return;
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("ไม่พบเซสชัน กรุณาเข้าสู่ระบบใหม่");

      const isStatusChanged = selectedStatus !== data.status;
      const isRemarkChanged = adminNotes.trim().length > 0;

      if (!isStatusChanged && !isRemarkChanged) {
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
          status: isStatusChanged ? selectedStatus : undefined,
          remark: isRemarkChanged ? adminNotes : undefined,
          oldStatus: data.status
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }

      setSaveMessage({ type: 'success', text: 'อัปเดตสถานะเรียบร้อยแล้ว' });
      setAdminNotes("");
      await fetchData(true);

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
      <div className="space-y-8 animate-pulse">
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

  const getTimelineIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center border-4 border-white dark:border-slate-900 z-10 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        );
      case 'in_progress':
        return (
          <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 flex items-center justify-center border-4 border-white dark:border-slate-900 z-10 shrink-0">
            <Play className="w-5 h-5 rotate-90" />
          </div>
        );
      case 'completed':
        return (
          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center justify-center border-4 border-white dark:border-slate-900 z-10 shrink-0">
            <Check className="w-5 h-5" />
          </div>
        );
      case 'cancelled':
        return (
          <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 flex items-center justify-center border-4 border-white dark:border-slate-900 z-10 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 flex items-center justify-center border-4 border-white dark:border-slate-900 z-10 shrink-0">
            <X className="w-5 h-5" />
          </div>
        );
    }
  };

  const logs = data.report_logs || [];

  return (
    <div className="space-y-6 animate-fade-in p-6 md:p-8 max-w-6xl mx-auto w-full">
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
          
          <div className="bg-white dark:bg-slate-900 p-6 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow sticky top-6 space-y-5 no-print">
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
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`w-full flex items-center justify-between bg-white dark:bg-slate-800 border ${isDropdownOpen ? 'border-primary ring-4 ring-primary/10' : 'border-slate-200 dark:border-slate-700'} rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer transition-all shadow-sm`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      selectedStatus === 'pending' ? 'bg-blue-500' :
                      selectedStatus === 'in_progress' ? 'bg-amber-500' :
                      selectedStatus === 'completed' ? 'bg-emerald-500' :
                      'bg-rose-500'
                    }`} />
                    {STATUS_LABELS[selectedStatus] || selectedStatus}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsDropdownOpen(false)} 
                    />
                    <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden py-1 animate-fade-in">
                      {[
                        { id: 'pending', label: 'รับเรื่องแล้ว', color: 'bg-blue-500', bg: 'hover:bg-blue-50 dark:hover:bg-blue-900/20' },
                        { id: 'in_progress', label: 'กำลังดำเนินการ', color: 'bg-amber-500', bg: 'hover:bg-amber-50 dark:hover:bg-amber-900/20' },
                        { id: 'completed', label: 'เสร็จสิ้น', color: 'bg-emerald-500', bg: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20' },
                        { id: 'cancelled', label: 'ไม่สามารถดำเนินการได้', color: 'bg-rose-500', bg: 'hover:bg-rose-50 dark:hover:bg-rose-900/20' }
                      ].map((status) => (
                        <button
                          key={status.id}
                          type="button"
                          onClick={() => {
                            setSelectedStatus(status.id);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold transition-colors ${status.bg} ${selectedStatus === status.id ? 'bg-slate-50 dark:bg-slate-800' : ''}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${status.color}`} />
                          <span className={selectedStatus === status.id ? 'text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'}>
                            {status.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

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
              disabled={isSaving || (userRole !== 'super_admin' && userRole !== 'admin')}
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

          <div className="bg-white dark:bg-slate-900 p-6 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-50 dark:border-slate-800/40 pb-4 mb-5 flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              บันทึกประวัติการดำเนินงาน (Logs)
            </h4>

            {logs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">ไม่มีประวัติการบันทึกงาน</p>
            ) : (
              <div className="relative pl-2.5 space-y-6 before:absolute before:left-6 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 dark:before:bg-slate-800">
                {logs.map((log: any) => (
                  <div key={log.id} className="relative flex gap-4 items-start">
                    {getTimelineIcon(log.new_status)}
                    <div className="flex-1 bg-slate-50/50 dark:bg-slate-800/20 p-3.5 rounded-2xl border border-slate-100/50 dark:border-slate-800/20 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">
                          เปลี่ยนสถานะเป็น {STATUS_LABELS[log.new_status] || log.new_status}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                        </span>
                      </div>
                      
                      <p className="text-[10px] text-slate-400 font-bold mb-2">
                        ผู้ดำเนินการ: {log.staff_profiles?.full_name || "ระบบ"}
                      </p>

                      {log.remark && (
                        <div className="bg-white dark:bg-slate-800/60 p-2.5 rounded-xl text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed border border-slate-50 dark:border-slate-700/40 whitespace-pre-line">
                          {log.remark}
                        </div>
                      )}

                      <div className="mt-2 text-[10px] font-semibold text-slate-400">
                        {new Date(log.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
