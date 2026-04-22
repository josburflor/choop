import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { Eye, EyeOff } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ className, label, error, type, ...props }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="space-y-2 w-full">
      {label && (
        <label className="text-sm font-medium text-app-text-muted ml-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type={inputType}
          className={cn(
            "w-full bg-app-input border border-app-border rounded-xl px-4 py-3 text-app-text outline-none transition-all focus:border-choop-orange focus:ring-4 focus:ring-choop-orange/10 placeholder:text-app-text-muted/50",
            isPassword && "pr-12",
            error && "border-rose-500 focus:border-rose-500 focus:ring-rose-500/10",
            className
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text transition-colors"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs text-rose-500 ml-1 font-medium">
          {error}
        </p>
      )}
    </div>
  );
};
