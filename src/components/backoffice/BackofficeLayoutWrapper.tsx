"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { BackofficeSidebar } from "@/components/backoffice/BackofficeSidebar";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { NotificationToastContainer } from "@/components/backoffice/NotificationToast";
import { RealtimeListener } from "@/components/backoffice/RealtimeListener";
import { BackofficeNavbar } from "@/components/backoffice/BackofficeNavbar";
import { StaffAuthProvider } from "@/contexts/StaffAuthContext";
import { AuthGuard } from "@/components/backoffice/AuthGuard";

import { useStaffAuth } from "@/hooks/useStaffAuth";

const InnerLayout = ({ children, isLoginPage }: { children: React.ReactNode, isLoginPage: boolean }) => {
  const { user } = useStaffAuth();
  
  if (isLoginPage) {
    return <div data-theme="light" className="min-h-screen bg-slate-50 font-sans">{children}</div>;
  }
  
  const authKey = user?.id ?? "guest";

  return (
    <NotificationProvider>
      <RealtimeListener />
      <NotificationToastContainer />
      <div data-theme="light" className="min-h-screen bg-[#F8FAFC] font-sans flex">
        {/* Sidebar for Desktop */}
        <div className="hidden lg:block w-[240px] shrink-0">
          <BackofficeSidebar key={`sidebar-${authKey}`} />
        </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC]">
        <BackofficeNavbar key={`navbar-${authKey}`} />
        <main className="flex-1 w-full flex flex-col min-w-0">
          <div className="w-full max-w-[1440px] mx-auto min-w-0 flex-1 flex flex-col">
            <AuthGuard>
              {children}
            </AuthGuard>
          </div>
        </main>
      </div>
      </div>
    </NotificationProvider>
  );
};

export const BackofficeLayoutWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const isLoginPage = pathname === "/backoffice/login";

  return (
    <StaffAuthProvider>
      <InnerLayout isLoginPage={isLoginPage}>
        {children}
      </InnerLayout>
    </StaffAuthProvider>
  );
};
