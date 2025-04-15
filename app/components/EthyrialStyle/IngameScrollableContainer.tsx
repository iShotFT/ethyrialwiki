import React, { ReactNode, useRef, useEffect, useState } from 'react';
import { cn } from '~/utils/twMerge';

interface IngameScrollableContainerProps {
  children: ReactNode;
  direction?: 'horizontal' | 'vertical';
  className?: string; // For additional styling on the wrapper
}

const IngameScrollableContainer: React.FC<IngameScrollableContainerProps> = ({
  children,
  direction = 'horizontal',
  className,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState(0);
  const [thumbStartScroll, setThumbStartScroll] = useState(0);

  const isHorizontal = direction === 'horizontal';

  // Update thumb size and position based on scroll
  const updateThumb = () => {
    const content = contentRef.current;
    const track = trackRef.current;
    const thumb = thumbRef.current;

    if (!content || !track || !thumb) return;

    if (isHorizontal) {
      const scrollWidth = content.scrollWidth;
      const clientWidth = content.clientWidth;
      const trackWidth = track.clientWidth;

      if (scrollWidth <= clientWidth) {
        thumb.style.display = 'none'; // Hide thumb if no scroll needed
        track.style.display = 'none'; // Hide track too
        return;
      } else {
         thumb.style.display = 'block';
         track.style.display = 'block';
      }

      const thumbWidth = Math.max(20, (clientWidth / scrollWidth) * trackWidth); // Min width 20px
      const scrollPercentage = content.scrollLeft / (scrollWidth - clientWidth);
      const thumbLeft = scrollPercentage * (trackWidth - thumbWidth);

      thumb.style.width = `${thumbWidth}px`;
      thumb.style.left = `${thumbLeft}px`;
      thumb.style.height = '15px'; // Explicit height for horizontal thumb
      thumb.style.top = '0px';
    } else {
      // Vertical logic (similar)
      const scrollHeight = content.scrollHeight;
      const clientHeight = content.clientHeight;
      const trackHeight = track.clientHeight;

      if (scrollHeight <= clientHeight) {
          thumb.style.display = 'none';
          track.style.display = 'none';
          return;
      } else {
          thumb.style.display = 'block';
          track.style.display = 'block';
      }

      const thumbHeight = Math.max(20, (clientHeight / scrollHeight) * trackHeight); // Min height 20px
      const scrollPercentage = content.scrollTop / (scrollHeight - clientHeight);
      const thumbTop = scrollPercentage * (trackHeight - thumbHeight);

      thumb.style.height = `${thumbHeight}px`;
      thumb.style.top = `${thumbTop}px`;
      thumb.style.width = '15px'; // Explicit width for vertical thumb
      thumb.style.left = '0px';
    }
  };

  // Attach scroll listener and initial update
  useEffect(() => {
    const contentEl = contentRef.current;
    if (contentEl) {
      const scrollHandler = () => requestAnimationFrame(updateThumb);
      contentEl.addEventListener('scroll', scrollHandler);
      // Initial update
      requestAnimationFrame(updateThumb);

      // Also update on resize
      const resizeObserver = new ResizeObserver(scrollHandler); // Use throttled update on resize too
      resizeObserver.observe(contentEl);

      return () => {
        contentEl.removeEventListener('scroll', scrollHandler);
        resizeObserver.disconnect();
      };
    }
  // Add children as dependency? Might cause too many updates.
  // Let's rely on scroll/resize for now.
  }, [children]); // Re-run if children change significantly

  // Drag Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(true);
      if (isHorizontal) {
          setDragStartPos(e.clientX);
      } else {
          setDragStartPos(e.clientY);
      }
      setThumbStartScroll(contentRef.current?.[isHorizontal ? 'scrollLeft' : 'scrollTop'] || 0);
  };

  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (!isDragging || !contentRef.current) return;
          e.preventDefault();

          const content = contentRef.current;
          let delta = 0;
          if (isHorizontal) {
              delta = e.clientX - dragStartPos;
              const scrollWidth = content.scrollWidth;
              const clientWidth = content.clientWidth;
              const trackWidth = trackRef.current?.clientWidth || 0;
              const thumbWidth = thumbRef.current?.clientWidth || 0;
              // Scale delta based on ratio of scroll range to track range
              const scrollDelta = delta * (scrollWidth - clientWidth) / (trackWidth - thumbWidth);
              content.scrollLeft = thumbStartScroll + scrollDelta;
          } else {
               delta = e.clientY - dragStartPos;
               const scrollHeight = content.scrollHeight;
               const clientHeight = content.clientHeight;
               const trackHeight = trackRef.current?.clientHeight || 0;
               const thumbHeight = thumbRef.current?.clientHeight || 0;
               const scrollDelta = delta * (scrollHeight - clientHeight) / (trackHeight - thumbHeight);
               content.scrollTop = thumbStartScroll + scrollDelta;
          }

      };

      const handleMouseUp = () => {
          if (isDragging) {
              setIsDragging(false);
          }
      };

      if (isDragging) {
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
      }

      return () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
      };
  }, [isDragging, dragStartPos, thumbStartScroll, isHorizontal]);

  return (
    <div className={cn("relative group", className)}> {/* Wrapper */}
      {/* Content Area - hide default scrollbar */}
      <div
        ref={contentRef}
        className={cn(
          "scrollbar-hide", // Keep plugin class
          isHorizontal ? "overflow-x-auto overflow-y-hidden pb-4" : "overflow-y-auto overflow-x-hidden pr-4", // Add padding to prevent overlap
          "w-full h-full" // Ensure it fills parent if needed
        )}
        // Add inline styles for robust scrollbar hiding
        style={{
          msOverflowStyle: 'none', // IE and Edge
          scrollbarWidth: 'none', // Firefox
          // For Webkit browsers (Chrome, Safari), handled by ::-webkit-scrollbar below if needed, but plugin should do it
        }}
      >
        {children}
      </div>

      {/* Custom Scrollbar Track - Revert to fixed height */}
      <div
        ref={trackRef}
        className={cn(
          "absolute bg-[#2b2b2b] rounded-full border border-[#1b1b1b]", // Removed flex items-center, kept rounding
          "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
          // Add back fixed height/width, remove padding
          isHorizontal ? "left-0 right-0 h-[10px] mx-1 mb-0.5" : "top-0 bottom-0 right-0 w-[10px] my-1 mr-0.5", 
          "hidden" // Start hidden, updateThumb will show it
        )}
      >
        {/* Custom Scrollbar Thumb - Add back absolute/top positioning */}
        <div
          ref={thumbRef}
          onMouseDown={handleMouseDown}
          className={cn(
            "absolute bg-[#514941] cursor-pointer rounded-md", // Add absolute back
            // Re-add fixed height/width and negative offset for centering
             isHorizontal ? "h-[15px] -top-[2.5px]" : "w-[15px] -left-[2.5px]",
              "hidden" // Start hidden
          )}
        />
      </div>
    </div>
  );
};

export default IngameScrollableContainer; 