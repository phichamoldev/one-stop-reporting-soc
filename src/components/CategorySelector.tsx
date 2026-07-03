import { ReportCategory, CATEGORY_DETAILS } from "@/types/report";

interface CategorySelectorProps {
  value: ReportCategory | "";
  onChange: (category: ReportCategory) => void;
  error?: string;
  required?: boolean;
}

export function CategorySelector({
  value,
  onChange,
  error,
  required,
}: CategorySelectorProps) {
  return (
    <div className="form-control w-full">
      <label className="label">
        <span className="label-text font-bold text-xs">
          เลือกหมวดหมู่ปัญหา {required && <span className="text-error">*</span>}
        </span>
      </label>

      <div className="grid grid-cols-2 gap-2">
        {Object.entries(CATEGORY_DETAILS).map(([key, details]) => {
          const isSelected = value === key;
          return (
            <button
              type="button"
              key={key}
              onClick={() => onChange(key as ReportCategory)}
              className={`p-2.5 rounded-xl border-2 text-left transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                isSelected
                  ? "border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary shadow-sm"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-primary/30 dark:hover:border-primary/30"
              }`}
            >
              <span className="text-2xl shrink-0">{details.icon}</span>
              <div className="truncate">
                <span className="text-[11px] font-bold text-gray-900 dark:text-white block">
                  {details.label}
                </span>
                <span className="text-[9px] text-gray-400 block line-clamp-1">
                  {details.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <label className="label">
          <span className="label-text-alt text-error text-[10px] font-bold">
            <span className="w-1 h-1 rounded-full bg-error inline-block mr-1"></span>
            {error}
          </span>
        </label>
      )}
    </div>
  );
}
