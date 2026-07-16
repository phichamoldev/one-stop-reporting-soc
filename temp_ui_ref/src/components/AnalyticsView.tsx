/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  UserCheck, 
  Building, 
  Wrench, 
  CheckCircle2, 
  AlertCircle,
  Award,
  ChevronRight,
  TrendingDown,
  Timer
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  PieChart,
  Pie
} from 'recharts';
import { Report, Staff } from '../types';

interface AnalyticsViewProps {
  reports: Report[];
  staff: Staff[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ reports, staff }) => {
  const [isLoading, setIsLoading] = useState(true);

  // Loading skeleton simulation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 4500-4000);
    return () => clearTimeout(timer);
  }, []);

  // 1. Calculations
  const completedReports = reports.filter(r => r.status === 'เสร็จสิ้น');
  const inProgressReports = reports.filter(r => r.status === 'กำลังดำเนินการ');
  const newReports = reports.filter(r => r.status === 'รับเรื่องแล้ว');

  // Average resolution time simulation
  // We can calculate realistic completion hours
  // Let's assume on average it takes 4.5 hours for electrics, 6 hours for plumbing, etc.
  const averageResolutionHours = 5.2; 

  // Popular categories calculations
  const categories = ['อาคารสถานที่', 'คอมพิวเตอร์', 'อินเทอร์เน็ต', 'ความสะอาด', 'สิ่งแวดล้อม', 'ความปลอดภัย'];
  const categoryChartData = categories.map((cat, index) => {
    const total = reports.filter(r => r.mainCategory === cat).length;
    const completed = reports.filter(r => r.mainCategory === cat && r.status === 'เสร็จสิ้น').length;
    return {
      name: cat,
      'คำร้องทั้งหมด': total,
      'เสร็จสิ้นแล้ว': completed,
    };
  }).sort((a, b) => b['คำร้องทั้งหมด'] - a['คำร้องทั้งหมด']);

  // Monthly reports trend (simulated over last 6 months)
  const monthlyTrendData = [
    { month: 'ก.พ.', 'จำนวนคำร้อง': 28, 'แก้ไขเสร็จสิ้น': 25 },
    { month: 'มี.ค.', 'จำนวนคำร้อง': 35, 'แก้ไขเสร็จสิ้น': 32 },
    { month: 'เม.ย.', 'จำนวนคำร้อง': 22, 'แก้ไขเสร็จสิ้น': 20 },
    { month: 'พ.ค.', 'จำนวนคำร้อง': 41, 'แก้ไขเสร็จสิ้น': 38 },
    { month: 'มิ.ย.', 'จำนวนคำร้อง': 48, 'แก้ไขเสร็จสิ้น': 43 },
    { month: 'ก.ค.', 'จำนวนคำร้อง': reports.length + 15, 'แก้ไขเสร็จสิ้น': completedReports.length + 12 }, // dynamic base
  ];

  // Top staff performers
  const sortedStaff = [...staff].sort((a, b) => b.completedTasks - a.completedTasks);

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-10 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white dark:bg-slate-900 rounded-[20px] p-6" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 h-[380px] bg-white dark:bg-slate-900 rounded-[20px]" />
          <div className="h-[380px] bg-white dark:bg-slate-900 rounded-[20px]" />
        </div>
      </div>
    );
  }

  // Pie chart categories colors
  const COLORS = ['#D1350F', '#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899'];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
          📈 รายงานสถิติและวิเคราะห์ข้อมูลเชิงลึก
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          ระบบวิเคราะห์ประสิทธิภาพการดำเนินงาน อัตราความสําเร็จ และระยะเวลาเฉลี่ย
        </p>
      </div>

      {/* Overview Analytics row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1 */}
        <div className="bg-white dark:bg-slate-900 rounded-[20px] p-6 border border-slate-100 dark:border-slate-800/60 card-shadow">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Timer className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-0.5 rounded-md">
              ประสิทธิภาพ
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3.5xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
              {averageResolutionHours} ชม.
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">ระยะเวลาดำเนินการซ่อมเฉลี่ย</p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white dark:bg-slate-900 rounded-[20px] p-6 border border-slate-100 dark:border-slate-800/60 card-shadow">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5 rounded-md">
              อัตราเสร็จสิ้น
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3.5xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
              {reports.length > 0 ? Math.round((completedReports.length / reports.length) * 100) : 0}%
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">สัดส่วนคำร้องที่ปิดสำเร็จ</p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white dark:bg-slate-900 rounded-[20px] p-6 border border-slate-100 dark:border-slate-800/60 card-shadow">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-600 dark:text-amber-400">
              <Wrench className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider bg-amber-50 dark:bg-amber-950/30 px-2.5 py-0.5 rounded-md">
              กำลังทำ
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3.5xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
              {inProgressReports.length} รายการ
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">จำนวนช่างกำลังรื้อซ่อมฟื้นฟู</p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white dark:bg-slate-900 rounded-[20px] p-6 border border-slate-100 dark:border-slate-800/60 card-shadow">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-rose-600 dark:text-rose-400">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider bg-rose-50 dark:bg-rose-950/30 px-2.5 py-0.5 rounded-md">
              รับเรื่องใหม่
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3.5xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
              {newReports.length} รายการ
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">เรื่องใหม่รอมอบหมายช่าง</p>
          </div>
        </div>
      </div>

      {/* Main Charts Grid Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 1. Monthly Trends area - 2/3 cols */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow lg:col-span-2">
          <div className="mb-6">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">📅 สถิติความถี่คำร้องรายเดือน (6 เดือนย้อนหลัง)</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">เปรียบเทียบระหว่างสถิติจำนวนรับแจ้งกับจำนวนซ่อมสำเร็จเสร็จสิ้น</p>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReports" cx="0" cy="0" r="1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D1350F" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#D1350F" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorDone" cx="0" cy="0" r="1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    borderRadius: '12px', 
                    border: 'none',
                    color: '#fff',
                    fontFamily: 'Noto Sans Thai, sans-serif'
                  }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Area type="monotone" dataKey="จำนวนคำร้อง" stroke="#D1350F" strokeWidth={3} fillOpacity={1} fill="url(#colorReports)" />
                <Area type="monotone" dataKey="แก้ไขเสร็จสิ้น" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorDone)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Top Performing Staff list - 1/3 cols */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">🏆 เจ้าหน้าที่ที่ปิดงานมากที่สุด</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">พนักงานช่างที่ปิดคำร้องมากที่สุด</p>
            </div>
            <Award className="w-6 h-6 text-amber-500 animate-pulse shrink-0" />
          </div>

          <div className="space-y-4">
            {sortedStaff.map((person, index) => (
              <div 
                key={person.id} 
                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100/50 dark:border-slate-800/20"
              >
                {/* Ranking Badge */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  index === 0 
                    ? 'bg-amber-500 text-white shadow-xs shadow-amber-500/20' 
                    : index === 1 
                    ? 'bg-slate-300 text-slate-800'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {index + 1}
                </div>

                {/* Avatar */}
                <img 
                  src={person.imageUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&auto=format&fit=crop&q=80'} 
                  alt={person.name} 
                  className="w-10 h-10 rounded-xl object-cover shrink-0 border border-slate-100 dark:border-slate-800"
                  referrerPolicy="no-referrer"
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                    {person.name}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    {person.role}
                  </p>
                </div>

                {/* Score */}
                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    {person.completedTasks}
                  </span>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">งานที่เสร็จ</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Categories popular stats table bento block */}
      <div className="bg-white dark:bg-slate-900 rounded-[20px] p-6 border border-slate-100 dark:border-slate-800/60 card-shadow">
        <div className="mb-6">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">📂 ประสิทธิภาพตามรายหมวดหมู่คำร้องเรียน</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500">ข้อมูลเปรียบเทียบอัตราส่วนความสำเร็จและคำร้องทั้งหมดตามหมวดหมู่หลัก</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categoryChartData.map((cat, index) => {
            const completionRate = cat['คำร้องทั้งหมด'] > 0 
              ? Math.round((cat['เสร็จสิ้นแล้ว'] / cat['คำร้องทั้งหมด']) * 100) 
              : 0;
            return (
              <div 
                key={cat.name} 
                className="p-5 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100/80 dark:border-slate-800/40 space-y-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                    {cat.name}
                  </span>
                  <span className="text-[11px] font-black text-primary dark:text-red-400 bg-red-100/40 dark:bg-red-950/20 px-2.5 py-0.5 rounded-md">
                    รวม {cat['คำร้องทั้งหมด']} รายการ
                  </span>
                </div>

                {/* Visual completion progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                    <span>ความคืบหน้าการซ่อม ({cat['เสร็จสิ้นแล้ว']}/{cat['คำร้องทั้งหมด']})</span>
                    <span className="text-emerald-600">{completionRate}% สำเร็จ</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200/60 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
