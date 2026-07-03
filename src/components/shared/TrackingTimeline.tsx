import React from 'react';
import { TRACKING_STEPS, STATUS_DETAILS } from '@/types/report';

interface TrackingTimelineProps {
  currentStepIndex: number;
  isRejected: boolean;
}

export function TrackingTimeline({ currentStepIndex, isRejected }: TrackingTimelineProps) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4.5 space-y-4 shadow-sm">
      <h2 className="text-xs font-bold text-gray-900 dark:text-white pb-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-1.5">
        <span className="w-1.5 h-3 bg-primary rounded-full"></span>
        ความคืบหน้า
      </h2>
      
      {isRejected ? (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 space-y-1.5 animate-scale-up">
          <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-bold text-xs">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            คำร้องไม่ถูกรับเรื่อง
          </div>
          <p className="text-[10px] text-rose-600 dark:text-rose-400/90 leading-relaxed font-semibold">
            เนื่องจากข้อมูลไม่สอดคล้องกับเป้าหมายการแจ้งซ่อมของคณะ หรือรายละเอียดหลักฐานไม่เพียงพอ
          </p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-5 before:absolute before:left-[7.5px] before:top-2 before:bottom-2 before:w-[1.5px] before:bg-gray-200 dark:before:bg-gray-800">
          {TRACKING_STEPS.map((step, idx) => {
            const stepConfig = STATUS_DETAILS[step.status];
            const isCompleted = idx <= currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <div key={step.status} className="relative flex items-start gap-3.5 animate-fade-in">
                <span 
                  className={`absolute -left-[23px] w-4 h-4 rounded-full border-2 transition-colors duration-300 z-10 flex items-center justify-center ${
                    isCurrent
                      ? "bg-primary border-primary-light text-white shadow-sm"
                      : isCompleted
                        ? "bg-primary border-primary text-white"
                        : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                  }`}
                >
                  {isCompleted && (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-2 h-2 text-white">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                </span>
                <div className="space-y-0.5">
                  <h3 className={`text-xs font-extrabold ${
                    isCurrent ? "text-primary font-black" : isCompleted ? "text-gray-950 dark:text-white" : "text-gray-400"
                  }`}>
                    {step.label}
                  </h3>
                  <p className="text-[10px] text-gray-400 leading-tight font-semibold">
                    {isCurrent 
                      ? `ขณะนี้อยู่ขั้นตอน: ${stepConfig.label}` 
                      : isCompleted 
                        ? "เสร็จสิ้น" 
                        : "รอดำเนินการ"
                    }
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
