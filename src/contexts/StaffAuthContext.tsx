"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { StaffProfile } from "@/types/report";
import { useRouter } from "next/navigation";

export type AuthStatus =
  | "loading"
  | "unauthenticated"
  | "authenticating"
  | "authenticated"
  | "forbidden";

export type AuthErrorCode =
  | "INVALID_CREDENTIALS"
  | "AUTH_USER_NOT_FOUND"
  | "STAFF_NOT_FOUND"
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_INACTIVE"
  | "DATABASE_CONNECTION_ERROR"
  | "RLS_PERMISSION_ERROR"
  | "SESSION_ERROR";

export interface AuthErrorInfo {
  code: AuthErrorCode;
  message: string;
}

export function mapAuthErrorCodeToThaiMessage(
  code: string | undefined,
  fallbackMessage?: string
): AuthErrorInfo {
  switch (code) {
    case "INVALID_CREDENTIALS":
      return {
        code: "INVALID_CREDENTIALS",
        message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
      };
    case "AUTH_USER_NOT_FOUND":
      return {
        code: "AUTH_USER_NOT_FOUND",
        message: "ไม่พบบัญชีผู้ใช้งานในระบบยืนยันตัวตน",
      };
    case "STAFF_NOT_FOUND":
      return {
        code: "STAFF_NOT_FOUND",
        message: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงระบบ (ไม่พบข้อมูลเจ้าหน้าที่ในระบบ)",
      };
    case "ACCOUNT_SUSPENDED":
      return {
        code: "ACCOUNT_SUSPENDED",
        message: "บัญชีเจ้าหน้าที่นี้ถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ",
      };
    case "ACCOUNT_INACTIVE":
      return {
        code: "ACCOUNT_INACTIVE",
        message: "บัญชีเจ้าหน้าที่นี้ยังไม่ได้เปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ",
      };
    case "RLS_PERMISSION_ERROR":
      return {
        code: "RLS_PERMISSION_ERROR",
        message:
          "ไม่มีสิทธิ์เข้าถึงข้อมูลตามนโยบายความปลอดภัย (RLS Permission Denied)",
      };
    case "DATABASE_CONNECTION_ERROR":
      return {
        code: "DATABASE_CONNECTION_ERROR",
        message:
          "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง",
      };
    case "SESSION_ERROR":
    default:
      return {
        code: "SESSION_ERROR",
        message:
          fallbackMessage ||
          "เซสชันไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง",
      };
  }
}

interface StaffAuthContextType {
  // Legacy fields
  user: User | null;
  profile: StaffProfile | null;
  authLoading: boolean;
  profileLoading: boolean;
  profileResolved: boolean;
  loading: boolean;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null; code?: AuthErrorCode }>;
  signOut: () => Promise<void>;

  // V2 fields
  status: AuthStatus;
  authError: AuthErrorInfo | null;
}

const StaffAuthContext = createContext<StaffAuthContextType | undefined>(
  undefined
);

export let isLoggingOut = false;

export const StaffAuthProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);

  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [sessionLoading, setSessionLoading] = useState<boolean>(true);

  const fetchProfile = async (session: Session) => {
    setProfileLoading(true);
    setStatus((prev) =>
      prev === "authenticated" ? "authenticated" : "loading"
    );

    try {
      const res = await fetch("/api/staff/profile?v=2", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const mappedErr = mapAuthErrorCodeToThaiMessage(
          data?.code ||
            (res.status === 404
              ? "STAFF_NOT_FOUND"
              : res.status === 401
                ? "SESSION_ERROR"
                : res.status >= 500
                  ? "DATABASE_CONNECTION_ERROR"
                  : "ACCOUNT_INACTIVE")
        );
        setAuthError(mappedErr);
        setProfile(null);
        setStatus("forbidden");
        return;
      }

      if (data?.profile) {
        setAuthError(null);
        setProfile((prevProfile) => {
          if (
            prevProfile &&
            JSON.stringify(prevProfile) === JSON.stringify(data.profile)
          ) {
            return prevProfile;
          }
          return data.profile as unknown as StaffProfile;
        });
        setStatus("authenticated");
      } else {
        setAuthError(mapAuthErrorCodeToThaiMessage("STAFF_NOT_FOUND"));
        setProfile(null);
        setStatus("forbidden");
      }
    } catch (err: any) {
      console.error("FETCH PROFILE ERROR:", err);
      setAuthError(mapAuthErrorCodeToThaiMessage("DATABASE_CONNECTION_ERROR"));
      setProfile(null);
      setStatus("forbidden");
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
        setStatus("unauthenticated");
        setSessionLoading(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === "INITIAL_SESSION") {
        initialSessionHandled = true;
        await handleSession(session);
      } else if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        isLoggingOut = false;
        await handleSession(session);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        setAuthError(null);
        setStatus("unauthenticated");
        setSessionLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (!initialSessionHandled) {
        await handleSession(session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error: string | null; code?: AuthErrorCode }> => {
    setIsAuthenticating(true);
    setAuthError(null);
    setStatus("authenticating");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setStatus("unauthenticated");
        const errCode = (error as any).code || "";
        const errMsg = (error.message || "").toLowerCase();

        if (
          errCode === "user_not_found" ||
          errMsg.includes("user not found")
        ) {
          const info = mapAuthErrorCodeToThaiMessage("AUTH_USER_NOT_FOUND");
          setAuthError(info);
          return { error: info.message, code: info.code };
        }

        if (
          errCode === "invalid_credentials" ||
          errMsg.includes("invalid login credentials")
        ) {
          const info = mapAuthErrorCodeToThaiMessage("INVALID_CREDENTIALS");
          setAuthError(info);
          return { error: info.message, code: info.code };
        }

        if (
          errMsg.includes("database") ||
          errMsg.includes("fetch") ||
          errMsg.includes("network")
        ) {
          const info = mapAuthErrorCodeToThaiMessage(
            "DATABASE_CONNECTION_ERROR"
          );
          setAuthError(info);
          return { error: info.message, code: info.code };
        }

        const info = mapAuthErrorCodeToThaiMessage(
          "SESSION_ERROR",
          error.message
        );
        setAuthError(info);
        return { error: info.message, code: info.code };
      }

      if (!data?.session || !data?.user) {
        setStatus("unauthenticated");
        const info = mapAuthErrorCodeToThaiMessage("SESSION_ERROR");
        setAuthError(info);
        return { error: info.message, code: info.code };
      }

      return { error: null };
    } catch (err: any) {
      setStatus("unauthenticated");
      const info = mapAuthErrorCodeToThaiMessage(
        "DATABASE_CONNECTION_ERROR",
        err.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ"
      );
      setAuthError(info);
      return { error: info.message, code: info.code };
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

    setUser(null);
    setProfile(null);
    setAuthError(null);
    setStatus("unauthenticated");

    try {
      router.replace("/backoffice/login");
    } catch (navError) {
      window.location.replace("/backoffice/login");
    }
  };

  // V1 Compatibility Mapping
  const isContextLoading = status === "loading" || status === "authenticating";
  const profileResolved = status === "authenticated" || status === "forbidden";

  return (
    <StaffAuthContext.Provider
      value={{
        user,
        profile,
        authLoading: sessionLoading,
        profileLoading,
        profileResolved,
        loading: isContextLoading,
        signIn,
        signOut,
        status,
        authError,
      }}
    >
      {children}
    </StaffAuthContext.Provider>
  );
};

export const useStaffAuthContext = () => {
  const context = useContext(StaffAuthContext);
  if (context === undefined) {
    throw new Error(
      "useStaffAuthContext must be used within a StaffAuthProvider"
    );
  }
  return context;
};
