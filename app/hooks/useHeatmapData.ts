import { useCallback, useRef } from 'react';
import type { Extent } from "ol/extent";
import type { Map as OLMap } from "ol";
import VectorSource from "ol/source/Vector";
import HeatmapLayer from "ol/layer/Heatmap";
import { client } from "~/utils/ApiClient";
import Logger from "~/utils/Logger";
import MapStore from '~/stores/MapStore';
import { updateHeatmap } from "~/utils/heatmapUtils";
import type { AggregatedPoint } from "@server/utils/PointAggregator";

// Performance tracking
const PERF_LOG_PREFIX = "[HEATMAP_PERF]";
let lastRequestId = 0;

// Check if performance logging is enabled (defaults to true in development, false in production)
const IS_PERF_LOGGING_ENABLED = typeof window !== 'undefined' && (
  typeof process !== 'undefined' && (
    process.env.NEXT_PUBLIC_ENABLE_HEATMAP_PERF_LOGS === 'true' || 
    (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_HEATMAP_PERF_LOGS !== 'false')
  )
);

// Helper function for conditional performance logging
function logPerformance(level: 'info' | 'debug' | 'warn' | 'error', message: string): void {
  if (IS_PERF_LOGGING_ENABLED) {
    if (level === 'error' || level === 'warn') {
      Logger[level]("misc", new Error(message));
    } else {
      // @ts-ignore - Logger types are overly strict but this works
      Logger[level]("misc", message);
    }
  }
}

export interface FetchHeatmapOptions {
  mapId: string;
  itemId: string;
  viewState: { zoom: number; extent: Extent };
  // Add direct map references to bypass React
  map?: OLMap | null;
  heatmapSource?: VectorSource | null;
  heatmapLayer?: HeatmapLayer | null;
  updateStore?: boolean;
}

/**
 * Custom hook for fetching and managing heatmap data
 * Modified to update OpenLayers directly to minimize React re-rendering
 */
export function useHeatmapData() {
  // Create refs to hold OpenLayers objects
  const mapRef = useRef<OLMap | null>(null);
  const heatmapSourceRef = useRef<VectorSource | null>(null);
  const heatmapLayerRef = useRef<HeatmapLayer | null>(null);
  const requestTimeoutRef = useRef<number | null>(null);
  
  // Add request tracking to verify if API calls are made
  const requestsStartedRef = useRef<number>(0);
  const requestsCompletedRef = useRef<number>(0);
  
  // Fetch heatmap data with proper error handling
  const fetchHeatmapData = useCallback(async (options: FetchHeatmapOptions) => {
    const requestId = ++lastRequestId;
    const startTime = performance.now();
    
    requestsStartedRef.current++;
    Logger.info("misc", `[HEATMAP_FLOW] fetchHeatmapData CALLED #${requestId} (total started: ${requestsStartedRef.current}) - itemId: ${options.itemId}, mapId: ${options.mapId}`);
    logPerformance('info', `${PERF_LOG_PREFIX} #${requestId} FETCH_CALLED - timestamp: ${startTime.toFixed(2)}ms`);
    
    const { mapId, itemId, viewState, map, heatmapSource, heatmapLayer, updateStore = true } = options;
    
    // Store map references if provided - add logging
    if (map) {
      mapRef.current = map;
      Logger.debug("misc", `[HEATMAP_FLOW] Map reference provided and stored (valid: ${!!map})`);
    }
    if (heatmapSource) {
      heatmapSourceRef.current = heatmapSource;
      Logger.debug("misc", `[HEATMAP_FLOW] Source reference provided and stored (valid: ${!!heatmapSource})`);
    }
    if (heatmapLayer) {
      heatmapLayerRef.current = heatmapLayer;
      Logger.debug("misc", `[HEATMAP_FLOW] Layer reference provided and stored (valid: ${!!heatmapLayer})`);
    }
    
    if (!mapId || !viewState) {
      Logger.warn(
        "misc",
        new Error(`[HEATMAP_FLOW] Missing required data! mapId: ${!!mapId}, viewState: ${!!viewState}`)
      );
      return;
    }
    
    // Add validation check to ensure source and layer are ready
    if (!heatmapSourceRef.current || !heatmapLayerRef.current) {
      Logger.warn(
        "misc",
        new Error(`[HEATMAP_FLOW] Heatmap source or layer refs not ready! source: ${!!heatmapSourceRef.current}, layer: ${!!heatmapLayerRef.current}`)
      );
    }
    
    // Cancel any pending request timeouts
    if (requestTimeoutRef.current) {
      logPerformance('info', `${PERF_LOG_PREFIX} #${requestId} CANCELLING_PREVIOUS_REQUEST at ${(performance.now() - startTime).toFixed(2)}ms`);
      window.clearTimeout(requestTimeoutRef.current);
    }
    
    // Log debounce start
    logPerformance('info', `${PERF_LOG_PREFIX} #${requestId} DEBOUNCE_START at ${(performance.now() - startTime).toFixed(2)}ms`);
    
    // Use timeout to debounce and prevent flashing during navigation
    requestTimeoutRef.current = window.setTimeout(async () => {
      const debounceEndTime = performance.now();
      logPerformance('info', `${PERF_LOG_PREFIX} #${requestId} DEBOUNCE_END - took ${(debounceEndTime - startTime).toFixed(2)}ms`);
      Logger.debug("misc", `[HEATMAP_FLOW] Debounce period ended, proceeding with API request for itemId: ${itemId}`);
      
      try {
        const { zoom, extent } = viewState;
        const [minX, minY, maxX, maxY] = extent;
        
        // Use integer zoom level
        const intZoom = Math.round(zoom);
        
        // Update loading state in store only if needed
        if (updateStore) {
          MapStore.setHeatmapLoading(true);
        }
        
        // Construct API URL with all parameters
        const apiUrl = `/game-data/heatmap/${mapId}/${itemId}/${intZoom}`;
        
        // Use separate params object to let the client properly format the URL
        const params = {
          minX: minX.toString(),
          minY: minY.toString(),
          maxX: maxX.toString(),
          maxY: maxY.toString()
        };
        
        logPerformance('info', `${PERF_LOG_PREFIX} #${requestId} API_REQUEST_START at ${(performance.now() - startTime).toFixed(2)}ms - URL: ${apiUrl}`);
        Logger.debug("misc", `[HEATMAP_FLOW] Making API request to ${apiUrl} with params: ${JSON.stringify(params)}`);
        
        // Track API request time
        const apiStartTime = performance.now();
        
        // Fetch the data
        const response = await client.get(apiUrl, params);
        
        const apiEndTime = performance.now();
        const apiDuration = apiEndTime - apiStartTime;
        
        // Got the data
        const points = response.data || [];
        
        logPerformance('info', `${PERF_LOG_PREFIX} #${requestId} API_REQUEST_END - took ${apiDuration.toFixed(2)}ms, received ${points.length} points at ${(performance.now() - startTime).toFixed(2)}ms`);
        Logger.debug("misc", `[HEATMAP_FLOW] API response received with ${points.length} points for itemId: ${itemId}`);
        
        // Track update time
        const updateStartTime = performance.now();
        
        // CRITICAL: Update OpenLayers directly if possible to avoid React re-renders
        let updateSuccess = false;
        if (heatmapSourceRef.current && heatmapLayerRef.current) {
          // Log before update
          logPerformance('info', `${PERF_LOG_PREFIX} #${requestId} UPDATE_HEATMAP_START at ${(performance.now() - startTime).toFixed(2)}ms`);
          Logger.debug("misc", `[HEATMAP_FLOW] Updating heatmap with ${points.length} points directly`);
          
          // Update the heatmap directly in OpenLayers
          updateSuccess = updateHeatmap({ points }, heatmapSourceRef.current, heatmapLayerRef.current, mapRef.current);
          
          const updateEndTime = performance.now();
          logPerformance('info', `${PERF_LOG_PREFIX} #${requestId} UPDATE_HEATMAP_END - took ${(updateEndTime - updateStartTime).toFixed(2)}ms`);
        } else {
          Logger.warn("misc", new Error(`[HEATMAP_FLOW] Missing heatmap refs! source: ${!!heatmapSourceRef.current}, layer: ${!!heatmapLayerRef.current}`));
        }
        
        // Update store with minimal changes only if requested and update was successful
        if (updateSuccess) {
          // Always update the current item ID for UI state, regardless of updateStore flag
          MapStore.setCurrentHeatmapItemId(itemId);
          
          if (updateStore) {
            logPerformance('info', `${PERF_LOG_PREFIX} #${requestId} STORE_UPDATE_START at ${(performance.now() - startTime).toFixed(2)}ms`);
            Logger.debug("misc", `[HEATMAP_FLOW] Updating MapStore with ${points.length} points for itemId: ${itemId}`);
            
            // Convert points to the format expected by MapStore
            const storePoints: Array<[number, number, number]> = points.map((point: AggregatedPoint) => [
              point.x, 
              point.y, 
              point.weight || 1
            ]);
            
            // Update store with the converted points
            MapStore.setHeatmapData({ points: storePoints });
            MapStore.setHeatmapError(null);
            
            logPerformance('info', `${PERF_LOG_PREFIX} #${requestId} STORE_UPDATE_END at ${(performance.now() - startTime).toFixed(2)}ms`);
          }
        }
        
        // Complete time
        const totalTime = performance.now() - startTime;
        requestsCompletedRef.current++;
        logPerformance('info', `${PERF_LOG_PREFIX} #${requestId} FETCH_COMPLETE - total time: ${totalTime.toFixed(2)}ms`);
        Logger.info("misc", `[HEATMAP_FLOW] Heatmap fetch complete for itemId: ${itemId} (completed ${requestsCompletedRef.current}/${requestsStartedRef.current} requests)`);
        
      } catch (err: any) {
        // Handle and log errors
        const errorMessage = `Failed to load heatmap data: ${err.message || "Unknown error"}`;
        Logger.error("misc", new Error(errorMessage));
        Logger.error("misc", new Error(`[HEATMAP_FLOW] Error fetching heatmap: ${errorMessage}`));
        
        if (updateStore) {
          MapStore.setHeatmapError(errorMessage);
          MapStore.setHeatmapData(null);
          MapStore.setCurrentHeatmapItemId(null);
        }
      } finally {
        // Always reset loading state if we're updating the store
        if (updateStore) {
          MapStore.setHeatmapLoading(false);
        }
      }
    }, 50); // Reduced debounce time for faster response
  }, []);
  
  // Convenience method for clearing heatmap
  const clearHeatmap = useCallback(() => {
    Logger.info("misc", `[HEATMAP_FLOW] clearHeatmap called`);
    
    // Clear the heatmap source first to avoid redraw when hiding
    if (heatmapSourceRef.current) {
      heatmapSourceRef.current.clear();
      Logger.debug("misc", `[HEATMAP_FLOW] Heatmap source cleared`);
    } else {
      Logger.warn("misc", new Error(`[HEATMAP_FLOW] Cannot clear heatmap - source ref is null`));
    }
    
    // Then explicitly hide the layer after source is cleared
    if (heatmapLayerRef.current) {
      heatmapLayerRef.current.setVisible(false);
      Logger.debug("misc", `[HEATMAP_FLOW] Heatmap layer visibility set to false`);
    } else {
      Logger.warn("misc", new Error(`[HEATMAP_FLOW] Cannot clear heatmap - layer ref is null`));
    }
    
    // Also update store
    MapStore.clearHeatmap();
    Logger.debug("misc", `[HEATMAP_FLOW] MapStore heatmap data cleared`);
  }, []);
  
  return {
    // State accessed from store
    heatmapData: MapStore.heatmapData,
    currentHeatmapItemId: MapStore.currentHeatmapItemId,
    isLoading: MapStore.isLoadingHeatmap,
    error: MapStore.heatmapError,
    hasData: MapStore.hasHeatmapData,
    
    // Methods
    fetchHeatmapData,
    clearHeatmap,
    
    // Expose refs for direct access
    mapRef,
    heatmapSourceRef,
    heatmapLayerRef
  };
}

// No need for observer wrapper - use observer() directly in components instead 