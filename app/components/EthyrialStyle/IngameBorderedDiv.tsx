import React, { forwardRef, ReactNode } from 'react';
import { cn } from '~/utils/twMerge';

interface GameHUDProps {
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  noPadding?: boolean;
  noBorder?: boolean;
}

const IngameBorderedDiv = forwardRef<HTMLDivElement, GameHUDProps>(
  ({ children, className, style, noPadding = false, noBorder = false }, ref) => {
    return (
      <div
        ref={ref}
        style={style}
        className={[
          "select-none max-h-[80vh]",
          "bg-[#38322c]",
          "rounded-sm",
          className
        ].filter(Boolean).join(' ')}
      >
        <div 
          className={cn(
            "w-full h-full bg-[#151515] rounded-sm overflow-y-auto",
            !noPadding && "p-3",
            !noBorder && "border-t border-l border-[#4e443a] border-b border-r border-[#2c2824] shadow-sm"
          )}
        >
          {children}
        </div>
      </div>
    );
  }
);

IngameBorderedDiv.displayName = 'IngameBorderedDiv';

export default IngameBorderedDiv;