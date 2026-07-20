"use client";

import React, { useEffect } from 'react';

import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { useNotification, AppNotification } from '@/contexts/NotificationContext';
import Link from 'next/link';

const icons = {
  success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />,
  error: <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />,
  info: <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />,
};

const bgColors = {
  success: 'bg-white dark:bg-slate-800',
  warning: 'bg-white dark:bg-slate-800',
  error: 'bg-white dark:bg-slate-800',
  info: 'bg-white dark:bg-slate-800',
};

const NotificationItem: React.FC<{ notification: AppNotification; onClose: () => void }> = ({ notification, onClose }) => {
  useEffect(() => {
    // Auto remove toast after 5 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [notification, onClose]);

  const content = (
    <div className="flex items-start gap-3 w-full">
      {icons[notification.type]}
      <div className="flex-1 min-w-0 pr-6">
        <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100">{notification.title}</h4>
        {notification.message && (
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1 line-clamp-2">
            {notification.message}
          </p>
        )}
        {notification.link && (
          <div className="mt-3 mb-1 text-[13px] font-bold text-[#D1350F]">
            ดูรายละเอียดทันที
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={`relative p-4 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 pointer-events-auto flex gap-3 items-start justify-between ${bgColors[notification.type]} transition-colors duration-200 overflow-hidden w-full max-w-sm animate-toast-in`}
    >
      {notification.link ? (
        <Link href={notification.link} className="flex-1 block hover:bg-slate-50 dark:hover:bg-slate-800/50 -m-4 p-4 transition-colors">
          {content}
        </Link>
      ) : (
        <div className="flex-1 block -m-4 p-4">{content}</div>
      )}
      
      <button
        onClick={(e) => {
          e.preventDefault();
          onClose();
        }}
        className="absolute top-2 right-2 p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      
      {/* Progress Bar (Visual representation of 5s timeout) */}
      <div 
        className={`absolute bottom-0 left-0 h-1 animate-toast-progress ${
          notification.type === 'success' ? 'bg-emerald-500' :
          notification.type === 'warning' ? 'bg-amber-500' :
          notification.type === 'error' ? 'bg-rose-500' : 'bg-blue-500'
        }`}
      />
    </div>
  );
};

export const NotificationToastContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotification();
  
  // Show only up to 3 toasts at a time, and ignore silent notifications
  const visibleToasts = notifications.filter(n => !n.isSilent).slice(0, 3);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none w-full max-w-sm sm:max-w-md px-4 sm:px-0">
        {visibleToasts.map((notification) => (
          <NotificationItem 
            key={notification.id} 
            notification={notification} 
            onClose={() => removeNotification(notification.id)} 
          />
        ))}
    </div>
  );
};
