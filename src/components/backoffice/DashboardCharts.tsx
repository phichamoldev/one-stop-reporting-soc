"use client";

import React from "react";
import { TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, Cell
} from 'recharts';
import { useDashboardContext } from "@/contexts/DashboardContext";

export const DashboardCharts: React.FC = React.memo(() => {
  const { data, isLoading } = useDashboardContext();

  if (isLoading || !data) return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="h-[360px] bg-slate-50 dark:bg-slate-900 rounded-[20px] animate-pulse"></div>
      <div className="h-[360px] bg-slate-50 dark:bg-slate-900 rounded-[20px] animate-pulse"></div>
    </div>
  );

  const { lineChartData, peakDay, maxCount, categoryStats } = React.useMemo(() => {
    const analytics = data.analytics || { trend: [], category: [] };

    // Transform trend data to match UI
    const lineData = analytics.trend.map((t: any) => ({
      day: t.date,
      'จำนวนคำร้อง': t.count
    }));

    let pDay = '';
    let mCount = -1;
    lineData.forEach((d: any) => {
      if (d['จำนวนคำร้อง'] > mCount) {
        mCount = d['จำนวนคำร้อง'];
        pDay = d.day;
      }
    });

    const catStats = analytics.category
      .map((c: any) => ({ name: c.name, 'จำนวน': c.value }))
      .sort((a: any, b: any) => b['จำนวน'] - a['จำนวน']);

    return {
      lineChartData: lineData,
      peakDay: pDay,
      maxCount: mCount,
      categoryStats: catStats
    };
  }, [data.analytics]);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left Chart: Line Chart */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">📈 ความถี่การแจ้งย้อนหลัง 7 วัน</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">จํานวนครั้งที่แจ้งในสัปดาห์ปัจจุบัน</p>
          </div>
          {peakDay && (
            <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-lg text-[10px] font-bold text-amber-600 dark:text-amber-400">
              <TrendingUp className="w-3 h-3" />
              <span>สูงสุด: {peakDay} ({maxCount} รายการ)</span>
            </div>
          )}
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
              <RechartsTooltip 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  borderRadius: '12px', 
                  border: 'none',
                  color: '#fff',
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
              <RechartsTooltip 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  borderRadius: '12px', 
                  border: 'none',
                  color: '#fff',
                  fontSize: '12px'
                }}
                itemStyle={{ color: '#fb7185' }}
              />
              <Bar dataKey="จำนวน" radius={[8, 8, 0, 0]} maxBarSize={36}>
                {categoryStats.map((entry: any, index: number) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={index === 0 ? '#D1350F' : '#334155'} 
                    opacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
});

DashboardCharts.displayName = "DashboardCharts";
