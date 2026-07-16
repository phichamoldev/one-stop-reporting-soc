/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  User, 
  Mail, 
  Phone, 
  Building, 
  MessageSquare, 
  Check, 
  Clock, 
  AlertCircle,
  FileText,
  Printer,
  Maximize2,
  X,
  PlusCircle,
  TrendingUp,
  History,
  AlertTriangle,
  Play
} from 'lucide-react';
import { Report, ReportLog, ReportStatus, Staff } from '../types';

interface ReportDetailViewProps {
  reportId: string;
  reports: Report[];
  logs: ReportLog[];
  staff: Staff[];
  onBack: () => void;
  onUpdateReport: (
    id: string, 
    newStatus: ReportStatus, 
    notes: string, 
    operatorName: string
  ) => void;
}

export const ReportDetailView: React.FC<ReportDetailViewProps> = ({
  reportId,
  reports,
  logs,
  staff,
  onBack,
  onUpdateReport
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<ReportStatus>('รับเรื่องแล้ว');
  const [adminNotes, setAdminNotes] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('');
  const [isFullscreenImage, setIsFullscreenImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load report details
  const report = reports.find(r => r.id === reportId);
  const filteredLogs = logs
    .filter(l => l.reportId === reportId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Latest first

  // Simulated Skeleton loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 4500-4000);
    return () => clearTimeout(timer);
  }, []);

  // Initialize status and notes on mount
  useEffect(() => {
    if (report) {
      setSelectedStatus(report.status);
      setAdminNotes(report.notes || '');
      setSelectedStaff(report.assignedStaff || '');
    }
  }, [report]);

  if (isLoading || !report) {
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

  const getStatusColorClass = (status: ReportStatus) => {
    switch (status) {
      case 'รับเรื่องแล้ว':
        return 'bg-blue-500 text-white dark:bg-blue-600';
      case 'กำลังดำเนินการ':
        return 'bg-amber-500 text-white dark:bg-amber-600';
      case 'เสร็จสิ้น':
        return 'bg-emerald-500 text-white dark:bg-emerald-600';
      case 'ไม่สามารถดำเนินการได้':
        return 'bg-rose-500 text-white dark:bg-rose-600';
      case 'ยกเลิกรายการ':
        return 'bg-slate-500 text-white dark:bg-slate-600';
      default:
        return 'bg-slate-500 text-white';
    }
  };

  const handleSaveStatus = () => {
    setIsSaving(true);
    // Simulate tiny database save time
    setTimeout(() => {
      onUpdateReport(report.id, selectedStatus, adminNotes, 'ผู้ดูแลระบบกลาง');
      setIsSaving(false);
    }, 600);
  };

  const handlePrint = () => {
    window.print();
  };

  // Timeline item icon helper
  const getTimelineIcon = (status: ReportStatus) => {
    switch (status) {
      case 'รับเรื่องแล้ว':
        return (
          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center border-4 border-white dark:border-slate-900 z-10 shrink-0">
            <Clock className="w-4.5 h-4.5" />
          </div>
        );
      case 'กำลังดำเนินการ':
        return (
          <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 flex items-center justify-center border-4 border-white dark:border-slate-900 z-10 shrink-0">
            <Play className="w-4.5 h-4.5 rotate-90" />
          </div>
        );
      case 'เสร็จสิ้น':
        return (
          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center justify-center border-4 border-white dark:border-slate-900 z-10 shrink-0">
            <Check className="w-4.5 h-4.5" />
          </div>
        );
      case 'ไม่สามารถดำเนินการได้':
        return (
          <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 flex items-center justify-center border-4 border-white dark:border-slate-900 z-10 shrink-0">
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
        );
      case 'ยกเลิกรายการ':
        return (
          <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 flex items-center justify-center border-4 border-white dark:border-slate-900 z-10 shrink-0">
            <X className="w-4.5 h-4.5" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>ย้อนกลับไปหน้าจัดการคำร้อง</span>
        </button>

        {/* Action button row */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>พิมพ์รายงาน (PDF)</span>
          </button>
        </div>
      </div>

      {/* Main Print Container Wrapper */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
        
        {/* LEFT COLUMN: 70% width on Desktop */}
        <div className="col-span-1 lg:col-span-7 space-y-6">
          
          {/* Main Info Card */}
          <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow">
            
            {/* Header info bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-50 dark:border-slate-800/60 pb-5 mb-6 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">ใบงานแจ้งซ่อมเลขที่</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400">
                    {report.priority}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono tracking-tight">
                  {report.id}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-bold">สถานะปัจจุบัน:</span>
                <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${getStatusColorClass(report.status)} shadow-xs`}>
                  {report.status}
                </span>
              </div>
            </div>

            {/* Timestamps Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl mb-6 text-xs text-slate-500 dark:text-slate-400 font-semibold border border-slate-100/50 dark:border-slate-800/20">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span>วันที่รับเรื่องแจ้ง: {formatThaiDate(report.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 pt-2.5 md:pt-0 md:pl-4">
                <History className="w-4 h-4 text-slate-400 shrink-0" />
                <span>อัปเดตล่าสุด: {formatThaiDate(report.updatedAt)}</span>
              </div>
            </div>

            {/* Report Content Details */}
            <div className="space-y-6">
              <div>
                <p className="text-lg font-black text-slate-800 dark:text-slate-100 leading-snug">
                  {report.title}
                </p>
              </div>

              {/* Categories block */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-5 border-b border-slate-50 dark:border-slate-800/30">
                <div>
                  <h5 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">หมวดหมู่หลัก</h5>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    📂 {report.mainCategory}
                  </span>
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">หมวดหมู่ย่อย</h5>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    🔧 {report.subCategory}
                  </span>
                </div>
              </div>

              {/* Location details */}
              <div className="pb-5 border-b border-slate-50 dark:border-slate-800/30">
                <h5 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">สถานที่ชำรุด</h5>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-4.5 h-4.5 text-primary shrink-0" />
                  {report.location}
                </p>
              </div>

              {/* Text description */}
              <div>
                <h5 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">รายละเอียดความชำรุดเสียหาย</h5>
                <div className="bg-slate-50 dark:bg-slate-800/30 p-5 rounded-2xl border border-slate-100/60 dark:border-slate-800/40">
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-line">
                    {report.description}
                  </p>
                </div>
              </div>

              {/* Complaint Image section */}
              {report.imageUrl && (
                <div className="pt-2">
                  <h5 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">ภาพประกอบที่แนบมา</h5>
                  <div className="relative group overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 max-w-md">
                    <img 
                      src={report.imageUrl} 
                      alt={report.title} 
                      className="w-full h-auto object-cover max-h-72 transition-transform duration-300 group-hover:scale-102"
                      referrerPolicy="no-referrer"
                    />
                    {/* Hover zoom overlay */}
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

          {/* Reporter Information Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-50 dark:border-slate-800/40 pb-4 mb-4 flex items-center gap-2">
              <User className="w-4.5 h-4.5 text-primary" />
              ข้อมูลและรายละเอียดผู้แจ้งเรื่อง
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm font-medium">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                  <User className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">ชื่อ-นามสกุล</p>
                  <p className="text-slate-800 dark:text-slate-200 font-semibold">{report.reporterName}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                  <Mail className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">อีเมลติดต่อ</p>
                  <p className="text-slate-800 dark:text-slate-200 font-semibold font-mono">{report.reporterEmail}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                  <Phone className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">เบอร์โทรศัพท์</p>
                  <p className="text-slate-800 dark:text-slate-200 font-semibold font-mono">{report.reporterPhone}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 30% width on Desktop */}
        <div className="col-span-1 lg:col-span-3 space-y-6">
          
          {/* Action Update Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow sticky top-6 space-y-5 no-print">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-50 dark:border-slate-800/40 pb-3 mb-1 flex items-center gap-2">
              <MessageSquare className="w-4.5 h-4.5 text-primary" />
              การจัดการสถานะและมอบหมาย
            </h4>

            {/* Change Status Dropdown */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                ปรับปรุงสถานะคำร้อง
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as ReportStatus)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-0 focus:ring-2 focus:ring-primary/20 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-hidden cursor-pointer"
              >
                <option value="รับเรื่องแล้ว">รับเรื่องแล้ว</option>
                <option value="กำลังดำเนินการ">กำลังดำเนินการ</option>
                <option value="เสร็จสิ้น">เสร็จสิ้น</option>
                <option value="ไม่สามารถดำเนินการได้">ไม่สามารถดำเนินการได้</option>
                <option value="ยกเลิกรายการ">ยกเลิกรายการ</option>
              </select>
            </div>

            {/* Note Textarea */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                หมายเหตุจากเจ้าหน้าที่ปฏิบัติงาน
              </label>
              <textarea
                rows={4}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="เพิ่มรายละเอียดการดำเนินงาน ขั้นตอนการเข้าซ่อม อะไหล่ หรือข้อติดขัดต่างๆ..."
                className="w-full bg-slate-50 dark:bg-slate-800 border-0 focus:ring-2 focus:ring-primary/20 rounded-xl p-3.5 text-xs font-medium text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition-all outline-hidden resize-none"
              />
            </div>

            {/* Save Button */}
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

          {/* Timeline of logs card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-50 dark:border-slate-800/40 pb-4 mb-5 flex items-center gap-2">
              <History className="w-4.5 h-4.5 text-primary" />
              บันทึกประวัติการดำเนินงาน (Logs)
            </h4>

            {filteredLogs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">ไม่มีประวัติการบันทึกงาน</p>
            ) : (
              <div className="relative pl-2.5 space-y-6 before:absolute before:left-6 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 dark:before:bg-slate-800">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="relative flex gap-4 items-start">
                    {/* Glowing timeline point */}
                    {getTimelineIcon(log.newStatus)}

                    {/* Timeline text body */}
                    <div className="flex-1 bg-slate-50/50 dark:bg-slate-800/20 p-3.5 rounded-2xl border border-slate-100/50 dark:border-slate-800/20 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">
                          {log.action}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(log.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                        </span>
                      </div>
                      
                      <p className="text-[10px] text-slate-400 font-bold mb-2">
                        ผู้ดำเนินการ: {log.createdBy}
                      </p>

                      {log.note && (
                        <div className="bg-white dark:bg-slate-800/60 p-2.5 rounded-xl text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed border border-slate-50 dark:border-slate-700/40 whitespace-pre-line">
                          {log.note}
                        </div>
                      )}

                      <div className="mt-2 text-[10px] font-semibold text-slate-400">
                        {new Date(log.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image zoom lightbox overlay */}
      {isFullscreenImage && report.imageUrl && (
        <div 
          className="fixed inset-0 bg-black/90 z-[200] flex flex-col items-center justify-center p-4"
          onClick={() => setIsFullscreenImage(false)}
        >
          {/* Close bar */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              onClick={() => setIsFullscreenImage(false)}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <img 
            src={report.imageUrl} 
            alt={report.title} 
            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            referrerPolicy="no-referrer"
          />
          <p className="text-white text-sm font-bold mt-4 px-4 py-2 bg-white/10 rounded-full text-center max-w-lg">
            {report.title} • {report.location}
          </p>
        </div>
      )}
    </div>
  );
};
