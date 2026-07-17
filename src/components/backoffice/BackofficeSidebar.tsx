"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { hasAccess } from "@/lib/auth-helpers";
import { 
  LayoutDashboard, 
  ClipboardList, 
  Users, 
  BarChart3, 
  Settings, 
  Moon,
  Sun,
  Zap,
  LogOut
} from 'lucide-react';

export const BackofficeSidebar: React.FC = () => {
  const { profile, signOut } = useStaffAuth();
  const pathname = usePathname();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSimulating, setIsSimulating] = useState(true);

  // Sync Dark Mode class from storage
  useEffect(() => {
    const storedDarkMode = localStorage.getItem('soc_backoffice_darkmode') === 'true';
    setIsDarkMode(storedDarkMode);
    if (storedDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const storedSim = localStorage.getItem('soc_backoffice_simulating') !== 'false';
    setIsSimulating(storedSim);
  }, []);

  const handleToggleDarkMode = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    localStorage.setItem('soc_backoffice_darkmode', String(nextDark));
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleToggleSimulation = () => {
    const nextSim = !isSimulating;
    setIsSimulating(nextSim);
    localStorage.setItem('soc_backoffice_simulating', String(nextSim));
  };

  const menuItems = [
    { href: '/backoffice', label: 'แดชบอร์ด', icon: LayoutDashboard },
    { href: '/backoffice/reports', label: 'จัดการคำร้อง', icon: ClipboardList },
    { href: '/backoffice/analytics', label: 'สถิติเชิงลึก', icon: BarChart3 },
    { href: '/backoffice/staff', label: 'เจ้าหน้าที่', icon: Users },
    { href: '/backoffice/settings', label: 'ตั้งค่าระบบ', icon: Settings },
  ].filter(item => hasAccess(profile?.role, item.href));

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex flex-col w-[260px] bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800/60">
      {/* Header/Logo */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#D1350F] rounded-xl flex items-center justify-center text-white font-bold text-xl select-none shrink-0">
            S
          </div>
          <div className="leading-tight text-left">
            <h1 className="text-sm font-extrabold text-[#D1350F] dark:text-red-400">
              ระบบบริหารจัดการ
            </h1>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">
              Complaint Back-Office
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Menus */}
      <nav className="flex-1 px-4 py-5 space-y-1 overflow-y-auto no-scrollbar">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = item.href === '/backoffice' ? pathname === item.href : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer text-left ${
                isActive 
                  ? 'bg-primary/10 text-primary shadow-sm dark:bg-primary/15' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <IconComponent className={`w-5 h-5 shrink-0 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
              <span>{item.label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800/60 space-y-2 bg-white dark:bg-slate-900">
        {/* User Profile */}
        {profile ? (
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800/40 flex items-center justify-between mb-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-[#D1350F] text-white flex items-center justify-center font-bold text-xs shrink-0">
                {profile.full_name?.[0] || "U"}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{profile.full_name}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{profile.role === 'super_admin' ? 'ผู้ดูแลระบบ' : profile.role}</span>
              </div>
            </div>
            <button onClick={() => signOut()} className="text-slate-400 hover:text-red-500 transition-colors p-1" title="ออกจากระบบ">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800/40">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mb-1 uppercase tracking-wider">เข้าใช้งานล่าสุด</p>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
              กำลังโหลด...
            </p>
          </div>
        )}

        {/* Real-time simulator toggle */}
        <button
          onClick={handleToggleSimulation}
          className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-[11px] font-bold cursor-pointer transition-all ${
            isSimulating 
              ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30' 
              : 'bg-slate-50 border-slate-100 text-slate-500 hover:text-slate-700 dark:bg-slate-800/30 dark:border-slate-800 dark:text-slate-400'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Zap className={`w-4 h-4 shrink-0 ${isSimulating ? 'text-amber-500' : 'text-slate-400'}`} />
            <span>จําลอง Real-time</span>
          </div>
          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-extrabold ${
            isSimulating ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
          }`}>
            {isSimulating ? 'เปิด' : 'ปิด'}
          </span>
        </button>

        {/* Dark Mode toggle */}
        <button
          onClick={handleToggleDarkMode}
          className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 text-[11px] font-bold cursor-pointer transition-all"
        >
          <div className="flex items-center gap-1.5">
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-500 shrink-0" />
            ) : (
              <Moon className="w-4 h-4 text-slate-500 shrink-0" />
            )}
            <span>{isDarkMode ? 'โหมดสว่าง' : 'โหมดมืด'}</span>
          </div>
          <span className="text-[9px] font-bold text-slate-400">
            {isDarkMode ? 'Light' : 'Dark'}
          </span>
        </button>
      </div>
    </aside>
  );
};
