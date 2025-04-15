import React, { useState, cloneElement, useRef } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  safePolygon,
  FloatingPortal, // To render tooltip in body
  arrow,
  FloatingArrow // Optional arrow component
} from '@floating-ui/react';
import { motion, AnimatePresence } from 'framer-motion'; // For animation
import { cn } from '~/utils/twMerge';

interface IngameTooltipProps {
  children: JSX.Element; // Expect a single element trigger
  content: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  showArrow?: boolean;
}

const IngameTooltip: React.FC<IngameTooltipProps> = ({
  children,
  content,
  placement = 'top',
  className,
  showArrow = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const arrowRef = useRef(null);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: placement,
    // Make sure the tooltip stays on the screen
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(showArrow ? 10 : 5), // Add more offset if arrow is shown
      flip({ fallbackAxisSideDirection: 'start' }),
      shift({ padding: 5 }),
      arrow({ element: arrowRef }),
    ],
  });

  // Define interactions
  const hover = useHover(context, { move: false, handleClose: safePolygon() });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });

  // Merge interactions
  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);

  return (
    <>
      {/* Clone the trigger element to attach interaction props */}
      {cloneElement(children, getReferenceProps({ ref: refs.setReference, ...children.props }))}

      {/* Render tooltip in a portal */}
      <FloatingPortal>
        <AnimatePresence>
          {isOpen && (
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              className={cn(
                "z-50", // Ensure high z-index
                // Style using Tailwind classes for consistency
                "border border-[#1A1A1A] rounded-sm",
                "p-1.5 bg-[#38322c]", // Inner background (like IngameBorderedDiv)
                className
                )}
              {...getFloatingProps()}
            >
              {/* Innermost content area */}
              <div className="bg-[#151515] text-white text-xs px-2 py-1 rounded-sm border-t border-l border-[#4e443a] border-b border-r border-[#2c2824]">
                 {content}
              </div>

              {/* Optional Arrow */}
              {showArrow && (
                <FloatingArrow
                    ref={arrowRef}
                    context={context}
                    fill="#38322c" // Match inner background
                    stroke="#1A1A1A" // Match outer border
                    strokeWidth={1}
                    height={5}
                    width={10}
                />
              )}
            </div>
          )}
        </AnimatePresence>
      </FloatingPortal>
    </>
  );
};

export default IngameTooltip; 