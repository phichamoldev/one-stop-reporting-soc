import React from "react";
import { CheckCircle2, AlertTriangle, Clock, XCircle, Ban } from "lucide-react";
import { getRoleDisplayName } from "@/lib/role-config";

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

export const StaffCard: React.FC<StaffCardProps> = ({ staff, onClick }) => {
  const { stats } = staff;
  const initial = staff.full_name ? staff.full_name.charAt(0) : "?";
  const roleColor = roleColors[staff.role] || roleColors.staff;
  const roleLabel = getRoleDisplayName(staff.role);

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
              {staff.role === 'manager' && staff.manager_departments && staff.manager_departments.length > 0
                ? staff.manager_departments.map((md: any) => md.departments?.name_th).filter(Boolean).join(", ")
                : staff.departments?.name_th || "ไม่มีสังกัด"}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="text-[11px] font-bold text-slate-500 mb-1">
          การดำเนินงาน
        </div>

        <div className="flex items-center justify-between px-2">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-medium text-slate-400 mb-1">ทั้งหมด</span>
            <span className="text-lg font-extrabold text-slate-700 dark:text-slate-200">{stats.total}</span>
          </div>
          <div className="w-px h-8 bg-slate-100 dark:bg-slate-800"></div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-medium text-slate-400 mb-1">กำลังทำ</span>
            <span className="text-lg font-extrabold text-orange-600">{stats.inProgress}</span>
          </div>
          <div className="w-px h-8 bg-slate-100 dark:bg-slate-800"></div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-medium text-slate-400 mb-1">เสร็จสิ้น</span>
            <span className="text-lg font-extrabold text-green-600">{stats.completed}</span>
          </div>
        </div>

        <div className="pt-1">
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
