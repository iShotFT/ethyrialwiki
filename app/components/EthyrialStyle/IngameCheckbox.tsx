import React, { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '~/utils/twMerge'; // Assuming this utility exists

interface IngameCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  labelClassName?: string;
}

const IngameCheckbox = forwardRef<HTMLLabelElement, IngameCheckboxProps>((
  {
    label,
    id,
    className,
    labelClassName,
    checked,
    disabled,
    ...props
  },
  ref
) => {
  // Generate a simpler ID for React 17 compatibility
  const checkboxId = id || `ingame-checkbox-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <label
      ref={ref}
      htmlFor={checkboxId}
      className={cn(
        "inline-flex items-center cursor-pointer",
        disabled ? "opacity-50 cursor-not-allowed" : "",
        className // Allow overriding container styles
      )}
    >
      {/* Hidden actual checkbox for state and accessibility */}
      <input
        type="checkbox"
        id={checkboxId}
        className="sr-only peer" // Hide visually but keep accessible
        checked={checked}
        disabled={disabled}
        {...props}
      />

      {/* Custom Checkbox Visual - Increased Size */}
      <div
        className={cn(
          "relative w-5 h-5 border border-[#1A1A1A] bg-[#151515] shadow-inner rounded-sm", // Outer box (4th square) - SIZE INCREASED
          "p-px" // Keep outer padding minimal
        )}
        aria-hidden="true"
      >
        {/* 3rd square - Increased Padding */}
        <div className="w-full h-full bg-[#38322c] border border-[#4e443a] rounded-[1px] p-0.5"> {/* PADDING INCREASED */}
          {/* 2nd square - Increased Padding */}
          <div className="w-full h-full bg-[#7a6d5f] rounded-[1px] p-0.5"> {/* PADDING INCREASED */}
             {/* 1st square (Innermost - check indicator) */}
             <div
               className={cn(
                 "w-full h-full bg-[#151515] rounded-[1px] transition-opacity", // Innermost dark square
                 checked ? "opacity-0" : "opacity-100" // Hide when checked, show when unchecked
               )}
             />
          </div>
        </div>
      </div>

      {/* Optional Label */}
      {label && (
        <span className={cn("ml-2 text-sm", labelClassName)}>
          {label}
        </span>
      )}
    </label>
  );
});

export default IngameCheckbox; 