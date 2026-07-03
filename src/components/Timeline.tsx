import { ReportStatus, STATUS_DETAILS, TRACKING_STEPS } from "@/types/report";

interface TimelineProps {
  currentStatus: ReportStatus;
  isRejected?: boolean;
}

export function Timeline({ currentStatus, isRejected = false }: TimelineProps) {
  const currentStatusInfo = STATUS_DETAILS[currentStatus];
  const currentStepIndex = currentStatusInfo.stepIndex;

  if (isRejected) {
    return (
      <div className="p-3.5 rounded-xl bg-error/10 dark:bg-error/10 border border-error/30 dark:border-error/30 space-y-1.5">
        <div className="flex items-center gap-1.5 text-error font-bold text-xs">
          <span className="w-2 h-2 rounded-full bg-error"></span>
          คำร้องไม่ถูกรับเรื่อง
        </div>
        <p className="text-[10px] text-error/90 leading-relaxed">
          เนื่องจากข้อมูลไม่สอดคล้องกับเป้าหมายการแจ้งซ่อมของคณะ
          หรือรายละเอียดหลักฐานไม่เพียงพอ
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="timeline timeline-compact">
        {TRACKING_STEPS.map((step, idx) => {
          const stepConfig = STATUS_DETAILS[step.status];
          const isCompleted = idx <= currentStepIndex;
          const isCurrent = idx === currentStepIndex;

          return (
            <div key={step.status} className="timeline-item">
              <div
                className={`timeline-marker ${
                  isCurrent
                    ? "badge badge-lg badge-primary"
                    : isCompleted
                      ? "badge badge-lg bg-primary text-white"
                      : "badge badge-lg badge-ghost"
                }`}
              />
              <div className="timeline-content pb-4">
                <h3
                  className={`text-xs font-bold ${
                    isCurrent
                      ? "text-primary"
                      : isCompleted
                        ? "text-gray-900 dark:text-white"
                        : "text-gray-400"
                  }`}
                >
                  {step.label}
                </h3>
                <p className="text-[10px] text-gray-400">
                  {isCurrent
                    ? `ขณะนี้อยู่ขั้นตอน: ${stepConfig.label}`
                    : isCompleted
                      ? "เสร็จสิ้น"
                      : "รอดำเนินการ"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
