"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { BackofficeSidebar } from "@/components/backoffice/BackofficeSidebar";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { NotificationToastContainer } from "@/components/backoffice/NotificationToast";
import { RealtimeListener } from "@/components/backoffice/RealtimeListener";
import { BackofficeNavbar } from "@/components/backoffice/BackofficeNavbar";

export const BackofficeLayoutWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const isLoginPage = pathname === "/backoffice/login";

  if (isLoginPage) {
    return <div className="min-h-screen bg-slate-50 font-sans">{children}</div>;
  }

  return (
    <NotificationProvider>
      <RealtimeListener />
      <NotificationToastContainer />
      <div className="min-h-screen bg-[#F8FAFC] font-sans flex">
        {/* Sidebar for Desktop */}
        <div className="hidden lg:block w-[260px] shrink-0">
          <BackofficeSidebar />
        </div>
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <BackofficeNavbar />
          {children}
        </div>
      </div>
    </NotificationProvider>
  );
};
