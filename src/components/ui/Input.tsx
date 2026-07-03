import React, { forwardRef, useId } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', error, label, id, ...props }, ref) => {
    const fallbackId = useId();
    const generatedId = id || fallbackId;
    
    return (
      <div className="form-control w-full">
        {label && (
          <label htmlFor={generatedId} className="label">
            <span className="label-text font-semibold">{label}</span>
          </label>
        )}
        <input
          id={generatedId}
          ref={ref}
          className={`input input-bordered w-full ${error ? 'input-error' : ''} ${className}`}
          {...props}
        />
        {error && (
          <label className="label">
            <span className="label-text-alt text-error">{error}</span>
          </label>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
