import { useRef, useCallback, useEffect, useState } from 'react';
import type { Map as OLMap } from 'ol';
import type { Coordinate } from 'ol/coordinate';
import Logger from '~/utils/Logger';

export interface MapCoords {
  x: number;
  y: number;
  z: number;
}

export interface ContextMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
  coords: MapCoords;
}

export interface UseMapInteractionsOptions {
  allowContextMenu?: boolean;
  preventClickAfterDrag?: boolean;
  dragDelayMs?: number;
}

/**
 * Hook to manage map interactions
 */
export function useMapInteractions(
  map: OLMap | null,
  options: UseMapInteractionsOptions = {}
) {
  const {
    allowContextMenu = true,
    preventClickAfterDrag = true,
    dragDelayMs = 50
  } = options;
  
  // State tracking
  const interactionState = useRef({
    isDragging: false,
    lastDragEnd: 0,
    dragCount: 0,
    quickDragAttempts: 0,
    viewUpdatesPending: 0,
  });
  
  // Context menu state
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    coords: { x: 0, y: 0, z: 0 }
  });
  
  // Track timeouts
  const timeoutIdRef = useRef<number | undefined>();
  
  // Handle context menu
  const handleContextMenu = useCallback((e: MouseEvent, coords: MapCoords) => {
    if (!allowContextMenu || !map) return;
    
    e.preventDefault();
    setContextMenuState({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      coords
    });
  }, [map, allowContextMenu]);
  
  // Close context menu
  const handleContextMenuClose = useCallback(() => {
    setContextMenuState((prev: ContextMenuState) => ({
      ...prev,
      isOpen: false
    }));
  }, []);
  
  // Set up drag tracking and context menu
  useEffect(() => {
    if (!map) return;
    
    // Add drag tracking
    const handlePointerDrag = () => {
      interactionState.current.isDragging = true;
      interactionState.current.dragCount++;
        
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        interactionState.current.viewUpdatesPending--;
      }
    };
    
    const handlePointerUp = () => {
      if (interactionState.current.isDragging) {
        const now = performance.now();
        const timeSinceLastDrag = now - interactionState.current.lastDragEnd;
          
        if (timeSinceLastDrag < 200) {
          interactionState.current.quickDragAttempts++;
        } else {
          interactionState.current.quickDragAttempts = 0;
        }
          
        setTimeout(() => {
          interactionState.current.isDragging = false;
        }, dragDelayMs);
          
        interactionState.current.lastDragEnd = now;
        interactionState.current.dragCount = 0;
      }
    };
    
    // Handle context menu
    const handleContextMenuEvent = (e: MouseEvent) => {
      if (!allowContextMenu) return;
      
      e.preventDefault();
        
      const pixel = map.getEventPixel({ clientX: e.clientX, clientY: e.clientY });
      const coord = map.getCoordinateFromPixel(pixel);
      const zoom = Math.round(map.getView().getZoom() || 0);
        
      if (coord) {
        handleContextMenu(e, {
          x: Math.round(coord[0]),
          y: Math.round(coord[1]),
          z: zoom
        });
      }
    };
    
    // Add cursor change on hover
    const handlePointerMove = (e: any) => {
      const pixel = map.getEventPixel(e.originalEvent);
      const hit = map.hasFeatureAtPixel(pixel);
      const target = map.getTargetElement();
      if (target) {
        target.style.cursor = hit ? 'pointer' : '';
      }
    };
    
    // Register event handlers
    map.on('pointerdrag', handlePointerDrag);
    map.getViewport().addEventListener('pointerup', handlePointerUp);
    map.getViewport().addEventListener('contextmenu', handleContextMenuEvent);
    map.on('pointermove', handlePointerMove);
    
    // Prevent default context menu
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };
    
    if (map.getTargetElement()) {
      map.getTargetElement().addEventListener('contextmenu', preventContextMenu);
    }
    
    // Cleanup event handlers
    return () => {
      map.un('pointerdrag', handlePointerDrag);
      map.getViewport().removeEventListener('pointerup', handlePointerUp);
      map.getViewport().removeEventListener('contextmenu', handleContextMenuEvent);
      map.un('pointermove', handlePointerMove);
      
      if (map.getTargetElement()) {
        map.getTargetElement().removeEventListener('contextmenu', preventContextMenu);
      }
      
      clearTimeout(timeoutIdRef.current);
    };
  }, [map, allowContextMenu, dragDelayMs, handleContextMenu]);
  
  // Track if a drag is in progress
  const isDragging = useCallback(() => {
    return interactionState.current.isDragging;
  }, []);
  
  return {
    isDragging,
    contextMenuState,
    handleContextMenuClose
  };
}

export default useMapInteractions; 