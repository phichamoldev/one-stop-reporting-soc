"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from "next/image";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { LogOut, Bell, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
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
  const { profile, signOut } = useStaffAuth();
  const { notifications, unreadCount, markAllAsRead } = useNotification();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
    if (!isDropdownOpen && unreadCount > 0) {
      markAllAsRead();
    }
  };

  return (
    <nav className="w-full h-[72px] bg-white/80 backdrop-blur-md border-b border-[#EDF0F4] px-[20px] flex items-center justify-end sticky top-0 z-40">
      <div className="flex items-center gap-4">
        {/* Notification Bell with Dropdown */}
        <div className="relative flex items-center justify-center" ref={dropdownRef}>
          <div 
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${isDropdownOpen ? 'bg-slate-100' : 'hover:bg-slate-100'}`}
            onClick={handleToggleDropdown}
          >
            <Bell className="w-5 h-5 text-slate-600" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white animate-pulse"></span>
            )}
          </div>

          {/* Dropdown Menu */}
          <div
            className={`absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden z-50 origin-top-right transition-all duration-200 ease-out ${
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
  );
};
