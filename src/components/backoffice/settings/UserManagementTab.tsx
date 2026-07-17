"use client";

import React, { useState, useEffect } from "react";
import { Search, MoreVertical, Users, UserCheck, UserX, Star, ShieldCheck } from "lucide-react";
import { UserFormModal } from "./UserFormModal";
import { PasswordResetModal } from "./PasswordResetModal";
import { fetchWithAuth } from "@/lib/api-client";
import { AppButton } from "@/components/design-system/AppButton";
import { AppSelect } from "@/components/ui/AppSelect";

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  department_id: number | null;
  departments?: { name_th: string };
  last_login: string | null;
  created_at: string;
}

const roleBadge: Record<string, { bg: string; text: string; label: string }> = {
  super_admin: { bg: "bg-violet-100", text: "text-violet-700", label: "Super Admin" },
  admin: { bg: "bg-sky-100", text: "text-sky-700", label: "Admin" },
  manager: { bg: "bg-amber-100", text: "text-amber-700", label: "Manager" },
  staff: { bg: "bg-slate-100", text: "text-slate-600", label: "Staff" },
};

export default function UserManagementTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [departments, setDepartments] = useState<{ id: number; name_th: string }[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth("/api/backoffice/settings/users");
      const data = await res.json();
      if (res.ok && data.users) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetchWithAuth("/api/departments");
      const data = await res.json();
      if (data.departments) {
        setDepartments(data.departments);
      }
    } catch (error) {
      console.error("Failed to fetch departments", error);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
  }, []);

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsUserModalOpen(true);
  };

  const handlePasswordReset = (user: User) => {
    setSelectedUser(user);
    setIsPasswordModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedUser(null);
    setIsUserModalOpen(true);
  };

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = roleFilter === "all" ? true : u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "active").length;
  const disabledUsers = users.filter((u) => u.status === "disabled").length;
  const managersCount = users.filter((u) => u.role === "manager").length;
  const staffCount = users.filter((u) => u.role === "staff").length;

  return (
    <div className="space-y-8">
      {/* KPI Cards — same structure as StaffDashboardView */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">รวมทั้งหมด</p>
            <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{totalUsers}</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">เปิดใช้งาน</p>
            <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{activeUsers}</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
            <UserX className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">ถูกระงับ</p>
            <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{disabledUsers}</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
            <Star className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">Managers</p>
            <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{managersCount}</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">Staff</p>
            <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{staffCount}</h3>
          </div>
        </div>
      </div>

      {/* Main Card — wraps toolbar + table together (same as StaffDashboardView pattern) */}
      <div className="bg-white dark:bg-slate-900 rounded-[20px] p-1 shadow-sm border border-slate-100 dark:border-slate-800">
        {/* Toolbar header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Role filter — AppSelect */}
            <div className="w-[200px]">
              <AppSelect
                value={roleFilter}
                onChange={(val) => setRoleFilter(val as string)}
                options={[
                  { label: "ทุกตำแหน่ง (All Roles)", value: "all" },
                  { label: "Super Admin", value: "super_admin" },
                  { label: "Admin", value: "admin" },
                  { label: "Manager", value: "manager" },
                  { label: "Staff", value: "staff" },
                ]}
              />
            </div>
            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, อีเมล..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-56 pl-9 pr-4 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <AppButton onClick={handleCreate} variant="primary" size="sm">
            + เพิ่มผู้ใช้งานใหม่
          </AppButton>
        </div>

        {/* Table content area */}
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">ชื่อ-สกุล (อีเมล)</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">หน่วยงาน</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">ตำแหน่ง</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">สถานะ</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">ล็อกอินล่าสุด</th>
                <th className="text-right px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto"></div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 font-medium text-sm">
                    ไม่พบข้อมูลผู้ใช้งาน
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const rb = roleBadge[user.role] ?? roleBadge.staff;
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{user.full_name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{user.email}</div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {user.departments?.name_th || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${rb.bg} ${rb.text}`}>
                          {rb.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            user.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-red-50 text-red-600 border-red-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              user.status === "active" ? "bg-emerald-500" : "bg-red-500"
                            }`}
                          />
                          {user.status === "active" ? "เปิดใช้งาน" : "ถูกระงับ"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-400">
                        {user.last_login
                          ? new Date(user.last_login).toLocaleString("th-TH")
                          : "ไม่เคยเข้าสู่ระบบ"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="relative inline-block">
                          <button
                            type="button"
                            onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {openMenuId === user.id && (
                            <>
                              {/* Invisible full-screen backdrop to close menu */}
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setOpenMenuId(null)}
                              />
                              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 z-50 py-1">
                                <button
                                  onClick={() => { handleEdit(user); setOpenMenuId(null); }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                  แก้ไขข้อมูล (Edit)
                                </button>
                                <button
                                  onClick={() => { handlePasswordReset(user); setOpenMenuId(null); }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                  รีเซ็ตรหัสผ่าน (Reset)
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <UserFormModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        user={selectedUser}
        departments={departments}
        onSuccess={fetchUsers}
      />

      <PasswordResetModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        user={selectedUser}
      />
    </div>
  );
}
