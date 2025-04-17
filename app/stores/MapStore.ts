import { observable, action, computed, makeObservable } from 'mobx';
import type { Map as OLMap } from 'ol';
import type { Extent } from 'ol/extent';
import Logger from "../utils/Logger";
import { ensureLayerVisibility, refreshVectorLayers } from "~/utils/layerManager";
import type { AggregatedPoint } from "@server/utils/PointAggregator";

// Types
export interface HeatmapData {
  points: Array<[number, number, number]>; // [x, y, weight]
}

export interface ViewState {
  zoom: number;
  extent: Extent;
}

/**
 * Store for managing map-related state
 */
class MapStore {
  // Map instance
  mapInstance: OLMap | null = null;
  
  // View state
  viewState: ViewState | null = null;
  
  // Heatmap data
  heatmapData: HeatmapData | null = null;
  currentHeatmapItemId: string | null = null;
  isLoadingHeatmap: boolean = false;
  heatmapError: string | null = null;
  
  // Layer visibility
  visibleCategoryIds: string[] = [];
  
  constructor() {
    makeObservable(this, {
      // Properties
      mapInstance: observable,
      viewState: observable,
      heatmapData: observable,
      currentHeatmapItemId: observable,
      isLoadingHeatmap: observable,
      heatmapError: observable,
      visibleCategoryIds: observable,
      
      // Computed
      hasHeatmapData: computed,
      
      // Actions
      setMapInstance: action,
      setViewState: action,
      setHeatmapData: action,
      setCurrentHeatmapItemId: action,
      setHeatmapLoading: action,
      setHeatmapError: action,
      clearHeatmap: action,
      setVisibleCategoryIds: action,
      toggleVisibleCategory: action,
    });
  }
  
  // Computed properties
  get hasHeatmapData(): boolean {
    return !!this.heatmapData && Array.isArray(this.heatmapData.points) && this.heatmapData.points.length > 0;
  }
  
  // Actions
  setMapInstance(map: OLMap | null): void {
    this.mapInstance = map;
    Logger.debug("misc", `[MapStore] Map instance ${map ? 'set' : 'cleared'}`);
  }
  
  setViewState(viewState: ViewState | null): void {
    this.viewState = viewState;
  }
  
  setHeatmapData(data: HeatmapData | null): void {
    this.heatmapData = data;
    
    // If setting heatmap data, ensure proper layer visibility
    if (data && this.mapInstance) {
      ensureLayerVisibility(this.mapInstance, { logMessages: true });
      
      // Use timeout to ensure rendering issues are fixed
      setTimeout(() => {
        if (this.mapInstance) {
          refreshVectorLayers(this.mapInstance);
        }
      }, 100);
    }
  }
  
  setCurrentHeatmapItemId(itemId: string | null): void {
    this.currentHeatmapItemId = itemId;
  }
  
  setHeatmapLoading(loading: boolean): void {
    this.isLoadingHeatmap = loading;
  }
  
  setHeatmapError(error: string | null): void {
    this.heatmapError = error;
  }
  
  clearHeatmap(): void {
    this.heatmapData = null;
    this.currentHeatmapItemId = null;
    this.heatmapError = null;
  }
  
  setVisibleCategoryIds(categoryIds: string[]): void {
    this.visibleCategoryIds = [...categoryIds];
  }
  
  toggleVisibleCategory(categoryId: string): void {
    if (this.visibleCategoryIds.includes(categoryId)) {
      this.visibleCategoryIds = this.visibleCategoryIds.filter(id => id !== categoryId);
    } else {
      this.visibleCategoryIds = [...this.visibleCategoryIds, categoryId];
    }
  }
}

// Export as singleton
export default new MapStore(); 