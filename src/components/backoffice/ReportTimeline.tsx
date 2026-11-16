"use client";

import React from 'react';
import { Clock, Play, Check, AlertTriangle, ArrowRightLeft, X, History, Inbox, FileText, Image as ImageIcon } from 'lucide-react';

import { STATUS_DETAILS, getStatusLabel } from '@/types/report';

const getTimelineIcon = (log: any) => {
  const action = log.action;
  if (action === 'transfer') {
    return (
      <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 flex items-center justify-center border-4 border-white dark:border-slate-900 z-10 shrink-0">
        <ArrowRightLeft className="w-5 h-5" />
      </div>
    );
  }

  if (action === 'note_updated' || action === 'admin_note_added') {
    return (
      <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center border-4 border-white dark:border-slate-900 z-10 shrink-0">
        <FileText className="w-4 h-4" />
      </div>
    );
  }

  if (action === 'image_updated' || action === 'note_and_image_updated') {
    return (
      <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 flex items-center justify-center border-4 border-white dark:border-slate-900 z-10 shrink-0">
        <ImageIcon className="w-4 h-4" />
      </div>
    );
  }

  const status = log.new_status;
  const config = STATUS_DETAILS[status as keyof typeof STATUS_DETAILS];
  if (!config) {
    return (
      <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 flex items-center justify-center border-4 border-white dark:border-slate-900 z-10 shrink-0">
        <X className="w-5 h-5" />
      </div>
    );
  }

  const renderIcon = () => {
    switch (config.icon) {
      case 'Clock': return <Clock className="w-5 h-5" />;
      case 'Inbox': return <Inbox className="w-5 h-5" />;
      case 'Play': return <Play className="w-5 h-5 rotate-90" />;
      case 'CheckCircle2': return <Check className="w-5 h-5" />;
      case 'XCircle': return <X className="w-5 h-5" />;
      case 'AlertTriangle': return <AlertTriangle className="w-5 h-5" />;
      default: return <Clock className="w-5 h-5" />;
    }
  };

  return (
    <div className={`w-9 h-9 rounded-full ${config.bgClass} ${config.colorClass} flex items-center justify-center border-4 border-white dark:border-slate-900 z-10 shrink-0`}>
      {renderIcon()}
    </div>
  );
};

function getLogTitle(log: any): { title: string; badge: string } {
  const statusLabel = getStatusLabel(log.new_status);
  switch (log.action) {
    case 'transfer':
      return { title: 'โอนคำร้อง', badge: 'เปลี่ยนหน่วยงาน' };
    case 'note_updated':
    case 'admin_note_added':
      return { title: 'อัปเดตหมายเหตุ', badge: `Activity Log · คงสถานะ${statusLabel}` };
    case 'image_updated':
      return { title: 'อัปเดตรูปภาพ', badge: `Activity Log · คงสถานะ${statusLabel}` };
    case 'note_and_image_updated':
      return { title: 'อัปเดตหมายเหตุและรูปภาพ', badge: `Activity Log · คงสถานะ${statusLabel}` };
    case 'status_updated':
      if (log.remark && String(log.remark).trim().length > 0) {
        return { title: `เปลี่ยนสถานะและอัปเดตหมายเหตุ (${statusLabel})`, badge: 'Status History' };
      }
      return { title: `เปลี่ยนสถานะเป็น ${statusLabel}`, badge: 'Status History' };
    case 'priority_classified':
    case 'priority_updated':
      return { title: 'จัดระดับความเร่งด่วน', badge: 'System Activity' };
    case 'incident_detection_completed':
    case 'incident_detection_failed':
      return { title: 'ตรวจสอบความสัมพันธ์คำร้อง', badge: 'System Activity' };
    case 'incident_group_added':
      return { title: 'จัดเข้ากลุ่มเหตุการณ์', badge: 'Incident Group' };
    case 'incident_group_removed':
      return { title: 'นำออกจากกลุ่มเหตุการณ์', badge: 'Incident Group' };
    case 'draft_created':
      return { title: 'สร้างร่างกลุ่มเหตุการณ์', badge: 'System Activity' };
    case 'draft_rejected':
      return { title: 'ปฏิเสธร่างกลุ่มเหตุการณ์', badge: 'Incident Group' };
    default:
      return { title: `เปลี่ยนสถานะเป็น ${statusLabel}`, badge: 'Status History' };
  }
}

interface ReportTimelineProps {
  logs: any[];
  isDrawer?: boolean;
}

export const ReportTimeline: React.FC<ReportTimelineProps> = ({ logs, isDrawer = false }) => {
  const sortedLogs = [...(logs || [])].sort((a, b) => {
    const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (diff !== 0) return diff;
    return (b.id || 0) - (a.id || 0);
  });

  return (
    <div className={isDrawer ? "space-y-4 pt-1" : "bg-white dark:bg-slate-900 p-6 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow"}>
      <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-50 dark:border-slate-800/40 pb-4 mb-5 flex items-center gap-2">
        <History className="w-5 h-5 text-primary" />
        บันทึกประวัติการดำเนินงาน (Status &amp; Activity Logs)
      </h4>

      {sortedLogs.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">ไม่มีประวัติการบันทึกงาน</p>
      ) : (
        <div className="relative pl-2.5 space-y-6 before:absolute before:left-6 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 dark:before:bg-slate-800">
          {sortedLogs.map((log: any) => {
            const { title, badge } = getLogTitle(log);
            const isActivityOnly =
              log.action === 'note_updated' ||
              log.action === 'admin_note_added' ||
              log.action === 'image_updated' ||
              log.action === 'note_and_image_updated';
            return (
              <div key={log.id} className="relative flex gap-4 items-start">
                {getTimelineIcon(log)}
                <div className="flex-1 bg-slate-50/50 dark:bg-slate-800/20 p-3.5 rounded-2xl border border-slate-100/50 dark:border-slate-800/20 text-xs">
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">
                        {title}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isActivityOnly
                            ? 'bg-blue-50 text-blue-600 border border-blue-100'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {badge}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                    </span>
                  </div>
                  
                  <div className="mb-2">
                    <p className="text-[10px] text-slate-400 font-bold leading-snug">
                      ผู้ดำเนินการ: {log.staff_users?.full_name || "ระบบ"}
                    </p>
                    {log.staff_users?.position && (
                      <p className="text-[10px] text-slate-400 font-normal leading-snug mt-0.5">
                        {log.staff_users.position}
                      </p>
                    )}
                  </div>

                  {log.remark && (
                    <div className="bg-white dark:bg-slate-800/60 p-2.5 rounded-xl text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed border border-slate-50 dark:border-slate-700/40 whitespace-pre-line break-words">
                      {log.remark}
                    </div>
                  )}

                  {log.image_url && (
                    <div className="mt-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={log.image_url}
                        alt="รูปภาพประกอบ"
                        className="max-h-24 rounded-lg border border-slate-200 object-contain"
                      />
                    </div>
                  )}

                  <div className="mt-2 text-[10px] font-semibold text-slate-400">
                    {new Date(log.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
