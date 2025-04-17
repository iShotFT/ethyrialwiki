import { Map as OLMap } from "ol";
import VectorLayer from "ol/layer/Vector";
import BaseLayer from "ol/layer/Base";
import HeatmapLayer from "ol/layer/Heatmap";
import { Geometry } from "ol/geom";
import Feature from "ol/Feature";
import VectorSource from "ol/source/Vector";
import Logger from "./Logger";

interface LayerVisibilityOptions {
  logMessages?: boolean;
}

/**
 * Ensures vector layers are visible after heatmap operations
 * @param map OpenLayers map instance
 * @param options Configuration options
 */
export const ensureLayerVisibility = (map: OLMap, options: LayerVisibilityOptions = {}): void => {
  const { logMessages = false } = options;
  
  if (!map) {
    if (logMessages) {
      Logger.warn("misc", new Error("Cannot ensure layer visibility without map reference"));
    }
    return;
  }
  
  // Get all layers in the map
  const allLayers = map.getLayers().getArray();
  
  if (logMessages) {
    Logger.info("misc", `[LayerManager] Ensuring visibility for ${allLayers.length} layers`);
  }
  
  // Process each layer
  allLayers.forEach((layer: BaseLayer, index: number) => {
    const layerId = layer.get('id') || `unknown-${index}`;
    const layerType = layer.get('layerType') || 'unknown';
    
    // We only want to ensure vector layers are visible, not heatmap layers
    if (layer instanceof VectorLayer && !(layer instanceof HeatmapLayer)) {
      const wasVisible = layer.getVisible();
      
      // Ensure vector layer is visible with high z-index
      layer.setVisible(true);
      layer.setZIndex(Math.max(layer.getZIndex() || 0, 10));
      
      if (logMessages && wasVisible !== layer.getVisible()) {
        Logger.info("misc", `[LayerManager] Updated visibility for vector layer '${layerId}': ${wasVisible} -> ${layer.getVisible()}`);
      }
    }
  });
  
  // Force map to re-render
  map.render();
};

/**
 * Refreshes vector layers to ensure they're properly displayed
 * @param map OpenLayers map instance
 */
export const refreshVectorLayers = (map: OLMap): void => {
  if (!map) {
    Logger.warn("misc", new Error("Cannot refresh vector layers without map reference"));
    return;
  }
  
  // Get all layers in the map
  const allLayers = map.getLayers().getArray();
  Logger.debug("misc", `[LayerManager] Refreshing ${allLayers.length} layers`);
  
  // Create a set to track which vector layers have been refreshed
  const refreshedLayers = new Set<string>();
  
  // Process each layer
  allLayers.forEach((layer: BaseLayer, index: number) => {
    const layerId = layer.get('id') || `unknown-${index}`;
    
    // Only refresh vector layers that aren't heatmap layers
    if (layer instanceof VectorLayer && !(layer instanceof HeatmapLayer)) {
      // Check if this layer has a source with features
      const source = layer.getSource();
      
      if (source instanceof VectorSource) {
        // Force change events to trigger rerendering
        source.changed();
        layer.changed();
        
        // Set high z-index to ensure it appears above other layers
        layer.setZIndex(Math.max(layer.getZIndex() || 0, 15));
        
        // Track that we've refreshed this layer
        refreshedLayers.add(layerId);
      }
    }
  });
  
  // Log refresh summary
  Logger.debug("misc", `[LayerManager] Refreshed ${refreshedLayers.size} vector layers`);
  
  // Force map to re-render
  map.render();
}; 