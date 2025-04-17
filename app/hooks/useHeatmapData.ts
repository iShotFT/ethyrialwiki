import { useState, useCallback, useEffect } from 'react';
import { useMap } from './useMap';
import type { Map as OLMap } from "ol";
import type { Extent } from "ol/extent";
import { client } from "~/utils/ApiClient";
import Logger from "~/utils/Logger";
import MapStore from '~/stores/MapStore';
import { observer } from 'mobx-react';

export interface FetchHeatmapOptions {
  mapId: string;
  itemId: string;
  viewState: { zoom: number; extent: Extent };
}

/**
 * Custom hook for fetching and managing heatmap data
 */
export function useHeatmapData() {
  const { mapInstance } = useMap();
  
  // Fetch heatmap data with proper error handling
  const fetchHeatmapData = useCallback(async (options: FetchHeatmapOptions) => {
    const { mapId, itemId, viewState } = options;
    
    if (!mapId || !viewState) {
      Logger.warn(
        "utils",
        new Error("Map ID or view state not available for heatmap fetch")
      );
      return;
    }
    
    const { zoom, extent } = viewState;
    const [minX, minY, maxX, maxY] = extent;
    
    // Use integer zoom level
    const intZoom = Math.round(zoom);
    
    Logger.info("misc", `Fetching heatmap data for item ${itemId} at zoom ${intZoom}`);
    
    // Update loading state in store
    MapStore.setHeatmapLoading(true);
    
    try {
      // Construct API URL with all parameters
      const apiUrl = `/game-data/heatmap/${mapId}/${itemId}/${intZoom}?minX=${minX}&minY=${minY}&maxX=${maxX}&maxY=${maxY}`;
      
      // Fetch the data
      const response = await client.get(apiUrl, {});
      
      // Process and set the data
      const points = response.data || [];
      Logger.info("misc", `Received ${points.length} heatmap points`);
      
      // Update store with fetched data
      MapStore.setHeatmapData({ points });
      MapStore.setCurrentHeatmapItemId(itemId);
      MapStore.setHeatmapError(null);
      
    } catch (err: any) {
      // Handle and log errors
      const errorMessage = `Failed to load heatmap data: ${err.message || "Unknown error"}`;
      Logger.error("misc", new Error(errorMessage));
      MapStore.setHeatmapError(errorMessage);
      MapStore.setHeatmapData(null);
      MapStore.setCurrentHeatmapItemId(null);
    } finally {
      // Always reset loading state
      MapStore.setHeatmapLoading(false);
    }
  }, []);
  
  // Convenience method for clearing heatmap
  const clearHeatmap = useCallback(() => {
    MapStore.clearHeatmap();
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
    clearHeatmap
  };
}

// Export an observer-wrapped version for direct use in components
export const useObservedHeatmapData = observer(useHeatmapData); 