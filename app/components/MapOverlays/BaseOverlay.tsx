import React, { useState, useEffect, useRef } from 'react';
import styled, { CSSProperties } from 'styled-components';
import { useDrag } from 'react-dnd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCompressAlt, faExpandAlt, faAnchor } from '@fortawesome/free-solid-svg-icons';
import Flex from '~/components/Flex';
import { cn } from '~/utils/twMerge';
import IngameBorderedDiv from '~/components/EthyrialStyle/IngameBorderedDiv';
import IngameTooltip from '~/components/EthyrialStyle/IngameTooltip';
import Logger from '~/utils/Logger';
import { getOverlayByStorageKey, registerOverlay } from './OverlayRegistry';

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
  id?: string; // Add optional ID for registry
}

// Default distance from edge if no offset provided
const DEFAULT_EDGE_DISTANCE = 16;

// Snap threshold in pixels - if within this distance of default position, it will snap
const SNAP_THRESHOLD = 30;

// --- Styled Components --- //
const PanelHeader = styled(Flex)`
  margin-bottom: 12px;
  font-weight: 600;
  padding: 0 4px;
  width: 100%;
  color: #ffd5ae;
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
  &:hover { background: ${(props) => props.theme.tooltipBackground || 'rgba(0,0,0,0.2)'}; }
  svg { display: block; }
`;

// New styled component for the snap indicator with higher z-index and better visibility
const SnapIndicator = styled.div<{ visible: boolean }>`
  position: absolute;
  top: -25px;
  left: 50%;
  transform: translateX(-50%);
  background: #38322c;
  border: 1px solid #ffd5ae;
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 12px;
  color: #ffd5ae;
  pointer-events: none;
  opacity: ${props => props.visible ? 1 : 0};
  transition: opacity 0.15s ease-in-out;
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  z-index: 2000;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  font-weight: bold;
`;

// Ghost element showing the snap target position
const SnapTargetGhost = styled.div<{ visible: boolean, width: number, height: number }>`
  position: absolute;
  width: ${props => props.width}px;
  height: ${props => props.height}px;
  border: 2px dashed #ffd5ae;
  background: rgba(255, 213, 174, 0.1);
  pointer-events: none;
  opacity: ${props => props.visible ? 0.8 : 0};
  transition: opacity 0.2s ease-in-out;
  z-index: 1000;
`;

// Simple collapsed panel design with fixed dimensions
const CollapsedPanel = styled.div`
  width: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #151515;
  border-radius: 4px;
  overflow: hidden;
  padding: 8px 0;
`;

// Vertical title for collapsed state
const CollapsedTitle = styled.div`
  text-align: center;
  margin-bottom: 8px;
  
  .full-title {
    color: #ffd5ae;
    font-weight: bold;
    font-size: 12px;
    padding: 0 4px;
  }
  
  .vertical-chars {
    display: flex;
    flex-direction: column;
    align-items: center;
    
    span {
      color: #ffd5ae;
      font-size: 11px;
      font-weight: bold;
      line-height: 1.3;
      padding: 1px 0;
    }
  }
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
  noBorder = false,
  id
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  // Initialize position state slightly differently to handle async calculation
  const [position, setPosition] = useState<PositionState | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [defaultPos, setDefaultPos] = useState<PositionState | null>(null);
  const [isNearDefaultPosition, setIsNearDefaultPosition] = useState(false);
  const [isDraggingInstance, setIsDraggingInstance] = useState(false);
  const [panelDimensions, setPanelDimensions] = useState({ width: 200, height: 100 });

  // Register the overlay with the registry on mount
  useEffect(() => {
    const overlayId = id || dragType;
    registerOverlay({
      id: overlayId,
      localStorageKey,
      defaultPosition,
      title
    });
  }, [id, dragType, localStorageKey, defaultPosition, title]);

  // Load/calculate position on mount
  useEffect(() => {
    const loadPosition = () => {
      const savedPosition = localStorage.getItem(localStorageKey);
      let finalPosition: PositionState;

      // Calculate default position for snapping and initial position
      const calculatedDefaultPos = calculateDefaultPosition(defaultPosition, panelRef.current);
      setDefaultPos(calculatedDefaultPos);

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
            // Saved data invalid, use default
            finalPosition = calculatedDefaultPos;
          }
        } catch (e) {
          Logger.warn("utils", new Error(`Failed to parse saved overlay position: ${e instanceof Error ? e.message : String(e)}`));
          localStorage.removeItem(localStorageKey);
          finalPosition = calculatedDefaultPos;
        }
      } else {
        // No saved position, use default
        finalPosition = calculatedDefaultPos;
      }

      setPosition(finalPosition);
    };

    // Initial load
    loadPosition();

    // Add handler for UI reset event
    const handleResetUI = () => {
      // Calculate default position and apply it immediately
      const calculatedDefaultPos = calculateDefaultPosition(defaultPosition, panelRef.current);
      setDefaultPos(calculatedDefaultPos);
      setPosition(calculatedDefaultPos);
    };

    // Listen for reset event
    window.addEventListener('reset-ui-positions', handleResetUI);
    
    // Handle window resize to recalculate default position
    const handleResize = () => {
      const calculatedDefaultPos = calculateDefaultPosition(defaultPosition, panelRef.current);
      setDefaultPos(calculatedDefaultPos);
    };
    
    window.addEventListener('resize', handleResize);

    // Clean up event listeners
    return () => {
      window.removeEventListener('reset-ui-positions', handleResetUI);
      window.removeEventListener('resize', handleResize);
    };
  }, [localStorageKey, defaultPosition]); // Rerun if default changes

  // Save position to localStorage when it changes (and is not null)
  useEffect(() => {
    if (position) {
      localStorage.setItem(localStorageKey, JSON.stringify(position));
    }
  }, [position, localStorageKey]);

  // Update panel dimensions whenever it changes
  useEffect(() => {
    if (!panelRef.current) return;
    
    const updateDimensions = () => {
      if (!panelRef.current) return;
      const rect = panelRef.current.getBoundingClientRect();
      setPanelDimensions({
        width: rect.width,
        height: rect.height
      });
    };
    
    // Initial measurement
    updateDimensions();
    
    // Set up a resize observer to track panel size changes
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(panelRef.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [isCollapsed]); // Re-run when collapsed state changes

  // Check if a position is close to the default position (for snapping)
  const isCloseToDefault = (pos: PositionState): boolean => {
    if (!defaultPos) return false;
    
    const xDistance = Math.abs(pos.x - defaultPos.x);
    const yDistance = Math.abs(pos.y - defaultPos.y);
    
    return xDistance <= SNAP_THRESHOLD && yDistance <= SNAP_THRESHOLD;
  };

  // Configure drag functionality
  const [{ isDragging }, drag] = useDrag(() => ({
    type: dragType,
    item: () => {
      // Get accurate measurements right before drag starts
      const rect = panelRef.current?.getBoundingClientRect();
      setIsDraggingInstance(true);
      
      return {
        id: localStorageKey,
        position,
        isCollapsed,
        title,
        dragType,
        // Include precise dimensions for the drag preview
        width: rect?.width || 0,
        height: rect?.height || 0
      };
    },
    collect: (monitor) => ({ isDragging: !!monitor.isDragging() }),
    end: (item, monitor) => {
      setIsDraggingInstance(false);
      setIsNearDefaultPosition(false);
      
      const delta = monitor.getDifferenceFromInitialOffset();
      if (delta && position) { // Check if position is not null
        const newPos = {
          x: Math.round((position.x) + delta.x),
          y: Math.round((position.y) + delta.y),
        };
        
        // Check if the new position is close to the default position
        if (isCloseToDefault(newPos) && defaultPos) {
          // Snap to default position
          setPosition(defaultPos);
        } else {
          // Otherwise use the new dragged position
          setPosition(newPos);
        }
      }
    },
  }), [dragType, isCollapsed, title, position, defaultPos]); // Add defaultPos to dependencies

  // Add effect to update the near default position state during dragging
  useEffect(() => {
    if (!isDragging || !position || !defaultPos) return;

    const handleDrag = (e: MouseEvent) => {
      if (!position || !defaultPos) return;
      
      // Calculate the position if the drag ended now
      // We need to account for the initial grab position offset
      const panelRect = panelRef.current?.getBoundingClientRect();
      if (!panelRect) return;
      
      // Get the current mouse position and calculate potential new position
      const potentialPos = {
        x: e.clientX - (panelRect.width / 2),
        y: e.clientY - 20, // Approximate header height offset
      };
      
      // Check if we're near the default position
      const isNear = isCloseToDefault(potentialPos);
      if (isNear !== isNearDefaultPosition) {
        setIsNearDefaultPosition(isNear);
      }
    };

    window.addEventListener('mousemove', handleDrag);
    return () => {
      window.removeEventListener('mousemove', handleDrag);
    };
  }, [isDragging, position, defaultPos, isNearDefaultPosition]);

  // Handlers
  const handleToggleCollapse = () => setIsCollapsed(!isCollapsed);

  // Don't render until position is calculated
  if (!position) {
    return null;
  }

  // Full panel style with position
  const panelStyle: CSSProperties = {
    position: 'absolute',
    left: `${position.x}px`,
    top: `${position.y}px`,
    zIndex: isCollapsed ? zIndex - 1 : zIndex,
    opacity: isDragging ? 0.6 : 1, // Make slightly transparent while dragging
  };

  // Default position snap target ghost style
  const ghostStyle: CSSProperties = defaultPos ? {
    position: 'absolute',
    left: `${defaultPos.x}px`,
    top: `${defaultPos.y}px`,
    zIndex: zIndex - 2,
    pointerEvents: 'none'
  } : {};

  // Render collapsed or expanded layout
  return (
    <>
      {/* Snap ghost target - only visible when dragging near default position */}
      {defaultPos && isDragging && (
        <SnapTargetGhost 
          visible={isNearDefaultPosition}
          width={panelDimensions.width}
          height={panelDimensions.height}
          style={ghostStyle}
        />
      )}
      
      <div
        ref={panelRef}
        className={cn("map-overlay", className)}
        style={panelStyle}
      >
        {/* The snap indicator is now placed outside but still positioned relative to the panel */}
        <SnapIndicator visible={isDraggingInstance && isNearDefaultPosition}>
          <FontAwesomeIcon icon={faAnchor} size="xs" />
          <span>Will snap</span>
        </SnapIndicator>
        
        <div ref={drag} style={{ cursor: 'grab', position: 'relative' }}>
          {isCollapsed ? (
            // Completely redesigned collapsed state
            <IngameBorderedDiv 
              noBorder={noBorder} 
              noPadding={true} 
              className="collapsed-panel"
            >
              <CollapsedPanel>
                <CollapsedTitle>
                  {collapsedTitle ? (
                    <div className="full-title">{collapsedTitle}</div>
                  ) : (
                    <div className="vertical-chars">
                      {title.split('').map((char, i) => (
                        <span key={i}>{char}</span>
                      ))}
                    </div>
                  )}
                </CollapsedTitle>
                <CollapseButton 
                  onClick={handleToggleCollapse}
                  aria-label="Expand panel"
                  style={{ color: '#ffd5ae', marginTop: 4 }}
                >
                  <FontAwesomeIcon icon={faExpandAlt} />
                </CollapseButton>
              </CollapsedPanel>
            </IngameBorderedDiv>
          ) : (
            // Expanded view
            <IngameBorderedDiv 
              noPadding={noPadding} 
              noBorder={noBorder} 
              className="transition-all duration-200 relative"
            >
              {showHeader && (
                <PanelHeader justify="space-between" align="center">
                  <div className="overflow-hidden text-ellipsis whitespace-nowrap mr-2">
                    {title}
                  </div>
                  <CollapseButton 
                    onClick={handleToggleCollapse} 
                    aria-label="Collapse panel"
                    className="text-[#ffd5ae]"
                  >
                    <FontAwesomeIcon icon={faCompressAlt} size="sm" />
                  </CollapseButton>
                </PanelHeader>
              )}
              {children}
            </IngameBorderedDiv>
          )}
        </div>
      </div>
    </>
  );
};

export default BaseOverlay; 