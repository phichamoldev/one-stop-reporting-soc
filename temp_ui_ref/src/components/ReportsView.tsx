/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  SlidersHorizontal, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Inbox, 
  AlertTriangle,
  RotateCcw,
  Eye
} from 'lucide-react';
import { Report, ReportStatus } from '../types';

interface ReportsViewProps {
  reports: Report[];
  onViewReport: (id: string) => void;
  onExportExcel: (reportsToExport: Report[]) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ 
  reports, 
  onViewReport,
  onExportExcel
}) => {
  const [isLoading, setIsLoading] = useState(true);
  
  // Advanced Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ทั้งหมด');
  const [selectedCategory, setSelectedCategory] = useState<string>('ทั้งหมด');
  const [selectedDept, setSelectedDept] = useState<string>('ทั้งหมด');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('ทั้งหมด');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'priority-desc' | 'priority-asc'>('date-desc');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Simulated Loading Skeleton
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 4500-4000); // Fast, snappy 500ms skeleton
    return () => clearTimeout(timer);
  }, []);

  // List of unique departments from actual reports
  const departments = ['ทั้งหมด', ...Array.from(new Set(reports.map(r => r.department)))];
  const categories = ['ทั้งหมด', 'อาคารสถานที่', 'คอมพิวเตอร์', 'อินเทอร์เน็ต', 'ความสะอาด', 'สิ่งแวดล้อม', 'ความปลอดภัย'];
  const statuses = ['ทั้งหมด', 'รับเรื่องแล้ว', 'กำลังดำเนินการ', 'เสร็จสิ้น', 'ไม่สามารถดำเนินการได้', 'ยกเลิกรายการ'];

  // Reset Filters helper
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedStatus('ทั้งหมด');
    setSelectedCategory('ทั้งหมด');
    setSelectedDept('ทั้งหมด');
    setSelectedTimeframe('ทั้งหมด');
    setSortBy('date-desc');
    setCurrentPage(1);
  };

  // 1. Filtering Logic
  const filteredReports = reports.filter(report => {
    // Search Term match
    const matchesSearch = 
      report.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.reporterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.location.toLowerCase().includes(searchTerm.toLowerCase());

    // Status match
    const matchesStatus = selectedStatus === 'ทั้งหมด' || report.status === selectedStatus;

    // Category match
    const matchesCategory = selectedCategory === 'ทั้งหมด' || report.mainCategory === selectedCategory;

    // Department match
    const matchesDept = selectedDept === 'ทั้งหมด' || report.department === selectedDept;

    // Timeframe match
    let matchesTime = true;
    if (selectedTimeframe !== 'ทั้งหมด') {
      const reportDate = new Date(report.createdAt);
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

  // 2. Sorting Logic
  const sortedReports = [...filteredReports].sort((a, b) => {
    if (sortBy === 'date-desc') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortBy === 'date-asc') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    
    // Priority sorting: เร่งด่วน > สูง > ปานกลาง > ต่ำ
    const priorityWeight = { 'เร่งด่วน': 4, 'สูง': 3, 'ปานกลาง': 2, 'ต่ำ': 1 };
    if (sortBy === 'priority-desc') {
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    }
    if (sortBy === 'priority-asc') {
      return priorityWeight[a.priority] - priorityWeight[b.priority];
    }
    return 0;
  });

  // 3. Pagination Calculations
  const totalItems = sortedReports.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedReports = sortedReports.slice(startIndex, startIndex + itemsPerPage);

  // Jump to page safety check
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

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'รับเรื่องแล้ว':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900/25 dark:text-blue-400 dark:border-blue-800/40">
            รับเรื่องแล้ว
          </span>
        );
      case 'กำลังดำเนินการ':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-900/25 dark:text-amber-400 dark:border-amber-800/40">
            กำลังดำเนินการ
          </span>
        );
      case 'เสร็จสิ้น':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-900/25 dark:text-emerald-400 dark:border-emerald-800/40">
            เสร็จสิ้น
          </span>
        );
      case 'ไม่สามารถดำเนินการได้':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-900/25 dark:text-rose-400 dark:border-rose-800/40">
            ไม่สมควร/ทำไม่ได้
          </span>
        );
      case 'ยกเลิกรายการ':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
            ยกเลิก
          </span>
        );
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: Report['priority']) => {
    switch (priority) {
      case 'เร่งด่วน':
        return <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400">เร่งด่วน</span>;
      case 'สูง':
        return <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">สูง</span>;
      case 'ปานกลาง':
        return <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">ปานกลาง</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400">ต่ำ</span>;
    }
  };

  // Loading skeleton layout
  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="h-10 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-10 w-36 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        </div>
        <div className="h-20 bg-white dark:bg-slate-900 rounded-[20px] p-4 border border-slate-100 dark:border-slate-800/60" />
        <div className="h-[450px] bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800/60" />
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
            สืบค้น ตรวจสอบรายละเอียด คัดกรอง และสั่งส่งออกรายงานคำร้องแจ้งซ่อม
          </p>
        </div>

        {/* Excel Export Button */}
        <button
          onClick={() => onExportExcel(sortedReports)}
          disabled={sortedReports.length === 0}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none text-white font-bold rounded-2xl shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20 transition-all cursor-pointer text-sm shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>ส่งออก Excel ({sortedReports.length})</span>
        </button>
      </div>

      {/* Advanced Filter Box Card */}
      <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 card-shadow">
        <div className="flex items-center gap-2 mb-4 text-xs font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-50 dark:border-slate-800">
          <Filter className="w-3.5 h-3.5 text-primary" />
          <span>ระบบคัดกรองข้อมูลขั้นสูง</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search Term Input */}
          <div className="relative">
            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-1.5">ค้นหาข้อมูล</label>
            <div className="relative">
              <input
                type="text"
                placeholder="เลขคำร้อง, หัวข้อ, ผู้แจ้ง..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full bg-slate-50 dark:bg-slate-800 border-0 focus:ring-2 focus:ring-primary/20 dark:focus:ring-red-500/20 rounded-xl px-4 py-3 pl-10 text-xs font-medium text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition-all outline-hidden"
              />
              <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
            </div>
          </div>

          {/* Status Dropdown */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-1.5">สถานะรายการ</label>
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-50 dark:bg-slate-800 border-0 focus:ring-2 focus:ring-primary/20 dark:focus:ring-red-500/20 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 outline-hidden cursor-pointer"
            >
              {statuses.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-1.5">หมวดหมู่หลัก</label>
            <select
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-50 dark:bg-slate-800 border-0 focus:ring-2 focus:ring-primary/20 dark:focus:ring-red-500/20 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 outline-hidden cursor-pointer"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Department Dropdown */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-1.5">หน่วยงานผู้แจ้ง</label>
            <select
              value={selectedDept}
              onChange={(e) => { setSelectedDept(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-50 dark:bg-slate-800 border-0 focus:ring-2 focus:ring-primary/20 dark:focus:ring-red-500/20 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 outline-hidden cursor-pointer"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* Date timeframe dropdown */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-1.5">ช่วงเวลาแจ้ง</label>
            <select
              value={selectedTimeframe}
              onChange={(e) => { setSelectedTimeframe(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-50 dark:bg-slate-800 border-0 focus:ring-2 focus:ring-primary/20 dark:focus:ring-red-500/20 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 outline-hidden cursor-pointer"
            >
              <option value="ทั้งหมด">ทั้งหมด</option>
              <option value="วันนี้">ภายใน 24 ชม. ที่ผ่านมา</option>
              <option value="สัปดาห์นี้">ภายใน 7 วันที่ผ่านมา</option>
              <option value="เดือนนี้">ภายใน 30 วันที่ผ่านมา</option>
            </select>
          </div>
        </div>

        {/* Sort & Reset Actions Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 pt-4 border-t border-slate-50 dark:border-slate-800/60 gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-bold">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>เรียงลำดับโดย:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSortBy('date-desc')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  sortBy === 'date-desc' 
                    ? 'bg-slate-800 border-slate-800 text-white dark:bg-slate-200 dark:border-slate-200 dark:text-slate-900' 
                    : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                }`}
              >
                วันที่แจ้งล่าสุด
              </button>
              <button
                onClick={() => setSortBy('date-asc')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  sortBy === 'date-asc' 
                    ? 'bg-slate-800 border-slate-800 text-white dark:bg-slate-200 dark:border-slate-200 dark:text-slate-900' 
                    : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                }`}
              >
                วันที่แจ้งเก่าสุด
              </button>
              <button
                onClick={() => setSortBy('priority-desc')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  sortBy === 'priority-desc' 
                    ? 'bg-slate-800 border-slate-800 text-white dark:bg-slate-200 dark:border-slate-200 dark:text-slate-900' 
                    : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                }`}
              >
                ระดับความเร่งด่วน สูง-ต่ำ
              </button>
            </div>
          </div>

          {/* Reset Filters button */}
          <button
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-primary dark:hover:text-red-400 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            ล้างตัวคัดกรองทั้งหมด
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow overflow-hidden">
        {/* Table Stats line */}
        <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-50 dark:border-slate-800/40 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
          <span>พบคำร้องทั้งหมด {totalItems} รายการ</span>
          <span>แสดง {startIndex + 1}-{Math.min(startIndex + itemsPerPage, totalItems)} รายการ</span>
        </div>

        {/* Responsive Table wrapper */}
        <div className="overflow-x-auto">
          {paginatedReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-full text-slate-300 dark:text-slate-600 mb-4">
                <Inbox className="w-12 h-12 animate-bounce" />
              </div>
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">ไม่พบข้อมูลคำร้องตามตัวกรอง</h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm">
                ลองตรวจสอบหรือเปลี่ยนคำค้นหา ปรับสถานะ หรือล้างตัวคัดกรองระบบใหม่อีกครั้ง
              </p>
              <button
                onClick={handleResetFilters}
                className="mt-4 px-4 py-2 bg-primary/10 text-primary font-bold text-xs rounded-xl hover:bg-primary/20 transition-all cursor-pointer"
              >
                คืนค่าตัวกรองเริ่มต้น
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/20 dark:bg-slate-800/10 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100/50 dark:border-slate-800/40">
                  <th className="py-4 px-6">เลขคำร้อง</th>
                  <th className="py-4 px-4">หมวดหมู่</th>
                  <th className="py-4 px-4">หัวข้อและสถานที่</th>
                  <th className="py-4 px-4">ผู้แจ้งเรื่อง</th>
                  <th className="py-4 px-4">วันที่แจ้ง</th>
                  <th className="py-4 px-4 text-center">สถานะ</th>
                  <th className="py-4 px-6 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40 text-xs">
                {paginatedReports.map((report) => (
                  <tr 
                    key={report.id} 
                    className="hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors group"
                  >
                    <td className="py-4 px-6 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {report.id}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {report.mainCategory}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                          {report.subCategory}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 max-w-xs">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          {getPriorityBadge(report.priority)}
                          <span className="font-bold text-slate-700 dark:text-slate-200 truncate block max-w-[180px]">
                            {report.title}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block max-w-[200px] leading-relaxed">
                          📌 {report.location}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold uppercase text-[10px]">
                          {report.reporterName.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {report.reporterName}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {report.department}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-500 dark:text-slate-400 font-medium">
                      {formatThaiDate(report.createdAt)}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {getStatusBadge(report.status)}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => onViewReport(report.id)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-300 dark:hover:text-slate-100 rounded-xl font-bold transition-all cursor-pointer text-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>ดูรายละเอียด</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-5 border-t border-slate-50 dark:border-slate-800/60 gap-4">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              หน้า {currentPage} จากทั้งหมด {totalPages} หน้า (ทั้งหมด {totalItems} รายการ)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              {/* Render dynamic page numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    currentPage === pageNum
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-white border border-slate-100 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'
                  }`}
                >
                  {pageNum}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
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
