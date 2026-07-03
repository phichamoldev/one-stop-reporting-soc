import { ReportStatus, STATUS_DETAILS } from "@/types/report";

interface StatusBadgeProps {
  status: ReportStatus;
  size?: "sm" | "md" | "lg";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = STATUS_DETAILS[status];

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[9px]",
    md: "px-3 py-1 text-xs",
    lg: "px-4 py-1.5 text-sm",
  };

  return (
    <span
      className={`badge badge-outline badge-lg gap-1.5 font-bold flex items-center ${sizeClasses[size]} ${config.bgClass} ${config.colorClass} ${config.borderClass}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${config.dotClass} ${
          status !== "resolved" && status !== "rejected" ? "animate-pulse" : ""
        }`}
      />
      {config.label}
    </span>
  );
}
