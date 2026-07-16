"use client";

import React from 'react';
import Link from 'next/link';
import Image from "next/image";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { LogOut } from "lucide-react";

export const BackofficeNavbar: React.FC = () => {
  const { profile, signOut } = useStaffAuth();

  return (
    <nav className="w-full h-[72px] bg-white border-b border-[#EDF0F4] px-[20px] flex items-center justify-between sticky top-0 z-50 shadow-sm">
      <Link href="/backoffice" className="flex items-center gap-2.5 group">
        <div className="w-8 h-8 rounded-md bg-white p-1 flex items-center justify-center border border-slate-100 shadow-sm">
          <Image
            src="/images/ku-logo.png"
            alt="Kasetsart University"
            width={20}
            height={20}
            className="object-contain w-auto h-auto"
            priority
          />
        </div>
        <div>
          <span className="text-[14px] leading-none font-bold block text-slate-800">Back Office</span>
          <span className="text-[10px] leading-none text-[#D1350F] block uppercase tracking-wider font-semibold mt-1">
            Faculty of Social Sciences
          </span>
        </div>
      </Link>

      {profile && (
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <span className="text-[13px] font-bold text-slate-800 block leading-tight">{profile.full_name}</span>
            <span className="text-[11px] text-[#D1350F] font-medium">{profile.departments?.name_th || "-"} • {profile.role}</span>
          </div>
          <button 
            onClick={() => signOut()} 
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:text-[#D1350F] hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">ออกจากระบบ</span>
          </button>
        </div>
      )}
    </nav>
  );
};
