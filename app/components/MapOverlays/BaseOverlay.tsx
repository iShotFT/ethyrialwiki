import React, { useState, useEffect, useRef } from 'react';
import styled, { CSSProperties } from 'styled-components';
import { useDrag } from 'react-dnd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCompressAlt, faExpandAlt } from '@fortawesome/free-solid-svg-icons';
import Flex from '~/components/Flex';
import { cn } from '~/utils/twMerge';
import IngameBorderedDiv from '~/components/EthyrialStyle/IngameBorderedDiv';
import IngameTooltip from '~/components/EthyrialStyle/IngameTooltip';
import Logger from '~/utils/Logger';

// Position types
export type PositionState = { x: number; y: number };

// Define standard positions
export type StandardPosition = 
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  | 'middle-left' | 'middle-right' | 'middle-top' | 'middle-bottom';

// Define offset structure
export interface PositionOffset {
  x?: number;
  y?: number;
}

// Define the defaultPosition prop structure
export interface DefaultPosition {
  position: StandardPosition;
  offset?: PositionOffset; // Optional offsets
}

// Common props for all overlays
export interface BaseOverlayProps {
  title: string;
  collapsedTitle?: string;
  localStorageKey: string;
  // Remove initialPosition, use defaultPosition instead
  defaultPosition?: DefaultPosition; // New prop for standardized positioning
  zIndex?: number;
  className?: string;
  children?: React.ReactNode;
  dragType: string;
  showHeader?: boolean;
  noPadding?: boolean;
  noBorder?: boolean;
}

// Default distance from edge if no offset provided
const DEFAULT_EDGE_DISTANCE = 16;

// --- Styled Components --- //
const PanelHeader = styled(Flex)`
  margin-bottom: 12px;
  font-weight: 600;
  padding: 0 4px;
`;

const CollapseButton = styled.button`
  background: none; 
  border: none; 
  padding: 4px; 
  margin: 0;
  cursor: pointer; 
  color: inherit; 
  display: inline-flex;
  align-items: center; 
  justify-content: center; 
  border-radius: 4px;
  font-size: 16px;
  &:hover { background: ${(props) => props.theme.tooltipBackground}; }
  svg { display: block; }
`;

// Helper function to calculate position based on standard string and dimensions
const calculateDefaultPosition = (pos: DefaultPosition, element: HTMLDivElement | null): PositionState => {
  const { position, offset } = pos;
  const offsetX = offset?.x ?? DEFAULT_EDGE_DISTANCE;
  const offsetY = offset?.y ?? DEFAULT_EDGE_DISTANCE;
  
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const elementWidth = element?.offsetWidth ?? 200; // Default width if not measured
  const elementHeight = element?.offsetHeight ?? 100; // Default height if not measured

  let x = offsetX; // Default to top-left X
  let y = offsetY; // Default to top-left Y

  switch (position) {
    case 'top-right':
      x = viewportWidth - elementWidth - offsetX;
      break;
    case 'bottom-left':
      y = viewportHeight - elementHeight - offsetY;
      break;
    case 'bottom-right':
      x = viewportWidth - elementWidth - offsetX;
      y = viewportHeight - elementHeight - offsetY;
      break;
    case 'middle-left':
      y = viewportHeight / 2 - elementHeight / 2 + (offset?.y ?? 0); // Apply direct Y offset for middle
      break;
    case 'middle-right':
      x = viewportWidth - elementWidth - offsetX;
      y = viewportHeight / 2 - elementHeight / 2 + (offset?.y ?? 0); // Apply direct Y offset for middle
      break;
    case 'middle-top':
      x = viewportWidth / 2 - elementWidth / 2 + (offset?.x ?? 0); // Apply direct X offset for middle
      break;
    case 'middle-bottom':
      x = viewportWidth / 2 - elementWidth / 2 + (offset?.x ?? 0); // Apply direct X offset for middle
      y = viewportHeight - elementHeight - offsetY;
      break;
    case 'top-left':
    default:
      // Already set to defaults
      break;
  }

  // Ensure position is within bounds
  x = Math.max(0, Math.min(x, viewportWidth - elementWidth));
  y = Math.max(0, Math.min(y, viewportHeight - elementHeight));

  return { x: Math.round(x), y: Math.round(y) };
};

// Main BaseOverlay Component
const BaseOverlay: React.FC<BaseOverlayProps> = ({
  title,
  collapsedTitle,
  localStorageKey,
  defaultPosition = { position: 'top-left' }, // Default to top-left
  zIndex = 10,
  className,
  children,
  dragType,
  showHeader = true,
  noPadding = false,
  noBorder = false
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  // Initialize position state slightly differently to handle async calculation
  const [position, setPosition] = useState<PositionState | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load/calculate position on mount
  useEffect(() => {
    const savedPosition = localStorage.getItem(localStorageKey);
    let finalPosition: PositionState;

    if (savedPosition) {
      try {
        const parsed = JSON.parse(savedPosition);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          finalPosition = parsed as PositionState;
          // Ensure loaded position is within bounds
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          // Estimate element size if panelRef not ready (less accurate)
          const elWidth = panelRef.current?.offsetWidth ?? 200;
          const elHeight = panelRef.current?.offsetHeight ?? 100;
          finalPosition.x = Math.max(0, Math.min(finalPosition.x, viewportWidth - elWidth));
          finalPosition.y = Math.max(0, Math.min(finalPosition.y, viewportHeight - elHeight));
        } else {
          // Saved data invalid, calculate default
          finalPosition = calculateDefaultPosition(defaultPosition, panelRef.current);
        }
      } catch (e) {
        Logger.warn("utils", new Error(`Failed to parse saved overlay position: ${e instanceof Error ? e.message : String(e)}`));
        localStorage.removeItem(localStorageKey);
        finalPosition = calculateDefaultPosition(defaultPosition, panelRef.current);
      }
    } else {
      // No saved position, calculate default
      finalPosition = calculateDefaultPosition(defaultPosition, panelRef.current);
    }

    setPosition(finalPosition);

    // Optional: Add resize listener to recalculate default position if needed,
    // but only if the position hasn't been manually moved (dragged).
    // This can be complex to manage state correctly.

  }, [localStorageKey, defaultPosition]); // Rerun if default changes

  // Save position to localStorage when it changes (and is not null)
  useEffect(() => {
    if (position) {
      localStorage.setItem(localStorageKey, JSON.stringify(position));
    }
  }, [position, localStorageKey]);

  // Configure drag functionality
  const [{ isDragging }, drag] = useDrag(() => ({
    type: dragType,
    item: () => ({
      width: panelRef.current?.offsetWidth,
      height: panelRef.current?.offsetHeight,
      isCollapsed: isCollapsed,
      title: title,
      dragType: dragType,
    }),
    collect: (monitor) => ({ isDragging: !!monitor.isDragging() }),
    end: (item, monitor) => {
      const delta = monitor.getDifferenceFromInitialOffset();
      if (delta && position) { // Check if position is not null
        setPosition((prevPos: PositionState | null) => ({
          x: Math.round((prevPos?.x ?? 0) + delta.x),
          y: Math.round((prevPos?.y ?? 0) + delta.y),
        }));
      }
    },
  }), [dragType, isCollapsed, title, position]); // Add position to dependencies

  // Connect drag ref to panel
  drag(panelRef);

  const handleToggleCollapse = () => setIsCollapsed(!isCollapsed);

  const displayTitle = !isCollapsed ? title : (collapsedTitle || title.charAt(0));

  // Don't render until position is calculated
  if (!position) {
    return null;
  }

  return (
    <IngameBorderedDiv
      ref={panelRef}
      style={{ 
        position: 'absolute', 
        top: `${position.y}px`, 
        left: `${position.x}px`, 
        opacity: isDragging ? 0 : 1,
        zIndex: zIndex
      }}
      className={cn(
        isCollapsed ? 'w-auto' : '',
        'min-w-[120px]',
        className
      )}
      noPadding={noPadding}
      noBorder={noBorder}
    >
      {showHeader && (
        <PanelHeader justify="space-between" align="center">
          <span className="text-[#ffd5ae]">{displayTitle}</span>
          <IngameTooltip content={isCollapsed ? "Expand" : "Collapse"} placement="left">
            <CollapseButton onClick={handleToggleCollapse} className="text-[#ffd5ae]">
              <FontAwesomeIcon icon={isCollapsed ? faExpandAlt : faCompressAlt} />
            </CollapseButton>
          </IngameTooltip>
        </PanelHeader>
      )}

      {(!isCollapsed || !showHeader) && children}
    </IngameBorderedDiv>
  );
};

export default BaseOverlay; 