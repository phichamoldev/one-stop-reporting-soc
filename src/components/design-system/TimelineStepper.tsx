import React from 'react';
import { Report, STATUS_DETAILS } from '@/types/report';
import { Check, Wrench } from 'lucide-react';

interface TimelineStepperProps {
  report: Report;
}

export const TimelineStepper: React.FC<TimelineStepperProps> = ({ report }) => {
  const status = report.status;
  const statusInfo = STATUS_DETAILS[status];

  if (status === 'rejected' || status === 'cancelled') {
    return (
      <div className={`p-4 rounded-2xl ${statusInfo.bgClass} ${statusInfo.colorClass} border ${statusInfo.borderClass} text-[13px] font-medium`}>
        <div className="font-bold mb-1">{statusInfo.label}</div>
        <div className="text-[11px] opacity-80">{statusInfo.description}</div>
      </div>
    );
  }

  // Status logic
  const isInProgress = status === 'in_progress';
  const isResolved = status === 'completed';

  const s1State = 'completed';
  const s2State = isResolved ? 'completed' : (isInProgress ? 'active' : 'inactive');
  const s3State = isResolved ? 'completed' : 'inactive';

  const getLineColor = (nextState: string) => {
    if (nextState === 'completed') return 'bg-[#10B981]';
    if (nextState === 'active') return 'bg-[#F97316]'; // Orange-500
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
        <div className="w-6 h-6 rounded-full bg-[#F97316] flex items-center justify-center shrink-0">
          <Wrench className="w-3 h-3 text-white" strokeWidth={2.5} />
        </div>
      );
    }
    return (
      <div className="w-6 h-6 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center shrink-0">
      </div>
    );
  };

  const s1 = STATUS_DETAILS.pending;
  const s2 = STATUS_DETAILS.in_progress;
  const s3 = STATUS_DETAILS.completed;

  return (
    <div className="flex flex-col">
      {/* Step 1 */}
      <div className="flex gap-3">
        <div className="flex flex-col items-center shrink-0">
          {getIcon(s1State)}
          <div className={`w-[2px] grow ${line1Color} my-1`}></div>
        </div>
        <div className="flex flex-col pb-4">
          <span className="text-[13px] font-semibold text-slate-800 leading-none pt-1">{s1.label}</span>
          <span className="text-[11px] text-gray-500 leading-none mt-1">{s1.description}</span>
        </div>
      </div>

      {/* Step 2 */}
      <div className="flex gap-3">
        <div className="flex flex-col items-center shrink-0">
          {getIcon(s2State)}
          <div className={`w-[2px] grow ${line2Color} my-1`}></div>
        </div>
        <div className="flex flex-col pb-4">
          <span className="text-[13px] font-semibold text-slate-800 leading-none pt-1">{s2.label}</span>
          <span className="text-[11px] text-gray-500 leading-none mt-1">{s2.description}</span>
        </div>
      </div>

      {/* Step 3 */}
      <div className="flex gap-3">
        <div className="flex flex-col items-center shrink-0">
          {getIcon(s3State)}
        </div>
        <div className="flex flex-col">
          <span className="text-[13px] font-semibold text-slate-800 leading-none pt-1">{s3.label}</span>
          <span className="text-[11px] text-gray-500 leading-none mt-1">{s3.description}</span>
        </div>
      </div>
    </div>
  );
};
