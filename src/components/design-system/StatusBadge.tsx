import React from 'react';
import { ReportStatus, STATUS_DETAILS } from '@/types/report';

interface StatusBadgeProps {
  status: ReportStatus;
  label?: string;
  animatePulse?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  label, 
  animatePulse = false,
  className = '' 
}) => {
  const config = STATUS_DETAILS[status] || STATUS_DETAILS['pending'];
  const displayLabel = label || config.label || status;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${config.bgClass} ${config.colorClass} ${config.borderClass} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass} ${animatePulse ? 'animate-pulse' : ''}`}></span>
      {displayLabel}
    </span>
  );
};
