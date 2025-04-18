import type { Map as OLMap } from 'ol';
import HeatmapLayer from 'ol/layer/Heatmap';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import Logger from '~/utils/Logger';

// Layer z-index constants
export const LAYER_Z_INDEXES = {
  BASE_TILE: 1,
  HEATMAP: 5,
  MARKERS: 10,
  LABELS: 15
};

interface LayerVisibilityOptions {
  logMessages?: boolean;
}

/**
 * Get a layer by its identifier
 */
export function getLayerById(map: OLMap, id: string): any {
  const allLayers = map.getLayers().getArray();
  for (const layer of allLayers) {
    if (layer.get && typeof layer.get === 'function') {
      const layerId = layer.get('id');
      if (layerId === id) {
        return layer;
      }
    }
  }
  return null;
}

/**
 * Get a layer by its type
 */
export function getLayerByType(map: OLMap, layerType: string): any {
  const allLayers = map.getLayers().getArray();
  for (const layer of allLayers) {
    if (layer.get && typeof layer.get === 'function') {
      const type = layer.get('layerType');
      if (type === layerType) {
        return layer;
      }
    }
  }
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
    
    if (layerType === 'basemap' || layerId === 'base-osm') {
      layer.setZIndex(LAYER_Z_INDEXES.BASE_TILE);
      layer.setVisible(true);
      if (logMessages) {
        Logger.debug('misc', `[LayerManager] Set base layer ${layerId} z-index to ${LAYER_Z_INDEXES.BASE_TILE}`);
      }
    }
    
    if (layerType === 'heatmap' || layerId === 'main-heatmap') {
      layer.setZIndex(LAYER_Z_INDEXES.HEATMAP);
      if (logMessages) {
        Logger.debug('misc', `[LayerManager] Set heatmap layer ${layerId} z-index to ${LAYER_Z_INDEXES.HEATMAP}`);
      }
    }
    
    if (layerType === 'marker' || layerId === 'main-markers') {
      layer.setZIndex(LAYER_Z_INDEXES.MARKERS);
      layer.setVisible(true);
      if (logMessages) {
        Logger.debug('misc', `[LayerManager] Set marker layer ${layerId} z-index to ${LAYER_Z_INDEXES.MARKERS}`);
      }
    }
  }
}

/**
 * Force vector layers to refresh
 */
export function refreshVectorLayers(map: OLMap): void {
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
  const layer = getLayerById(map, layerId);
  if (layer) {
    updateFn(layer);
    
    // Force layer to rerender
    if (typeof layer.changed === 'function') {
      layer.changed();
    }
  }
}

export default {
  getLayerById,
  getLayerByType,
  ensureLayerVisibility,
  refreshVectorLayers,
  updateLayerSource,
  LAYER_Z_INDEXES
}; 