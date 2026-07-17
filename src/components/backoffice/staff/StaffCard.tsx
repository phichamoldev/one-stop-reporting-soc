import React from "react";
import { CheckCircle2, AlertTriangle, Clock, XCircle, Ban } from "lucide-react";

interface StaffCardProps {
  staff: any;
  onClick: (staff: any) => void;
}

const roleColors: Record<string, string> = {
  staff: "bg-slate-100 text-slate-600 border-slate-200",
  manager: "bg-orange-100 text-orange-700 border-orange-200",
  admin: "bg-blue-100 text-blue-700 border-blue-200",
  super_admin: "bg-red-100 text-red-700 border-red-200"
};

const roleLabels: Record<string, string> = {
  staff: "เจ้าหน้าที่ปฏิบัติงาน",
  manager: "หัวหน้าฝ่าย",
  admin: "ผู้ดูแลระบบ",
  super_admin: "ผู้ดูแลระบบสูงสุด"
};

export const StaffCard: React.FC<StaffCardProps> = ({ staff, onClick }) => {
  const { stats } = staff;
  const initial = staff.full_name ? staff.full_name.charAt(0) : "?";
  const roleColor = roleColors[staff.role] || roleColors.staff;
  const roleLabel = roleLabels[staff.role] || staff.role;

  return (
    <div 
      onClick={() => onClick(staff)}
      className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex items-start gap-4 mb-5">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl font-bold shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-primary transition-colors">
            {staff.full_name}
          </h3>
          <p className="text-xs text-slate-500 truncate mb-2">{staff.email}</p>
          <div className="flex flex-col gap-1.5">
            <span className={`w-fit text-[10px] px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap ${roleColor}`}>
              {roleLabel}
            </span>
            <span className="text-[11px] text-slate-500 font-medium truncate">
              {staff.departments?.name_th || "ไม่มีสังกัด"}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-end mb-1">
          <span className="text-[11px] font-bold text-slate-500">รับผิดชอบทั้งหมด</span>
          <span className="text-lg font-extrabold text-slate-800 dark:text-slate-100 leading-none">{stats.total} <span className="text-[10px] font-normal text-slate-500">งาน</span></span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-50/70 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-700/50 flex flex-col justify-between">
            <div className="flex items-center gap-1 mb-1 text-slate-500">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span className="text-[9px] sm:text-[10px] font-medium leading-tight">กำลังดำเนินการ</span>
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{stats.inProgress}</p>
          </div>

          <div className="bg-slate-50/70 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-700/50 flex flex-col justify-between">
            <div className="flex items-center gap-1 mb-1 text-slate-500">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
              <span className="text-[9px] sm:text-[10px] font-medium leading-tight">เสร็จสิ้น</span>
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{stats.completed}</p>
          </div>

          <div className="bg-slate-50/70 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-700/50 flex flex-col justify-between">
            <div className="flex items-center gap-1 mb-1 text-slate-500">
              <Ban className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[9px] sm:text-[10px] font-medium leading-tight">ทำไม่ได้/ยกเลิก</span>
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{stats.cancelled + stats.rejected}</p>
          </div>
        </div>

        <div className="pt-2">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-bold text-slate-500">ความสำเร็จ</span>
            <span className="text-[11px] font-extrabold text-primary">{stats.completionRate}%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-primary h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${stats.completionRate}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};
