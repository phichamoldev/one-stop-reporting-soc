import React from 'react';
import Link from 'next/link';

export function HeroSection() {
  return (
    <div className="relative bg-gradient-to-br from-[#D1350F] to-[#E35F3A] pt-8 pb-10 px-6 rounded-b-[40px] text-white shrink-0 shadow-lg">
      {/* Logo and Pill Button "One Stop Service" */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-primary shadow-sm font-bold text-xs select-none">
            KU
          </div>
          <div>
            <span className="text-[10px] leading-none font-extrabold block text-white/90">คณะสังคมศาสตร์ มก.</span>
            <span className="text-[8px] leading-none text-white/70 block uppercase tracking-wider font-semibold">Faculty of Social Sciences</span>
          </div>
        </div>
        
        <span className="px-3 py-1 rounded-full border border-white/30 text-[10px] font-bold text-white uppercase tracking-wider bg-white/10 backdrop-blur-sm">
          One Stop Service
        </span>
      </div>
      
      {/* Titles */}
      <div className="mt-6 space-y-1">
        <h1 className="text-xl font-extrabold tracking-tight">ระบบรับแจ้งปัญหา</h1>
        <h2 className="text-2xl font-black tracking-tight leading-none text-white/95">One Stop Service</h2>
        <p className="text-[11px] text-white/80 font-medium leading-relaxed max-w-[300px] pt-1">
          ศูนย์กลางการแจ้งปัญหาและติดตามสถานะการดำเนินงานของคณะสังคมศาสตร์
        </p>
      </div>
      
      {/* Floating Badges */}
      <div className="mt-5 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-black/15 text-white/95 border border-white/10 backdrop-blur-sm">
          ⚡ แจ้งปัญหาภายใน 1 นาที
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-black/15 text-white/95 border border-white/10 backdrop-blur-sm">
          📍 ติดตามสถานะแบบ Real-time
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-black/15 text-white/95 border border-white/10 backdrop-blur-sm">
          🔔 รับการแจ้งเตือน
        </span>
      </div>
      
      {/* Lookup Link */}
      <div className="mt-5">
        <Link
          href="/track/lookup"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-white hover:text-white/80 transition-colors bg-white/10 backdrop-blur-sm px-3.5 py-1.5 rounded-full border border-white/10"
        >
          <span>&rsaquo; ติดตามปัญหาที่แจ้งไว้แล้ว</span>
        </Link>
      </div>
    </div>
  );
}
