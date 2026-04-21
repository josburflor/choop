import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ className, label, error, ...props }) => {
  return (
    <div className="space-y-2 w-full">
      {label && (
        <label className="text-sm font-medium text-neutral-400 ml-1">
          {label}
        </label>
      )}
      <input
        className={cn(
          "w-full bg-[#262626] border border-neutral-800 rounded-xl px-4 py-3 text-white outline-none transition-all focus:border-[#F97316] focus:ring-4 focus:ring-[#F97316]/10 placeholder:text-neutral-600",
          error && "border-rose-500 focus:border-rose-500 focus:ring-rose-500/10",
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-xs text-rose-500 ml-1 font-medium">
          {error}
        </p>
      )}
    </div>
  );
};
