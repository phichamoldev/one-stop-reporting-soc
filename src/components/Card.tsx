interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
}

export function Card({ children, className = "", title, subtitle }: CardProps) {
  return (
    <div
      className={`card bg-base-100 shadow-sm border border-base-300 dark:border-base-300 rounded-2xl ${className}`}
    >
      <div className="card-body">
        {title && (
          <h2 className="card-title text-sm font-bold text-gray-900 dark:text-white">
            {title}
            {subtitle && (
              <span className="text-xs font-normal text-gray-400">
                {subtitle}
              </span>
            )}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
