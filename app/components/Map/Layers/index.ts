// Export layer component and functions
export { default as HeatmapLayer } from './HeatmapLayer';
export { default as MarkerLayer } from './MarkerLayer';
export { createBaseTileLayer } from './BaseTileLayer';
export { 
  getLayerById, 
  getLayerByType, 
  ensureLayerVisibility, 
  refreshVectorLayers,
  updateLayerSource,
  LAYER_Z_INDEXES
} from './LayerManager'; 