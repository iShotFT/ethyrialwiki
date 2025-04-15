import React, { forwardRef, ReactNode } from 'react';
import { cn } from '~/utils/twMerge';

interface GameHUDProps {
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const IngameBorderedDiv = forwardRef<HTMLDivElement, GameHUDProps>(
  ({ children, className, style }, ref) => {
    return (
      <div
        ref={ref}
        style={style}
        className={[
          "select-none max-h-[80vh]",
          "p-[9px] bg-[#38322c]",
          "rounded-sm",
          className
        ].filter(Boolean).join(' ')}
      >
        <div className="w-full h-full bg-[#151515] p-3 border-t border-l border-[#4e443a] border-b border-r border-[#2c2824] shadow-sm overflow-y-auto rounded-sm">
          {children}
        </div>
      </div>
    );
  }
);

IngameBorderedDiv.displayName = 'IngameBorderedDiv';

export default IngameBorderedDiv;