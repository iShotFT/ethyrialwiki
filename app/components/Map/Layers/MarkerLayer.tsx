import * as React from 'react';
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style } from 'ol/style';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { FeatureLike } from 'ol/Feature';
import Logger from '~/utils/Logger';
import { useMapContext } from '../Context/MapContext';
import { LAYER_Z_INDEXES } from './LayerManager';
import { useMarkerStyleContext } from '~/components/MarkerStyleContext';

interface MarkerLayerProps {
  visible?: boolean;
  labelCategoryIds?: Set<string>;
  onLayerReady?: (layer: VectorLayer<VectorSource>, source: VectorSource) => void;
}

/**
 * Vector layer component for map markers with standard OpenLayers styling
 */
const MarkerLayer = forwardRef<any, MarkerLayerProps>(({
  visible = true,
  labelCategoryIds = new Set<string>(),
  onLayerReady,
}, ref) => {
  const { map, setMarkerLayer, setMarkerSource } = useMapContext();
  const layerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const sourceRef = useRef<VectorSource | null>(null);
  // Use shared marker styles
  const { getMarkerStyle } = useMarkerStyleContext();
  
  console.log('[LAYER DEBUG] MarkerLayer initializing', {
    visible,
    labelCategoryIdsCount: labelCategoryIds.size,
    hasMap: !!map
  });
  
  // Create and initialize the marker layer
  useEffect(() => {
    if (!map) {
      Logger.debug('misc', '[MarkerLayer] Map not yet available');
      return;
    }
    
    console.log('[LAYER DEBUG] Setting up marker layer with map instance');
    
    // Create vector source if it doesn't exist
    if (!sourceRef.current) {
      sourceRef.current = new VectorSource({
        wrapX: false,
      });
      Logger.debug('misc', '[MarkerLayer] Created new vector source');
    }
    
    console.log('[LAYER DEBUG] Using shared marker style function with labelCategoryIds:', 
               Array.from(labelCategoryIds).join(', '));
    
    // Create vector layer for markers
    layerRef.current = new VectorLayer({
      source: sourceRef.current,
      style: (feature: FeatureLike) => getMarkerStyle(feature, labelCategoryIds),
      visible: visible,
      updateWhileAnimating: true,
      updateWhileInteracting: true,
    });
    
    console.log('[LAYER DEBUG] Vector layer created with properties:',
               { updateWhileAnimating: true, updateWhileInteracting: true, visible });
    
    // Set layer properties
    layerRef.current.set('id', 'main-markers');
    layerRef.current.set('layerType', 'marker');
    layerRef.current.setZIndex(LAYER_Z_INDEXES.MARKERS);
    
    // Add the layer to the map
    map.addLayer(layerRef.current);
    Logger.debug('misc', '[MarkerLayer] Added standard marker layer to map');
    console.log('[LAYER DEBUG] Marker layer added to map with zIndex:', LAYER_Z_INDEXES.MARKERS);
    
    // Update context with layer and source references
    if (setMarkerLayer) setMarkerLayer(layerRef.current);
    if (setMarkerSource) setMarkerSource(sourceRef.current);
    
    // Notify via callback if provided
    if (onLayerReady && layerRef.current && sourceRef.current) {
      onLayerReady(layerRef.current, sourceRef.current);
      console.log('[LAYER DEBUG] onLayerReady callback invoked');
    }
    
    // Clean up on unmount
    return () => {
      if (map && layerRef.current) {
        map.removeLayer(layerRef.current);
        
        if (setMarkerLayer) setMarkerLayer(null);
        if (setMarkerSource) setMarkerSource(null);
        
        Logger.debug('misc', '[MarkerLayer] Removed marker layer from map');
        console.log('[LAYER DEBUG] Marker layer removed during cleanup');
      }
    };
  }, [map, visible, setMarkerLayer, setMarkerSource, onLayerReady, getMarkerStyle, labelCategoryIds]);
  
  // Update when label categories change
  useEffect(() => {
    if (layerRef.current) {
      console.log('[LAYER DEBUG] Updating styles due to label category changes');
      // Force redraw by setting a new style function with updated labelCategoryIds
      layerRef.current.setStyle((feature: FeatureLike) => {
        return getMarkerStyle(feature, labelCategoryIds);
      });
      
      // Ensure visibility is maintained
      layerRef.current.setVisible(visible);
      
      // Force redraw
      layerRef.current.changed();
      console.log('[LAYER DEBUG] Layer visibility set to', visible, 'and redraw triggered');
    }
  }, [labelCategoryIds, visible, getMarkerStyle]);
  
  // Update markers with current zoom level
  useEffect(() => {
    if (!map || !layerRef.current || !sourceRef.current) return;
    
    const handleZoomChange = () => {
      const zoom = Math.round(map.getView().getZoom() || 0);
      console.log('[LAYER DEBUG] Zoom changed to', zoom);
      
      // Update all features with current zoom level
      const features = sourceRef.current?.getFeatures() || [];
      console.log('[LAYER DEBUG] Updating zoom level for', features.length, 'features');
      
      features.forEach(feature => {
        feature.set('_mapZoom', zoom);
      });
      
      // Force style recalculation and redraw
      if (layerRef.current) {
        layerRef.current.changed();
        console.log('[LAYER DEBUG] Forced layer redraw after zoom update');
      }
    };
    
    // Listen for resolution (zoom) change
    const view = map.getView();
    view.on('change:resolution', handleZoomChange);
    console.log('[LAYER DEBUG] Added zoom change listener');
    
    // Initial update
    handleZoomChange();
    
    return () => {
      view.un('change:resolution', handleZoomChange);
      console.log('[LAYER DEBUG] Removed zoom change listener');
    };
  }, [map]);
  
  /**
   * Public method to add markers to the layer
   */
  const addMarkers = (markers: Array<{
    id: string;
    coordinate: { x: number; y: number };
    categoryId: string;
    title?: string;
    categoryTitle?: string;
    iconId?: string;
    description?: string;
  }>) => {
    if (!sourceRef.current) return;
    
    console.log('[LAYER DEBUG] addMarkers called with:', markers.length, 'markers');
    console.log('[LAYER DEBUG] First few marker categories:', 
               markers.slice(0, 3).map(m => m.categoryId).join(', '));
    
    // Get current zoom level
    const zoom = map ? Math.round(map.getView().getZoom() || 0) : undefined;
    console.log('[LAYER DEBUG] Current zoom level:', zoom);
    
    // Create features from markers
    const features = markers
      .map(marker => {
        if (!marker.coordinate) return null;
        
        try {
          // Ensure we're using the correct category format
          const normalizedCategoryId = (marker.categoryId || '').toUpperCase();
          
          // Using direct console.log for easier debugging
          console.log(`[LAYER DEBUG] Creating feature for category: ${normalizedCategoryId}, title: ${marker.title}, at ${marker.coordinate.x},${marker.coordinate.y}`);
          
          const feature = new Feature({
            geometry: new Point([marker.coordinate.x, marker.coordinate.y]),
            id: marker.id,
            title: marker.title || '',
            description: marker.description || '',
            categoryId: normalizedCategoryId,
            categoryName: normalizedCategoryId,
            category: normalizedCategoryId,
            _categoryTitle: normalizedCategoryId,
            iconId: marker.iconId || '',
            _mapZoom: zoom,
          });
          
          feature.setId(marker.id);
          
          // Use the getMarkerStyle from context instead of the local style function
          feature.setStyle((feature) => getMarkerStyle(feature, labelCategoryIds));
          
          return feature;
        } catch (error) {
          Logger.error('misc', new Error(`Error creating feature for marker ${marker.id}: ${error}`));
          console.error('[LAYER DEBUG] Error creating feature:', error);
          return null;
        }
      })
      .filter(Boolean) as Feature[];
    
    // Add features to source
    if (features.length > 0) {
      console.log(`[LAYER DEBUG] Adding ${features.length} features to marker layer source`);
      sourceRef.current.addFeatures(features);
      
      // Force redraw
      if (layerRef.current) {
        layerRef.current.changed();
        console.log('[LAYER DEBUG] Forced layer redraw after adding features');
      }
    }
  };
  
  /**
   * Clear all markers from the layer
   */
  const clearMarkers = () => {
    if (sourceRef.current) {
      sourceRef.current.clear();
      console.log('[LAYER DEBUG] Cleared all markers from layer');
    }
  };
  
  // Expose methods to parent component
  useImperativeHandle(
    ref,
    () => ({
      addMarkers,
      clearMarkers,
      getSource: () => sourceRef.current,
      getLayer: () => layerRef.current,
    }),
    [sourceRef.current, layerRef.current]
  );
  
  return null;
});

export default MarkerLayer; 