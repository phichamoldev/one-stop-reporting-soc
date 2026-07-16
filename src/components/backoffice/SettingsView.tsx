"use client";

import React, { useState } from 'react';
import { Settings, Save, ShieldAlert, CheckCircle2, RotateCcw } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [systemName, setSystemName] = useState("ระบบบริหารจัดการ SOC-MAINTENANCE");
  const [maintenanceEmail, setMaintenanceEmail] = useState("support.soc@ku.th");
  const [maxDailyReports, setMaxDailyReports] = useState(100);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setIsSaved(false);
    
    // Simulate API call for settings
    setTimeout(() => {
      setIsSaving(false);
      setIsSaved(true);
      
      setTimeout(() => setIsSaved(false), 3000);
    }, 800);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
          ⚙️ ตั้งค่าระบบบริหารจัดการหลังบ้าน
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          จัดการสิทธิ์ ชื่อระบบ อีเมลฝ่ายเทคนิคการซ่อม และระดับความปลอดภัยของฐานข้อมูล
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-50 dark:border-slate-800/40 flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary shrink-0" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">แผงควบคุมการตั้งค่าเซิร์ฟเวอร์หลัก</span>
        </div>

        <form onSubmit={handleSave} className="p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* System Name input */}
            <div className="md:col-span-2 space-y-2">
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                ชื่อหลักของระบบบริหารจัดการ
              </label>
              <input
                type="text"
                required
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-0 focus:ring-2 focus:ring-primary/20 rounded-xl px-4 py-3.5 text-xs font-medium text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none"
              />
            </div>

            {/* Support Email input */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                อีเมลศูนย์แจ้งซ่อมกลาง
              </label>
              <input
                type="email"
                required
                value={maintenanceEmail}
                onChange={(e) => setMaintenanceEmail(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-0 focus:ring-2 focus:ring-primary/20 rounded-xl px-4 py-3.5 text-xs font-medium text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none"
              />
            </div>

            {/* Max Daily Limit input */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                จำกัดเพดานคำร้องต่อวันสูงสุด
              </label>
              <input
                type="number"
                required
                min={5}
                max={500}
                value={maxDailyReports}
                onChange={(e) => setMaxDailyReports(parseInt(e.target.value) || 50)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-0 focus:ring-2 focus:ring-primary/20 rounded-xl px-4 py-3.5 text-xs font-medium text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none"
              />
            </div>
          </div>

          {/* Action form save buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-50 dark:border-slate-800">
            {isSaved && (
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500 text-xs font-bold animate-fade-in mr-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>บันทึกสำเร็จ</span>
              </div>
            )}
            
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-black rounded-xl cursor-pointer transition-all shadow-md shadow-primary/10"
            >
              {isSaving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>กำลังบันทึกข้อมูล...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>บันทึกการตั้งค่าระบบ</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
