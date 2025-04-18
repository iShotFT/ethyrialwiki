// Core components
export { default as MapContainer } from './Core/MapContainer';
export { default as MapInstance } from './Core/MapInstance';
export { useMapInteractions } from './Core/useMapInteractions';

// Context
export { 
  MapContext, 
  MapProvider, 
  useMapContext,
  type MapContextType 
} from './Context/MapContext';

// Layers
export {
  HeatmapLayer,
  MarkerLayer,
  createBaseTileLayer,
  getLayerById,
  getLayerByType,
  ensureLayerVisibility,
  refreshVectorLayers,
  updateLayerSource,
  LAYER_Z_INDEXES
} from './Layers';

// Controls
export { default as ZLayerControl } from './Controls/ZLayerControl';

// URL management
export { 
  parseMapHash,
  updateMapHashWithZ,
  encodeResourceId,
  decodeResourceId,
  useHashManager
} from './URL/HashManager'; 