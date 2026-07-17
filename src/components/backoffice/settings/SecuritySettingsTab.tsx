"use client";

import React, { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/api-client";
import { AppButton } from "@/components/design-system/AppButton";

export default function SecuritySettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [settings, setSettings] = useState({
    minPasswordLength: 8,
    sessionTimeout: 60,
    maxLoginAttempts: 5
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetchWithAuth("/api/backoffice/settings/system");
        const data = await res.json();
        if (res.ok && data.settings?.security_config) {
          setSettings(data.settings.security_config);
        }
      } catch (err) {
        console.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const res = await fetchWithAuth("/api/backoffice/settings/system", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "security_config",
          value: settings
        })
      });

      if (!res.ok) throw new Error("Failed to save settings");
      setMessage("บันทึกการตั้งค่าความปลอดภัยเรียบร้อยแล้ว");
      setTimeout(() => setMessage(""), 3000);
    } catch (err: any) {
      setMessage(err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center"><span className="loading loading-spinner text-primary"></span></div>;
  }

  return (
    <div className="max-w-2xl mx-auto py-4">
      <h2 className="text-xl font-bold mb-6 text-gray-800">ตั้งค่าความปลอดภัย (Security Settings)</h2>
      
      {message && (
        <div className={`alert ${message.includes("เรียบร้อย") ? "alert-success text-white" : "alert-error"} mb-6`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="form-control">
          <label className="block text-[12px] font-medium text-slate-700 mb-2">ความยาวรหัสผ่านขั้นต่ำ (ตัวอักษร)</label>
          <input 
            type="number" 
            min="6"
            className="w-full text-[12px] font-normal placeholder-slate-400 bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none" 
            value={settings.minPasswordLength}
            onChange={e => setSettings({...settings, minPasswordLength: parseInt(e.target.value)})}
          />
        </div>

        <div className="form-control">
          <label className="block text-[12px] font-medium text-slate-700 mb-2">หมดอายุเมื่อไม่มีการใช้งาน (Session Timeout - นาที)</label>
          <input 
            type="number" 
            min="5"
            className="w-full text-[12px] font-normal placeholder-slate-400 bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none" 
            value={settings.sessionTimeout}
            onChange={e => setSettings({...settings, sessionTimeout: parseInt(e.target.value)})}
          />
        </div>

        <div className="form-control">
          <label className="block text-[12px] font-medium text-slate-700 mb-2">จำกัดการล็อกอินผิดพลาด (Maximum Login Attempts)</label>
          <input 
            type="number"
            min="3" 
            className="w-full text-[12px] font-normal placeholder-slate-400 bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none" 
            value={settings.maxLoginAttempts}
            onChange={e => setSettings({...settings, maxLoginAttempts: parseInt(e.target.value)})}
          />
        </div>

        <div className="pt-4 border-t border-gray-100 flex justify-end">
          <AppButton type="submit" variant="primary" disabled={saving}>บันทึกการตั้งค่า</AppButton>
        </div>
      </form>
    </div>
  );
}
