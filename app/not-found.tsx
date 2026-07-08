import React from "react";
import Link from "next/link";
import { AppContainer } from "@/components/design-system/AppContainer";
import { AppNavbar } from "@/components/shared/AppNavbar";
import { AppButton } from "@/components/design-system/AppButton";
import { GlobalFooter } from "@/components/shared/GlobalFooter";

export default function NotFoundPage() {
  return (
    <AppContainer>
      <AppNavbar />
      <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-slate-50 dark:bg-slate-950 justify-between items-center text-center">
        <div className="space-y-6 pt-24 w-full">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-400 flex items-center justify-center mx-auto border border-[#EDF0F4] dark:border-slate-800">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-[17px] font-bold text-slate-800 dark:text-white">ไม่พบหน้าที่ต้องการ (404)</h2>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 max-w-[280px] mx-auto leading-relaxed">
              ขออภัย หน้าที่คุณพยายามเข้าถึงอาจถูกลบ ย้าย หรือไม่มีอยู่จริง
            </p>
          </div>
        </div>
        
        <div className="w-full flex flex-col gap-3 mt-auto pt-6 pb-6">
          <Link href="/" className="block">
            <AppButton fullWidth variant="primary">
              กลับหน้าหลัก
            </AppButton>
          </Link>
        </div>
        
        <GlobalFooter />
      </div>
    </AppContainer>
  );
}
