import * as React from 'react';
import { useEffect } from 'react';
import type { Map as OLMap } from 'ol';
import type { Extent } from 'ol/extent';
import HeatmapLayer from 'ol/layer/Heatmap';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Logger from '~/utils/Logger';
import MapStore from '~/stores/MapStore';

/**
 * Context interface for the map
 */
export interface MapContextType {
  map: OLMap | null;
  heatmapLayer: HeatmapLayer | null;
  heatmapSource: VectorSource | null;
  markerLayer: VectorLayer<VectorSource> | null;
  markerSource: VectorSource | null;
  currentZLayer: number;
  setCurrentZLayer: (zLayer: number) => void;
  updateViewState: (zoom: number, extent: Extent) => void;
  setMap: (map: OLMap) => void;
  setHeatmapLayer: (layer: HeatmapLayer | null) => void;
  setHeatmapSource: (source: VectorSource | null) => void;
  setMarkerLayer: (layer: VectorLayer<VectorSource> | null) => void;
  setMarkerSource: (source: VectorSource | null) => void;
}

/**
 * Default context values
 */
const defaultContext: MapContextType = {
  map: null,
  heatmapLayer: null,
  heatmapSource: null,
  markerLayer: null,
  markerSource: null,
  currentZLayer: 1,
  setCurrentZLayer: () => {},
  updateViewState: () => {},
  setMap: () => {},
  setHeatmapLayer: () => {},
  setHeatmapSource: () => {},
  setMarkerLayer: () => {},
  setMarkerSource: () => {},
};

/**
 * Create context for map state
 */
export const MapContext = React.createContext<MapContextType>(defaultContext);

/**
 * Props for the MapProvider component
 */
interface MapProviderProps {
  children: React.ReactNode;
  onMapReady?: (map: OLMap) => void;
  onViewChange?: (zoom: number, extent: Extent) => void;
}

/**
 * Provider component to wrap map components with context
 */
export const MapProvider: React.FC<MapProviderProps> = ({ 
  children, 
  onMapReady,
  onViewChange,
}) => {
  const [map, setMap] = React.useState<OLMap | null>(null);
  const [heatmapLayer, setHeatmapLayer] = React.useState<HeatmapLayer | null>(null);
  const [heatmapSource, setHeatmapSource] = React.useState<VectorSource | null>(null);
  const [markerLayer, setMarkerLayer] = React.useState<VectorLayer<VectorSource> | null>(null);
  const [markerSource, setMarkerSource] = React.useState<VectorSource | null>(null);
  const [currentZLayer, setCurrentZLayer] = React.useState<number>(1);

  // Handle map initialization
  const handleMapInit = React.useCallback((newMap: OLMap) => {
    setMap(newMap);
    if (onMapReady) {
      onMapReady(newMap);
    }
  }, [onMapReady]);

  // Handle view state changes  
  const updateViewState = React.useCallback((zoom: number, extent: Extent) => {
    if (onViewChange) {
      onViewChange(zoom, extent);
    }
  }, [onViewChange]);
  
  // Handle heatmap layer changes
  const handleHeatmapLayerChange = React.useCallback((layer: HeatmapLayer | null) => {
    Logger.debug('misc', `[MapContext] Setting heatmap layer: ${layer ? 'provided' : 'null'}`);
    setHeatmapLayer(layer);
  }, []);
  
  // Handle heatmap source changes
  const handleHeatmapSourceChange = React.useCallback((source: VectorSource | null) => {
    Logger.debug('misc', `[MapContext] Setting heatmap source: ${source ? 'provided' : 'null'}`);
    setHeatmapSource(source);
  }, []);
  
  // Handle marker layer changes
  const handleMarkerLayerChange = React.useCallback((layer: VectorLayer<VectorSource> | null) => {
    Logger.debug('misc', `[MapContext] Setting marker layer: ${layer ? 'provided' : 'null'}`);
    setMarkerLayer(layer);
  }, []);
  
  // Handle marker source changes
  const handleMarkerSourceChange = React.useCallback((source: VectorSource | null) => {
    Logger.debug('misc', `[MapContext] Setting marker source: ${source ? 'provided' : 'null'}`);
    setMarkerSource(source);
  }, []);
  
  // Sync heatmap layer/source with hooks
  useEffect(() => {
    if (heatmapLayer && heatmapSource) {
      Logger.debug('misc', '[MapContext] Heatmap layer and source ready');
    }
  }, [heatmapLayer, heatmapSource]);
  
  // Sync marker layer/source with hooks
  useEffect(() => {
    if (markerLayer && markerSource) {
      Logger.debug('misc', '[MapContext] Marker layer and source ready');
    }
  }, [markerLayer, markerSource]);

  // Context value
  const contextValue = React.useMemo(() => ({
    map,
    heatmapLayer,
    heatmapSource,
    markerLayer,
    markerSource,
    currentZLayer,
    setCurrentZLayer,
    updateViewState,
    
    // Internal
    setMap: handleMapInit,
    setHeatmapLayer: handleHeatmapLayerChange,
    setHeatmapSource: handleHeatmapSourceChange,
    setMarkerLayer: handleMarkerLayerChange,
    setMarkerSource: handleMarkerSourceChange,
  }), [
    map, 
    heatmapLayer, 
    heatmapSource,
    markerLayer,
    markerSource,
    currentZLayer, 
    handleMapInit,
    updateViewState,
    handleHeatmapLayerChange,
    handleHeatmapSourceChange,
    handleMarkerLayerChange,
    handleMarkerSourceChange
  ]);

  return (
    <MapContext.Provider value={contextValue}>
      {children}
    </MapContext.Provider>
  );
};

/**
 * Hook to use the map context in components
 */
export const useMapContext = () => React.useContext(MapContext);

export default MapContext; 