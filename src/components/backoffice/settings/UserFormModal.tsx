"use client";

import React, { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { fetchWithAuth } from "@/lib/api-client";
import { AppButton } from "@/components/design-system/AppButton";
import { AppSelect } from "@/components/ui/AppSelect";

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any | null;
  departments: { id: number; name_th: string }[];
  onSuccess: () => void;
}

const inputCls =
  "w-full text-sm font-normal placeholder-slate-400 bg-slate-50 dark:bg-slate-800 border border-[#E5E7EB] dark:border-slate-700 px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none text-slate-800 dark:text-slate-200";

const labelCls = "block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-2";

function PasswordInput({
  value,
  onChange,
  placeholder,
  required,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  required?: boolean;
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
        required={required}
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

export function UserFormModal({ isOpen, onClose, user, departments, onSuccess }: UserFormModalProps) {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    full_name: "",
    department_id: "",
    role: "staff",
    status: "active",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEdit = !!user;

  useEffect(() => {
    if (isOpen) {
      if (user) {
        setFormData({
          email: user.email || "",
          password: "",
          confirmPassword: "",
          full_name: user.full_name || "",
          department_id: user.department_id ? String(user.department_id) : "",
          role: user.role || "staff",
          status: user.status || "active",
        });
      } else {
        setFormData({
          email: "",
          password: "",
          confirmPassword: "",
          full_name: "",
          department_id: "",
          role: "staff",
          status: "active",
        });
      }
      setError("");
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isEdit) {
      if (!formData.email) return setError("กรุณากรอกอีเมล");
      if (formData.password.length < 8) return setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      if (formData.password !== formData.confirmPassword) return setError("รหัสผ่านไม่ตรงกัน");
    }
    if (!formData.full_name) return setError("กรุณากรอกชื่อ-สกุล");

    setLoading(true);

    try {
      const payload: any = {
        full_name: formData.full_name,
        role: formData.role,
        status: formData.status,
        department_id: formData.department_id ? parseInt(formData.department_id) : null,
      };

      let res;
      if (isEdit) {
        res = await fetchWithAuth(`/api/backoffice/settings/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        payload.email = formData.email;
        payload.password = formData.password;
        res = await fetchWithAuth("/api/backoffice/settings/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deptOptions = [
    { label: "— ไม่ระบุ —", value: "" },
    ...departments.map((d) => ({ label: d.name_th, value: String(d.id) })),
  ];

  return (
    <div className="modal modal-open">
      <div className="modal-box !overflow-visible bg-white dark:bg-slate-900 max-w-2xl p-6 rounded-2xl">
        <h3 className="font-extrabold text-lg mb-5 text-slate-800 dark:text-slate-100">
          {isEdit ? "แก้ไขข้อมูลผู้ใช้งาน" : "เพิ่มผู้ใช้งานใหม่"}
        </h3>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Account Info */}
          {!isEdit && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                ข้อมูลการเข้าสู่ระบบ (Account Information)
              </h4>
              <div>
                <label className={labelCls}>อีเมล (Email)</label>
                <input
                  type="email"
                  className={inputCls}
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>รหัสผ่าน (Password)</label>
                  <PasswordInput
                    value={formData.password}
                    onChange={(val) => setFormData({ ...formData, password: val })}
                    placeholder="อย่างน้อย 8 ตัวอักษร"
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>ยืนยันรหัสผ่าน</label>
                  <PasswordInput
                    value={formData.confirmPassword}
                    onChange={(val) => setFormData({ ...formData, confirmPassword: val })}
                    placeholder="พิมพ์รหัสผ่านอีกครั้ง"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* User Info */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              ข้อมูลผู้ใช้งาน (User Information)
            </h4>
            <div>
              <label className={labelCls}>ชื่อ - นามสกุล</label>
              <input
                type="text"
                className={inputCls}
                placeholder="กรอกชื่อ-นามสกุล"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>สิทธิ์ (Role)</label>
                <AppSelect
                  value={formData.role}
                  onChange={(val) => setFormData({ ...formData, role: val as string })}
                  options={[
                    { label: "Staff", value: "staff" },
                    { label: "Manager", value: "manager" },
                    { label: "Admin", value: "admin" },
                    { label: "Super Admin", value: "super_admin" },
                  ]}
                />
              </div>
              <div>
                <label className={labelCls}>หน่วยงาน (ถ้ามี)</label>
                <AppSelect
                  value={formData.department_id}
                  onChange={(val) => setFormData({ ...formData, department_id: val as string })}
                  options={deptOptions}
                  placeholder="— ไม่ระบุ —"
                />
              </div>
            </div>
          </div>

          {/* Status — edit only */}
          {isEdit && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                สถานะบัญชี (Account Status)
              </h4>
              <div>
                <label className={labelCls}>สถานะการใช้งาน</label>
                <AppSelect
                  value={formData.status}
                  onChange={(val) => setFormData({ ...formData, status: val as string })}
                  options={[
                    { label: "เปิดใช้งาน (Active)", value: "active" },
                    { label: "ระงับการใช้งาน (Disabled)", value: "disabled" },
                  ]}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <AppButton type="button" variant="secondary" onClick={onClose} disabled={loading}>
              ยกเลิก
            </AppButton>
            <AppButton type="submit" variant="primary" disabled={loading} isLoading={loading}>
              บันทึกข้อมูล
            </AppButton>
          </div>
        </form>
      </div>
    </div>
  );
}
