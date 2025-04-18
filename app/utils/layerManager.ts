import { Map as OLMap } from "ol";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import HeatmapLayer from "ol/layer/Heatmap";
import BaseLayer from "ol/layer/Base";
import VectorSource from "ol/source/Vector";
import type { Geometry } from "ol/geom";
import Feature from "ol/Feature";
import Logger from "./Logger";

// Layer manager options
export interface LayerManagerOptions {
  logMessages?: boolean;
}

// Shorthand for layer visibility options
export type LayerVisibilityOptions = LayerManagerOptions;

/**
 * Ensure the visibility state of all layers is preserved correctly
 * @param map OpenLayers map instance
 * @param options Optional configuration
 */
export const ensureLayerVisibility = (map: OLMap, options: LayerManagerOptions = {}) => {
  const { logMessages = false } = options;
  
  if (logMessages) {
    Logger.debug("misc", `[HEATMAP_FLOW] ensureLayerVisibility called`);
  }
  
  if (!map) {
    if (logMessages) {
      Logger.warn("misc", new Error(`[HEATMAP_FLOW] ensureLayerVisibility called with null map!`));
    }
    return;
  }
  
  // Get all layers in the map
  const allLayers = map.getLayers().getArray();
  
  if (logMessages) {
    Logger.debug("misc", `[HEATMAP_FLOW] ensureLayerVisibility processing ${allLayers.length} layers`);
  }
  
  // Track layers by type for debugging
  let markerLayers = 0;
  let heatmapLayers = 0;
  let baseLayers = 0;
  let otherLayers = 0;
  
  // Process all layers
  for (const layer of allLayers) {
    try {
      // For typed layers, set specific properties
      if (layer instanceof VectorLayer) {
        markerLayers++;
        layer.setZIndex(10); // Always ensure markers on top
        if (logMessages) {
          Logger.debug("misc", `[HEATMAP_FLOW] Vector/marker layer ${layer.get('id') || 'unknown'}: visible=${layer.getVisible()}, zIndex=${layer.getZIndex() || 'default'}`);
        }
      } else if (layer instanceof HeatmapLayer) {
        heatmapLayers++;
        layer.setZIndex(5); // Heatmap in middle
        if (logMessages) {
          Logger.debug("misc", `[HEATMAP_FLOW] Heatmap layer ${layer.get('id') || 'unknown'}: visible=${layer.getVisible()}, zIndex=${layer.getZIndex() || 'default'}`);
        }
      } else {
        // Base layer (tile layer) or other
        const layerType = layer.get('layerType') || 'unknown';
        if (layerType === 'basemap') {
          baseLayers++;
        } else {
          otherLayers++;
        }
        if (logMessages) {
          Logger.debug("misc", `[HEATMAP_FLOW] Base/other layer ${layer.get('id') || 'unknown'}: type=${layerType}, visible=${layer.getVisible()}, zIndex=${layer.getZIndex() || 'default'}`);
        }
      }
    } catch (error) {
      if (logMessages) {
        Logger.warn("misc", new Error(`[HEATMAP_FLOW] Error processing layer: ${error}`));
      }
    }
  }
  
  if (logMessages) {
    Logger.debug("misc", `[HEATMAP_FLOW] Layer summary: markers=${markerLayers}, heatmaps=${heatmapLayers}, base=${baseLayers}, other=${otherLayers}`);
  }
};

/**
 * Refresh all vector layers in the map by forcing a redraw
 * @param map OpenLayers map instance
 */
export const refreshVectorLayers = (map: OLMap) => {
  Logger.debug("misc", `[HEATMAP_FLOW] refreshVectorLayers called`);
  
  if (!map) {
    Logger.warn("misc", new Error(`[HEATMAP_FLOW] refreshVectorLayers called with null map!`));
    return;
  }
  
  // Get all layers in the map
  const allLayers = map.getLayers().getArray();
  Logger.debug("misc", `[HEATMAP_FLOW] refreshVectorLayers processing ${allLayers.length} layers`);
  
  // Specifically target vector and heatmap layers
  let updated = 0;
  
  for (const layer of allLayers) {
    try {
      if (layer instanceof VectorLayer || layer instanceof HeatmapLayer) {
        // For vector and heatmap layers, force a refresh of just that layer
        layer.changed();
        updated++;
        Logger.debug("misc", `[HEATMAP_FLOW] Refreshed layer ${layer.get('id') || 'unknown'}: type=${layer instanceof VectorLayer ? 'vector' : 'heatmap'}`);
      }
    } catch (error) {
      Logger.warn("misc", new Error(`[HEATMAP_FLOW] Error refreshing layer: ${error}`));
    }
  }
  
  Logger.debug("misc", `[HEATMAP_FLOW] refreshVectorLayers completed - updated ${updated} layers`);
}; 