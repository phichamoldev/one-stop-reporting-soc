"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { Lock, Mail, ArrowRight, Loader2 } from "lucide-react";

export default function BackofficeLogin() {
  const router = useRouter();
  const { user, loading, signIn } = useStaffAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/backoffice");
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    const { error } = await signIn(email, password);
    
    if (error) {
      setErrorMsg(error);
      setIsSubmitting(false);
    } else {
      // router.replace will be handled by useEffect when user state updates
    }
  };

  if (loading || user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#D1350F]" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-[400px] bg-white rounded-[16px] shadow-sm border border-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="p-8 text-center border-b border-slate-50">
          <div className="w-16 h-16 mx-auto bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
            <Image
              src="/images/ku-logo.png"
              alt="KU Logo"
              width={40}
              height={40}
              className="object-contain w-auto h-auto"
              priority
            />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Back Office</h1>
          <p className="text-sm text-slate-500 mt-1">
            เข้าสู่ระบบสำหรับเจ้าหน้าที่
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 pt-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl font-medium border border-red-100 flex items-start gap-2">
              <span className="shrink-0 mt-0.5">⚠️</span>
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">อีเมล</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#D1350F] focus:ring-1 focus:ring-[#D1350F] transition-colors"
                  placeholder="admin@soc.ku.ac.th"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">รหัสผ่าน</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#D1350F] focus:ring-1 focus:ring-[#D1350F] transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 mt-2 bg-[#D1350F] hover:bg-[#b02c0c] text-white rounded-xl font-medium text-[14px] flex items-center justify-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                เข้าสู่ระบบ
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

      </div>
    </main>
  );
}
