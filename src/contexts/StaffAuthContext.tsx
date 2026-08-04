"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { StaffProfile } from "@/types/report";
import { useRouter } from "next/navigation";

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
  
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [sessionLoading, setSessionLoading] = useState<boolean>(true);

  const fetchProfile = async (session: Session) => {
    setProfileLoading(true);
    setStatus('loading');
    
    try {
      const res = await fetch("/api/staff/profile?v=2", {
        headers: { "Authorization": `Bearer ${session.access_token}` },
        cache: 'no-store'
      });
      
      if (!res.ok) {
        // 401, 403, 404 must become forbidden without logging out
        setProfile(null);
        setStatus('forbidden');
        return;
      }
      
      const data = await res.json();
      if (data?.profile) {
        setProfile(data.profile as unknown as StaffProfile);
        setStatus('authenticated');
      } else {
        setProfile(null);
        setStatus('forbidden');
      }
    } catch (err: any) {
      console.error('FETCH PROFILE ERROR:', err);
      setProfile(null);
      setStatus('forbidden');
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    let initialSessionHandled = false;

    const handleSession = async (session: Session | null) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        setSessionLoading(false);
        await fetchProfile(session);
      } else {
        setUser(null);
        setProfile(null);
        setStatus('unauthenticated');
        setSessionLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      if (event === 'INITIAL_SESSION') {
        initialSessionHandled = true;
        await handleSession(session);
      } else if (event === 'SIGNED_IN') {
        isLoggingOut = false;
        await handleSession(session);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setStatus('unauthenticated');
        setSessionLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      // Fallback in case INITIAL_SESSION event doesn't fire (Supabase JS v2 quirk)
      if (!initialSessionHandled) {
        await handleSession(session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    setIsAuthenticating(true);
    setStatus('authenticating');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus('unauthenticated');
        if (error.message.includes("Invalid login credentials")) {
           return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
        }
        return { error: error.message };
      }
      return { error: null };
    } catch (err: any) {
      setStatus('unauthenticated');
      return { error: err.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" };
    } finally {
      setIsAuthenticating(false);
    }
  };

  const signOut = async () => {
    isLoggingOut = true;
    
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Logout error:", error);
    }
    
    // Completely deterministic local state cleanup without mutating any caches
    setUser(null);
    setProfile(null);
    setStatus('unauthenticated');

    try {
      router.replace("/backoffice/login");
    } catch (navError) {
      window.location.replace("/backoffice/login");
    }
  };

  // V1 Compatibility Mapping
  const isContextLoading = status === 'loading' || status === 'authenticating';
  const profileResolved = status === 'authenticated' || status === 'forbidden';

  return (
    <StaffAuthContext.Provider value={{ 
      user, 
      profile, 
      authLoading: sessionLoading, 
      profileLoading, 
      profileResolved, 
      loading: isContextLoading, 
      signIn, 
      signOut,
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
