"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export interface AppSelectOption {
  label: string;
  value: string | number;
}

export interface AppSelectProps {
  options: AppSelectOption[];
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: boolean;
}

export const AppSelect: React.FC<AppSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select...",
  className = "",
  disabled = false,
  error = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-[44px] px-4 bg-white dark:bg-slate-900 border ${error ? 'border-rose-500' : 'border-[#E5E7EB] dark:border-slate-700/80'} rounded-[12px] flex items-center justify-between transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#D1350F] focus:border-transparent ${
          disabled 
            ? "opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-800/50" 
            : "hover:bg-[#F8FAFC] dark:hover:bg-slate-800/50 cursor-pointer"
        }`}
      >
        <span className={`text-[14px] truncate ${!selectedOption ? "text-slate-500 dark:text-slate-400" : "text-slate-800 dark:text-slate-200"}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-[99] mt-2 w-full min-w-max bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 p-2 animate-in fade-in zoom-in-95 duration-100">
          <div className="max-h-60 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-1">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left min-h-[40px] px-[14px] flex items-center rounded-lg text-[14px] transition-colors ${
                    isSelected 
                      ? "bg-[#D1350F] text-white font-semibold" 
                      : "text-slate-700 dark:text-slate-300 hover:bg-[#F8FAFC] dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
