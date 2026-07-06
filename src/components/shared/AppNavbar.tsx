import React from 'react';
import Link from 'next/link';

export const AppNavbar: React.FC = () => {
  return (
    <nav className="w-full h-[72px] bg-white dark:bg-slate-900 border-b border-[#EDF0F4] dark:border-slate-800 px-[20px] flex items-center justify-between sticky top-0 z-50">
      {/* Left: Faculty Logo */}
      <Link href="/" className="flex items-center gap-2.5 group">
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white shadow-sm font-bold text-sm shrink-0 transition-transform group-hover:scale-105">
          KU
        </div>
        <div className="flex flex-col">
          <span className="text-[12px] leading-tight font-extrabold text-slate-900 dark:text-white">คณะสังคมศาสตร์ มก.</span>
          <span className="text-[9px] leading-tight text-slate-500 dark:text-slate-400 font-semibold tracking-wider mt-0.5">FACULTY OF SOCIAL SCIENCES</span>
        </div>
      </Link>

      {/* Right: Search Icon */}
      <Link 
        href="/track/lookup" 
        className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors shrink-0"
        aria-label="ค้นหาปัญหา"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
      </Link>
    </nav>
  );
};
