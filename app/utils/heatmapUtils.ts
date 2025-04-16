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
      
      // Create features
      for (const point of data.points) {
        try {
          features.push(
            new Feature({
              geometry: new Point([point.x, point.y]),
              weight: point.weight || 1,
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
        
        // Notify source of changes - simple changed() is enough
        source.changed();
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
      radius: 24,
      blur: 18,
      opacity: 0.90,
    };
  } else if (zoom === 5) {
    // Medium zoom - slightly less spread
    return {
      radius: 20,
      blur: 15,
      opacity: 0.85,
    };
  } else {
    // Zoomed in - focused heatmap
    return {
      radius: 14,
      blur: 12,
      opacity: 0.80,
    };
  }
}; 