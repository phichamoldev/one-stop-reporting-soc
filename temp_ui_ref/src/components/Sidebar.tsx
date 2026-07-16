/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Building2, 
  Users, 
  BarChart3, 
  Settings, 
  Menu, 
  X,
  Moon,
  Sun,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  isSimulating: boolean;
  onToggleSimulation: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onViewChange,
  isOpen,
  onToggle,
  isDarkMode,
  onToggleDarkMode,
  isSimulating,
  onToggleSimulation
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'แดชบอร์ด', icon: LayoutDashboard },
    { id: 'reports', label: 'จัดการคำร้อง', icon: ClipboardList },
    { id: 'staff', label: 'เจ้าหน้าที่', icon: Users },
    { id: 'analytics', label: 'รายงานสถิติ', icon: BarChart3 },
    { id: 'settings', label: 'ตั้งค่าระบบ', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 xl:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-60 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800/60 transition-transform duration-300 xl:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
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
          {/* Close button on mobile */}
          <button 
            onClick={onToggle}
            className="xl:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menus */}
        <nav className="flex-1 px-4 py-5 space-y-1 overflow-y-auto no-scrollbar">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeView === item.id || (item.id === 'reports' && activeView === 'report-detail');
            return (
              <button
                key={item.id}
                onClick={() => {
                  onViewChange(item.id);
                  if (window.innerWidth < 1280) {
                    onToggle();
                  }
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer text-left ${
                  isActive 
                    ? 'bg-primary/8 text-primary shadow-xs dark:bg-primary/15' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850/50'
                }`}
              >
                <IconComponent className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600'}`} />
                <span>{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/60 space-y-2 bg-white dark:bg-slate-900">
          {/* Simulated login card matching High Density */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-850/50 rounded-xl border border-slate-100 dark:border-slate-800/40">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mb-1 uppercase tracking-wider">เข้าใช้งานล่าสุด</p>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
              15 ต.ค. 2567 | 09:42 น.
            </p>
          </div>

          {/* Real-time simulator toggle */}
          <button
            onClick={onToggleSimulation}
            className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-[11px] font-bold cursor-pointer transition-all ${
              isSimulating 
                ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30' 
                : 'bg-slate-50 border-slate-100 text-slate-500 hover:text-slate-700 dark:bg-slate-800/30 dark:border-slate-800 dark:text-slate-400'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Zap className={`w-3.5 h-3.5 shrink-0 ${isSimulating ? 'text-amber-500' : 'text-slate-400'}`} />
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
            onClick={onToggleDarkMode}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 text-[11px] font-bold cursor-pointer transition-all"
          >
            <div className="flex items-center gap-1.5">
              {isDarkMode ? (
                <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              )}
              <span>{isDarkMode ? 'โหมดสว่าง' : 'โหมดมืด'}</span>
            </div>
            <span className="text-[9px] font-bold text-slate-400">
              {isDarkMode ? 'Light' : 'Dark'}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
};
