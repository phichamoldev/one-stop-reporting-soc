import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function Navbar() {
  const router = useRouter();

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between bg-white px-4 border-b border-gray-100 h-[72px] shrink-0">
      {/* Left Section */}
      <Link href="/" className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-sm shrink-0">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
            <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="2.5" strokeDasharray="3 3"/>
            <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="1" />
            <path d="M50 20C33.4315 20 20 33.4315 20 50C20 66.5685 33.4315 80 50 80C66.5685 80 80 66.5685 80 50C80 33.4315 66.5685 20 50 20Z" stroke="currentColor" strokeWidth="2.5" />
            <path d="M20 50H80" stroke="currentColor" strokeWidth="1.5" />
            <path d="M30 35H70" stroke="currentColor" strokeWidth="1" />
            <path d="M30 65H70" stroke="currentColor" strokeWidth="1" />
            <path d="M50 20C55 30 58 40 58 50C58 60 55 70 50 80C45 70 42 60 42 50C42 40 45 30 50 20Z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M50 35V65" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            <circle cx="50" cy="30" r="4" fill="currentColor" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-extrabold text-gray-900 leading-tight">คณะสังคมศาสตร์ มก.</span>
          <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide leading-tight">Faculty of Social Sciences</span>
        </div>
      </Link>

      {/* Right Section */}
      <button 
        onClick={() => router.push("/track/lookup")}
        className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-primary transition-colors cursor-pointer"
        title="กลับไปหน้าค้นหาสถานะ"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
        </svg>
      </button>
    </div>
  );
}
