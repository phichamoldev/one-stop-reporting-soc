"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { StaffProfile } from "@/types/report";
import { useRouter, usePathname } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticating' | 'authenticated' | 'forbidden';

interface StaffAuthContextType {
  // Legacy fields
  user: User | null;
  profile: StaffProfile | null;
  authLoading: boolean;
  profileLoading: boolean;
  profileResolved: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  
  // V2 fields
  status: AuthStatus;
}

const StaffAuthContext = createContext<StaffAuthContextType | undefined>(undefined);

export let isLoggingOut = false;

export const StaffAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  
  const [user, setUser] = useState<User | null>(null);
  const [sessionLoading, setSessionLoading] = useState<boolean>(true);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

  const { data: profileData, error: profileError, isLoading: profileLoading } = useSWR(
    user ? "/api/staff/profile?v=2" : null,
    async (url) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");
      if (!session.access_token || session.access_token.trim() === "") {
         await supabase.auth.signOut();
         throw new Error("Corrupted session, forcing logout");
      }
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${session.access_token}` },
        cache: 'no-store'
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error('FETCH ERROR:', res.status, errText);
        throw new Error("Failed to fetch profile: " + errText);
      }
      return res.json();
    },
    { dedupingInterval: 300000 }
  );

  const profile = useMemo(() => {
    if (!user) return null;
    return profileData?.profile ? (profileData.profile as unknown as StaffProfile) : null;
  }, [user, profileData]);
  
  // V2 Unified State Machine
  const status: AuthStatus = useMemo(() => {
    if (sessionLoading) return 'loading';
    if (!user) return 'unauthenticated';
    if (isAuthenticating) return 'authenticating';
    
    if (profileLoading) return 'loading';
    if (profileError) return 'forbidden';
    if (!profile) return 'forbidden';
    
    return 'authenticated';
  }, [sessionLoading, user, isAuthenticating, profileLoading, profileError, profile]);

  // V1 Compatibility Mapping
  const isContextLoading = status === 'loading' || status === 'authenticating';
  const profileResolved = status === 'authenticated' || status === 'forbidden';

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (session?.user) {
        isLoggingOut = false;
        setUser(session.user);
      } else {
        setUser(null);
      }
      setSessionLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
      }
      setSessionLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    setIsAuthenticating(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
           return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
        }
        return { error: error.message };
      }
      return { error: null };
    } catch (err: any) {
      return { error: err.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" };
    } finally {
      setIsAuthenticating(false);
    }
  };

  const signOut = async () => {
    isLoggingOut = true;
    setUser(null);
    mutate("/api/staff/profile?v=2", undefined, { revalidate: false }).catch(console.error);

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Logout error:", error);
    }

    try {
      router.replace("/backoffice/login");
    } catch (navError) {
      console.error("Router navigation failed, falling back to window.location", navError);
      window.location.replace("/backoffice/login");
    }
  };

  return (
    <StaffAuthContext.Provider value={{ 
      // V1 Legacy properties
      user, 
      profile, 
      authLoading: sessionLoading, 
      profileLoading, 
      profileResolved, 
      loading: isContextLoading, 
      signIn, 
      signOut,
      // V2 property
      status 
    }}>
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
