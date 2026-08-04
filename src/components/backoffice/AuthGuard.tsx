"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { hasAccess } from "@/lib/auth-helpers";
import { Loader2 } from "lucide-react";

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, profile } = useStaffAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      const returnUrl = encodeURIComponent(pathname);
      router.replace(`/backoffice/login?next=${returnUrl}`);
      return;
    }

    if (status === 'forbidden') {
      router.replace("/backoffice/unauthorized");
      return;
    }

    if (status === 'authenticated') {
      if (profile && !hasAccess(profile.role, pathname)) {
        if (pathname.startsWith("/backoffice/settings")) {
          router.replace("/backoffice/unauthorized");
        } else {
          router.replace("/backoffice/reports");
        }
      }
    }
  }, [status, pathname, profile, router]);

  // While transitioning or loading, display spinner to avoid flashes of unauthorized content
  if (
    status === 'loading' || 
    status === 'unauthenticated' || 
    status === 'forbidden' ||
    (status === 'authenticated' && profile && !hasAccess(profile.role, pathname))
  ) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
};
