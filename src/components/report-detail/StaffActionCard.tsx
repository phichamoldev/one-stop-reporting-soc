"use client";

import React, { useRef, useState, useEffect } from "react";
import { Report } from "@/types/report";
import { ImageIcon, Lock, Check, ChevronDown, FileText, Maximize2, Trash2, RefreshCw } from "lucide-react";
import { DetailCard, formatThaiDateTime, getLatestStaffActionData } from "./ReportDetailBlocks";

export interface StatusMeta {
  label: string;
  dotClass: string;
  badgeClass: string;
}

export const STATUS_META_MAP: Record<string, StatusMeta> = {
  pending: {
    label: "รอรับเรื่อง",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  received: {
    label: "รับเรื่องแล้ว",
    dotClass: "bg-blue-500",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
  },
  in_progress: {
    label: "กำลังดำเนินการ",
    dotClass: "bg-[#C2410C]",
    badgeClass: "bg-orange-50 text-[#C2410C] border-orange-200",
  },
  completed: {
    label: "เสร็จสิ้น",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  rejected: {
    label: "ปฏิเสธคำร้อง",
    dotClass: "bg-rose-500",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
  },
  cancelled: {
    label: "ยกเลิกคำร้อง",
    dotClass: "bg-slate-400",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
  },
  transfer: {
    label: "โอนคำร้องไปยังหน่วยงานอื่น",
    dotClass: "bg-purple-500",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
  },
};

const ORDERED_STATUSES = ["pending", "received", "in_progress", "completed", "rejected", "cancelled", "transfer"];

interface StatusSelectDropdownProps {
  currentReportStatus: string;
  selectedStatus: string;
  onChange: (status: string) => void;
  disabled?: boolean;
  allowTransfer?: boolean;
}

export function StatusSelectDropdown({
  currentReportStatus,
  selectedStatus,
  onChange,
  disabled = false,
  allowTransfer = false,
}: StatusSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentMeta = STATUS_META_MAP[currentReportStatus] || STATUS_META_MAP.pending;
  const isPreservingCurrent = selectedStatus === currentReportStatus;
  const activeMeta = STATUS_META_MAP[selectedStatus] || currentMeta;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        id="staff-status-dropdown-btn"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full border rounded-xl px-3.5 py-2.5 bg-white text-left flex items-center justify-between gap-3 focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20 transition-all cursor-pointer shadow-sm ${
          isOpen ? "border-[#C2410C] ring-2 ring-[#C2410C]/15" : "border-slate-200 hover:border-slate-300"
        } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${activeMeta.dotClass}`} />
          <div className="min-w-0 flex items-center gap-2">
            <span className="text-[13px] font-bold text-slate-800 truncate">
              {isPreservingCurrent
                ? `คงสถานะเดิม (${currentMeta.label})`
                : `เปลี่ยนเป็น: ${activeMeta.label}`}
            </span>
            {isPreservingCurrent ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0 border border-slate-200">
                สถานะปัจจุบัน
              </span>
            ) : (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${activeMeta.badgeClass}`}>
                สถานะใหม่
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 z-50 animate-scale-up space-y-1">
          {/* Option 1: Keep Current Status */}
          <button
            type="button"
            onClick={() => {
              onChange(currentReportStatus);
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
              isPreservingCurrent
                ? "bg-orange-50/70 text-[#C2410C] font-bold"
                : "hover:bg-slate-50 text-slate-700"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${currentMeta.dotClass}`} />
              <div className="min-w-0">
                <span className="text-[13px] font-bold block leading-tight">
                  คงสถานะเดิม ({currentMeta.label})
                </span>
                <span className="text-[11px] text-slate-400 font-normal block mt-0.5">
                  บันทึกเฉพาะข้อความตอบกลับ โดยไม่เปลี่ยนแปลงสถานะ
                </span>
              </div>
            </div>
            {isPreservingCurrent && (
              <Check className="w-4 h-4 text-[#C2410C] shrink-0" strokeWidth={2.5} />
            )}
          </button>

          <div className="border-t border-slate-100 my-1 pt-1 px-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              เลือกสถานะใหม่
            </span>
          </div>

          {/* Other Target Statuses */}
          <div className="max-h-60 overflow-y-auto space-y-0.5 pr-0.5">
            {ORDERED_STATUSES.filter((s) => allowTransfer || s !== "transfer").map((s) => {
              const meta = STATUS_META_MAP[s];
              if (!meta) return null;
              const isCurrent = s === currentReportStatus;
              const isSelected = selectedStatus === s && !isPreservingCurrent;

              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    onChange(s);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-orange-50/90 font-bold text-[#C2410C]"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dotClass}`} />
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="text-[13px] font-medium leading-tight">{meta.label}</span>
                      {isCurrent && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                          ปัจจุบัน
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-[#C2410C] shrink-0" strokeWidth={2.5} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export interface StaffActionCardProps {
  report: Report;
  isStaffActive: boolean;
  authLoading: boolean;
  canManage: boolean;
  userRole?: string;
  updateStatus: string;
  setUpdateStatus: (status: string) => void;
  updateRemark: string;
  setUpdateRemark: (remark: string) => void;
  completionImage: File | null;
  setCompletionImage: (file: File | null) => void;
  completionImagePreview: string | null;
  setCompletionImagePreview: (url: string | null) => void;
  isImageRemoved?: boolean;
  setIsImageRemoved?: (removed: boolean) => void;
  departments: { id: number; name_th: string }[];
  updateDepartmentId: number | "";
  setUpdateDepartmentId: (id: number | "") => void;
  isSaving: boolean;
  saveMessage: { type: "success" | "error"; text: string } | null;
  onSave: () => Promise<void>;
  onCancel: () => void;
  onStartEdit?: () => void;
  onImageClick?: (url: string) => void;
  loginEmail: string;
  setLoginEmail: (email: string) => void;
  loginPassword: string;
  setLoginPassword: (password: string) => void;
  loginError: string | null;
  isLoggingIn: boolean;
  onLogin: () => Promise<void>;
  isEditMode: boolean;
}

export function StaffActionCard({
  report,
  isStaffActive,
  authLoading,
  canManage,
  userRole,
  updateStatus,
  setUpdateStatus,
  updateRemark,
  setUpdateRemark,
  setCompletionImage,
  completionImagePreview,
  setCompletionImagePreview,
  setIsImageRemoved,
  departments,
  updateDepartmentId,
  setUpdateDepartmentId,
  isSaving,
  saveMessage,
  onSave,
  onCancel,
  onStartEdit,
  onImageClick,
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword,
  loginError,
  isLoggingIn,
  onLogin,
  isEditMode,
}: StaffActionCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const staffData = getLatestStaffActionData(report);
  const currentStatusMeta = STATUS_META_MAP[report.status] || STATUS_META_MAP.pending;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        alert("รูปภาพมีขนาดใหญ่เกินไป (สูงสุด 5MB)");
        return;
      }
      setCompletionImage(file);
      setCompletionImagePreview(URL.createObjectURL(file));
      setIsImageRemoved?.(false);
    }
  };

  const removeImage = () => {
    setCompletionImage(null);
    setCompletionImagePreview(null);
    setIsImageRemoved?.(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <DetailCard
      title="การดำเนินการ"
      accent="blue"
      right={
        isStaffActive && canManage ? (
          isEditMode ? (
            <span className="text-[12px] font-semibold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
              กำลังแก้ไข
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 text-[12px] font-bold px-2.5 py-0.5 rounded-full border ${currentStatusMeta.badgeClass}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${currentStatusMeta.dotClass}`} />
              {currentStatusMeta.label}
            </span>
          )
        ) : null
      }
    >
      {authLoading ? (
        <div className="py-8 flex flex-col items-center justify-center space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <p className="text-xs text-slate-400">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      ) : !isStaffActive ? (
        /* Not logged in: inline login box */
        <div className="space-y-4 py-2">
          <div className="text-center pb-2">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mx-auto mb-2">
              <Lock className="w-5 h-5" />
            </div>
            <h4 className="text-[14px] font-bold text-slate-800">เข้าสู่ระบบสำหรับเจ้าหน้าที่</h4>
            <p className="text-[12px] text-slate-500 mt-0.5">กรุณาเข้าสู่ระบบเพื่อบันทึกการดำเนินการหรือเปลี่ยนสถานะ</p>
          </div>

          {loginError && (
            <div className="p-3 bg-red-50 text-red-600 text-xs font-medium rounded-xl border border-red-100">
              {loginError}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">อีเมลเจ้าหน้าที่</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="อีเมล (@ku.th)"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#C2410C]/20"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">รหัสผ่าน</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="รหัสผ่าน"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#C2410C]/20"
                onKeyDown={(e) => e.key === "Enter" && onLogin()}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onLogin}
            disabled={isLoggingIn}
            className="w-full py-2.5 rounded-xl bg-[#C2410C] hover:bg-[#9A3412] text-white font-bold text-sm shadow-sm transition-colors cursor-pointer"
          >
            {isLoggingIn ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบเพื่อดำเนินการ"}
          </button>
        </div>
      ) : !canManage ? (
        /* Logged in but unauthorized */
        <div className="text-center py-6 space-y-3">
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 mx-auto">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-[14px] font-bold text-slate-800">ไม่มีสิทธิ์จัดการคำร้องนี้</h4>
            <p className="text-[12px] text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
              คำร้องนี้สังกัดหน่วยงาน &quot;{report.categories?.name_th || "ไม่ระบุ"}&quot; ซึ่งอยู่นอกเหนือสิทธิ์การเข้าถึงของบัญชีท่าน
            </p>
          </div>
        </div>
      ) : !isEditMode ? (
        /* === VIEWING STATE (แสดงข้อมูลการดำเนินการที่บันทึกไว้ล่าสุด) === */
        <div className="space-y-4">
          {saveMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-medium border ${
                saveMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {saveMessage.text}
            </div>
          )}

          {/* 1. หมายเหตุสรุปผล / ข้อความตอบกลับล่าสุด */}
          <div>
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              หมายเหตุสรุปผล / ข้อความตอบกลับ
            </span>
            {staffData.latestRemark.trim() ? (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-[14px] text-slate-800 whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-[1.8]">
                {staffData.latestRemark}
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-dashed border-slate-200 text-xs text-slate-400 italic">
                ยังไม่มีข้อความหมายเหตุสรุปผล
              </div>
            )}

            {/* ข้อความกำกับขนาดเล็กใต้ข้อความ เมื่อมีการอัปเดตหมายเหตุหรือรูปภาพเพิ่มเติม (Requirement 9.2) */}
            {staffData.updateCaption && (
              <p className="text-[11px] text-slate-400 font-medium mt-1.5">
                {staffData.updateCaption}
              </p>
            )}
          </div>

          {/* 2. ภาพประกอบการทำงาน (หากเคยแนบไว้) */}
          {staffData.currentActionImage && (
            <div>
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                ภาพประกอบการทำงาน
              </span>
              <div
                onClick={() => onImageClick?.(staffData.currentActionImage as string)}
                className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50 max-h-56 flex items-center justify-center cursor-pointer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={staffData.currentActionImage}
                  alt="ภาพประกอบการทำงาน"
                  className="w-full h-auto max-h-56 object-contain"
                />
                <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="inline-flex items-center gap-1.5 bg-black/75 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
                    <Maximize2 className="w-3.5 h-3.5" />
                    ขยายภาพขนาดเต็ม
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 3. ข้อมูลผู้ดำเนินการและเวลาสถานะ */}
          <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
            <div className="flex items-start justify-between gap-2">
              <span className="text-slate-400 font-medium">ดำเนินการโดย</span>
              <div className="text-right">
                <span className="font-bold text-slate-700 block leading-tight">{staffData.actorName}</span>
                {staffData.actorPosition && (
                  <span className="text-[11px] text-slate-400 font-normal block mt-0.5 leading-snug">
                    {staffData.actorPosition}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400 font-medium">เวลาสถานะล่าสุด</span>
              <span className="font-semibold text-slate-600">{formatThaiDateTime(staffData.statusUpdatedAt)}</span>
            </div>
          </div>

          {/* 4. ปุ่มแก้ไขเพื่อเข้าสู่ Edit State */}
          <button
            type="button"
            onClick={onStartEdit}
            className="w-full py-2.5 px-4 rounded-xl bg-[#FFF1E8] hover:bg-[#C2410C] text-[#B4360A] hover:text-white border border-[#F5C4A8] hover:border-[#C2410C] font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <FileText className="w-4 h-4" />
            <span>แก้ไขข้อมูลการดำเนินการ</span>
          </button>
        </div>
      ) : (
        /* === EDIT STATE (ฟอร์มแก้ไขและบันทึกข้อมูลแบบ Partial Update) === */
        <div className="space-y-4">
          {saveMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-medium border ${
                saveMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {saveMessage.text}
            </div>
          )}

          {/* 1. Modern Status Selector Dropdown */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                สถานะคำร้อง
              </label>
              <span className="text-[11px] text-slate-400 font-medium">ไม่บังคับเปลี่ยนสถานะ</span>
            </div>
            <StatusSelectDropdown
              currentReportStatus={report.status}
              selectedStatus={updateStatus}
              onChange={(newStatus) => {
                setUpdateStatus(newStatus);
              }}
              disabled={isSaving}
              allowTransfer={userRole !== "staff"}
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              เลือกสถานะใหม่ หรือคงสถานะเดิมเพื่อบันทึกเฉพาะข้อความตอบกลับ/รูปภาพ
            </p>
          </div>

          {/* Transfer destination (if transfer) */}
          {updateStatus === "transfer" && (
            <div className="animate-fade-in">
              <label htmlFor="staff-transfer-dept" className="block text-xs font-semibold text-slate-700 mb-1">
                โอนคำร้องไปยังหน่วยงานปลายทาง
              </label>
              <div className="relative">
                <select
                  id="staff-transfer-dept"
                  value={updateDepartmentId}
                  onChange={(e) => setUpdateDepartmentId(e.target.value ? Number(e.target.value) : "")}
                  disabled={isSaving}
                  className="w-full appearance-none border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#C2410C]/20 transition-all cursor-pointer pr-10"
                >
                  <option value="">เลือกหน่วยงานปลายทาง...</option>
                  {departments
                    .filter((d) => d.id !== report.categories?.department_id)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name_th}
                      </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>
          )}

          {/* 2. ภาพประกอบการทำงาน (ไม่บังคับ) */}
          <div className="animate-fade-in">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              ภาพประกอบการทำงาน (ไม่บังคับ)
            </label>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
              disabled={isSaving}
            />

            {!completionImagePreview ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving}
                className="w-full border border-dashed border-slate-300 rounded-xl py-6 px-4 flex flex-col items-center justify-center gap-1.5 hover:bg-slate-50 transition-colors cursor-pointer group"
              >
                <ImageIcon className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                <span className="text-xs font-bold text-slate-700">คลิกเพื่ออัปโหลดรูปภาพ</span>
                <span className="text-[11px] text-slate-400">รองรับ JPG, PNG สูงสุด 5MB</span>
              </button>
            ) : (
              <div className="space-y-2">
                <div
                  onClick={() => onImageClick?.(completionImagePreview)}
                  className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50 max-h-56 flex items-center justify-center cursor-pointer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={completionImagePreview} alt="Preview" className="w-full h-auto max-h-56 object-contain" />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="inline-flex items-center gap-1 bg-black/75 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                      <Maximize2 className="w-3 h-3" /> ขยายภาพ
                    </span>
                  </div>
                </div>

                {!isSaving && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>เปลี่ยนรูปภาพ</span>
                    </button>
                    <button
                      type="button"
                      onClick={removeImage}
                      className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ลบรูปภาพ</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. หมายเหตุสรุปผล / ข้อความตอบกลับ */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="staff-remark-text" className="block text-xs font-semibold text-slate-700">
                หมายเหตุสรุปผล / ข้อความตอบกลับ
              </label>
              <span className="text-[11px] text-slate-400 font-medium">รองรับหลายย่อหน้า</span>
            </div>
            <textarea
              id="staff-remark-text"
              rows={8}
              value={updateRemark}
              onChange={(e) => setUpdateRemark(e.target.value)}
              disabled={isSaving}
              placeholder="พิมพ์ข้อความตอบกลับหรือหมายเหตุสรุปผล รองรับหลายย่อหน้า"
              className="w-full border border-slate-200 rounded-2xl p-4 text-[14px] leading-[1.8] bg-white font-normal text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#C2410C]/20 focus:border-[#C2410C] min-h-[220px] resize-y transition-all"
            />
          </div>

          {/* 4. Action buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors cursor-pointer text-center disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-[#C2410C] hover:bg-[#9A3412] text-white font-bold text-sm shadow-sm transition-colors cursor-pointer text-center disabled:opacity-50"
            >
              {isSaving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </button>
          </div>
        </div>
      )}
    </DetailCard>
  );
}
