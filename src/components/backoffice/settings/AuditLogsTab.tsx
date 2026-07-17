"use client";

import React, { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/api-client";

interface AuditLog {
  id: string;
  action: string;
  target: string;
  details: any;
  created_at: string;
  staff_users: {
    full_name: string;
    role: string;
  };
}

export default function AuditLogsTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetchWithAuth("/api/backoffice/settings/audit-logs");
        const data = await res.json();
        if (res.ok && data.logs) {
          setLogs(data.logs);
        }
      } catch (err) {
        console.error("Failed to fetch audit logs");
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6 py-2">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">ประวัติการใช้งาน (Audit Logs)</h2>
        <span className="text-sm text-gray-500">แสดง 50 รายการล่าสุด (Read Only)</span>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="table w-full">
          <thead>
            <tr className="bg-gray-50 text-gray-700">
              <th>วัน-เวลา (Date)</th>
              <th>ผู้ดำเนินการ (User)</th>
              <th>การกระทำ (Action)</th>
              <th>เป้าหมาย (Target)</th>
              <th>รายละเอียด (Details)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-8">
                  <span className="loading loading-spinner loading-md text-primary"></span>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-500">ไม่พบประวัติการใช้งาน</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 text-sm">
                  <td className="whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('th-TH')}
                  </td>
                  <td>
                    <div className="font-medium">{log.staff_users?.full_name || "Unknown"}</div>
                    <div className="text-xs text-gray-500">{log.staff_users?.role || "-"}</div>
                  </td>
                  <td>
                    <span className="badge badge-ghost badge-sm">{log.action}</span>
                  </td>
                  <td className="text-gray-600 truncate max-w-[200px]" title={log.target}>
                    {log.target || "-"}
                  </td>
                  <td>
                    <pre className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded overflow-auto max-w-[300px] max-h-20">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
