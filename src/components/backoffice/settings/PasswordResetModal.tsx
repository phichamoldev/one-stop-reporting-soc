"use client";

import React, { useState, useEffect } from "react";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { fetchWithAuth } from "@/lib/api-client";
import { AppButton } from "@/components/design-system/AppButton";

interface PasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any | null;
}

const inputCls =
  "w-full text-sm font-normal placeholder-slate-400 bg-slate-50 dark:bg-slate-800 border border-[#E5E7EB] dark:border-slate-700 px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none text-slate-800 dark:text-slate-200";

const labelCls = "block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-2";

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        className={inputCls + " pr-10"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={8}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export function PasswordResetModal({ isOpen, onClose, user }: PasswordResetModalProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPassword("");
      setConfirmPassword("");
      setError("");
      setSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) return setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
    if (password !== confirmPassword) return setError("รหัสผ่านไม่ตรงกัน");

    setLoading(true);

    try {
      const res = await fetchWithAuth(`/api/backoffice/settings/users/${user.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");

      setSuccess(true);
      setTimeout(() => onClose(), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box bg-white dark:bg-slate-900 max-w-md p-6 rounded-2xl">
        <h3 className="font-extrabold text-lg mb-5 text-slate-800 dark:text-slate-100">
          รีเซ็ตรหัสผ่าน
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          สำหรับ <span className="font-bold text-slate-700">{user.full_name}</span>
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        {success ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <CheckCircle className="w-12 h-12 text-emerald-500" />
            <p className="text-sm font-bold text-emerald-600">เปลี่ยนรหัสผ่านสำเร็จแล้ว</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>รหัสผ่านใหม่</label>
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="อย่างน้อย 8 ตัวอักษร"
              />
            </div>
            <div>
              <label className={labelCls}>ยืนยันรหัสผ่านใหม่</label>
              <PasswordInput
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="พิมพ์รหัสผ่านอีกครั้ง"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <AppButton type="button" variant="secondary" onClick={onClose} disabled={loading}>
                ยกเลิก
              </AppButton>
              <AppButton type="submit" variant="primary" disabled={loading} isLoading={loading}>
                รีเซ็ตรหัสผ่าน
              </AppButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
