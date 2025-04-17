import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronUp, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import IngameBorderedDiv from './IngameBorderedDiv';
import Logger from '../../utils/Logger';

// Min and max Z values for the map
const MIN_Z_LAYER = -3;
const MAX_Z_LAYER = 40;

// Storage key for position persistence
const POSITION_STORAGE_KEY = 'ethyrial-z-layer-control-position';
const OVERLAY_DISTANCE = 16; // Consistent D-value for overlay positioning

interface ZLayerControlProps {
  currentZLayer: number;
  onChange: (zLayer: number) => void;
}

// Use a simpler positioning approach with absolute pixels
const ControlContainer = styled.div<{ $left: number; $top: number }>`
  position: absolute;
  left: ${props => props.$left}px;
  top: ${props => props.$top}px;
  width: 44px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: grab;
  user-select: none;
  
  &:active {
    cursor: grabbing;
  }
`;

const ZControlInner = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  background-color: #1A1A1A;
  color: #e0e0e0;
  font-family: 'Asul', sans-serif;
  padding: 0;
  overflow: hidden;
`;

const ControlButton = styled.button`
  width: 100%;
  padding: 8px 0;
  background-color: #2c2824;
  color: #e0e0e0;
  border: none;
  outline: none;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1px solid #4e443a;
  border-bottom: 1px solid #1A1A1A;

  &:hover {
    background-color: #4e443a;
    color: #ffd5ae;
  }

  &:active {
    background-color: #5a524a;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ZValueDisplay = styled.div`
  width: 100%;
  padding: 10px 0;
  font-size: 16px;
  font-weight: bold;
  text-align: center;
  border-top: 1px solid #1A1A1A;
  border-bottom: 1px solid #1A1A1A;
  background-color: #151515;
  color: #ffd5ae;
  border-left: 1px solid #4e443a;
  border-right: 1px solid #2c2824;
`;

/**
 * ZLayerControl component that displays a vertical slider to control the Z-layer of the map
 * with drag-and-drop capability for repositioning
 */
const ZLayerControl: React.FC<ZLayerControlProps> = ({ currentZLayer, onChange }) => {
  // Initialize position from localStorage, with fallback to default position
  const [position, setPosition] = useState<{ left: number; top: number }>(() => {
    try {
      const savedPosition = localStorage.getItem(POSITION_STORAGE_KEY);
      if (savedPosition) {
        const parsed = JSON.parse(savedPosition);
        // Ensure position is within viewport bounds
        return {
          left: Math.min(Math.max(parsed.left, 0), window.innerWidth - 100),
          top: Math.min(Math.max(parsed.top, 0), window.innerHeight - 100)
        };
      }
    } catch (e) {
      Logger.warn("misc", new Error(`Failed to parse saved Z-layer control position: ${e}`));
    }
    // Default position: middle of the y-axis and consistent distance from right
    return { 
      left: window.innerWidth - 60 - OVERLAY_DISTANCE, 
      top: Math.max(window.innerHeight / 2 - 75, OVERLAY_DISTANCE) 
    };
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const controlRef = useRef<HTMLDivElement>(null);
  
  // Guard against invalid values
  const safeZLayer = Math.min(Math.max(currentZLayer, MIN_Z_LAYER), MAX_Z_LAYER);
  
  const handleIncrement = useCallback(() => {
    if (safeZLayer < MAX_Z_LAYER) {
      onChange(safeZLayer + 1);
    }
  }, [safeZLayer, onChange]);

  const handleDecrement = useCallback(() => {
    if (safeZLayer > MIN_Z_LAYER) {
      onChange(safeZLayer - 1);
    }
  }, [safeZLayer, onChange]);

  // Function to update position and save to localStorage
  const updatePosition = useCallback((newPos: { left: number; top: number }) => {
    // Constrain position to stay within viewport
    const constrainedPos = {
      left: Math.min(Math.max(newPos.left, 0), window.innerWidth - 100),
      top: Math.min(Math.max(newPos.top, 0), window.innerHeight - 100)
    };
    
    setPosition(constrainedPos);
    
    // Save to localStorage with error handling
    try {
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(constrainedPos));
    } catch (e) {
      Logger.warn("misc", new Error(`Failed to save Z-layer control position: ${e}`));
    }
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if no input elements are focused
      if (document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'PageUp') {
        handleIncrement();
      } else if (e.key === 'PageDown') {
        handleDecrement();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleIncrement, handleDecrement]);

  // Mouse event handlers for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragOffset.x = e.clientX - position.left;
    dragOffset.y = e.clientY - position.top;
    e.preventDefault();
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    updatePosition({ 
      left: e.clientX - dragOffset.x, 
      top: e.clientY - dragOffset.y 
    });
  }, [isDragging, dragOffset, updatePosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add and remove event listeners for mouse events
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Touch event handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    const touch = e.touches[0];
    dragOffset.x = touch.clientX - position.left;
    dragOffset.y = touch.clientY - position.top;
    e.preventDefault();
  }, [position]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    updatePosition({ 
      left: touch.clientX - dragOffset.x, 
      top: touch.clientY - dragOffset.y 
    });
  }, [isDragging, dragOffset, updatePosition]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add and remove event listeners for touch events
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
      window.addEventListener('touchcancel', handleTouchEnd);
    }
    
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isDragging, handleTouchMove, handleTouchEnd]);

  // Handle window resize to keep component in bounds
  useEffect(() => {
    const handleResize = () => {
      updatePosition({
        left: Math.min(position.left, window.innerWidth - 100),
        top: Math.min(position.top, window.innerHeight - 100)
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position.left, position.top, updatePosition]);

  return (
    <ControlContainer 
      ref={controlRef}
      $left={position.left}
      $top={position.top}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <IngameBorderedDiv noPadding={true} style={{ overflow: 'hidden', width: '100%' }}>
        <ZControlInner>
          <ControlButton 
            onClick={handleIncrement}
            disabled={safeZLayer >= MAX_Z_LAYER}
            title="Move up one Z-layer"
          >
            <FontAwesomeIcon icon={faChevronUp} />
          </ControlButton>
          
          <ZValueDisplay title={`Current Z-layer: ${safeZLayer}`}>
            {safeZLayer}
          </ZValueDisplay>
          
          <ControlButton 
            onClick={handleDecrement}
            disabled={safeZLayer <= MIN_Z_LAYER}
            title="Move down one Z-layer"
          >
            <FontAwesomeIcon icon={faChevronDown} />
          </ControlButton>
        </ZControlInner>
      </IngameBorderedDiv>
    </ControlContainer>
  );
};

export default ZLayerControl; 