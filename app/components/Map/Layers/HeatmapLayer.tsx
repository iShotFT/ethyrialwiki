import * as React from 'react';
import { useEffect, useRef } from 'react';
import OLHeatmapLayer from 'ol/layer/Heatmap';
import VectorSource from 'ol/source/Vector';
import Logger from '~/utils/Logger';
import { useMapContext } from '../Context/MapContext';
import { LAYER_Z_INDEXES } from './LayerManager';
import { getHeatmapParams, ETHYRIAL_GRADIENT } from '~/utils/heatmapUtils';

interface Props {
  opacity?: number;
  blur?: number;
  radius?: number;
  gradient?: string[];
  visible?: boolean;
  onLayerReady?: (layer: OLHeatmapLayer, source: VectorSource) => void;
}

/**
 * Heatmap layer component
 */
const HeatmapLayer: React.FC<Props> = ({
  opacity = 0.8,
  blur,
  radius,
  gradient = ETHYRIAL_GRADIENT, // Use the centralized Ethyrial themed gradient
  visible = false,
  onLayerReady,
}) => {
  const { map, setHeatmapLayer, setHeatmapSource } = useMapContext();
  const layerRef = useRef<OLHeatmapLayer | null>(null);
  const sourceRef = useRef<VectorSource | null>(null);
  
  // Create the heatmap layer when the map is available
  useEffect(() => {
    if (!map) {
      Logger.debug('misc', '[HeatmapLayer] Map not yet available');
      return;
    }
    
    // Create source if it doesn't exist
    if (!sourceRef.current) {
      sourceRef.current = new VectorSource({
        wrapX: false,
      });
      Logger.debug('misc', '[HeatmapLayer] Created new vector source');
    }
    
    // Get initial parameters based on current zoom
    const zoom = Math.round(map.getView().getZoom() || 0);
    const initialParams = getHeatmapParams(zoom);
    
    // Create layer with provided or default parameters
    layerRef.current = new OLHeatmapLayer({
      source: sourceRef.current,
      opacity: opacity,
      blur: blur || initialParams.blur,
      radius: radius || initialParams.radius,
      weight: (feature) => feature.get('weight') || 1,
      gradient: gradient,
      visible: visible,
    });
    
    // Explicitly force the gradient to be applied after creation
    layerRef.current.setGradient(gradient);
    
    // Set layer properties for identification
    layerRef.current.set('id', 'main-heatmap');
    layerRef.current.set('layerType', 'heatmap');
    layerRef.current.setZIndex(LAYER_Z_INDEXES.HEATMAP);
    
    // Add the layer to the map
    map.addLayer(layerRef.current);
    Logger.debug('misc', '[HeatmapLayer] Added heatmap layer to map');
    
    // Register zoom change handler to update heatmap parameters
    let lastProcessedZoom = zoom;
    let zoomTimeoutId: number | undefined;
    
    const handleResolutionChange = () => {
      if (!layerRef.current) return;
      
      const currentZoom = Math.round(map.getView().getZoom() || 0);
      if (currentZoom === lastProcessedZoom) return;
      
      lastProcessedZoom = currentZoom;
      clearTimeout(zoomTimeoutId);
      
      zoomTimeoutId = window.setTimeout(() => {
        if (!layerRef.current) return;
        
        const params = getHeatmapParams(currentZoom);
        layerRef.current.setRadius(params.radius);
        layerRef.current.setBlur(params.blur);
        layerRef.current.setOpacity(params.opacity);
        
        // Re-apply gradient to ensure it stays consistent
        layerRef.current.setGradient(gradient);
        layerRef.current.changed();
        
        Logger.debug('misc', `[HeatmapLayer] Updated parameters for zoom ${currentZoom}: radius=${params.radius}, blur=${params.blur}, opacity=${params.opacity}`);
      }, 50);
    };
    
    map.getView().on('change:resolution', handleResolutionChange);
    
    // Share the layer references via context
    setHeatmapLayer(layerRef.current);
    setHeatmapSource(sourceRef.current);
    
    // Call the ready callback if provided
    if (onLayerReady && layerRef.current && sourceRef.current) {
      onLayerReady(layerRef.current, sourceRef.current);
      Logger.debug('misc', '[HeatmapLayer] onLayerReady callback invoked');
    }
    
    // Clean up on unmount
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        Logger.debug('misc', '[HeatmapLayer] Removed heatmap layer from map');
      }
      
      clearTimeout(zoomTimeoutId);
      map.getView().un('change:resolution', handleResolutionChange);
      
      // Clear references
      setHeatmapLayer(null);
      setHeatmapSource(null);
      layerRef.current = null;
    };
  }, [map, opacity, blur, radius, gradient, visible, setHeatmapLayer, setHeatmapSource, onLayerReady]);
  
  // Force a layer update for any change
  useEffect(() => {
    if (layerRef.current && map) {
      // Force gradient update
      layerRef.current.setGradient(gradient);
      
      // Get zoom parameters again
      const zoom = Math.round(map.getView().getZoom() || 0);
      const params = getHeatmapParams(zoom);
      
      // Apply parameters
      layerRef.current.setRadius(params.radius);
      layerRef.current.setBlur(params.blur);
      layerRef.current.setOpacity(params.opacity);
      
      // Force redraw
      layerRef.current.changed();
      map.render();
    }
  }, [gradient, map]);
  
  // This is a logical component, it doesn't render anything
  return null;
};

export default HeatmapLayer; 