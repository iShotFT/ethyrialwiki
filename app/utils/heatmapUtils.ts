import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import VectorSource from "ol/source/Vector";
import HeatmapLayer from "ol/layer/Heatmap";
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
        source.addFeatures(features);
        
        // Force the layer to refresh properly
        layer.setVisible(false);
        
        // Use a small timeout to ensure DOM updates
        setTimeout(() => {
          // Make the layer visible again
          layer.setVisible(true);
          
          // Force source changed signal
          source.changed();
          
          // Force a layer redraw
          layer.changed();
          
          Logger.debug("misc", `[HeatmapDebug] Forced heatmap layer visibility toggle to refresh rendering`);
        }, 50);
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
    Logger.error("misc", new Error(`[HeatmapDebug] Critical error during heatmap update: ${e}`));
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
  if (zoom <= 4) {
    // Very zoomed out - make the heatmap spread out more
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