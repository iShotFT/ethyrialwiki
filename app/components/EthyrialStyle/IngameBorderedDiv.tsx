import React from 'react';
import { cn } from '~/utils/twMerge';

interface GameHUDProps {
  className?: string;
}

const GameHUD = ({
  className,
}: GameHUDProps) => {
  return (
    <div className={cn("relative select-none", className)}>
      {/* Main panel container matching the exact image reference */}
      <div className="w-full h-32 relative">
        {/* Outer dark border - 1px */}
        <div className="absolute inset-0 bg-[#1A1A1A] p-[1px]">
          {/* Inner dark border with subtle gradient - 9px */}
          <div className="w-full h-full p-[9px] bg-[#38322c]">
            {/* Main content area - very dark charcoal/black */}
            <div className="w-full h-full bg-[#151515] p-3 border-2 border-[#4e443a]">
              {/* Content would go here */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameHUD;