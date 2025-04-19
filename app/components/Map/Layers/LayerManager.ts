import type { Map as OLMap } from 'ol';
import HeatmapLayer from 'ol/layer/Heatmap';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { Extent } from 'ol/extent';
import Logger from '~/utils/Logger';
import StyleManager from '../Styles/StyleManager';
import { ETHYRIAL_GRADIENT, getHeatmapParams } from '~/utils/heatmapUtils';

// Layer z-index constants
export const LAYER_Z_INDEXES = {
  BASE_TILE: 1,
  HEATMAP: 5,
  MARKERS: 10,
  LABELS: 15
};

// Layer types
export enum LayerType {
  BASEMAP = 'basemap',
  MARKER = 'marker',
  LABEL = 'label',
  HEATMAP = 'heatmap'
}

// Layer IDs
export const LAYER_IDS = {
  BASE_TILE: 'base-osm',
  HEATMAP: 'main-heatmap',
  MARKERS: 'main-markers',
  LABELS: 'main-labels'
};

interface LayerVisibilityOptions {
  logMessages?: boolean;
}

interface HeatmapPoint {
  x: number;
  y: number;
  weight: number;
  count?: number;
  cellSize?: number;
}

interface MarkerData {
  id: string;
  title: string;
  description: string | null;
  coordinate: { x: number; y: number; z: number } | null;
  categoryId: string;
  categoryName?: string;
  iconId: string | null;
  iconUrl: string | null;
  isLabel: boolean;
  categoryIsLabel: boolean;
}

/**
 * Get a layer by its identifier
 */
export function getLayerById(map: OLMap, id: string): any {
  Logger.debug('misc', `[LayerManager] Getting layer by id: ${id}`);
  const allLayers = map.getLayers().getArray();
  for (const layer of allLayers) {
    if (layer.get && typeof layer.get === 'function') {
      const layerId = layer.get('id');
      if (layerId === id) {
        return layer;
      }
    }
  }
  Logger.debug('misc', `[LayerManager] Layer with id ${id} not found`);
  return null;
}

/**
 * Get a layer by its type
 */
export function getLayerByType(map: OLMap, layerType: string): any {
  Logger.debug('misc', `[LayerManager] Getting layer by type: ${layerType}`);
  const allLayers = map.getLayers().getArray();
  for (const layer of allLayers) {
    if (layer.get && typeof layer.get === 'function') {
      const type = layer.get('layerType');
      if (type === layerType) {
        return layer;
      }
    }
  }
  Logger.debug('misc', `[LayerManager] Layer with type ${layerType} not found`);
  return null;
}

/**
 * Ensure layer visibility and z-index
 */
export function ensureLayerVisibility(map: OLMap, options: LayerVisibilityOptions = {}): void {
  const { logMessages = false } = options;
  
  if (logMessages) {
    Logger.debug('misc', '[LayerManager] Ensuring layer visibility');
  }
  
  const allLayers = map.getLayers().getArray();
  
  // Check all layers and set appropriate visibility and z-index
  for (const layer of allLayers) {
    if (!layer || !layer.get || typeof layer.get !== 'function') continue;
    
    const layerType = layer.get('layerType');
    const layerId = layer.get('id');
    
    if (layerType === LayerType.BASEMAP || layerId === LAYER_IDS.BASE_TILE) {
      layer.setZIndex(LAYER_Z_INDEXES.BASE_TILE);
      layer.setVisible(true);
      if (logMessages) {
        Logger.debug('misc', `[LayerManager] Set base layer ${layerId} z-index to ${LAYER_Z_INDEXES.BASE_TILE}`);
      }
    }
    
    if (layerType === LayerType.HEATMAP || layerId === LAYER_IDS.HEATMAP) {
      layer.setZIndex(LAYER_Z_INDEXES.HEATMAP);
      if (logMessages) {
        Logger.debug('misc', `[LayerManager] Set heatmap layer ${layerId} z-index to ${LAYER_Z_INDEXES.HEATMAP}`);
      }
    }
    
    if (layerType === LayerType.MARKER || layerId === LAYER_IDS.MARKERS) {
      layer.setZIndex(LAYER_Z_INDEXES.MARKERS);
      layer.setVisible(true);
      if (logMessages) {
        Logger.debug('misc', `[LayerManager] Set marker layer ${layerId} z-index to ${LAYER_Z_INDEXES.MARKERS}`);
      }
    }
    
    if (layerType === LayerType.LABEL || layerId === LAYER_IDS.LABELS) {
      layer.setZIndex(LAYER_Z_INDEXES.LABELS);
      layer.setVisible(true);
      if (logMessages) {
        Logger.debug('misc', `[LayerManager] Set label layer ${layerId} z-index to ${LAYER_Z_INDEXES.LABELS}`);
      }
    }
  }
}

/**
 * Force vector layers to refresh
 */
export function refreshVectorLayers(map: OLMap): void {
  Logger.debug('misc', '[LayerManager] Refreshing vector layers');
  const allLayers = map.getLayers().getArray();
  
  for (const layer of allLayers) {
    if (!layer) continue;
    
    if (layer instanceof VectorLayer || layer instanceof HeatmapLayer) {
      if (typeof layer.getSource === 'function') {
        const source = layer.getSource();
        if (source && typeof source.refresh === 'function') {
          source.refresh();
        }
      }
      
      // Force layer to rerender
      if (typeof layer.changed === 'function') {
        layer.changed();
      }
    }
  }
}

/**
 * Update layer source with new data
 */
export function updateLayerSource(map: OLMap, layerId: string, updateFn: (layer: any) => void): void {
  Logger.debug('misc', `[LayerManager] Updating layer source for ${layerId}`);
  const layer = getLayerById(map, layerId);
  if (layer) {
    updateFn(layer);
    
    // Force layer to rerender
    if (typeof layer.changed === 'function') {
      layer.changed();
    }
  } else {
    Logger.warn('misc', new Error(`[LayerManager] Cannot update source - layer ${layerId} not found`));
  }
}

/**
 * Update heatmap layer with new data
 */
export function updateHeatmapLayer(map: OLMap, heatmapData: { points: HeatmapPoint[] }): boolean {
  Logger.debug('misc', `[LayerManager] Updating heatmap with ${heatmapData.points.length} points`);
  
  // Get the heatmap layer
  const heatmapLayer = getLayerById(map, LAYER_IDS.HEATMAP) as HeatmapLayer;
  if (!heatmapLayer) {
    Logger.warn('misc', new Error('[LayerManager] Heatmap layer not found'));
    return false;
  }
  
  // Get the source
  const source = heatmapLayer.getSource() as VectorSource;
  if (!source) {
    Logger.warn('misc', new Error('[LayerManager] Heatmap source not found'));
    return false;
  }
  
  // Clear existing features
  source.clear();
  
  // Create new features from points using the smarter weight approach
  const features = heatmapData.points.map((point: HeatmapPoint) => {
    try {
      // Calculate zoom-based intensity factor to boost weights at higher zoom levels
      const zoom = Math.round(map.getView().getZoom() || 0);
      const zoomIntensityFactor = Math.min(1.0 + (zoom - 3) * 0.15, 1.7);
      
      // Get count with default value to prevent undefined errors
      const count = point.count ?? 1;
      
      // Determine weight with higher visibility base values that scale with zoom
      let smartWeight;
      
      // Different handling based on count with much higher base weights
      if (count <= 1) {
        // Single item - zoom-boosted medium intensity
        smartWeight = Math.min(0.55 * zoomIntensityFactor, 0.8);
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
      
      // Create feature with the enhanced weight and additional properties
      const feature = new Feature({
        geometry: new Point([point.x, point.y]),
        weight: smartWeight,
        // Store original data for potential tooltips or label rendering
        originalCount: count,
        originalWeight: point.weight || 1,
        cellSize: point.cellSize ?? 50,
        createdAtZoom: zoom
      });
      
      return feature;
    } catch (error) {
      // Skip error features and return null
      return null;
    }
  }).filter((feature): feature is Feature<Point> => feature !== null); // Type guard to filter out nulls
  
  // Add features to source
  source.addFeatures(features);
  
  // Always ensure the layer is visible
  heatmapLayer.setVisible(true);
  
  // Get zoom-based parameters and apply them
  const zoom = Math.round(map.getView().getZoom() || 0);
  const params = getHeatmapParams(zoom);
  heatmapLayer.setRadius(params.radius);
  heatmapLayer.setBlur(params.blur);
  heatmapLayer.setOpacity(params.opacity);
  
  // Set an enhanced weight function that also considers radiusFactor
  heatmapLayer.setWeight(function(feature) {
    const weight = feature.get("weight");
    // Also consider radiusFactor if available (adjust weight to create dramatic radius differences)
    const radiusFactor = feature.get("radiusFactor");
    const baseWeight = typeof weight === 'number' ? weight : 1;
    
    // Use a more balanced power factor to distribute colors more evenly
    return typeof radiusFactor === 'number' ? 
      baseWeight * Math.pow(radiusFactor, 1.7) : baseWeight;
  });
  
  // Always ensure we're using the correct gradient
  heatmapLayer.setGradient(ETHYRIAL_GRADIENT);
  
  // Force a redraw
  heatmapLayer.changed();
  
  Logger.debug('misc', `[LayerManager] Heatmap updated with ${features.length} features`);
  return true;
}

/**
 * Clear heatmap layer
 */
export function clearHeatmapLayer(map: OLMap): void {
  Logger.debug('misc', '[LayerManager] Clearing heatmap layer');
  
  const heatmapLayer = getLayerById(map, LAYER_IDS.HEATMAP) as HeatmapLayer;
  if (!heatmapLayer) {
    Logger.warn('misc', new Error('[LayerManager] Heatmap layer not found'));
    return;
  }
  
  // Get the source
  const source = heatmapLayer.getSource() as VectorSource;
  if (!source) {
    Logger.warn('misc', new Error('[LayerManager] Heatmap source not found'));
    return;
  }
  
  // Clear source
  source.clear();
  
  // Hide layer
  heatmapLayer.setVisible(false);
  
  // Maintain the proper gradient even when hidden
  // This ensures the appearance is correct when made visible again
  heatmapLayer.setGradient(ETHYRIAL_GRADIENT);
  
  Logger.debug('misc', '[LayerManager] Heatmap layer cleared');
}

/**
 * Update markers layer with new data
 */
export function updateMarkersLayer(
  map: OLMap, 
  markers: MarkerData[], 
  visibleCategoryIds: Record<string, boolean>,
  labelCategoryIds: Set<string>
): void {
  Logger.debug('misc', `[LayerManager] Updating markers layer with ${markers.length} markers`);
  
  // Get marker layer
  const markerLayer = getLayerById(map, LAYER_IDS.MARKERS) as VectorLayer<VectorSource>;
  if (!markerLayer) {
    Logger.warn('misc', new Error('[LayerManager] Marker layer not found'));
    return;
  }
  
  // Get marker source
  const source = markerLayer.getSource();
  if (!source) {
    Logger.warn('misc', new Error('[LayerManager] Marker source not found'));
    return;
  }
  
  // Clear existing features
  source.clear();
  
  // Filter markers by visible categories
  const visibleMarkers = markers.filter(marker => 
    marker.coordinate && marker.coordinate.x && marker.coordinate.y && 
    (visibleCategoryIds[marker.categoryId] !== false)
  );
  
  // Create features from markers
  const features = visibleMarkers.map(marker => {
    if (!marker.coordinate) return null;
    
    const feature = new Feature({
      geometry: new Point([marker.coordinate.x, marker.coordinate.y]),
      id: marker.id,
      title: marker.title,
      description: marker.description,
      categoryId: marker.categoryId,
      categoryName: marker.categoryName,
      iconUrl: marker.iconUrl,
      isLabel: marker.isLabel || labelCategoryIds.has(marker.categoryId)
    });
    
    // Set feature id for later reference
    feature.setId(marker.id);
    
    return feature;
  }).filter(Boolean) as Feature[];
  
  // Add features to source
  source.addFeatures(features);
  
  // Update styles for all features
  source.getFeatures().forEach(feature => {
    feature.setStyle((feature) => StyleManager.getMarkerStyle(feature, labelCategoryIds));
  });
  
  // Make sure layer is visible
  markerLayer.setVisible(true);
  
  // Force redraw
  markerLayer.changed();
  
  Logger.debug('misc', `[LayerManager] Markers layer updated with ${features.length} features`);
}

/**
 * Set category visibility
 */
export function setCategoryVisibility(
  map: OLMap, 
  categoryId: string, 
  visible: boolean, 
  labelCategoryIds: Set<string>
): void {
  Logger.debug('misc', `[LayerManager] Setting category ${categoryId} visibility to ${visible}`);
  
  // Get marker layer
  const markerLayer = getLayerById(map, LAYER_IDS.MARKERS) as VectorLayer<VectorSource>;
  if (!markerLayer) {
    Logger.warn('misc', new Error('[LayerManager] Marker layer not found'));
    return;
  }
  
  // Get marker source
  const source = markerLayer.getSource();
  if (!source) {
    Logger.warn('misc', new Error('[LayerManager] Marker source not found'));
    return;
  }
  
  // Get features for this category
  const features = source.getFeatures().filter(feature => 
    feature.get('categoryId') === categoryId
  );
  
  // Update visibility by setting/removing style
  features.forEach(feature => {
    if (visible) {
      feature.setStyle((feature) => StyleManager.getMarkerStyle(feature, labelCategoryIds));
    } else {
      feature.setStyle(undefined); // Hide by setting undefined style
    }
  });
  
  // Force redraw
  markerLayer.changed();
  
  Logger.debug('misc', `[LayerManager] Updated visibility for ${features.length} features in category ${categoryId}`);
}

export default {
  getLayerById,
  getLayerByType,
  ensureLayerVisibility,
  refreshVectorLayers,
  updateLayerSource,
  updateHeatmapLayer,
  clearHeatmapLayer,
  updateMarkersLayer,
  setCategoryVisibility,
  LAYER_Z_INDEXES,
  LAYER_IDS,
  LayerType
}; 