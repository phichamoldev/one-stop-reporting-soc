/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Clock, 
  Play, 
  CheckCircle2, 
  XCircle, 
  ArrowUpRight, 
  Calendar,
  User,
  ChevronRight,
  TrendingUp,
  Inbox,
  Eye
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  BarChart, 
  Bar, 
  Cell 
} from 'recharts';
import { Report, ReportStatus } from '../types';

interface DashboardViewProps {
  reports: Report[];
  onViewReport: (id: string) => void;
  onNavigateToReports: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ 
  reports, 
  onViewReport,
  onNavigateToReports
}) => {
  const [isLoading, setIsLoading] = useState(true);

  // Simulated Loading Skeleton
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 4500-4000); // Fast, snappy 500ms skeleton
    return () => clearTimeout(timer);
  }, []);

  // 1. KPI Calculations
  const totalCount = reports.length;
  const newCount = reports.filter(r => r.status === 'รับเรื่องแล้ว').length;
  const inProgressCount = reports.filter(r => r.status === 'กำลังดำเนินการ').length;
  const completedCount = reports.filter(r => r.status === 'เสร็จสิ้น').length;
  const failedCount = reports.filter(r => r.status === 'ไม่สามารถดำเนินการได้' || r.status === 'ยกเลิกรายการ').length;

  // 2. 7-Day Line Chart Calculations
  // Let's map reports to day of week. Since reports have realistic dates:
  // จันทร์ (Mon), อังคาร (Tue), พุธ (Wed), พฤหัสบดี (Thu), ศุกร์ (Fri), เสาร์ (Sat), อาทิตย์ (Sun)
  const daysOfWeekThai = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  
  // We initialize the 7 days of the week in Thai
  const lineChartData = [
    { day: 'จันทร์', 'จำนวนคำร้อง': 0 },
    { day: 'อังคาร', 'จำนวนคำร้อง': 0 },
    { day: 'พุธ', 'จำนวนคำร้อง': 0 },
    { day: 'พฤหัสบดี', 'จำนวนคำร้อง': 0 },
    { day: 'ศุกร์', 'จำนวนคำร้อง': 0 },
    { day: 'เสาร์', 'จำนวนคำร้อง': 0 },
    { day: 'อาทิตย์', 'จำนวนคำร้อง': 0 },
  ];

  reports.forEach(r => {
    const date = new Date(r.createdAt);
    const dayIndex = date.getDay(); // 0 is Sunday, 1 is Monday, etc.
    const dayNameThai = daysOfWeekThai[dayIndex];
    const target = lineChartData.find(d => d.day === dayNameThai);
    if (target) {
      target['จำนวนคำร้อง'] += 1;
    }
  });

  // Find peak day for highlighting
  let peakDay = '';
  let maxCount = -1;
  lineChartData.forEach(d => {
    if (d['จำนวนคำร้อง'] > maxCount) {
      maxCount = d['จำนวนคำร้อง'];
      peakDay = d.day;
    }
  });

  // 3. Category Bar Chart Calculations
  const categories: Report['mainCategory'][] = [
    'อาคารสถานที่', 'คอมพิวเตอร์', 'อินเทอร์เน็ต', 'ความสะอาด', 'สิ่งแวดล้อม', 'ความปลอดภัย'
  ];
  
  const categoryStats = categories.map(cat => {
    const count = reports.filter(r => r.mainCategory === cat).length;
    return { name: cat, 'จำนวน': count };
  }).sort((a, b) => b['จำนวน'] - a['จำนวน']); // Sort highest to lowest as requested

  // Get status badge UI
  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'รับเรื่องแล้ว':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900/25 dark:text-blue-400 dark:border-blue-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            รับเรื่องแล้ว
          </span>
        );
      case 'กำลังดำเนินการ':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-900/25 dark:text-amber-400 dark:border-amber-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            กำลังดำเนินการ
          </span>
        );
      case 'เสร็จสิ้น':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-900/25 dark:text-emerald-400 dark:border-emerald-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            เสร็จสิ้น
          </span>
        );
      case 'ไม่สามารถดำเนินการได้':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-900/25 dark:text-rose-400 dark:border-rose-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            ไม่สามารถดำเนินการได้
          </span>
        );
      case 'ยกเลิกรายการ':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            ยกเลิกรายการ
          </span>
        );
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: Report['priority']) => {
    switch (priority) {
      case 'เร่งด่วน':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400">เร่งด่วน</span>;
      case 'สูง':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">สูง</span>;
      case 'ปานกลาง':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">ปานกลาง</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400">ต่ำ</span>;
    }
  };

  // 4. Skeleton Loader UI
  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        {/* Title */}
        <div className="flex flex-col gap-2">
          <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60" />
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="h-[360px] bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800/60" />
          <div className="h-[360px] bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800/60" />
        </div>

        {/* Recent Table */}
        <div className="h-[400px] bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800/60" />
      </div>
    );
  }

  // Formatting timestamp to Thai Locale
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

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
            📊 สถิติและการบริหารจัดการ
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            ภาพรวมและแผงควบคุมหลักสำหรับเจ้าหน้าที่ดูแลระบบ คณะสังคมศาสตร์
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs text-slate-500 dark:text-slate-400 shrink-0">
          <Calendar className="w-4 h-4 text-primary shrink-0" />
          <span>ข้อมูลล่าสุด: {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Card 2: New */}
        <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 card-shadow transition-all hover:translate-y-[-2px] border-l-4 border-l-blue-500">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">รับเรื่องแล้ว</p>
            <div className="p-1.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-black text-slate-850 dark:text-slate-100 tracking-tight">{newCount}</h3>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 mt-3.5 rounded-full overflow-hidden">
              <div 
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${totalCount > 0 ? Math.min(100, Math.round((newCount / totalCount) * 100)) : 0}%` }}
              />
            </div>
            <p className="text-[9px] text-slate-400 font-bold mt-1 text-right">
              {totalCount > 0 ? Math.round((newCount / totalCount) * 100) : 0}% ของทั้งหมด
            </p>
          </div>
        </div>

        {/* Card 3: In Progress */}
        <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 card-shadow transition-all hover:translate-y-[-2px] border-l-4 border-l-orange-500">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">กำลังดำเนินการ</p>
            <div className="p-1.5 bg-orange-50 dark:bg-orange-950/40 rounded-lg text-orange-600 dark:text-orange-400">
              <Play className="w-4 h-4 rotate-90" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-black text-slate-850 dark:text-slate-100 tracking-tight">{inProgressCount}</h3>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 mt-3.5 rounded-full overflow-hidden">
              <div 
                className="bg-orange-500 h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${totalCount > 0 ? Math.min(100, Math.round((inProgressCount / totalCount) * 100)) : 0}%` }}
              />
            </div>
            <p className="text-[9px] text-slate-400 font-bold mt-1 text-right">
              {totalCount > 0 ? Math.round((inProgressCount / totalCount) * 100) : 0}% ของทั้งหมด
            </p>
          </div>
        </div>

        {/* Card 4: Completed */}
        <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 card-shadow transition-all hover:translate-y-[-2px] border-l-4 border-l-green-500">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">ดำเนินการเสร็จสิ้น</p>
            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-black text-slate-850 dark:text-slate-100 tracking-tight">{completedCount}</h3>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 mt-3.5 rounded-full overflow-hidden">
              <div 
                className="bg-green-500 h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${totalCount > 0 ? Math.min(100, Math.round((completedCount / totalCount) * 100)) : 0}%` }}
              />
            </div>
            <p className="text-[9px] text-slate-400 font-bold mt-1 text-right">
              {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}% ของทั้งหมด
            </p>
          </div>
        </div>

        {/* Card 5: Unresolvable */}
        <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 card-shadow transition-all hover:translate-y-[-2px] border-l-4 border-l-red-500">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">ไม่สามารถดำเนินการ</p>
            <div className="p-1.5 bg-rose-50 dark:bg-rose-950/40 rounded-lg text-rose-600 dark:text-rose-400">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-black text-slate-850 dark:text-slate-100 tracking-tight">{failedCount}</h3>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 mt-3.5 rounded-full overflow-hidden">
              <div 
                className="bg-red-500 h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${totalCount > 0 ? Math.min(100, Math.round((failedCount / totalCount) * 100)) : 0}%` }}
              />
            </div>
            <p className="text-[9px] text-slate-400 font-bold mt-1 text-right">
              {totalCount > 0 ? Math.round((failedCount / totalCount) * 100) : 0}% ของทั้งหมด
            </p>
          </div>
        </div>
      </div>

      {/* Analytics Section - Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Chart: Line Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">📈 ความถี่การแจ้งย้อนหลัง 7 วัน</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">จํานวนครั้งที่แจ้งในสัปดาห์ปัจจุบัน</p>
            </div>
            <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-lg text-[10px] font-bold text-amber-600 dark:text-amber-400">
              <TrendingUp className="w-3 h-3" />
              <span>สูงสุด: วัน{peakDay} ({maxCount} รายการ)</span>
            </div>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis 
                  dataKey="day" 
                  tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} 
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    borderRadius: '12px', 
                    border: 'none',
                    color: '#fff',
                    fontFamily: 'Noto Sans Thai, sans-serif',
                    fontSize: '12px'
                  }}
                  itemStyle={{ color: '#38bdf8' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="จำนวนคำร้อง" 
                  stroke="#D1350F" 
                  strokeWidth={3} 
                  activeDot={{ r: 8, strokeWidth: 0, fill: '#D1350F' }}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    const isPeak = payload.day === peakDay;
                    return (
                      <circle 
                        key={payload.day}
                        cx={cx} 
                        cy={cy} 
                        r={isPeak ? 6 : 4} 
                        fill={isPeak ? '#D1350F' : '#fff'} 
                        stroke="#D1350F" 
                        strokeWidth={isPeak ? 3 : 2} 
                      />
                    );
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Chart: Bar Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">📊 หมวดหมู่ที่ถูกร้องเรียนมากที่สุด</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">แยกประเภทตามหมวดหมู่หลัก (เรียงจากมากไปน้อย)</p>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">
              จำแนกตามประเภทหลัก
            </span>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} 
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    borderRadius: '12px', 
                    border: 'none',
                    color: '#fff',
                    fontFamily: 'Noto Sans Thai, sans-serif',
                    fontSize: '12px'
                  }}
                  itemStyle={{ color: '#fb7185' }}
                />
                <Bar dataKey="จำนวน" radius={[8, 8, 0, 0]} maxBarSize={36}>
                  {categoryStats.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index === 0 ? '#D1350F' : '#334155'} // Highlight highest with red
                      opacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Reports Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-5 border-b border-slate-50 dark:border-slate-800/60 gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">📋 ตารางคำร้องล่าสุด</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">รายการแจ้งซ่อมและร้องเรียนใหม่ 5 รายการล่าสุดในระบบ</p>
          </div>
          <button 
            onClick={onNavigateToReports}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-100 dark:border-slate-700 transition-colors cursor-pointer self-start sm:self-auto"
          >
            ดูทั้งหมด
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Responsive Table Wrapper */}
        <div className="overflow-x-auto">
          {reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-full text-slate-300 dark:text-slate-600 mb-4">
                <Inbox className="w-10 h-10" />
              </div>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">ไม่มีข้อมูลคำร้องในขณะนี้</h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm text-center">
                ระบบยังไม่ได้รับเรื่องแจ้งร้องเรียนใดๆ หรือข้อมูลอาจถูกลบไปแล้ว
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100/50 dark:border-slate-800/40">
                  <th className="py-4 px-6">เลขที่อ้างอิง</th>
                  <th className="py-4 px-4">หมวดหมู่</th>
                  <th className="py-4 px-4">หัวข้อ</th>
                  <th className="py-4 px-4">ผู้แจ้ง</th>
                  <th className="py-4 px-4">วันที่แจ้ง</th>
                  <th className="py-4 px-4 text-center">สถานะ</th>
                  <th className="py-4 px-6 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40 text-xs">
                {reports
                  .slice()
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 5)
                  .map((report) => (
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
                            <span className="font-semibold text-slate-700 dark:text-slate-200 truncate block max-w-[200px]">
                              {report.title}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block max-w-[220px]">
                            {report.location}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 text-[10px] font-bold uppercase">
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
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-300 dark:hover:text-slate-100 rounded-xl font-bold transition-all cursor-pointer text-xs"
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
      </div>
    </div>
  );
};
