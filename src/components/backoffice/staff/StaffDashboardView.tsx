"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { supabase } from "@/lib/supabase";
import { Users, UserCircle, Star, ShieldAlert, BarChart3, TrendingUp, History, Search } from "lucide-react";
import { StaffCard } from "./StaffCard";
import { StaffDetailModal } from "./StaffDetailModal";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend
} from "recharts";
import { AppSelect } from "@/components/ui/AppSelect";

export default function StaffDashboardView() {
  const router = useRouter();
  const { user, loading: authLoading } = useStaffAuth();
  
  const [staff, setStaff] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [filterOptions, setFilterOptions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [noPermission, setNoPermission] = useState(false);
  
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [sessionToken, setSessionToken] = useState<string>("");

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setSessionToken(session.access_token);

      const res = await fetch(`/api/backoffice/staff/dashboard`, {
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        if (errData?.code === "NO_PERMISSION") {
          setNoPermission(true);
          return;
        }
        if (res.status === 401 || res.status === 403) {
          router.replace("/backoffice/login");
        }
        throw new Error("Failed to fetch data");
      }

      const result = await res.json();
      setStaff(result.staff || []);
      setKpis(result.kpis || {});
      setRecentLogs(result.recentLogs || []);
      setFilterOptions(result.filterOptions || null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user, router]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/backoffice/login");
    } else if (user) {
      fetchDashboardData();
    }
  }, [user, authLoading, fetchDashboardData, router]);

  // Extract unique departments for the dropdown
  const departments = filterOptions?.departments
    ? filterOptions.departments
    : Array.from(new Set(staff.map(s => s.departments?.name_th).filter(Boolean)));

  // Filtering
  const filteredStaff = staff.filter(s => {
    const matchesTab = activeTab === "all" || s.role === activeTab;
    const matchesDept = selectedDept === "all" || s.departments?.name_th === selectedDept;
    const matchesSearch = s.full_name?.toLowerCase().includes(search.toLowerCase()) || 
                          s.email?.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch && matchesDept;
  });

  // Top 10 Leaderboard by completed tasks
  const leaderboard = [...staff]
    .sort((a, b) => b.stats.completed - a.stats.completed)
    .slice(0, 10);

  // Chart Data
  const chartData = [...staff]
    .filter(s => s.stats.total > 0)
    .sort((a, b) => b.stats.total - a.stats.total)
    .slice(0, 15)
    .map(s => ({
      name: s.full_name?.split(" ")[0] || "Unknown",
      total: s.stats.total,
      pending: s.stats.pending,
      inProgress: s.stats.inProgress,
      completed: s.stats.completed,
      cancelled: s.stats.cancelled,
      rejected: s.stats.rejected
    }));

  if (noPermission) {
    return (
      <div className="flex-1 p-6 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="bg-red-50 text-red-600 p-4 rounded-full mb-4">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">คุณไม่มีสิทธิ์เข้าถึงข้อมูล</h2>
        <p className="text-slate-500">บัญชีของคุณยังไม่ได้รับการกำหนดสิทธิ์ให้เข้าถึงข้อมูลเจ้าหน้าที่ใดๆ</p>
      </div>
    );
  }

  if (authLoading || (loading && !kpis)) {
    return (
      <div className="px-6 md:px-[50px] py-6 md:py-8 space-y-8 animate-pulse w-full">
        <div className="h-10 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white dark:bg-slate-900 rounded-[20px]" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="h-[360px] bg-white dark:bg-slate-900 rounded-[20px]" />
          <div className="h-[360px] bg-white dark:bg-slate-900 rounded-[20px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 md:px-[50px] py-6 md:py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mb-1">
          จัดการเจ้าหน้าที่
        </h1>
        <p className="text-sm font-medium text-slate-500">
          ติดตามภาระงานและประสิทธิภาพการดำเนินงานของเจ้าหน้าที่
        </p>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 mb-1">เจ้าหน้าที่ทั้งหมด</p>
              <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{kpis.total}</h3>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <UserCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 mb-1">เจ้าหน้าที่ปฏิบัติงาน</p>
              <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{kpis.staff}</h3>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <Star className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 mb-1">หัวหน้าฝ่าย</p>
              <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{kpis.manager}</h3>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 mb-1">ผู้ดูแลระบบ</p>
              <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{kpis.admin}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Tabs and Grid Section */}
      <div className="bg-white dark:bg-slate-900 rounded-[20px] p-1 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "all", label: "ทั้งหมด" },
              { id: "staff", label: "เจ้าหน้าที่ปฏิบัติงาน" },
              { id: "manager", label: "หัวหน้าฝ่าย" },
              { id: "admin", label: "ผู้ดูแลระบบ" },
              { id: "super_admin", label: "ผู้ดูแลระบบสูงสุด" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                  activeTab === tab.id 
                    ? "bg-primary text-white shadow-md shadow-primary/20" 
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="w-[180px]">
              <AppSelect
                value={selectedDept}
                onChange={(val) => setSelectedDept(val as string)}
                options={[
                  { label: "ทุกหน่วยงาน", value: "all" },
                  ...departments.map((dept: any) => ({ label: dept, value: dept }))
                ]}
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="ค้นหาชื่อ, อีเมล..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>

        <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-b-[20px]">
          {filteredStaff.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-slate-400 font-medium text-sm">ไม่พบเจ้าหน้าที่</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
              {filteredStaff.map((s) => (
                <StaffCard key={s.id} staff={s} onClick={setSelectedStaff} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <div className="bg-white dark:bg-slate-900 rounded-[20px] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" /> Top 10 งานปิดมากสุด
            </h3>
          </div>
          <div className="p-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs text-center w-12">#</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs">ชื่อ</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs text-right">ปิดงาน</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((staff, idx) => (
                  <tr key={staff.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        idx === 0 ? "bg-amber-100 text-amber-700" :
                        idx === 1 ? "bg-slate-200 text-slate-700" :
                        idx === 2 ? "bg-orange-100 text-orange-700" : "text-slate-400"
                      }`}>{idx + 1}</span>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{staff.full_name}</td>
                    <td className="px-4 py-3 text-right font-extrabold text-green-600">{staff.stats.completed}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-500">{staff.stats.completionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Workload Chart */}
          <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 shadow-sm border border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" /> สถิติคำร้องที่รับผิดชอบ
            </h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(209, 53, 15, 0.05)' }} 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="total" name="งานทั้งหมด" fill="#D1350F" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Stacked Status Chart */}
          <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 shadow-sm border border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" /> สัดส่วนสถานะงาน
            </h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }} 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                  <Bar dataKey="inProgress" name="กำลังดำเนินการ" stackId="a" fill="#F97316" />
                  <Bar dataKey="completed" name="เสร็จสิ้น" stackId="a" fill="#22C55E" />
                  <Bar dataKey="cancelled" name="ยกเลิก/ไม่สามารถทำได้" stackId="a" fill="#64748B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="bg-white dark:bg-slate-900 rounded-[20px] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <History className="w-5 h-5 text-primary" /> Recent Activities (ล่าสุด)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-5 py-4 font-semibold text-slate-500 text-xs">วันเวลา</th>
                <th className="px-5 py-4 font-semibold text-slate-500 text-xs">เจ้าหน้าที่</th>
                <th className="px-5 py-4 font-semibold text-slate-500 text-xs">คำร้อง</th>
                <th className="px-5 py-4 font-semibold text-slate-500 text-xs">การดำเนินการ</th>
                <th className="px-5 py-4 font-semibold text-slate-500 text-xs">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.map((log) => (
                <tr key={log.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-5 py-4 text-xs font-medium text-slate-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-5 py-4 font-bold text-slate-700 dark:text-slate-200">
                    {log.staff_users?.full_name || "-"}
                  </td>
                  <td className="px-5 py-4 font-bold text-primary whitespace-nowrap">
                    {log.reports?.public_id || "-"}
                  </td>
                  <td className="px-5 py-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {log.action}
                  </td>
                  <td className="px-5 py-4">
                    {log.new_status && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border
                        ${log.new_status === 'completed' ? 'bg-green-100 text-green-700 border-green-200' :
                          log.new_status === 'in_progress' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                          log.new_status === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                          'bg-slate-100 text-slate-700 border-slate-200'}
                      `}>
                        {log.new_status}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentLogs.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">ไม่มีประวัติการทำรายการ</div>
          )}
        </div>
      </div>

      <StaffDetailModal 
        staff={selectedStaff} 
        isOpen={!!selectedStaff} 
        onClose={() => setSelectedStaff(null)} 
        token={sessionToken}
      />
    </div>
  );
}
