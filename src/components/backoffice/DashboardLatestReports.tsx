"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Inbox, Eye } from "lucide-react";
import { useDashboardContext } from "@/contexts/DashboardContext";
import { StatusBadge } from "@/components/design-system/StatusBadge";

export const DashboardLatestReports: React.FC = React.memo(() => {
  const router = useRouter();
  const { data, isLoading } = useDashboardContext();

  const reports = React.useMemo(() => {
    return data?.reports || [];
  }, [data?.reports]);

  if (isLoading || !data) return (
    <div className="h-[400px] bg-slate-50 dark:bg-slate-900 rounded-[20px] animate-pulse"></div>
  );

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
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">🗂️ คำร้องที่เข้ามาใหม่</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500">รายการคำร้อง 10 รายการล่าสุด</p>
        </div>
        <button 
          onClick={() => router.push('/backoffice/reports')}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-100 dark:border-slate-700 transition-colors cursor-pointer self-start sm:self-auto"
        >
          ดูงานทั้งหมด
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="overflow-x-auto">
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-full text-slate-300 dark:text-slate-600 mb-4">
              <Inbox className="w-10 h-10" />
            </div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">ไม่มีคำร้องที่เข้ามาใหม่</h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm text-center">
              ยังไม่มีคำร้องใด ๆ ในระบบขณะนี้
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100/50 dark:border-slate-800/40">
                <th className="py-4 px-6 font-semibold first:rounded-l-xl whitespace-nowrap">เลขที่อ้างอิง</th>
                <th className="py-4 px-4 whitespace-nowrap">หมวดหมู่</th>
                <th className="py-4 px-4 w-[250px] whitespace-nowrap">หัวข้อ</th>
                <th className="py-4 px-4 whitespace-nowrap">ผู้แจ้ง</th>
                <th className="py-4 px-4 whitespace-nowrap">หน่วยงาน</th>
                <th className="py-4 px-4 whitespace-nowrap">วันที่แจ้ง</th>
                <th className="py-4 px-4 text-center whitespace-nowrap">สถานะ</th>
                <th className="py-4 px-6 text-center last:rounded-r-xl whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40 text-xs">
              {reports
                .slice(0, 10)
                .map((report: any) => (
                  <tr 
                    key={report.id} 
                    className="hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors group"
                  >
                    <td className="py-4 px-6 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {report.public_id}
                    </td>
                    <td className="py-4 px-4 max-w-[180px]">
                      <div className="flex flex-col gap-0.5">
                        <span 
                          className="font-semibold text-slate-700 dark:text-slate-300 truncate block"
                          title={report.categories?.name_th || "-"}
                        >
                          {report.categories?.name_th || "-"}
                        </span>
                        <span 
                          className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate block"
                          title={report.subcategories?.name_th || "-"}
                        >
                          {report.subcategories?.name_th || "-"}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 max-w-xs">
                      <div className="flex flex-col gap-0.5">
                        <span 
                          className="font-semibold text-slate-800 dark:text-slate-200 truncate block max-w-[220px]"
                          title={report.title || report.description}
                        >
                          {report.title || report.description}
                        </span>
                        {(report.location || report.room_number) && (
                          <span 
                            className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate block max-w-[220px]"
                            title={report.location || report.room_number}
                          >
                            {report.location || report.room_number}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 max-w-[150px]">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 text-[10px] font-bold uppercase shrink-0">
                          {(report.users?.first_name || report.reporter_name || "U").charAt(0)}
                        </div>
                        <span 
                          className="font-semibold text-slate-700 dark:text-slate-300 truncate block max-w-[120px]"
                          title={report.users ? `${report.users.first_name} ${report.users.last_name}` : (report.reporter_name || "ไม่ระบุชื่อ")}
                        >
                          {report.users ? `${report.users.first_name} ${report.users.last_name}` : (report.reporter_name || "ไม่ระบุชื่อ")}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 max-w-[160px]">
                      <span 
                        className="text-slate-700 dark:text-slate-300 font-medium truncate block max-w-[140px]"
                        title={report.categories?.departments?.name_th || "ไม่ระบุหน่วยงาน"}
                      >
                        {report.categories?.departments?.name_th || "ไม่ระบุหน่วยงาน"}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                      {formatThaiDate(report.created_at)}
                    </td>
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <StatusBadge status={report.status} className="px-3 py-1 text-[11px] font-semibold shadow-sm" />
                    </td>
                    <td className="py-4 px-6 text-center whitespace-nowrap">
                      <button
                        onClick={() => router.push(`/backoffice/reports/${report.public_id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-300 dark:hover:text-slate-100 rounded-xl font-bold transition-all cursor-pointer text-xs whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5 shrink-0" />
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

DashboardLatestReports.displayName = "DashboardLatestReports";
