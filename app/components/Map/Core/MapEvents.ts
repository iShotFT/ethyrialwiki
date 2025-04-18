import type { Map as OLMap } from 'ol';
import type { Extent } from 'ol/extent';
import Logger from '~/utils/Logger';
import MapStore from '~/stores/MapStore';
import { updateMapHashWithZ } from '../URL/HashManager';

interface SetupViewChangeOptions {
  onViewChange?: (zoom: number, extent: Extent) => void;
  debounceMs?: number;
  updateHash?: boolean;
  selectedResourceId?: string | null;
  currentZLayer?: number;
}

/**
 * Setup handlers for view changes (zoom/pan)
 */
export function setupViewChangeHandlers(
  map: OLMap,
  options: SetupViewChangeOptions
): () => void {
  const {
    onViewChange,
    debounceMs = 100,
    updateHash = true,
    selectedResourceId = null,
    currentZLayer = 1,
  } = options;
  
  const interactionState = {
    isDragging: false,
    lastDragEnd: 0,
    viewUpdatesPending: 0,
  };
  
  let timeoutId: number | undefined;
  
  // Track dragging state
  const handlePointerDrag = () => {
    interactionState.isDragging = true;
    
    if (timeoutId) {
      clearTimeout(timeoutId);
      interactionState.viewUpdatesPending--;
    }
  };
  
  const handlePointerUp = () => {
    setTimeout(() => {
      interactionState.isDragging = false;
    }, 50);
    
    interactionState.lastDragEnd = performance.now();
  };
  
  // Handle view changes
  const handleMoveEnd = () => {
    if (interactionState.isDragging) {
      return;
    }
    
    if (map.getTargetElement()) {
      map.getTargetElement().style.pointerEvents = 'auto';
    }
    
    if (timeoutId) {
      clearTimeout(timeoutId);
      interactionState.viewUpdatesPending--;
    }
    
    interactionState.viewUpdatesPending++;
    timeoutId = window.setTimeout(() => {
      try {
        interactionState.viewUpdatesPending--;
        
        const currentView = map.getView();
        const zoom = currentView.getZoom();
        const center = currentView.getCenter();
        
        if (center && zoom !== undefined) {
          if (interactionState.viewUpdatesPending > 0) return;
          
          // Update URL hash
          if (updateHash) {
            updateMapHashWithZ(
              Math.round(zoom),
              center as [number, number],
              currentZLayer,
              selectedResourceId || undefined
            );
          }
        }
        
        // Call the view change callback
        if (onViewChange && zoom !== undefined && !interactionState.isDragging) {
          if (interactionState.viewUpdatesPending > 0) return;
          
          const extent = currentView.calculateExtent(map.getSize());
          onViewChange(Math.round(zoom), extent);
          
          // Update MapStore's view state
          MapStore.setViewState({
            zoom: Math.round(zoom),
            extent
          });
        }
      } catch (error) {
        Logger.error('misc', new Error(`Error in moveEnd handler: ${error}`));
      }
    }, debounceMs);
  };
  
  // Register handlers
  map.on('pointerdrag', handlePointerDrag);
  map.getViewport().addEventListener('pointerup', handlePointerUp);
  map.on('moveend', handleMoveEnd);
  
  // Return cleanup function
  return () => {
    map.un('pointerdrag', handlePointerDrag);
    map.getViewport().removeEventListener('pointerup', handlePointerUp);
    map.un('moveend', handleMoveEnd);
    clearTimeout(timeoutId);
  };
}

export default {
  setupViewChangeHandlers,
}; 