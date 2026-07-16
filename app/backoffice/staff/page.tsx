"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { supabase } from "@/lib/supabase";
import { StaffView } from "@/components/backoffice/StaffView";

export default function BackofficeStaffPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useStaffAuth();
  
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStaff = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/staff`, {
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      });
      
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.replace("/backoffice/login");
        }
        throw new Error("Failed to fetch data");
      }

      const result = await res.json();
      setStaff(result.staff || []);
    } catch (error) {
      console.error("Error fetching staff:", error);
    } finally {
      setLoading(false);
    }
  }, [user, router]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/backoffice/login");
    } else if (user) {
      fetchStaff();
    }
  }, [user, authLoading, fetchStaff, router]);

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="space-y-8 animate-pulse w-full max-w-6xl p-8">
          <div className="h-10 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 bg-white dark:bg-slate-900 rounded-[20px]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 animate-fade-in w-full mx-auto max-w-7xl pb-12">
      <StaffView staff={staff} />
    </div>
  );
}
