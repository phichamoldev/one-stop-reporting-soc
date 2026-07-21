"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { StaffProfile } from "@/types/report";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";

interface StaffAuthContextType {
  user: User | null;
  profile: StaffProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const StaffAuthContext = createContext<StaffAuthContextType | undefined>(undefined);

export const StaffAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const { data: profileData, isLoading: profileLoading } = useSWR(
    user ? "/api/staff/profile" : null,
    async (url) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${session.access_token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    { dedupingInterval: 300000 } // Cache profile for 5 minutes
  );

  useEffect(() => {
    if (profileData?.profile) {
      setProfile(profileData.profile as unknown as StaffProfile);
    } else if (profileData?.profile === null) {
      setProfile(null);
    } else if (profileData === undefined && !profileLoading && !user) {
      setProfile(null);
    }
  }, [profileData, profileLoading, user]);

  const isContextLoading = loading || (!!user && profileLoading);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    // Initial session load to prevent waiting for event
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
           return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
        }
        return { error: error.message };
      }
      return { error: null };
    } catch (err: any) {
      return { error: err.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" };
    }
  };

  const signOut = async () => {
    try {
      // 1. Await actual sign out to guarantee localStorage is cleared before navigation
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // 2. Clear state
      setUser(null);
      setProfile(null);
      
      // 3. Clear all SWR caches globally
      await mutate(() => true, undefined, { revalidate: false });

      // 4. Primary navigation
      try {
        router.replace("/backoffice/login");
        router.refresh();
      } catch (navError) {
        // 5. Fallback navigation if Next.js router fails
        console.error("Router navigation failed, falling back to window.location", navError);
        window.location.replace("/backoffice/login");
      }
    }
  };

  return (
    <StaffAuthContext.Provider value={{ user, profile, loading: isContextLoading, signIn, signOut }}>
      {children}
    </StaffAuthContext.Provider>
  );
};

export const useStaffAuthContext = () => {
  const context = useContext(StaffAuthContext);
  if (context === undefined) {
    throw new Error("useStaffAuthContext must be used within a StaffAuthProvider");
  }
  return context;
};
