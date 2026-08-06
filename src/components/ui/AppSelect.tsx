"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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
  const popupRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = React.useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom,
        left: rect.left,
        width: rect.width
      });
    }
  }, []);

  const handleToggle = () => {
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsOpen(false);
    };

    if (isOpen) {
      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", updatePosition);
    }
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!popupRef.current || !popupRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative ${className} ${isOpen ? 'z-[9999]' : ''}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
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

      {mounted && isOpen && createPortal(
        <div
          ref={popupRef}
          className="fixed z-[99999] mt-2 bg-white dark:bg-slate-900 rounded-[16px] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.15)] ring-1 ring-black/5 dark:ring-white/10 p-2.5 animate-in fade-in zoom-in-95 duration-150"
          style={{ top: coords.top, left: coords.left, width: coords.width }}
        >
          <div className="flex flex-col gap-1.5 p-1">
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
                  className={`w-full text-left min-h-[44px] px-3.5 flex items-center rounded-xl text-[14px] transition-all duration-200 ${
                    isSelected 
                      ? "bg-[#D1350F] text-white font-bold shadow-md shadow-[#D1350F]/20" 
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
