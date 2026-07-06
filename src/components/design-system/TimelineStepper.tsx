import React from 'react';
import { Report } from '@/types/report';
import { Check, Wrench } from 'lucide-react';

interface TimelineStepperProps {
  report: Report;
}

export const TimelineStepper: React.FC<TimelineStepperProps> = ({ report }) => {
  const isRejected = report.status === 'rejected';

  if (isRejected) {
    return (
      <div className="p-4 rounded-2xl bg-rose-50 text-rose-700 text-[13px] font-medium">
         คำร้องไม่ถูกรับเรื่อง
      </div>
    );
  }

  const status = report.status;
  
  // Status logic
  const isInProgress = status === 'in_progress' || status === 'investigating';
  const isResolved = status === 'resolved';

  const s1State = 'completed';
  const s2State = isResolved ? 'completed' : (isInProgress ? 'active' : 'inactive');
  const s3State = isResolved ? 'completed' : 'inactive';

  const getLineColor = (nextState: string) => {
    if (nextState === 'completed') return 'bg-[#10B981]';
    if (nextState === 'active') return 'bg-[#F59E0B]';
    return 'bg-[#E5E7EB]';
  };

  const line1Color = getLineColor(s2State);
  const line2Color = getLineColor(s3State);

  const getIcon = (state: string) => {
    if (state === 'completed') {
      return (
        <div className="w-6 h-6 rounded-full bg-[#10B981] flex items-center justify-center shrink-0">
          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3.5} />
        </div>
      );
    }
    if (state === 'active') {
      return (
        <div className="w-6 h-6 rounded-full bg-[#F59E0B] flex items-center justify-center shrink-0">
          <Wrench className="w-3 h-3 text-white" strokeWidth={2.5} />
        </div>
      );
    }
    return (
      <div className="w-6 h-6 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center shrink-0">
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      {/* Step 1 */}
      <div className="flex gap-3">
        <div className="flex flex-col items-center shrink-0">
          {getIcon(s1State)}
          <div className={`w-[2px] grow ${line1Color} my-1`}></div>
        </div>
        <div className="flex flex-col pb-4">
          <span className="text-[13px] font-semibold text-slate-800 leading-none pt-1">รับเรื่องแล้ว</span>
          <span className="text-[11px] text-gray-500 leading-none mt-1">อยู่ระหว่างการรอคัดกรอง</span>
        </div>
      </div>

      {/* Step 2 */}
      <div className="flex gap-3">
        <div className="flex flex-col items-center shrink-0">
          {getIcon(s2State)}
          <div className={`w-[2px] grow ${line2Color} my-1`}></div>
        </div>
        <div className="flex flex-col pb-4">
          <span className="text-[13px] font-semibold text-slate-800 leading-none pt-1">กำลังดำเนินการ</span>
          <span className="text-[11px] text-gray-500 leading-none mt-1">ดำเนินการแจ้งไปยังหน่วยที่เกี่ยวข้องแล้ว</span>
        </div>
      </div>

      {/* Step 3 */}
      <div className="flex gap-3">
        <div className="flex flex-col items-center shrink-0">
          {getIcon(s3State)}
        </div>
        <div className="flex flex-col">
          <span className="text-[13px] font-semibold text-slate-800 leading-none pt-1">เสร็จสิ้น</span>
          <span className="text-[11px] text-gray-500 leading-none mt-1">ขอบคุณที่ช่วยกันพัฒนาคณะของเรา</span>
        </div>
      </div>
    </div>
  );
};
