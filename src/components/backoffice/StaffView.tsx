"use client";

import React from 'react';
import { Users, Phone, ShieldCheck, Mail, ClipboardCheck, Play } from 'lucide-react';

interface Staff {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  imageUrl: string | null;
  activeTasks: number;
  completedTasks: number;
  phone: string | null;
}

interface StaffViewProps {
  staff: Staff[];
}

export const StaffView: React.FC<StaffViewProps> = ({ staff }) => {
  // Group staff by department
  const staffByDept = staff.reduce((acc, person) => {
    const dept = person.department || 'ไม่ระบุฝ่าย';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(person);
    return acc;
  }, {} as Record<string, Staff[]>);

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
          👥 ข้อมูลเจ้าหน้าที่และทีมช่างซ่อมบำรุง
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
          รายชื่อและขีดความสามารถของเจ้าหน้าที่ปฏิบัติงานซ่อม
        </p>
      </div>

      {Object.entries(staffByDept).map(([dept, people]) => (
        <div key={dept} className="space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-lg font-extrabold text-slate-700 dark:text-slate-200">
              {dept}
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-bold">
              {people.length} คน
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {people.map((person) => (
          <div 
            key={person.id} 
            className="bg-white dark:bg-slate-900 rounded-[20px] p-6 border border-slate-100 dark:border-slate-800/60 card-shadow transition-all hover:translate-y-[-2px] flex flex-col items-center text-center"
          >
            {/* Staff image with custom container */}
            <div className="relative">
              <img 
                src={person.imageUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(person.name) + '&background=0D8ABC&color=fff'} 
                alt={person.name} 
                className="w-24 h-24 rounded-full object-cover border-4 border-slate-50 dark:border-slate-800 shadow-md"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-1 right-1 w-4.5 h-4.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] text-white" />
            </div>

            <div className="mt-4">
              <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">
                {person.name}
              </h3>
              <p className={`text-xs font-bold mt-2 px-2.5 py-1 rounded-full inline-block ${
                person.role === 'ผู้ดูแลระบบสูงสุด' ? 'text-purple-600 bg-purple-100/50 dark:bg-purple-900/20' :
                person.role === 'ผู้ดูแลระบบ' ? 'text-primary dark:text-red-400 bg-red-100/30 dark:bg-red-950/20' :
                'text-blue-600 bg-blue-100/50 dark:bg-blue-900/20'
              }`}>
                {person.role}
              </p>
            </div>

            {/* Tasks statistics block */}
            <div className="grid grid-cols-2 gap-3 w-full mt-6 pt-4 border-t border-slate-50 dark:border-slate-800/60">
              <div className="bg-slate-50 dark:bg-slate-800/30 p-2 rounded-xl text-center">
                <span className="text-base font-black text-slate-800 dark:text-slate-200 block">
                  {person.activeTasks}
                </span>
                <span className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 inline-flex items-center gap-1">
                  <Play className="w-2.5 h-2.5 text-amber-500 rotate-90 shrink-0" />
                  ค้างมือ
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/30 p-2 rounded-xl text-center">
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400 block">
                  {person.completedTasks}
                </span>
                <span className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 inline-flex items-center gap-1">
                  <ClipboardCheck className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                  ปิดแล้ว
                </span>
              </div>
            </div>

            {/* Quick action info */}
            <div className="mt-5 w-full space-y-1.5 text-left bg-slate-50/50 dark:bg-slate-800/10 p-3 rounded-xl border border-slate-50 dark:border-slate-800 text-[10px] text-slate-400 font-semibold">
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>เบอร์ติดต่อ: {person.phone || '-'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono">email: {person.email}</span>
              </div>
            </div>
          </div>
        ))}
          </div>
        </div>
      ))}
    </div>
  );
};
