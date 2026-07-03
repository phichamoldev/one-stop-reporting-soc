interface FormInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  required?: boolean;
  helperText?: string;
}

export function FormInput({
  label,
  error,
  required,
  helperText,
  className,
  ...props
}: FormInputProps) {
  return (
    <div className="form-control w-full">
      <label className="label">
        <span className="label-text font-bold text-xs">
          {label} {required && <span className="text-error">*</span>}
        </span>
      </label>
      <input
        className={`input input-bordered input-md w-full rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${
          error ? "input-error" : ""
        } ${className || ""}`}
        {...props}
      />
      {error && (
        <label className="label">
          <span className="label-text-alt text-error text-[10px] font-bold">
            <span className="w-1 h-1 rounded-full bg-error inline-block mr-1"></span>
            {error}
          </span>
        </label>
      )}
      {helperText && (
        <label className="label">
          <span className="label-text-alt text-[10px] text-gray-400">
            {helperText}
          </span>
        </label>
      )}
    </div>
  );
}
