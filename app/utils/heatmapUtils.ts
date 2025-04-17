import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import VectorSource from "ol/source/Vector";
import HeatmapLayer from "ol/layer/Heatmap";
import VectorLayer from "ol/layer/Vector";
import { Map as OLMap } from "ol";
import { Geometry } from "ol/geom";
import BaseLayer from "ol/layer/Base";
import type { AggregatedPoint } from "@server/utils/PointAggregator";
import Logger from "./Logger";

interface HeatmapData {
  points: AggregatedPoint[];
}

/**
 * Update heatmap with new data points
 * @param data Heatmap data containing points
 * @param source Vector source for the heatmap
 * @param layer Heatmap layer to update
 * @returns Whether the update was successful
 */
export const updateHeatmap = (
  data: HeatmapData | null,
  source: VectorSource,
  layer: HeatmapLayer
): boolean => {
  // CRITICAL EXECUTION PATH LOGGING
  Logger.info(
    "misc",
    `===== CRITICAL EXECUTION PATH: updateHeatmap called with ${data?.points?.length || 0} points =====`
  );
  
  if (!data) {
    Logger.debug("misc", `[HeatmapDebug] No heatmap data provided, skipping update`);
    return false;
  }
  
  const startTime = performance.now();
  Logger.debug("misc", `[HeatmapDebug] updateHeatmap called with ${data?.points?.length || 0} points`);
  
  if (!source) {
    Logger.warn(
      "misc",
      new Error(`[HeatmapDebug] Cannot update heatmap - source is not initialized`)
    );
    return false;
  }
  
  if (!layer) {
    Logger.warn(
      "misc",
      new Error(`[HeatmapDebug] Cannot update heatmap - layer is not initialized`)
    );
    return false;
  }
  
  try {
    // EXECUTION PATH TRACKING
    Logger.info(
      "misc",
      `===== CRITICAL PATH: Getting ready to update heatmap with: source=${!!source}, layer=${!!layer} =====`
    );
    
    // Clear existing features and log result
    const prevFeatureCount = source.getFeatures().length;
    
    // Only proceed with update if there's actual change in data
    const hasExistingFeatures = prevFeatureCount > 0;
    const hasNewData = data?.points?.length && data.points.length > 0;
    
    if (!hasNewData && !hasExistingFeatures) {
      // Nothing to do if no existing features and no new data
      Logger.debug("misc", `[HeatmapDebug] No change in heatmap data, skipping update`);
      return false;
    }
    
    Logger.debug("misc", `[HeatmapDebug] Clearing ${prevFeatureCount} existing features`);
    source.clear();
    
    // Process new features if available
    if (hasNewData) {
      Logger.debug("misc", `[HeatmapDebug] Processing ${data.points.length} heatmap points`);
      
      const features: Feature[] = [];
      let errorCount = 0;
      let minWeight = Infinity;
      let maxWeight = 0;
      
      // First pass to find weight range
      for (const point of data.points) {
        const weight = point.weight || 1;
        minWeight = Math.min(minWeight, weight);
        maxWeight = Math.max(maxWeight, weight);
      }
      
      Logger.debug("misc", `[HeatmapDebug] Weight range: min=${minWeight}, max=${maxWeight}`);
      
      // Create features with enhanced weights to improve visibility
      for (const point of data.points) {
        try {
          // Apply a minimum weight and normalize to make heatmap more visible
          // Boost lower values to ensure they're visible
          let weight = point.weight || 1;
          
          // Normalize weight for better heatmap visualization
          // Ensure weight is at least 0.3 for visibility
          const normalizedWeight = Math.max(0.3, weight > minWeight 
            ? 0.3 + 0.7 * ((weight - minWeight) / (maxWeight - minWeight || 1))
            : 0.3);
          
          features.push(
            new Feature({
              geometry: new Point([point.x, point.y]),
              weight: normalizedWeight,
              originalWeight: weight // Keep original for reference
            })
          );
        } catch (error) {
          errorCount++;
          if (errorCount <= 3) { // Limit error logs to avoid spam
            Logger.warn("misc", new Error(`Failed to create heatmap point at [${point.x}, ${point.y}]: ${error}`));
          }
        }
      }
      
      // Add features in batch
      if (features.length > 0) {
        Logger.debug("misc", `[HeatmapDebug] Adding ${features.length} features to heatmap source`);
        
        // Get the map from the layer
        const map = layer.get('map') as OLMap | undefined;
        
        if (map) {
          // CRITICAL: Log layers BEFORE any manipulation
          Logger.info(
            "misc",
            `===== CRITICAL PATH: Found map reference. Layer count: ${map.getLayers().getArray().length} =====`
          );
          
          // Log all layers and their visibility state before changes
          const allLayers = map.getLayers().getArray();
          allLayers.forEach((l, index) => {
            const id = l.get('id') || `unknown-${index}`;
            const type = l.get('layerType') || 'unknown';
            const visible = l.getVisible();
            Logger.info("misc", `LAYER ${index}: id=${id}, type=${type}, visible=${visible}`);
          });
          
          // Store all vector (marker) layers and their current visibility BEFORE making changes
          const vectorLayerStates = new Map<string, { layer: BaseLayer, visible: boolean, zIndex: number }>();
          
          // First identify and store layer states
          allLayers.forEach((l: BaseLayer) => {
            // We only want to store vector layers, and don't want to include our heatmap
            // Compare IDs instead of layer instances to avoid type mismatches
            if (l instanceof VectorLayer && l.get('id') !== layer.get('id')) {
              // Store a unique identifier for the layer and its visibility state
              const layerId = l.get('id') || Math.random().toString(36).substring(2, 9);
              vectorLayerStates.set(layerId, {
                layer: l,
                visible: l.getVisible(),
                zIndex: l.getZIndex() || 10
              });
              Logger.info("misc", `===== CRITICAL: Found vector layer '${layerId}', visible: ${l.getVisible()} =====`);
            }
          });
          
          // Now add features to the heatmap
          source.addFeatures(features);
          
          // Update heatmap layer properties
          layer.setZIndex(5); // Ensure heatmap is below marker layers
          layer.setVisible(true);
          source.changed();
          layer.changed();
          
          // IMPORTANT: Restore visibility for all vector layers we found
          vectorLayerStates.forEach((state, id) => {
            if (state.layer && typeof state.layer.setVisible === 'function') {
              // CRITICAL: Log before and after visibility states
              const beforeVisible = state.layer.getVisible();
              
              // CRITICAL FIX: FORCE VECTOR LAYERS TO BE VISIBLE
              state.layer.setVisible(true);
              
              if (typeof state.layer.setZIndex === 'function') {
                state.layer.setZIndex(Math.max(state.zIndex, 10)); // Ensure vector layers stay on top
              }
              
              Logger.info("misc", `===== CRITICAL: Vector layer '${id}' visibility: ${beforeVisible} -> ${state.layer.getVisible()} =====`);
            }
          });
          
          // Force map to re-render to apply all changes
          map.render();
          
          // Add extra delay and forcibly ensure all vector layers are visible
          setTimeout(() => {
            Logger.info("misc", `===== DELAYED CHECK: Ensuring vector layers remain visible =====`);
            
            const delayLayers = map.getLayers().getArray();
            delayLayers.forEach((l, index) => {
              // Check if it's a vector layer but not our heatmap layer using properties instead of type comparison
              const isVectorLayer = l instanceof VectorLayer;
              const layerId = l.get('id') || `unknown-${index}`;
              const isHeatmapLayer = l.get('id') === layer.get('id');
              
              if (isVectorLayer && !isHeatmapLayer) {
                const wasVisible = l.getVisible();
                
                // Forcibly set to visible
                l.setVisible(true);
                l.setZIndex(10);
                
                Logger.info("misc", `DELAYED FIX: Vector layer ${layerId} visibility: ${wasVisible} -> ${l.getVisible()}`);
              }
            });
            
            // Use a second additional timeout for delayed rendering
            // This helps OpenLayers properly sequence the layer rendering
            setTimeout(() => {
              Logger.info("misc", `===== SUPER DELAYED FINAL CHECK - Forcing render sequence =====`);
              // Force render again after a delay
              map.render();
              
              // Ensure vector layers are still visible and have highest z-index
              const finalLayers = map.getLayers().getArray();
              finalLayers.forEach((l, index) => {
                // Check layer type using properties instead of instance comparison
                const isVectorLayer = l instanceof VectorLayer;
                const layerId = l.get('id') || `unknown-${index}`;
                const isHeatmapLayer = l.get('id') === layer.get('id');
                
                if (isVectorLayer && !isHeatmapLayer) {
                  l.setVisible(true);
                  l.setZIndex(20); // Set even higher z-index to ensure it's on top
                  Logger.info("misc", `SUPER DELAYED FIX: Vector layer ${layerId} final visibility update`);
                }
              });
              
              // Final render attempt
              map.render();
            }, 150);
            
            // Force render again
            map.render();
          }, 200);
          
          Logger.debug("misc", `[HeatmapDebug] Heatmap updated with preserved marker layers (${vectorLayerStates.size} layers)`);
        } else {
          // Fallback if no map context available
          source.addFeatures(features);
          source.changed();
          layer.changed();
          Logger.debug("misc", `[HeatmapDebug] Heatmap layer refreshed without map context`);
        }
      } else {
        Logger.debug("misc", `[HeatmapDebug] No valid features to add`);
      }
    } else {
      Logger.debug("misc", `[HeatmapDebug] No heatmap data to process`);
    }
    
    const endTime = performance.now();
    Logger.debug("misc", `[HeatmapDebug] Heatmap update completed in ${Math.round(endTime - startTime)}ms`);
    return true;
    
  } catch (e) {
    // Log the full error with stack trace
    Logger.error("misc", new Error(`[HeatmapDebug] Critical error during heatmap update: ${e}`));
    console.error("CRITICAL HEATMAP ERROR:", e);
    return false;
  }
};

/**
 * Calculate heatmap parameters based on zoom level
 * @param zoom Current zoom level
 * @returns Parameters for heatmap rendering
 */
export const getHeatmapParams = (zoom: number) => {
  // Establish different size parameters for different zoom ranges
  if (zoom <= 2) {
    // Very zoomed out - make the heatmap spread out significantly more
    return {
      radius: 40,
      blur: 25,
      opacity: 0.98,
    };
  } else if (zoom <= 4) {
    // Moderately zoomed out - make the heatmap spread out more
    return {
      radius: 30, // Increased from 24
      blur: 20,   // Increased from 18
      opacity: 0.95, // Increased from 0.90
    };
  } else if (zoom === 5) {
    // Medium zoom - slightly less spread
    return {
      radius: 25,  // Increased from 20
      blur: 18,    // Increased from 15
      opacity: 0.90, // Increased from 0.85
    };
  } else {
    // Zoomed in - focused heatmap
    return {
      radius: 18,  // Increased from 14
      blur: 15,    // Increased from 12
      opacity: 0.85, // Increased from 0.80
    };
  }
}; 