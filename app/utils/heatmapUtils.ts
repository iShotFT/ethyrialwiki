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
 * Ethyrial-themed gradient using vibrant game-inspired colors for maximum visibility
 * Enhanced colors for better heatmap distinction
 */
export const ETHYRIAL_GRADIENT = [
  'rgba(15, 32, 69, 0.83)',     // Deep midnight blue
  'rgba(30, 58, 112, 0.85)',    // Royal night blue
  'rgba(44, 92, 148, 0.87)',    // Ocean blue
  'rgba(67, 134, 169, 0.89)',   // Steel blue
  'rgba(88, 157, 165, 0.91)',   // Teal
  'rgba(121, 175, 147, 0.92)',  // Sea green
  'rgba(166, 188, 118, 0.93)',  // Sage green
  'rgba(211, 201, 88, 0.95)',   // Gold yellow
  'rgba(238, 193, 56, 0.97)',   // Bright gold
  'rgba(251, 161, 41, 0.98)',   // Amber
  'rgba(248, 102, 36, 1.0)'     // Ethyrial orange
];

/**
 * Update heatmap with new data points using an advanced approach that preserves all layers
 * Enhanced version with improved visibility at all zoom levels and intelligent data utilization
 * @param data Heatmap data containing points with count and cellSize information
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
    
    // Create features from points
    const featureStartTime = performance.now();
    Logger.debug("misc", `${PERF_LOG_PREFIX} #${updateId} FEATURE_CREATION_START at ${(featureStartTime - startTime).toFixed(2)}ms`);
    Logger.debug("misc", `[HEATMAP_FLOW] Creating ${data.points.length} features for heatmap`);
    
    const features: Feature<Geometry>[] = [];
    const points = data.points;
    
    // Calculate zoom-based intensity factor to boost weights at higher zoom levels
    // At low zoom: normal weights, at high zoom: dramatically boosted weights
    const zoomIntensityFactor = Math.min(1.0 + (zoom - 3) * 0.15, 1.7);
    Logger.debug("misc", `[HEATMAP_FLOW] Using zoom intensity factor: ${zoomIntensityFactor.toFixed(2)} for zoom ${zoom}`);
    
    // Create features with high-visibility weight values that scale with zoom
    for (const point of points) {
      try {
        // Get the raw data
        const baseWeight = point.weight || 1;
        const count = 'count' in point ? point.count : 1;
        const cellSize = 'cellSize' in point ? point.cellSize : 50;
        
        // Use high-visibility weight values that scale with zoom level
        let smartWeight;
        
        // Different handling based on count with much higher base weights at higher zooms
        if (count <= 1) {
          // Single item - zoom-boosted medium intensity
          smartWeight = Math.min(baseWeight * 0.55 * zoomIntensityFactor, 0.8);
        } else if (count <= 3) {
          // Very small cluster (2-3) - zoom-boosted medium-high intensity
          smartWeight = Math.min((0.6 + (count * 0.05)) * zoomIntensityFactor, 0.85);
        } else if (count <= 7) {
          // Small cluster (4-7) - zoom-boosted high intensity
          smartWeight = Math.min((0.75 + ((count - 3) * 0.03)) * zoomIntensityFactor, 0.9);
        } else if (count <= 15) {
          // Medium cluster (8-15) - zoom-boosted very high intensity
          smartWeight = Math.min((0.85 + ((count - 7) * 0.01)) * zoomIntensityFactor, 0.95);
        } else if (count <= 30) {
          // Large cluster (16-30) - zoom-boosted near maximum intensity
          smartWeight = Math.min((0.9 + ((count - 15) * 0.003)) * zoomIntensityFactor, 0.98);
        } else {
          // Massive cluster (31+) - zoom-boosted maximum intensity
          smartWeight = Math.min(0.99 * zoomIntensityFactor, 1.0);
        }
        
        // Create a feature with the enhanced weight
        const feature = new Feature({
          geometry: new Point([point.x, point.y]),
          weight: smartWeight,
          // Store original data for potential tooltips or label rendering
          originalCount: count,
          originalWeight: baseWeight,
          cellSize: cellSize,
          // Store zoom level when the feature was created
          createdAtZoom: zoom
        });
        
        // Apply dynamic radius adjustment based on count and cellSize
        const radiusAdjustment = getRadiusAdjustmentFactor(
          typeof count === 'number' ? count : 1,
          typeof cellSize === 'number' ? cellSize : 50,
          zoom
        );
        
        // Set a custom radius factor on the feature
        if (radiusAdjustment !== 1.0) {
          feature.set('radiusFactor', radiusAdjustment);
        }
        
        features.push(feature);
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
 * Calculate radius adjustment based on count and cellSize
 * @param count Number of items at this point
 * @param cellSize Size of the aggregation cell
 * @param zoom Current zoom level
 * @returns Radius adjustment factor (1.0 = no change)
 */
export const getRadiusAdjustmentFactor = (count: number, cellSize: number, zoom: number): number => {
  // Much more aggressive adjustment based on count (more items = significantly larger radius)
  let adjustmentFactor = 1.0;
  
  if (count === 1) {
    // Single items remain at base size
    adjustmentFactor = 1.0;
  } else if (count <= 5) {
    // Small clusters - significant boost (+10% per item)
    adjustmentFactor = 1.0 + (count * 0.10);
  } else if (count <= 20) {
    // Medium clusters - strong boost but with slight diminishing returns
    adjustmentFactor = 1.5 + (Math.sqrt(count - 5) * 0.2);
  } else if (count <= 50) {
    // Large clusters - very prominent
    adjustmentFactor = 2.3 + (Math.log10(count) * 0.4);
  } else {
    // Massive clusters - extremely noticeable but capped
    adjustmentFactor = 3.0 + (Math.log10(count) * 0.3);
  }
  
  // Bold adjustment based on cellSize relative to zoom level
  const expectedCellSize = 50 / Math.pow(2, Math.max(0, zoom - 4));
  
  if (cellSize > expectedCellSize) {
    // Larger cell than expected for this zoom - increase radius more aggressively
    const cellSizeFactor = cellSize / expectedCellSize;
    adjustmentFactor *= 1.0 + ((cellSizeFactor - 1) * 0.15);
  }
  
  // Cap at a reasonable maximum to prevent excessive domination
  return Math.min(adjustmentFactor, 4.5);
};

/**
 * Calculate heatmap parameters based on zoom level
 * INVERTED LOGIC: Intensity increases dramatically with zoom level
 * @param zoom Current zoom level
 * @returns Parameters for heatmap rendering
 */
export const getHeatmapParams = (zoom: number) => {
  Logger.debug("misc", `[HEATMAP_FLOW] Getting heatmap parameters for zoom level ${zoom}`);
  
  // Progressive intensity scaling - stronger at higher zooms
  if (zoom <= 2) {
    // Very zoomed out - moderate intensity
    return {
      radius: 25,
      blur: 15,
      opacity: 0.95,
    };
  } else if (zoom === 3) {
    // Increasing intensity
    return {
      radius: 32,
      blur: 20,
      opacity: 0.97,
    };
  } else if (zoom === 4) {
    // Medium zoom - high intensity
    return {
      radius: 40,
      blur: 25,
      opacity: 0.98,
    };
  } else if (zoom === 5) {
    // Medium-high zoom - very high intensity
    return {
      radius: 50,
      blur: 30,
      opacity: 0.99,
    };
  } else if (zoom === 6) {
    // High zoom - extremely high intensity
    return {
      radius: 65,
      blur: 40,
      opacity: 1.0,
    };
  } else {
    // Maximum zoom - maximum intensity with extreme obfuscation
    return {
      radius: 80,
      blur: 55, 
      opacity: 1.0,
    };
  }
}; 