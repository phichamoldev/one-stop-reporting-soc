"use client";

import React, { use, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AppNavbar } from "@/components/shared/AppNavbar";
import { AppContainer } from "@/components/design-system/AppContainer";
import { PageShell } from "@/components/shared/PageShell";
import { AppCard } from "@/components/design-system/AppCard";
import { AppButton } from "@/components/design-system/AppButton";
import { useRouter } from "next/navigation";
import { Report, ReportStatus, STATUS_DETAILS, getStatusLabel } from "@/types/report";
import { GlobalFooter } from "@/components/shared/GlobalFooter";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import {
  ReportHeaderCard,
  ReportInfoCard,
  ActivityTimelineCard,
  ReporterInfoCard,
  buildTimelineEntries,
  isSystemGeneratedLog,
} from "@/components/report-detail/ReportDetailBlocks";
import { 
  FileText, 
  CheckCircle2,
  X,
  Plus
} from "lucide-react";

export interface PublicTimelineMilestone {
  key: string;
  status: string;
  label: string;
  created_at: string;
  remark: string | null;
  image_url?: string | null;
  staff_users?: { full_name: string } | null;
}

export function extractPublicMilestones(report?: Report | null): PublicTimelineMilestone[] {
  if (!report) return [];

  const rawLogs = [...(report.report_logs || [])]
    .filter(l => l && !isSystemGeneratedLog(l))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const milestones: PublicTimelineMilestone[] = [];

  // 1. Initial Submission Milestone (ส่งเรื่องเข้าระบบแล้ว)
  const createdLog = rawLogs.find(l => l.action === 'created');
  milestones.push({
    key: 'created',
    status: 'pending',
    label: 'ส่งเรื่องเข้าระบบแล้ว',
    created_at: createdLog?.created_at || report.created_at,
    remark: createdLog?.remark || null,
    image_url: createdLog?.image_url || null,
    staff_users: createdLog?.staff_users || null
  });

  // 2. Track seen statuses to prevent duplicate status entries
  const seenStatuses = new Set<string>(['pending']);

  for (const log of rawLogs) {
    if (log.action === 'created') continue;

    // Staff note / image updates intended for public viewing (do not create new status milestone)
    if (
      log.action === 'note_updated' ||
      log.action === 'admin_note_added' ||
      log.action === 'image_updated' ||
      log.action === 'note_and_image_updated'
    ) {
      const existing = milestones.find(m => m.status === log.new_status);
      if (
        existing &&
        log.action !== 'image_updated' &&
        log.remark
      ) {
        existing.remark = log.remark;
      }
      if (
        existing &&
        (log.action === 'image_updated' || log.action === 'note_and_image_updated')
      ) {
        existing.image_url = log.image_url || null;
      }
      if (existing && log.staff_users) {
        existing.staff_users = log.staff_users;
      }
      continue;
    }

    if (log.action === 'transfer') {
      milestones.push({
        key: `transfer-${log.id}`,
        status: 'transfer',
        label: 'โอนคำร้อง',
        created_at: log.created_at,
        remark: log.remark || null,
        image_url: log.image_url || null,
        staff_users: log.staff_users || null
      });
      continue;
    }

    // Status change event
    const targetStatus = log.new_status;
    if (!targetStatus) continue;

    // Prevent duplicate milestone if the status hasn't changed or has already been recorded
    if (seenStatuses.has(targetStatus)) {
      const existing = milestones.find(m => m.status === targetStatus);
      if (existing && log.remark) {
        existing.remark = log.remark;
      }
      if (existing && log.staff_users) {
        existing.staff_users = log.staff_users;
      }
      continue;
    }

    seenStatuses.add(targetStatus);
    const statusConfig = STATUS_DETAILS[targetStatus as ReportStatus];
    milestones.push({
      key: `status-${targetStatus}-${log.id}`,
      status: targetStatus,
      label: statusConfig?.label || getStatusLabel(targetStatus),
      created_at: log.created_at,
      remark: log.remark || null,
      image_url: log.image_url || null,
      staff_users: log.staff_users || null
    });
  }

  // Sort descending (latest milestone on top)
  return milestones.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

interface TrackPageProps {
  params: Promise<{
    publicId: string;
  }>;
}

export default function TrackPage({ params }: TrackPageProps) {
  const { publicId } = use(params);

  const router = useRouter();
  
  const { data, error, isLoading } = useSWR(
    publicId ? `/api/reports/${publicId}` : null,
    fetcher
  );
  
  const report = data?.report as Report | undefined;
  
  // สถานะการคัดลอกลิงก์
  const [copied, setCopied] = useState<boolean>(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // ฟังก์ชันสำหรับการคัดลอกลิงก์
  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // รีเซ็ตกลับเป็นปกติหลัง 2 วินาที
    }).catch(err => {
      console.error('Failed to copy link: ', err);
    });
  };

  if (isLoading) {
    return (
      <AppContainer>
        <AppNavbar />
        <div className="flex-1 p-5 md:p-8 flex items-center justify-center bg-[#F8FAFC]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500 font-medium">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      </AppContainer>
    );
  }

  if (error || !report) {
    return (
      <AppContainer>
        <AppNavbar />
        <div className="flex-1 p-5 md:p-8 flex items-center justify-center bg-[#F8FAFC]">
          <AppCard className="max-w-md w-full text-center py-10 shadow-sm border-[#EDF0F4]">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-red-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">ไม่พบข้อมูล</h2>
            <p className="text-slate-500 mb-6 px-4">
              {error?.message || "หมายเลขอ้างอิงที่คุณระบุไม่ถูกต้อง หรือถูกลบออกจากระบบแล้ว"}
            </p>
            <Link href="/">
              <AppButton variant="primary">กลับสู่หน้าหลัก</AppButton>
            </Link>
          </AppCard>
        </div>
      </AppContainer>
    );
  }

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  const timelineEntries = buildTimelineEntries(report, { includeInternal: false });
  const isClosed = ['completed', 'rejected', 'cancelled'].includes(report.status);

  return (
    <AppContainer>
      <AppNavbar />
      <PageShell>
        <ReportHeaderCard report={report} eyebrow="รายงาน" onBack={handleBack} />

        <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-5 items-start w-full min-w-0">
          {/* LEFT (70%): details + full timeline */}
          <div className="space-y-5 min-w-0 w-full">
            <ReportInfoCard report={report} onImageClick={setFullscreenImage} />
            <ActivityTimelineCard
              entries={timelineEntries}
              showUpcomingCompletion={!isClosed}
              onImageClick={setFullscreenImage}
            />
          </div>

          {/* RIGHT (30%): reporter + actions */}
          <aside className="space-y-5 min-w-0 w-full lg:sticky lg:top-6">
            <ReporterInfoCard report={report} />
            <div className="space-y-3 min-w-0 w-full">
              <Link href="/" className="block w-full">
                <span className="w-full h-[50px] rounded-2xl bg-[#C2410C] hover:bg-[#9A3412] text-white font-bold text-[15px] flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer">
                  <Plus className="w-5 h-5" />
                  แจ้งปัญหาใหม่
                </span>
              </Link>
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full h-[50px] rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer shadow-sm"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span className="text-emerald-700">คัดลอกลิงก์สำเร็จแล้ว</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5 text-slate-500" />
                    คัดลอกลิงก์ติดตามเรื่อง
                  </>
                )}
              </button>
            </div>
          </aside>
        </div>

        <div className="pt-2">
          <GlobalFooter />
        </div>
      </PageShell>
          {fullscreenImage && createPortal(
        <div className="fixed inset-0 z-[1200] flex flex-col items-center justify-center p-4 lg:p-8">
          <div 
            className="absolute inset-0 bg-black/95 backdrop-blur-sm"
            onClick={() => setFullscreenImage(null)}
          />
          <button
            onClick={() => setFullscreenImage(null)}
            className="absolute top-4 right-4 z-10 p-3 bg-white/10 hover:bg-white/25 text-white rounded-full transition-colors"
            title="ปิดรูปภาพ (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="relative w-full h-full max-w-5xl flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={fullscreenImage} 
              alt="Report image" 
              className="max-w-full max-h-[85vh] md:max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>,
        document.body
      )}
    </AppContainer>
  );
}