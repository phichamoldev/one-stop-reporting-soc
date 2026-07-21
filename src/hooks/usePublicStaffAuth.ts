"use client";

import { useState, useEffect, useMemo } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { StaffProfile } from "@/types/report";
import useSWR from "swr";

export function usePublicStaffAuth() {
  const [user, setUser] = useState<User | null>(null);
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
    { dedupingInterval: 300000 }
  );

  const profile = useMemo(() => {
    if (!user) return null;
    return profileData?.profile ? (profileData.profile as unknown as StaffProfile) : null;
  }, [user, profileData]);

  const isContextLoading = loading || (!!user && profileLoading);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

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

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
    }
  };

  return { user, profile, loading: isContextLoading, signOut };
}
