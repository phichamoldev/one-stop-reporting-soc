"use client";

import React, { useState } from "react";
import { AlertTriangle, Play, RefreshCw, CheckCircle2, XCircle, Clock, Globe, ShieldCheck, MessageSquare } from "lucide-react";

interface BaselineMessageResult {
  index: number;
  mockId: string;
  timeline: string;
  language: string;
  description: string;
  location: string;
  reporter: string;
  sentAt: string;
  status: "Sent" | "Failed";
  error?: string;
}

interface BaselineSummary {
  testRunId: string;
  targetDepartment: string;
  targetDepartmentCode: string;
  scenario: string;
  totalGenerated: number;
  totalSent: number;
  totalFailed: number;
  timeline: Record<string, number>;
  languages: {
    Thai: number;
    English: number;
    "Thai + English": number;
  };
  actualLineMessagesReceived: number;
  completedAt: string;
  messages: BaselineMessageResult[];
}

export function BaselineNotificationTestTab() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalCount] = useState(20);
  const [currentStepMessage, setCurrentStepMessage] = useState<string>("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [summary, setSummary] = useState<BaselineSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStartTest = async () => {
    setShowConfirmModal(false);
    setIsRunning(true);
    setProgress(0);
    setSummary(null);
    setErrorMessage(null);
    setCurrentStepMessage("กำลังเตรียมพร้อมและตรวจสอบ Safety Guard กับฐานข้อมูล...");

    try {
      // Simulate frontend progress ticks while API executes
      const progressTimer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 19) {
            clearInterval(progressTimer);
            return 19;
          }
          return prev + 1;
        });
      }, 500);

      const res = await fetch("/api/test/baseline-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intervalMs: 350 })
      });

      clearInterval(progressTimer);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}: Failed to execute baseline test.`);
      }

      const resData = await res.json();
      if (resData.success && resData.data) {
        setProgress(20);
        setSummary(resData.data);
        setCurrentStepMessage("การทดสอบเสร็จสมบูรณ์ 20/20 รายการ");
      } else {
        throw new Error(resData.error || "Execution failed without details.");
      }
    } catch (err: any) {
      console.error("Baseline test error:", err);
      setErrorMessage(err.message || "An unexpected error occurred during test.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-xs font-semibold border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-3.5 h-3.5" />
              BASELINE TEST (AS-IS) — ระบบเดิมเท่านั้น
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Existing System LINE Notification Baseline Test
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              ทดสอบพฤติกรรมของระบบปัจจุบันตามสภาพจริง เมื่อมีผู้แจ้งเรื่องปัญหาเดียวกันเข้ามา 20 ครั้ง ใน 9 ช่วงเวลา (T+0 ถึง T+3h) เพื่อสังเกตการณ์ปริมาณข้อความแจ้งเตือนที่ถูกส่งเข้ากลุ่ม LINE
            </p>
          </div>

          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={isRunning}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold shadow-lg shadow-amber-600/20 transition-all cursor-pointer whitespace-nowrap"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                กำลังทดสอบ ({progress}/20)...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                🚨 Start Baseline Test (20 Msgs)
              </>
            )}
          </button>
        </div>

        {/* Safety & Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <span className="font-semibold block text-slate-800 dark:text-slate-200 mb-1">🎯 LINE Target:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">SOC TEST (soc-test)</span>
            <span className="block text-[11px] text-slate-400 mt-0.5">ดึงจาก DB อัตโนมัติ</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <span className="font-semibold block text-slate-800 dark:text-slate-200 mb-1">📋 Test Scenario:</span>
            <span>ปัญหาเดียวกัน / หลากภาษา</span>
            <span className="block text-[11px] text-slate-400 mt-0.5">แอร์ห้อง 301 ตึก 14</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <span className="font-semibold block text-slate-800 dark:text-slate-200 mb-1">⏱️ Timeline ช่วงเวลา:</span>
            <span>T+0 ถึง T+3 ชั่วโมง</span>
            <span className="block text-[11px] text-slate-400 mt-0.5">รวม 9 จุดเวลา (20 รายการ)</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <span className="font-semibold block text-slate-800 dark:text-slate-200 mb-1">🔒 Database Safety:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">100% Mock Data</span>
            <span className="block text-[11px] text-slate-400 mt-0.5">ไม่มีการแตะตาราง reports</span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm flex items-start gap-3">
          <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">เกิดข้อผิดพลาดในการทดสอบ</div>
            <div>{errorMessage}</div>
          </div>
        </div>
      )}

      {/* Progress Bar (when running or completed) */}
      {(isRunning || progress > 0) && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between text-sm font-bold text-slate-800 dark:text-slate-200">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              สถานะการส่งข้อความจำลองเข้า LINE
            </div>
            <span>{progress} / {totalCount} ข้อความ</span>
          </div>

          <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
            <div
              className="bg-amber-500 h-full transition-all duration-300 rounded-full"
              style={{ width: `${(progress / totalCount) * 100}%` }}
            />
          </div>

          {currentStepMessage && (
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {currentStepMessage}
            </div>
          )}
        </div>
      )}

      {/* Summary Results Card */}
      {summary && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-lg">
              <CheckCircle2 className="w-5 h-5" />
              BASELINE TEST RESULT (ผลการทดสอบระบบเดิม)
            </div>
            <div className="text-xs text-slate-400 font-mono mt-1">
              Test Run ID: {summary.testRunId} | Target: {summary.targetDepartment} ({summary.targetDepartmentCode})
            </div>
          </div>

          {/* Key Metrics Counter */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <span className="text-xs text-slate-500 block">Total Generated</span>
              <span className="text-2xl font-black text-slate-800 dark:text-white">{summary.totalGenerated}</span>
              <span className="text-[11px] text-slate-400 block">Mock Reports</span>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <span className="text-xs text-emerald-700 dark:text-emerald-400 block">Total Sent</span>
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{summary.totalSent}</span>
              <span className="text-[11px] text-emerald-600/80 block">ส่งผ่าน LINE API สำเร็จ</span>
            </div>

            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <span className="text-xs text-red-700 dark:text-red-400 block">Total Failed</span>
              <span className="text-2xl font-black text-red-700 dark:text-red-400">{summary.totalFailed}</span>
              <span className="text-[11px] text-red-600/80 block">ข้อความที่ส่งไม่สำเร็จ</span>
            </div>

            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
              <span className="text-xs text-rose-700 dark:text-rose-400 block font-bold">LINE Messages in Group</span>
              <span className="text-2xl font-black text-rose-700 dark:text-rose-400">{summary.actualLineMessagesReceived}</span>
              <span className="text-[11px] text-rose-600/80 block font-semibold">ข้อความที่ จนท. เห็นในแชท</span>
            </div>
          </div>

          {/* Breakdown Grids */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Timeline Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                <Clock className="w-4 h-4 text-amber-500" />
                การกระจายตามช่วงเวลา (Timeline Breakdown)
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(summary.timeline).map(([timeLabel, count]) => (
                  <div key={timeLabel} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-center border border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-mono text-slate-500 block">{timeLabel}</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{count} ข้อความ</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Language Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                <Globe className="w-4 h-4 text-blue-500" />
                การกระจายตามภาษา (Language Breakdown)
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">ภาษาไทย (Thai):</span>
                  <span className="font-bold text-slate-900 dark:text-white">{summary.languages.Thai} ข้อความ</span>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">ภาษาอังกฤษ (English):</span>
                  <span className="font-bold text-slate-900 dark:text-white">{summary.languages.English} ข้อความ</span>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">ไทยปนอังกฤษ (Thai + English):</span>
                  <span className="font-bold text-slate-900 dark:text-white">{summary.languages["Thai + English"]} ข้อความ</span>
                </div>
              </div>
            </div>
          </div>

          {/* Baseline Observation Box */}
          <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-xs text-slate-700 dark:text-slate-300 space-y-2">
            <div className="font-bold text-amber-800 dark:text-amber-400 flex items-center gap-2 text-sm">
              <MessageSquare className="w-4 h-4" />
              การสังเกตการณ์ระบบเดิม (Baseline Observation)
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
              <li>ระบบส่ง 20 คำร้องแยกกัน ➔ กลุ่ม LINE ได้รับ <strong>20 ข้อความแยกเดี่ยว</strong> ตามลำดับเวลา</li>
              <li><strong>ไม่มีการรวมข้อความ (No Aggregation)</strong>: แม้ข้อความจะแจ้งเรื่องแอร์ห้อง 301 เหมือนกัน</li>
              <li><strong>ไม่มีการหน่วงเวลา (No Debounce)</strong>: คำร้องที่เข้ามาในช่วงเวลาไล่เลี่ยกัน (เช่น T+0 ทั้ง 3 รายการ) ส่งเสียงเตือน 3 ครั้งติด</li>
              <li><strong>ไม่มีการตรวจจับภาษาหรือคำพ้อง</strong>: ข้อความภาษาอังกฤษและไทยแสดงผลตามที่ผู้ใช้พิมพ์โดยตรง</li>
              <li>นี่คือระดับ Notification Noise ฐาน (Baseline) ของระบบปัจจุบันก่อนการปรับแต่ง</li>
            </ul>
          </div>

          {/* 20 Messages Detailed Table */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              รายละเอียดข้อความทั้ง 20 รายการที่ส่งออก
            </h4>
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">รหัส Mock</th>
                    <th className="p-3">Timeline</th>
                    <th className="p-3">ภาษา</th>
                    <th className="p-3">ข้อความปัญหา</th>
                    <th className="p-3">สถานที่</th>
                    <th className="p-3">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {summary.messages.map((m) => (
                    <tr key={m.mockId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="p-3 font-mono text-slate-400">{m.index}</td>
                      <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">{m.mockId}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-mono text-[11px] font-semibold">
                          {m.timeline}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{m.language}</td>
                      <td className="p-3 max-w-xs truncate text-slate-800 dark:text-slate-200" title={m.description}>
                        {m.description}
                      </td>
                      <td className="p-3 text-slate-500">{m.location}</td>
                      <td className="p-3">
                        {m.status === "Sent" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                            <XCircle className="w-3.5 h-3.5" /> Failed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                ยืนยันการทดสอบ Baseline Test
              </h3>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <p>ระบบกำลังจะสร้าง Mock Notification จำนวน <strong>20 รายการ</strong> (จำลองปัญหาเดียวกันตลอดช่วงเวลา T+0 ถึง T+3h) และส่งไปยัง:</p>
              
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1">
                <div className="font-semibold text-slate-800 dark:text-white">กลุ่มเป้าหมาย: LINE กลุ่ม SOC TEST</div>
                <div className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">Department: soc-test (Query จาก DB)</div>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>ไม่มีข้อมูลจริงในตาราง reports หรือ production ถูกแก้ไข</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                ยกเลิก (Cancel)
              </button>
              <button
                type="button"
                onClick={handleStartTest}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20 cursor-pointer"
              >
                เริ่มการทดสอบ (Start Test)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
