/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Building, Inbox, ArrowUpRight, ShieldCheck, PieChart } from 'lucide-react';
import { Report } from '../types';

interface DepartmentsViewProps {
  reports: Report[];
}

export const DepartmentsView: React.FC<DepartmentsViewProps> = ({ reports }) => {
  const departments = [
    { name: 'ภาควิชาจิตวิทยา', head: 'ศ.ดร.มานะ รักไทย', phone: '02-123-4567', code: 'PSY' },
    { name: 'ภาควิชาสังคมวิทยาและมนุษยวิทยา', head: 'รศ.ดร.สมศรี มีสุข', phone: '02-123-4568', code: 'SOC-ANT' },
    { name: 'ภาควิชาภูมิศาสตร์', head: 'ผศ.ดร.วิชัย ชัยชนะ', phone: '02-123-4569', code: 'GEO' },
    { name: 'ภาควิชารัฐศาสตร์', head: 'ดร.อรทัย สายสลวย', phone: '02-123-4570', code: 'POL' },
    { name: 'สำนักงานคณบดี', head: 'นางวิลาวัลย์ แก้วใจ', phone: '02-123-4571', code: 'DEAN' },
    { name: 'ศูนย์วิจัยสังคมศาสตร์', head: 'รศ.ดร.ศักดิ์ดา ดีเลิศ', phone: '02-123-4572', code: 'SRC' },
    { name: 'ห้องสมุดคณะสังคมศาสตร์', head: 'นางกรรณิการ์ แสนดี', phone: '02-123-4573', code: 'LIB' }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
          🏢 ระบบข้อมูลหน่วยงานและภาควิชา
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          รายชื่อหน่วยงานในสังกัดคณะสังคมศาสตร์และสถิติจำนวนร้องเรียนจำแนกรายแผนก
        </p>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept) => {
          const deptReports = reports.filter(r => r.department === dept.name);
          const activeCount = deptReports.filter(r => r.status !== 'เสร็จสิ้น' && r.status !== 'ยกเลิกรายการ' && r.status !== 'ไม่สามารถดำเนินการได้').length;
          const completedCount = deptReports.filter(r => r.status === 'เสร็จสิ้น').length;

          return (
            <div 
              key={dept.name} 
              className="bg-white dark:bg-slate-900 rounded-[20px] p-6 border border-slate-100 dark:border-slate-800/60 card-shadow hover:translate-y-[-2px] transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="p-3 bg-red-100/40 dark:bg-red-950/20 text-primary dark:text-red-400 rounded-xl">
                  <Building className="w-6 h-6" />
                </div>
                <span className="font-mono text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                  {dept.code}
                </span>
              </div>

              <div className="mt-4">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 truncate">
                  {dept.name}
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold mt-1">
                  หัวหน้าหน่วยงาน: {dept.head}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  เบอร์โทรภายใน: {dept.phone}
                </p>
              </div>

              {/* Stats Breakdown Row */}
              <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-slate-50 dark:border-slate-800/60 text-center">
                <div className="bg-slate-50/50 dark:bg-slate-800/30 p-2.5 rounded-xl">
                  <span className="text-lg font-black text-slate-800 dark:text-slate-200">
                    {deptReports.length}
                  </span>
                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">แจ้งรวม</p>
                </div>
                <div className="bg-blue-50/40 dark:bg-blue-950/20 p-2.5 rounded-xl">
                  <span className="text-lg font-black text-blue-600 dark:text-blue-400 animate-pulse">
                    {activeCount}
                  </span>
                  <p className="text-[9px] text-blue-400 font-bold uppercase mt-0.5">ค้างซ่อม</p>
                </div>
                <div className="bg-emerald-50/40 dark:bg-emerald-950/20 p-2.5 rounded-xl">
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {completedCount}
                  </span>
                  <p className="text-[9px] text-emerald-400 font-bold uppercase mt-0.5">เสร็จแล้ว</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
