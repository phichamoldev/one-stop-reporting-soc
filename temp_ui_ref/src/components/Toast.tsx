/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onClose: () => void }> = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, toast.duration || 5000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
    error: <XCircle className="w-5 h-5 text-red-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
  };

  const bgColors = {
    success: 'bg-white border-l-4 border-green-500 dark:bg-slate-800',
    warning: 'bg-white border-l-4 border-amber-500 dark:bg-slate-800',
    error: 'bg-white border-l-4 border-red-500 dark:bg-slate-800',
    info: 'bg-white border-l-4 border-blue-500 dark:bg-slate-800',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      className={`p-4 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 pointer-events-auto flex gap-3 items-start justify-between ${bgColors[toast.type]} transition-colors duration-200`}
    >
      <div className="flex gap-3">
        {icons[toast.type]}
        <div className="flex flex-col gap-1">
          <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100">{toast.title}</h4>
          {toast.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{toast.description}</p>
          )}
          {toast.action && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toast.action?.onClick();
                onClose();
              }}
              className="mt-2 text-xs font-semibold text-primary hover:text-primary-hover dark:text-red-400 flex items-center justify-start pointer-events-auto self-start"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      </div>
      <button
        onClick={onClose}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};
