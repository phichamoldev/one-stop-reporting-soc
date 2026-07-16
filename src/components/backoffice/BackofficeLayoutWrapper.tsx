"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { BackofficeSidebar } from "@/components/backoffice/BackofficeSidebar";

export const BackofficeLayoutWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const isLoginPage = pathname === "/backoffice/login";

  if (isLoginPage) {
    return <div className="min-h-screen bg-slate-50 font-sans">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans flex">
      {/* Sidebar for Desktop */}
      <div className="hidden lg:block w-[260px] shrink-0">
        <BackofficeSidebar />
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
    </div>
  );
};
