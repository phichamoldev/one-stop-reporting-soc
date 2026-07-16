"use client";

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Inbox, 
  Eye
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const STATUS_LABELS: Record<string, string> = {
  pending: "รับเรื่องแล้ว",
  in_progress: "กำลังดำเนินการ",
  completed: "เสร็จสิ้น",
  cancelled: "ไม่สามารถดำเนินการได้"
};

interface ReportsViewProps {
  reports: any[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({ reports }) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  
  // Advanced Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ทั้งหมด');
  const [selectedCategory, setSelectedCategory] = useState<string>('ทั้งหมด');
  const [selectedDept, setSelectedDept] = useState<string>('ทั้งหมด');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('ทั้งหมด');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc'>('date-desc');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Simulated Loading Skeleton
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500); 
    return () => clearTimeout(timer);
  }, []);

  // Compute distinct options dynamically from data
  const departments = ['ทั้งหมด', ...Array.from(new Set(reports.map(r => r.categories?.departments?.name_th || 'ไม่ระบุ')))];
  const categories = ['ทั้งหมด', ...Array.from(new Set(reports.map(r => r.categories?.name_th || 'ไม่ระบุ')))];
  const statuses = ['ทั้งหมด', 'pending', 'in_progress', 'completed', 'cancelled'];

  const getStatusLabel = (s: string) => {
    if (s === 'ทั้งหมด') return s;
    return STATUS_LABELS[s] || s;
  };

  // Filtering Logic
  const filteredReports = reports.filter(report => {
    // Search Term match
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      (report.public_id || '').toLowerCase().includes(searchLower) ||
      (report.title || '').toLowerCase().includes(searchLower) ||
      (report.description || '').toLowerCase().includes(searchLower) ||
      (report.reporter_name || '').toLowerCase().includes(searchLower);

    // Status match
    const matchesStatus = selectedStatus === 'ทั้งหมด' || report.status === selectedStatus;

    // Category match
    const catName = report.categories?.name_th || 'ไม่ระบุ';
    const matchesCategory = selectedCategory === 'ทั้งหมด' || catName === selectedCategory;

    // Department match
    const deptName = report.categories?.departments?.name_th || 'ไม่ระบุ';
    const matchesDept = selectedDept === 'ทั้งหมด' || deptName === selectedDept;

    // Timeframe match
    let matchesTime = true;
    if (selectedTimeframe !== 'ทั้งหมด') {
      const reportDate = new Date(report.created_at);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - reportDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (selectedTimeframe === 'วันนี้') {
        matchesTime = diffDays <= 1;
      } else if (selectedTimeframe === 'สัปดาห์นี้') {
        matchesTime = diffDays <= 7;
      } else if (selectedTimeframe === 'เดือนนี้') {
        matchesTime = diffDays <= 30;
      }
    }

    return matchesSearch && matchesStatus && matchesCategory && matchesDept && matchesTime;
  });

  // Sorting Logic
  const sortedReports = [...filteredReports].sort((a, b) => {
    if (sortBy === 'date-desc') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    if (sortBy === 'date-asc') {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    return 0;
  });

  // Pagination Calculations
  const totalItems = sortedReports.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedReports = sortedReports.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const formatThaiDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' น.';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900/25 dark:text-blue-400 dark:border-blue-800/40">
            {STATUS_LABELS[status]}
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-900/25 dark:text-amber-400 dark:border-amber-800/40">
            {STATUS_LABELS[status]}
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-900/25 dark:text-emerald-400 dark:border-emerald-800/40">
            {STATUS_LABELS[status]}
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-900/25 dark:text-rose-400 dark:border-rose-800/40">
            {STATUS_LABELS[status]}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse p-4">
        <div className="h-10 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="h-20 bg-white dark:bg-slate-900 rounded-[20px]" />
        <div className="h-[450px] bg-white dark:bg-slate-900 rounded-[20px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
            📋 จัดการรายการคำร้องทั้งหมด
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            สืบค้น ตรวจสอบรายละเอียด คัดกรอง
          </p>
        </div>
      </div>

      {/* Advanced Filter Box Card */}
      <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 card-shadow">
        <div className="flex items-center gap-2 mb-4 text-xs font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-50 dark:border-slate-800">
          <Filter className="w-3.5 h-3.5 text-primary" />
          <span>ระบบคัดกรองข้อมูลขั้นสูง</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหารหัสคำร้อง, ชื่อเรื่อง, ผู้แจ้ง..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-0 focus:ring-2 focus:ring-primary/20 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 outline-none"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-0 focus:ring-2 focus:ring-primary/20 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none appearance-none cursor-pointer"
          >
            {statuses.map(s => (
              <option key={s} value={s}>{getStatusLabel(s)}</option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-0 focus:ring-2 focus:ring-primary/20 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none appearance-none cursor-pointer"
          >
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-0 focus:ring-2 focus:ring-primary/20 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none appearance-none cursor-pointer"
          >
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-0 focus:ring-2 focus:ring-primary/20 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none appearance-none cursor-pointer"
          >
            <option value="ทั้งหมด">ทุกช่วงเวลา</option>
            <option value="วันนี้">แจ้งวันนี้</option>
            <option value="สัปดาห์นี้">สัปดาห์นี้</option>
            <option value="เดือนนี้">เดือนนี้</option>
          </select>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-50 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              พบ {totalItems} รายการ
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">เรียงตาม:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-0 focus:ring-2 focus:ring-primary/20 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="date-desc">วันที่ (ใหม่-เก่า)</option>
              <option value="date-asc">วันที่ (เก่า-ใหม่)</option>
            </select>
          </div>
        </div>

        {paginatedReports.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-300 dark:text-slate-600">
              <Inbox className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">
              ไม่พบคำร้องที่ตรงกับเงื่อนไข
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              ลองปรับการค้นหา หรือตัวกรองของคุณใหม่
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/20 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="font-bold py-4 px-6 border-b border-slate-100 dark:border-slate-800">เลขที่อ้างอิง</th>
                  <th className="font-bold py-4 px-4 border-b border-slate-100 dark:border-slate-800">หมวดหมู่ / ฝ่ายงาน</th>
                  <th className="font-bold py-4 px-4 border-b border-slate-100 dark:border-slate-800">หัวข้อ / สถานที่</th>
                  <th className="font-bold py-4 px-4 border-b border-slate-100 dark:border-slate-800">ผู้แจ้ง</th>
                  <th className="font-bold py-4 px-4 border-b border-slate-100 dark:border-slate-800">วันที่แจ้ง</th>
                  <th className="font-bold py-4 px-4 border-b border-slate-100 dark:border-slate-800">สถานะ</th>
                  <th className="font-bold py-4 px-6 border-b border-slate-100 dark:border-slate-800 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {paginatedReports.map((report, idx) => (
                  <tr 
                    key={report.id || idx} 
                    className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="py-4 px-6">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {report.public_id}
                      </span>
                    </td>
                    <td className="py-4 px-4 max-w-[200px]">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-slate-700 dark:text-slate-300 text-xs truncate block">
                          {report.categories?.name_th || 'ไม่ระบุหมวดหมู่'}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block">
                          {report.categories?.departments?.name_th || 'ไม่ระบุฝ่าย'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 max-w-xs">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                          {report.title || report.description}
                        </span>
                        {report.room_number && (
                          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate block">
                            {report.room_number}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                          {report.reporter_name?.charAt(0) || '?'}
                        </div>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs truncate max-w-[100px]">
                          {report.reporter_name || 'ไม่ระบุ'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {formatThaiDate(report.created_at)}
                    </td>
                    <td className="py-4 px-4">
                      {getStatusBadge(report.status)}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button 
                        onClick={() => router.push(`/backoffice/reports/${report.public_id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>รายละเอียด</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/10">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              หน้า {currentPage} จาก {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  let pageNum = currentPage;
                  if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  
                  if (pageNum < 1 || pageNum > totalPages) return null;
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        currentPage === pageNum 
                          ? 'bg-primary text-white shadow-md shadow-primary/20' 
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
