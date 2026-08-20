"use client";

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { hasAccess } from "@/lib/auth-helpers";
import { getRoleDisplayName } from "@/lib/role-config";
import { 
  LogOut, 
  Bell, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info,
  Menu,
  X,
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  Users,
  Settings
} from "lucide-react";
import { useNotification, AppNotification } from "@/contexts/NotificationContext";

const NotificationIcon = ({ type }: { type: AppNotification['type'] }) => {
  switch (type) {
    case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case 'error': return <XCircle className="w-4 h-4 text-rose-500" />;
    default: return <Info className="w-4 h-4 text-blue-500" />;
  }
};

export const BackofficeNavbar: React.FC = () => {
  const { user, profile, signOut } = useStaffAuth();
  const pathname = usePathname();
  const { notifications, unreadCount, markAllAsRead } = useNotification();
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close drawer on pathname change
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  // Close drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen]);

  const handleToggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
    if (!isDropdownOpen && unreadCount > 0) {
      markAllAsRead();
    }
  };

  const menuItems = [
    { href: '/backoffice', label: 'แดชบอร์ด', icon: LayoutDashboard },
    { href: '/backoffice/reports', label: 'จัดการคำร้อง', icon: ClipboardList },
    { href: '/backoffice/analytics', label: 'สถิติเชิงลึก', icon: BarChart3 },
    { href: '/backoffice/staff', label: 'เจ้าหน้าที่', icon: Users },
    { href: '/backoffice/settings', label: 'ตั้งค่าระบบ', icon: Settings },
  ].filter(item => hasAccess(profile?.role, item.href));

  return (
    <>
      <nav className="w-full h-[64px] sm:h-[72px] bg-white/80 backdrop-blur-md border-b border-[#EDF0F4] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
        {/* Left Side: Mobile Hamburger & Logo (hidden on desktop lg) */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="lg:hidden w-11 h-11 flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer -ml-1.5 shrink-0"
            aria-label="เปิดเมนู"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2.5 lg:hidden min-w-0">
            <div className="w-8 h-8 bg-[#D1350F] rounded-lg flex items-center justify-center text-white font-bold text-base select-none shrink-0">
              S
            </div>
            <div className="leading-tight text-left min-w-0">
              <span className="text-sm font-extrabold text-[#D1350F] dark:text-red-400 block truncate">
                ระบบบริหารจัดการ
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Notification Bell with Dropdown */}
        <div className="flex items-center gap-4 ml-auto">
          <div className="relative flex items-center justify-center" ref={dropdownRef}>
            <button
              type="button"
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors cursor-pointer ${isDropdownOpen ? 'bg-slate-100' : 'hover:bg-slate-100'}`}
              onClick={handleToggleDropdown}
              aria-label="การแจ้งเตือน"
            >
              <Bell className="w-5 h-5 text-slate-600" />
              {unreadCount > 0 && (
                <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white animate-pulse"></span>
              )}
            </button>

            {/* Dropdown Menu */}
            <div
              className={`absolute top-full right-0 mt-2 w-80 max-w-[calc(100vw-32px)] bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden z-50 origin-top-right transition-all duration-200 ease-out ${
                isDropdownOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'
              }`}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-sm text-slate-800">การแจ้งเตือน</h3>
                {notifications.length > 0 && (
                  <span className="text-[10px] font-semibold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                    {notifications.length} รายการ
                  </span>
                )}
              </div>
              
              <div className="max-h-[360px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center flex flex-col items-center justify-center text-slate-400">
                    <Bell className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-sm font-medium">ไม่มีการแจ้งเตือนใหม่</p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {notifications.map((notif) => (
                      <Link 
                        key={notif.id} 
                        href={notif.link || "#"}
                        onClick={() => setIsDropdownOpen(false)}
                        className={`flex gap-3 p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors ${!notif.isRead ? 'bg-blue-50/30' : ''}`}
                      >
                        <div className="mt-0.5">
                          <NotificationIcon type={notif.type} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 line-clamp-1">{notif.title}</p>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{notif.message}</p>
                          <p className="text-[10px] text-slate-400 mt-1.5 font-medium">
                            {new Date(notif.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Drawer */}
      {mounted && isDrawerOpen && createPortal(
        <div className="fixed inset-0 z-[999] lg:hidden animate-fade-in">
          {/* Overlay Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div 
            role="dialog"
            aria-modal="true"
            aria-label="เมนูหลัก"
            className="fixed inset-y-0 left-0 w-[280px] max-w-[85vw] bg-white dark:bg-slate-900 shadow-2xl flex flex-col z-10 animate-slide-right overflow-hidden"
          >
            {/* Header/Logo */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#D1350F] rounded-xl flex items-center justify-center text-white font-bold text-lg select-none shrink-0">
                  S
                </div>
                <div className="leading-tight text-left">
                  <h1 className="text-sm font-extrabold text-[#D1350F] dark:text-red-400">
                    ระบบบริหารจัดการ
                  </h1>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">
                    Complaint Back-Office
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="w-11 h-11 -mr-2 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="ปิดเมนู"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Menus */}
            <nav className="flex-1 px-3.5 py-4 space-y-1.5 overflow-y-auto no-scrollbar">
              {menuItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = item.href === '/backoffice' ? pathname === item.href : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsDrawerOpen(false)}
                    className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer text-left ${
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

            {/* Bottom User Section */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800/60 space-y-2 bg-white dark:bg-slate-900 shrink-0">
              {profile ? (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800/40 flex items-center justify-between">
                  <div className="flex items-center gap-3 overflow-hidden min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#D1350F] text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {profile.full_name?.[0] || "U"}
                    </div>
                    <div className="flex flex-col overflow-hidden min-w-0">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{profile.full_name}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{getRoleDisplayName(profile.role)}</span>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsDrawerOpen(false);
                      signOut();
                    }} 
                    className="text-slate-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer shrink-0" 
                    title="ออกจากระบบ"
                    aria-label="ออกจากระบบ"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800/40 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0"></div>
                  <div className="flex flex-col space-y-2 flex-1">
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-3/4"></div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-1/2"></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
