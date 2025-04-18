import { observable, action, computed, decorate } from 'mobx';
import type { Map as OLMap } from 'ol';
import type { Extent } from 'ol/extent';
import Logger from "../utils/Logger";
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
  
  // Computed properties
  get hasHeatmapData(): boolean {
    return !!this.heatmapData && Array.isArray(this.heatmapData.points) && this.heatmapData.points.length > 0;
  }
  
  // Actions
  setMapInstance(map: OLMap | null): void {
    this.mapInstance = map;
    Logger.debug("misc", `[MapStore] Map instance ${map ? 'set' : 'cleared'}`);
  }
  
  setViewState(state: ViewState): void {
    this.viewState = state;
  }
  
  setHeatmapData(data: HeatmapData | null): void {
    Logger.debug("misc", `[HEATMAP_FLOW] MapStore.setHeatmapData called with ${data?.points?.length || 0} points`);
    // Just update the state without triggering any redraws
    this.heatmapData = data;
  }
  
  setCurrentHeatmapItemId(itemId: string | null): void {
    Logger.debug("misc", `[HEATMAP_FLOW] MapStore.setCurrentHeatmapItemId: ${itemId || 'null'} (previous: ${this.currentHeatmapItemId || 'null'})`);
    this.currentHeatmapItemId = itemId;
  }
  
  setHeatmapLoading(loading: boolean): void {
    Logger.debug("misc", `[HEATMAP_FLOW] MapStore.setHeatmapLoading: ${loading}`);
    this.isLoadingHeatmap = loading;
  }
  
  setHeatmapError(error: string | null): void {
    if (error) {
      Logger.error("misc", new Error(`[HEATMAP_FLOW] MapStore heatmap error: ${error}`));
    }
    this.heatmapError = error;
  }
  
  clearHeatmap(): void {
    Logger.debug("misc", `[HEATMAP_FLOW] MapStore.clearHeatmap called`);
    this.heatmapData = null;
    this.currentHeatmapItemId = null;
    this.heatmapError = null;
  }
  
  setVisibleCategoryIds(ids: string[]): void {
    this.visibleCategoryIds = ids;
  }
  
  toggleVisibleCategory(id: string, visible: boolean): void {
    if (visible) {
      this.visibleCategoryIds = [...this.visibleCategoryIds, id];
    } else {
      this.visibleCategoryIds = this.visibleCategoryIds.filter(
        (currentId) => currentId !== id
      );
    }
  }
}

// Create and export a singleton instance
const store = new MapStore();

// Add decorators after class definition
decorate(MapStore, {
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

export default store; 