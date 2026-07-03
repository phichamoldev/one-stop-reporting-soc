interface AlertProps {
  type: "success" | "error" | "warning" | "info";
  title?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function Alert({ type, title, children, icon }: AlertProps) {
  const alertClasses = {
    success: "alert-success bg-success/10 border-success text-success",
    error: "alert-error bg-error/10 border-error text-error",
    warning: "alert-warning bg-warning/10 border-warning text-warning",
    info: "alert-info bg-info/10 border-info text-info",
  };

  const defaultIcons = {
    success: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="stroke-current shrink-0 h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    error: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="stroke-current shrink-0 h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4v2m0 6a9 9 0 110-18 9 9 0 010 18z"
        />
      </svg>
    ),
    warning: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="stroke-current shrink-0 h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4v2m0 6a9 9 0 110-18 9 9 0 010 18z"
        />
      </svg>
    ),
    info: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="stroke-current shrink-0 h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  };

  return (
    <div className={`alert alert-lg rounded-xl border ${alertClasses[type]}`}>
      {icon || defaultIcons[type]}
      <div>
        {title && <h3 className="font-bold text-sm">{title}</h3>}
        <div className="text-xs">{children}</div>
      </div>
    </div>
  );
}
