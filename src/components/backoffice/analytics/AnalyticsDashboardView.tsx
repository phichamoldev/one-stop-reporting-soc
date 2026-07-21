"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend, LabelList
} from "recharts";
import { Calendar, Filter, AlertTriangle, CheckCircle2, Play, Clock, Inbox, TrendingUp, Building2, BarChart3 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { AppSelect } from "@/components/ui/AppSelect";

interface AnalyticsDashboardViewProps {
  profile: any;
}

export const AnalyticsDashboardView: React.FC<AnalyticsDashboardViewProps> = ({ profile }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams();
      if (dateRange !== "all") params.append("dateRange", dateRange);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (deptFilter !== "all") params.append("department", deptFilter);

      const res = await fetch(`/api/backoffice/analytics?${params.toString()}`, {
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        if (errData?.code === "NO_PERMISSION") {
          setData({ noPermission: true } as any);
          return;
        }
        throw new Error("Failed to fetch analytics");
      }
      
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, statusFilter, deptFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading || !data) {
    return (
      <div className="space-y-8 animate-pulse w-full">
        <div className="h-10 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-white dark:bg-slate-900 rounded-[20px]" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="h-[400px] bg-white dark:bg-slate-900 rounded-[20px]" />
          <div className="h-[400px] bg-white dark:bg-slate-900 rounded-[20px]" />
        </div>
      </div>
    );
  }

  if (data?.noPermission) {
    return (
      <div className="flex-1 p-6 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="bg-red-50 text-red-600 p-4 rounded-full mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">คุณไม่มีสิทธิ์เข้าถึงข้อมูล</h2>
        <p className="text-slate-500">บัญชีของคุณยังไม่ได้รับการกำหนดสิทธิ์ให้เข้าถึงข้อมูลหน่วยงานใดๆ</p>
      </div>
    );
  }

  const { kpis, topProblems, longestOpen, categoryAnalytics, departmentPerformance, monthlyTrend, peakHours } = data;

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
            รายงานสถิติและวิเคราะห์ข้อมูลเชิงลึก
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
            วิเคราะห์แนวโน้ม ปัญหา และประสิทธิภาพการดำเนินงานของระบบรับแจ้งปัญหา
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-[160px]">
            <AppSelect 
              value={dateRange}
              onChange={(val) => setDateRange(val as string)}
              options={[
                { label: "วันนี้", value: "today" },
                { label: "7 วันล่าสุด", value: "7days" },
                { label: "30 วันล่าสุด", value: "30days" },
                { label: "90 วันล่าสุด", value: "90days" },
                { label: "1 ปีล่าสุด", value: "year" },
                { label: "ทั้งหมด", value: "all" },
              ]}
            />
          </div>
          <div className="w-[160px]">
            <AppSelect 
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as string)}
              options={[
                { label: "ทุกสถานะ", value: "all" },
                { label: "รับเรื่องแล้ว", value: "pending" },
                { label: "กำลังดำเนินการ", value: "in_progress" },
                { label: "เสร็จสิ้น", value: "completed" },
              ]}
            />
          </div>
          {(profile?.role === "super_admin" || profile?.role === "admin") && (
            <div className="flex items-center gap-2 text-xs font-semibold bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm text-slate-500">
              <Filter className="w-4 h-4 text-[#D1350F]" />
              <span>ภาพรวมทุกหน่วยงาน</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        
        {/* Total */}
        <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm border-l-4 border-l-slate-800 dark:border-l-slate-400">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">คำร้องทั้งหมด</p>
          </div>
          <div className="mt-2">
            <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{kpis.total}</h3>
          </div>
        </div>

        {/* New Today */}
        <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm border-l-4 border-l-purple-500">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">คำร้องใหม่วันนี้</p>
          </div>
          <div className="mt-2">
            <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{kpis.todayNew}</h3>
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm border-l-4 border-l-orange-500">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">กำลังดำเนินการ</p>
          </div>
          <div className="mt-2">
            <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{kpis.inProgress}</h3>
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm border-l-4 border-l-green-500">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">เสร็จสิ้น</p>
          </div>
          <div className="mt-2">
            <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{kpis.completed}</h3>
          </div>
        </div>

        {/* Avg Completion Time */}
        <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm border-l-4 border-l-blue-500">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">เวลาปิดงานเฉลี่ย</p>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{kpis.avgCompletionTimeDays}</h3>
            <span className="text-sm font-bold text-slate-500">วัน</span>
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-red-50 dark:bg-red-900/10 rounded-[20px] p-5 border border-red-200 dark:border-red-900/30 shadow-sm border-l-4 border-l-red-500">
          <div className="flex justify-between items-start">
            <p className="text-xs text-red-600 dark:text-red-400 font-bold mb-1">ค้างเกิน 7 วัน</p>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="mt-2">
            <h3 className="text-3xl font-black text-red-700 dark:text-red-400 tracking-tight">{kpis.overdueCount}</h3>
          </div>
        </div>

      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Top 10 Problems */}
        <div className="bg-white dark:bg-slate-900 rounded-[20px] p-6 border border-slate-100 dark:border-slate-800/60 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
            Top 10 ปัญหาที่เกิดซ้ำ
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProblems} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" />
                <YAxis dataKey="problem" type="category" width={100} tick={{fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: 'rgba(0,0,0,0.05)'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" fill="#D1350F" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Analytics */}
        <div className="bg-white dark:bg-slate-900 rounded-[20px] p-6 border border-slate-100 dark:border-slate-800/60 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
            หมวดหมู่ที่ถูกร้องเรียนมากที่สุด
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryAnalytics}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="count"
                >
                  {categoryAnalytics.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Row 3: Longest Open & Latest Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Longest Open Reports */}
        <div className="bg-white dark:bg-slate-900 rounded-[20px] p-6 border border-slate-100 dark:border-slate-800/60 shadow-sm h-[400px] flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2 shrink-0">
            Top 10 เรื่องค้างนานที่สุด
          </h3>
          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {longestOpen.length === 0 ? (
              <div className="text-center py-10 text-slate-400 font-medium">ไม่มีเรื่องค้างดำเนินการ</div>
            ) : (
              longestOpen.map((report: any, idx: number) => (
                <Link 
                  href={`/backoffice/reports/${report.publicId}`}
                  key={idx} 
                  className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/50 hover:border-[#D1350F]/40 hover:shadow-sm cursor-pointer transition-all group shrink-0"
                >
                  <div className="space-y-1 overflow-hidden pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono text-slate-500 group-hover:text-[#D1350F] transition-colors">{report.publicId}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {report.category}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{report.subject}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`text-xs font-bold px-3 py-1 rounded-full inline-block ${
                      report.daysOpen > 7 
                        ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' 
                        : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                    }`}>
                      ค้างมาแล้ว {report.daysOpen} วัน
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Peak Hours */}
        <div className="bg-white dark:bg-slate-900 rounded-[20px] p-6 border border-slate-100 dark:border-slate-800/60 shadow-sm h-[400px] flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2 shrink-0">
            ช่วงเวลาที่มีการแจ้งปัญหามากที่สุด
          </h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakHours} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="range" type="category" width={110} tick={{fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: 'rgba(0,0,0,0.05)'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any, name: any, props: any) => [`${value}% (${props.payload.count} เรื่อง)`, 'สัดส่วน']}
                />
                <Bar dataKey="percentage" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20}>
                  <LabelList dataKey="percentage" position="right" formatter={(val: any) => `${val}%`} style={{ fontSize: '12px', fill: '#64748b', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Row 4: Monthly Trend */}
      <div className="bg-white dark:bg-slate-900 rounded-[20px] p-6 border border-slate-100 dark:border-slate-800/60 shadow-sm w-full">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
          แนวโน้มจำนวนคำร้องรายเดือน
        </h3>
        <div className="h-[350px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyTrend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{fontSize: 12}} tickMargin={10} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize: 12}} axisLine={false} tickLine={false} />
              <Tooltip 
                cursor={{stroke: 'rgba(0,0,0,0.1)', strokeWidth: 2}}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Line 
                type="monotone" 
                dataKey="count" 
                name="จำนวนคำร้อง" 
                stroke="#D1350F" 
                strokeWidth={3}
                dot={{r: 4, strokeWidth: 2}} 
                activeDot={{r: 6}} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 4: Department Performance */}
      <div className="bg-white dark:bg-slate-900 rounded-[20px] p-6 border border-slate-100 dark:border-slate-800/60 shadow-sm overflow-hidden">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-slate-400" />
          ประสิทธิภาพการดำเนินงานของหน่วยงาน
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 rounded-tl-lg rounded-bl-lg">หน่วยงาน</th>
                <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 text-right">รับเรื่อง</th>
                <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 text-right">กำลังดำเนินการ</th>
                <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 text-right">เสร็จสิ้น</th>
                <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 text-right rounded-tr-lg rounded-br-lg">เวลาปิดงานเฉลี่ย (วัน)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {departmentPerformance.map((dept: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-4 font-bold text-slate-800 dark:text-slate-200">{dept.name}</td>
                  <td className="px-4 py-4 text-right font-medium">{dept.total}</td>
                  <td className="px-4 py-4 text-right font-medium text-orange-500">{dept.inProgress}</td>
                  <td className="px-4 py-4 text-right font-medium text-green-500">{dept.completed}</td>
                  <td className="px-4 py-4 text-right font-bold text-blue-600 dark:text-blue-400">{dept.avgTimeDays}</td>
                </tr>
              ))}
              {departmentPerformance.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">ไม่มีข้อมูลหน่วยงาน</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
