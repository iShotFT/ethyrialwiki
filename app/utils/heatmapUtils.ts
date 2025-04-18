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

// For tracking heatmap updates
const PERF_LOG_PREFIX = "[HEATMAP_RENDER_PERF]";
let lastUpdateId = 0;

interface HeatmapData {
  points: AggregatedPoint[];
}

/**
 * Ultra high-visibility gradient with maximum intensity colors
 * Each color step has been intensified for better visibility at all zoom levels
 */
export const ETHYRIAL_GRADIENT = [
  'rgba(255, 255, 255, 0)',    // Transparent
  'rgba(255, 255, 255, 0.85)', // Nearly opaque white
  'rgba(255, 236, 139, 0.9)',  // Bright yellow
  'rgba(255, 215, 0, 0.95)',   // Vibrant gold
  'rgba(255, 165, 0, 1)',      // Pure orange
  'rgba(255, 69, 0, 1)',       // Red-orange (stronger)
  'rgba(255, 0, 0, 1)',        // Pure red
  'rgba(255, 20, 147, 1)',     // Deep pink
  'rgba(128, 0, 255, 1)',      // Vibrant purple
  'rgba(255, 255, 255, 1)'     // Center white
];

/**
 * Update heatmap with new data points using an advanced approach that preserves all layers
 * Enhanced version with improved visibility at all zoom levels
 * @param data Heatmap data containing points
 * @param source Vector source for the heatmap
 * @param layer Heatmap layer to update
 * @param map Optional map reference for explicit rendering
 * @returns Whether the update was successful
 */
export const updateHeatmap = (
  data: HeatmapData | null,
  source: VectorSource,
  layer: HeatmapLayer,
  map?: OLMap | null
): boolean => {
  const updateId = ++lastUpdateId;
  const startTime = performance.now();
  
  Logger.debug("misc", `${PERF_LOG_PREFIX} #${updateId} UPDATE_START - ${data?.points?.length || 0} points - timestamp: ${startTime.toFixed(2)}ms`);
  Logger.debug("misc", `[HEATMAP_FLOW] updateHeatmap called with ${data?.points?.length || 0} points, map: ${!!map}`);
  
  try {
    // No data case - hide layer but don't modify source
    if (!data || !data.points || data.points.length === 0) {
      if (layer) {
        layer.setVisible(false);
        Logger.debug("misc", `${PERF_LOG_PREFIX} #${updateId} NO_DATA_HIDE - ${(performance.now() - startTime).toFixed(2)}ms`);
        Logger.debug("misc", `[HEATMAP_FLOW] No data provided, hiding heatmap layer`);
      }
      return false;
    }
    
    // Validate required objects
    if (!source || !layer) {
      Logger.warn("misc", new Error(`${PERF_LOG_PREFIX} #${updateId} MISSING_OBJECTS at ${(performance.now() - startTime).toFixed(2)}ms`));
      Logger.warn("misc", new Error(`[HEATMAP_FLOW] Missing required objects for heatmap update! source: ${!!source}, layer: ${!!layer}`));
      return false;
    }
    
    // Explicitly force our gradient - this is crucial for visibility
    layer.setGradient(ETHYRIAL_GRADIENT);
    
    // Get zoom-based parameters for proper styling
    const zoom = map ? Math.round(map.getView().getZoom() || 0) : 6; // Default to higher zoom if no map
    const params = getHeatmapParams(zoom);
    
    // Apply parameters directly and forcefully
    layer.setRadius(params.radius);
    layer.setBlur(params.blur);
    layer.setOpacity(params.opacity);
    
    Logger.debug("misc", `[HEATMAP_FLOW] Applied zoom-based parameters: radius=${params.radius}, blur=${params.blur}, opacity=${params.opacity}`);
    
    // Create features array directly
    const featureStartTime = performance.now();
    Logger.debug("misc", `${PERF_LOG_PREFIX} #${updateId} FEATURE_CREATION_START at ${(featureStartTime - startTime).toFixed(2)}ms`);
    Logger.debug("misc", `[HEATMAP_FLOW] Creating ${data.points.length} features for heatmap`);
    
    const features: Feature<Geometry>[] = [];
    const points = data.points;
    
    // Always normalize the weights for better visibility
    let minWeight = Infinity;
    let maxWeight = 0;
    
    // First pass to find min/max values
    for (const point of points) {
      const weight = point.weight || 1;
      minWeight = Math.min(minWeight, weight);
      maxWeight = Math.max(maxWeight, weight);
    }
    
    // Handle edge case of all points having same weight
    const weightRange = maxWeight - minWeight;
    const hasVariation = weightRange > 0.001;
    
    // Second pass to create enhanced normalized features
    for (const point of points) {
      try {
        const originalWeight = point.weight || 1;
        
        // Apply enhanced normalization for better visibility
        let normalizedWeight;
        
        if (!hasVariation) {
          // If all weights are the same, use a relatively high weight
          normalizedWeight = 0.8; // Higher base weight for better visibility
        } else {
          // Scale from 0-1
          const percentile = (originalWeight - minWeight) / weightRange;
          
          // Apply a curve that boosts mid-range and higher values
          // This makes more points visible while still maintaining differentiation
          normalizedWeight = Math.pow(percentile, 0.8) * 0.9;
          
          // Ensure stronger minimum weight for better visibility
          normalizedWeight = Math.max(0.5, normalizedWeight);
        }
        
        features.push(
          new Feature({
            geometry: new Point([point.x, point.y]),
            weight: normalizedWeight
          })
        );
      } catch (error) {
        // Skip error features
      }
    }
    
    const featureEndTime = performance.now();
    Logger.debug("misc", `${PERF_LOG_PREFIX} #${updateId} FEATURE_CREATION_END - created ${features.length} features in ${(featureEndTime - featureStartTime).toFixed(2)}ms`);
    Logger.debug("misc", `[HEATMAP_FLOW] Created ${features.length} features in ${(featureEndTime - featureStartTime).toFixed(2)}ms`);
    
    // Start source update
    const sourceUpdateStart = performance.now();
    Logger.debug("misc", `${PERF_LOG_PREFIX} #${updateId} SOURCE_UPDATE_START at ${(sourceUpdateStart - startTime).toFixed(2)}ms`);
    Logger.debug("misc", `[HEATMAP_FLOW] Updating vector source with ${features.length} features`);
    
    // Update source directly without hiding the layer
    source.clear();
    source.addFeatures(features);
    
    const sourceUpdateEnd = performance.now();
    Logger.debug("misc", `${PERF_LOG_PREFIX} #${updateId} SOURCE_UPDATE_END - took ${(sourceUpdateEnd - sourceUpdateStart).toFixed(2)}ms`);
    Logger.debug("misc", `[HEATMAP_FLOW] Vector source updated in ${(sourceUpdateEnd - sourceUpdateStart).toFixed(2)}ms`);
    
    // Set basic properties
    layer.setZIndex(5);
    
    // Always make layer visible when we have data
    layer.setVisible(true);
    
    // Force the layer to redraw
    layer.changed();
    
    if (map) {
      // Trigger a map render to ensure changes are visible
      map.render();
    }
    
    Logger.debug("misc", `[HEATMAP_FLOW] Heatmap layer visibility set to true and layer changed triggered`);
    
    // Log total time
    const totalTime = performance.now() - startTime;
    Logger.debug("misc", `${PERF_LOG_PREFIX} #${updateId} UPDATE_COMPLETE - total time: ${totalTime.toFixed(2)}ms`);
    Logger.info("misc", `[HEATMAP_FLOW] Heatmap update completed in ${totalTime.toFixed(2)}ms for ${features.length} features`);
    
    return true;
  } catch (e) {
    const errorTime = performance.now() - startTime;
    Logger.error("misc", new Error(`${PERF_LOG_PREFIX} #${updateId} ERROR at ${errorTime.toFixed(2)}ms: ${e}`));
    Logger.error("misc", new Error(`[HEATMAP_FLOW] Error updating heatmap: ${e}`));
    return false;
  }
};

/**
 * Calculate heatmap parameters based on zoom level
 * @param zoom Current zoom level
 * @returns Parameters for heatmap rendering
 */
export const getHeatmapParams = (zoom: number) => {
  Logger.debug("misc", `[HEATMAP_FLOW] Getting heatmap parameters for zoom level ${zoom}`);
  
  // Enhanced parameters for Ethyrial-themed heatmap 
  // Slightly increased blur to create a more glowing effect that matches the UI
  if (zoom <= 2) {
    // Very zoomed out - make the heatmap spread out significantly more
    return {
      radius: 45,     // Increased for better visibility
      blur: 30,       // More blur for a softer glow
      opacity: 0.95,  // Slightly reduced for better blend
    };
  } else if (zoom <= 4) {
    // Moderately zoomed out - make the heatmap spread out more
    return {
      radius: 35,     // Increased for better visibility 
      blur: 25,       // More blur for softer edges
      opacity: 0.92,  // Slight opacity adjustment
    };
  } else if (zoom === 5) {
    // Medium zoom - slightly less spread
    return {
      radius: 28,     // Increased for better visibility
      blur: 22,       // More blur for softer edges
      opacity: 0.88,  // Balanced opacity
    };
  } else {
    // Zoomed in - focused heatmap with glow effect
    return {
      radius: 22,     // Increased for better visibility
      blur: 18,       // More blur for a softer glow effect
      opacity: 0.85,  // Maintained opacity
    };
  }
}; 