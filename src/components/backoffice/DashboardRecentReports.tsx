"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Inbox, Eye } from "lucide-react";
import { useDashboardContext } from "@/contexts/DashboardContext";

export const DashboardRecentReports: React.FC = React.memo(() => {
  const router = useRouter();
  const { data, isLoading } = useDashboardContext();

  if (isLoading || !data) return (
    <div className="h-[400px] bg-slate-50 dark:bg-slate-900 rounded-[20px] animate-pulse"></div>
  );

  const reports = React.useMemo(() => data.reports || [], [data.reports]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900/25 dark:text-blue-400 dark:border-blue-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse-ring" />
            รับเรื่องแล้ว
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-900/25 dark:text-amber-400 dark:border-amber-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse-ring" />
            กำลังดำเนินการ
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-900/25 dark:text-emerald-400 dark:border-emerald-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            เสร็จสิ้น
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-900/25 dark:text-rose-400 dark:border-rose-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            ไม่สามารถดำเนินการได้
          </span>
        );
      default:
        return null;
    }
  };

  const formatThaiDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' น.';
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800/60 card-shadow overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-5 border-b border-slate-50 dark:border-slate-800/60 gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">📋 ตารางคำร้องล่าสุด</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500">รายการแจ้งซ่อมและร้องเรียน 5 รายการล่าสุดในระบบ</p>
        </div>
        <button 
          onClick={() => router.push('/backoffice/reports')}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-100 dark:border-slate-700 transition-colors cursor-pointer self-start sm:self-auto"
        >
          ดูทั้งหมด
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="overflow-x-auto">
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-full text-slate-300 dark:text-slate-600 mb-4">
              <Inbox className="w-10 h-10" />
            </div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">ไม่มีข้อมูลคำร้องในขณะนี้</h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm text-center">
              ระบบยังไม่ได้รับเรื่องแจ้งร้องเรียนใดๆ
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100/50 dark:border-slate-800/40">
                <th className="py-4 px-6">เลขที่อ้างอิง</th>
                <th className="py-4 px-4">หมวดหมู่</th>
                <th className="py-4 px-4">หัวข้อ</th>
                <th className="py-4 px-4">ผู้แจ้ง</th>
                <th className="py-4 px-4">วันที่แจ้ง</th>
                <th className="py-4 px-4 text-center">สถานะ</th>
                <th className="py-4 px-6 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40 text-xs">
              {reports
                .slice(0, 5)
                .map((report: any) => (
                  <tr 
                    key={report.id} 
                    className="hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors group"
                  >
                    <td className="py-4 px-6 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {report.public_id}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {report.categories?.name_th || "-"}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                          {report.subcategories?.name_th || "-"}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 max-w-xs">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-semibold text-slate-700 dark:text-slate-200 truncate block max-w-[200px]">
                          {report.title || report.description}
                        </span>
                        {report.room_number && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block max-w-[220px]">
                            {report.room_number}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 text-[10px] font-bold uppercase">
                          {(report.reporter_name || "U").charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {report.reporter_name || "ไม่ระบุชื่อ"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-500 dark:text-slate-400 font-medium">
                      {formatThaiDate(report.created_at)}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {getStatusBadge(report.status)}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => router.push(`/backoffice/reports/${report.public_id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-300 dark:hover:text-slate-100 rounded-xl font-bold transition-all cursor-pointer text-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>ดูรายละเอียด</span>
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
});

DashboardRecentReports.displayName = "DashboardRecentReports";
