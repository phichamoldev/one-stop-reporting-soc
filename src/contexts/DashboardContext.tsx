"use client";

import React, { createContext, useContext } from "react";
import useSWR from "swr";
import { fetcherWithAuth } from "@/lib/fetcher";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { hasAccess } from "@/lib/auth-helpers";

interface DashboardContextType {
  data: any;
  isLoading: boolean;
  error: any;
  mutate: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider = ({ 
  children, 
  dateRange 
}: { 
  children: React.ReactNode; 
  dateRange: string;
}) => {
  const { user, profile } = useStaffAuth();
  const params = new URLSearchParams({ dateRange });
  
  const { data, isLoading, error, mutate } = useSWR(
    user && profile && hasAccess(profile.role, "/backoffice") 
      ? `/api/backoffice/dashboard?${params.toString()}` 
      : null,
    fetcherWithAuth,
    { dedupingInterval: 60000 }
  );

  return (
    <DashboardContext.Provider value={{ data, isLoading, error, mutate }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboardContext = () => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error("useDashboardContext must be used within a DashboardProvider");
  }
  return context;
};
