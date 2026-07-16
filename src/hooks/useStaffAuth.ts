"use client";

import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { StaffProfile } from "@/types/report";

export function useStaffAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user && mounted) {
          setUser(session.user);
          await loadProfile(session);
        } else if (mounted) {
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error("Error loading session:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    async function loadProfile(sessionData: any) {
      try {
        const res = await fetch("/api/staff/profile", {
          headers: {
            "Authorization": `Bearer ${sessionData.access_token}`
          }
        });
        
        if (!res.ok) {
          throw new Error("Failed to fetch profile");
        }
        
        const data = await res.json();
        
        if (mounted && data.profile) {
          setProfile(data.profile as unknown as StaffProfile);
        }
      } catch (error) {
        console.error("Error loading staff profile:", error);
      }
    }

    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      if (session?.user) {
        setUser(session.user);
        await loadProfile(session);
      } else {
        setUser(null);
        setProfile(null);
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
    await supabase.auth.signOut();
  };

  return {
    user,
    profile,
    loading,
    signIn,
    signOut
  };
}
