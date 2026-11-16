"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, LogOut, Home, ArrowLeft } from "lucide-react";
import { useStaffAuth } from "@/hooks/useStaffAuth";

export default function UnauthorizedPage() {
  const { user, profile, signOut, authError } = useStaffAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100 text-center">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
          ไม่มีสิทธิ์เข้าถึงระบบ
        </h1>

        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          {authError?.message ||
            "บัญชีของคุณไม่ได้รับอนุญาตให้เข้าใช้งานส่วนงานนี้ กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์"}
        </p>

        {authError?.code && (
          <div className="inline-block px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-semibold mb-4 border border-rose-100">
            รหัสสถานะ: {authError.code}
          </div>
        )}

        {user && (
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 text-left">
            <div className="text-xs text-slate-400 font-medium">บัญชีที่ลงชื่อเข้าใช้:</div>
            <div className="text-sm font-semibold text-slate-700 truncate mt-0.5">{user.email}</div>
            {profile && (
              <div className="text-xs text-slate-500 mt-1">
                สถานะ: <span className="font-medium text-amber-600">{profile.role}</span>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/95 transition-all shadow-lg shadow-primary/25 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            ออกจากระบบ / เข้าสู่ระบบด้วยบัญชีอื่น
          </button>

          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
          >
            <Home className="w-4 h-4" />
            กลับสู่หน้าหลักสำหรับประชาชน
          </Link>
        </div>
      </div>
    </div>
  );
}

