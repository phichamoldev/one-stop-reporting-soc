"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { hasAccess } from "@/lib/auth-helpers";
import { Loader2 } from "lucide-react";

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading } = useStaffAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (pathname === '/backoffice/login') {
      if (user) {
        router.replace('/backoffice');
        router.refresh();
      } else {
        setAuthorized(true);
      }
      return;
    }

    if (!user || !profile) {
      router.replace("/backoffice/login");
      router.refresh();
      return;
    }

    if (!hasAccess(profile.role, pathname)) {
      if (pathname.startsWith("/backoffice/settings")) {
        router.replace("/backoffice/unauthorized");
      } else {
        router.replace("/backoffice/reports");
      }
      router.refresh();
      return;
    }

    setAuthorized(true);
  }, [user, profile, loading, pathname, router]);

  if (loading || !authorized) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
};
