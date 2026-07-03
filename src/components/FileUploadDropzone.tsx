"use client";

import React, { useRef, useState } from "react";

interface FileUploadDropzoneProps {
  label: string;
  onFileChange: (file: File) => void;
  preview?: string | null;
  onRemove?: () => void;
  error?: string;
  required?: boolean;
  accept?: string;
  maxSize?: number;
}

export function FileUploadDropzone({
  label,
  onFileChange,
  preview,
  onRemove,
  error,
  required,
  accept = "image/*",
  maxSize = 5 * 1024 * 1024, // 5MB default
}: FileUploadDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("กรุณาอัปโหลดเฉพาะไฟล์รูปภาพเท่านั้น");
      return;
    }

    // Validate file size
    if (file.size > maxSize) {
      alert(`ขนาดรูปภาพต้องไม่เกิน ${Math.round(maxSize / 1024 / 1024)}MB`);
      return;
    }

    onFileChange(file);
  };

  return (
    <div className="form-control w-full">
      <label className="label">
        <span className="label-text font-bold text-xs">
          {label} {required && <span className="text-error">*</span>}
        </span>
      </label>

      {preview ? (
        <div className="relative rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-950 aspect-video group shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Upload preview"
            className="w-full h-full object-cover"
          />
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="absolute top-2.5 right-2.5 p-1.5 bg-error hover:bg-error/90 text-white rounded-full transition-colors shadow shadow-error/10 cursor-pointer"
              title="เปลี่ยนรูปภาพ"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                />
              </svg>
            </button>
          )}
        </div>
      ) : (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 min-h-[150px] ${
            dragActive
              ? "border-primary bg-primary/5 dark:bg-primary/10"
              : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-slate-50/50 dark:hover:bg-gray-900/50"
          } ${error ? "border-error" : ""}`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept={accept}
            className="hidden"
          />
          <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
              />
            </svg>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              กดอัปโหลด หรือวางไฟล์รูปภาพหลักฐาน
            </p>
            <p className="text-[10px] text-gray-400">
              PNG, JPG, HEIC ขนาดไม่เกิน {Math.round(maxSize / 1024 / 1024)}MB
            </p>
          </div>
        </div>
      )}

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
