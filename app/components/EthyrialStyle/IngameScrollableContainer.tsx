import React, { ReactNode, useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { cn } from '~/utils/twMerge';
import styled from 'styled-components';

interface IngameScrollableContainerProps {
  children: ReactNode;
  direction?: 'horizontal' | 'vertical';
  className?: string; // For additional styling on the wrapper
  onWheel?: (event: React.WheelEvent<HTMLDivElement>) => void; // Add onWheel prop
}

const ScrollTrack = styled.div<{ horizontal?: boolean }>`
  position: absolute;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 5px;
  ${({ horizontal }) =>
    horizontal
      ? `
    left: 0;
    bottom: 0;
    width: calc(100% - 10px);
    height: 10px;
  `
      : `
    right: 0;
    top: 0;
    width: 10px;
    height: calc(100% - 10px);
  `}
  display: none;
`;

const ScrollThumb = styled.div<{ horizontal?: boolean }>`
  position: absolute;
  background-color: rgba(255, 255, 255, 0.5);
  border-radius: 7.5px;
  cursor: pointer;
  ${({ horizontal }) =>
    horizontal
      ? `
    bottom: -2.5px;
    height: 15px;
  `
      : `
    right: -2.5px;
    width: 15px;
  `}
  display: none;
  &:hover {
    background-color: rgba(255, 255, 255, 0.7);
  }
`;

const IngameScrollableContainer = forwardRef<HTMLDivElement, IngameScrollableContainerProps>(({
  children,
  direction = 'horizontal',
  className,
  onWheel,
}, ref) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState(0);
  const [thumbStartScroll, setThumbStartScroll] = useState(0);

  // Forward the contentRef to parent components
  useImperativeHandle(ref, () => contentRef.current as HTMLDivElement);

  const isHorizontal = direction === 'horizontal';

  // Add wheel event handler for horizontal scrolling
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (isHorizontal && contentRef.current) {
      // If custom onWheel handler provided, use it
      if (onWheel) {
        onWheel(e);
      } else {
        // Default horizontal scrolling behavior
        e.preventDefault();
        contentRef.current.scrollLeft += e.deltaY;
      }
    }
  };

  const updateThumb = () => {
    if (!contentRef.current) return;

    const container = contentRef.current;
    const content = container.firstElementChild as HTMLElement;
    if (!content) return;

    // Always show track first
    if (trackRef.current && thumbRef.current) {
      trackRef.current.style.display = 'block';
      thumbRef.current.style.display = 'block';
    }

    // Horizontal scrollbar
    if (isHorizontal && trackRef.current && thumbRef.current) {
      const track = trackRef.current;
      const thumb = thumbRef.current;
      
      const scrollableWidth = content.scrollWidth;
      const viewableWidth = container.clientWidth;
      
      // Always show scrollbar, but set minimum size if no scroll needed
      const thumbWidth = Math.max(
        30, 
        scrollableWidth <= viewableWidth 
          ? track.clientWidth * 0.8 // If no scroll needed, show a large thumb
          : (viewableWidth / scrollableWidth) * track.clientWidth
      );
      thumb.style.width = `${thumbWidth}px`;
      thumb.style.height = '15px'; // Restore original height
      
      // Position to center vertically
      thumb.style.top = '50%';
      thumb.style.transform = 'translateY(-50%)';
      
      // Calculate thumb position - fixed at start if no scroll needed
      if (scrollableWidth <= viewableWidth) {
        thumb.style.left = '0px';
      } else {
        const scrollLeft = container.scrollLeft;
        const maxScrollLeft = scrollableWidth - viewableWidth;
        const thumbLeft = (scrollLeft / maxScrollLeft) * (track.clientWidth - thumbWidth);
        thumb.style.left = `${thumbLeft}px`;
      }
    } else if (!isHorizontal && trackRef.current && thumbRef.current) {
      // Vertical scrollbar
      const track = trackRef.current;
      const thumb = thumbRef.current;
      
      const scrollableHeight = content.scrollHeight;
      const viewableHeight = container.clientHeight;
      
      // Always show scrollbar, but set minimum size if no scroll needed
      const thumbHeight = Math.max(
        30, 
        scrollableHeight <= viewableHeight 
          ? track.clientHeight * 0.8 // If no scroll needed, show a large thumb
          : (viewableHeight / scrollableHeight) * track.clientHeight
      );
      thumb.style.height = `${thumbHeight}px`;
      thumb.style.width = '15px'; // Restore original width
      
      // Position to center horizontally
      thumb.style.left = '50%';
      thumb.style.transform = 'translateX(-50%)';
      
      // Calculate thumb position - fixed at start if no scroll needed
      if (scrollableHeight <= viewableHeight) {
        thumb.style.top = '0px';
      } else {
        const scrollTop = container.scrollTop;
        const maxScrollTop = scrollableHeight - viewableHeight;
        const thumbTop = (scrollTop / maxScrollTop) * (track.clientHeight - thumbHeight);
        thumb.style.top = `${thumbTop}px`;
      }
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
      {/* Content Area - restore original padding */}
      <div
        ref={contentRef}
        className={cn(
          "scrollbar-hide", // Keep plugin class
          isHorizontal ? "overflow-x-auto overflow-y-hidden pb-4" : "overflow-y-auto overflow-x-hidden pr-4", // Restore original padding
          "w-full h-full" // Ensure it fills parent if needed
        )}
        // Add inline styles for robust scrollbar hiding
        style={{
          msOverflowStyle: 'none', // IE and Edge
          scrollbarWidth: 'none', // Firefox
        }}
        onWheel={handleWheel}
      >
        {children}
      </div>

      {/* Custom Scrollbar Track - Always visible with lower default opacity */}
      <div
        ref={trackRef}
        className={cn(
          "absolute bg-[#2b2b2b] rounded-full border border-[#1b1b1b]",
          "opacity-40 group-hover:opacity-100 transition-opacity duration-200", // Default opacity 40%, hover 100%
          isHorizontal 
            ? "left-0 right-0 bottom-0 h-[10px] mx-1 mb-0.5" // Original height for track: 10px 
            : "top-0 bottom-0 right-0 w-[10px] my-1 mr-0.5"
        )}
      >
        {/* Thumb with original height but positioned to be centered */}
        <div
          ref={thumbRef}
          onMouseDown={handleMouseDown}
          className={cn(
            "absolute bg-[#514941] cursor-pointer rounded-md",
            isHorizontal ? "h-[15px]" : "w-[15px]", // Original size: 15px
          )}
          // Center the thumb vertically in the track
          style={{ 
            position: 'absolute',
            transform: isHorizontal ? 'translateY(-50%)' : 'translateX(-50%)',
            top: isHorizontal ? '50%' : undefined,
            left: isHorizontal ? undefined : '50%'
          }}
        />
      </div>
    </div>
  );
});

// Add display name for debugging
IngameScrollableContainer.displayName = 'IngameScrollableContainer';

export default IngameScrollableContainer; 