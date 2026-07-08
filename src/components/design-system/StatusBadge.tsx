import React from 'react';
import { ReportStatus } from '@/types/report';

interface StatusBadgeProps {
  status: ReportStatus;
  label: string;
  animatePulse?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  label, 
  animatePulse = false,
  className = '' 
}) => {
  const badgeStyles: Record<ReportStatus, string> = {
    resolved: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30',
    pending: 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/30',
    rejected: 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/30',
    in_progress: 'bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900/30',
    cancelled: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
  };

  const indicatorStyles: Record<ReportStatus, string> = {
    resolved: 'bg-emerald-500',
    pending: 'bg-amber-500',
    rejected: 'bg-red-500',
    in_progress: 'bg-orange-500',
    cancelled: 'bg-gray-400'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeStyles[status]} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${indicatorStyles[status]} ${animatePulse ? 'animate-pulse' : ''}`}></span>
      {label}
    </span>
  );
};
