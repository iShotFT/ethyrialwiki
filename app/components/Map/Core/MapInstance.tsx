import * as React from 'react';
import { useEffect, useRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import Projection from 'ol/proj/Projection';
import { getCenter } from 'ol/extent';
import Logger from '~/utils/Logger';
import MapStore from '~/stores/MapStore';
import { useMapContext } from '../Context/MapContext';
import { parseMapHash } from '../URL/HashManager';
import { LAYER_Z_INDEXES } from '../Layers/LayerManager';

interface Props {
  mapId: string;
  initialZLayer?: number;
  children?: React.ReactNode;
  onResourceSelect?: (resourceId: string | null) => void;
}

/**
 * Core map initialization component
 */
const MapInstance: React.FC<Props> = ({
  mapId,
  initialZLayer = 1,
  children,
  onResourceSelect,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const { setMap, setCurrentZLayer } = useMapContext();
  
  // Initialize map - using a layout effect to ensure it runs before children are rendered
  useEffect(() => {
    // Skip if map is already initialized or container is not available
    if (mapInstanceRef.current || !mapContainerRef.current) {
      if (!mapContainerRef.current) {
        Logger.warn('misc', new Error('Map container reference is not available'));
      }
      return;
    }
    
    try {
      // 1. Define map projection and extent
      const mapExtent = [0, 0, 6000, 5000];
      const customProjection = new Projection({
        code: 'pixel-coords',
        units: 'pixels',
        extent: mapExtent,
      });
      
      // 2. Resolutions and view settings
      const resolutions = [32, 16, 8, 4, 2, 1, 0.5, 0.25];
      const maxZoom = resolutions.length - 1 + 4;
      const minZoom = 4;
      
      // 3. Parse URL hash for initial view settings
      let initialCenter = getCenter(mapExtent);
      let initialZoom = 4;
      let initialResourceId: string | null = null;
      let zLayer = initialZLayer;
      
      // Use parseMapHash directly with the full hash
      const hash = window.location.hash;
      if (hash) {
        const parsedHash = parseMapHash(hash);
        if (parsedHash) {
          initialZoom = parsedHash.zoom;
          initialCenter = parsedHash.center;
          zLayer = parsedHash.zLayer;
          
          if (parsedHash.resourceId) {
            initialResourceId = parsedHash.resourceId;
            
            if (onResourceSelect) {
              setTimeout(() => {
                onResourceSelect(initialResourceId);
              }, 0);
            }
          }
        }
      }
      
      // 4. Create map view
      const view = new View({
        projection: customProjection,
        center: initialCenter,
        zoom: initialZoom,
        resolutions,
        extent: mapExtent,
        minZoom: 1,
        maxZoom,
      });
      
      // 5. Create map instance
      const mapInstance = new Map({
        target: mapContainerRef.current,
        layers: [], // Layers will be added by child components
        view,
        controls: [],
      });
      
      // Store reference locally
      mapInstanceRef.current = mapInstance;
      
      // Initialize z-layer in context
      setCurrentZLayer(zLayer);
      
      // Share map instance through context
      setMap(mapInstance);
      
      // IMPORTANT: Also set map instance in MapStore for MobX state management
      MapStore.setMapInstance(mapInstance);
      
      // Set initial view state in MapStore
      const extent = view.calculateExtent(mapInstance.getSize());
      if (extent) {
        MapStore.setViewState({
          zoom: Math.round(initialZoom),
          extent
        });
      }
      
      // Cleanup on unmount is handled in a separate effect with empty dependencies
    } catch (err: any) {
      Logger.error('misc', new Error(`Failed to initialize map: ${err.message || 'Unknown error'}`));
    }
  }, [mapId, initialZLayer, onResourceSelect, setMap, setCurrentZLayer]);
  
  // Separate cleanup effect with empty dependencies to ensure it only runs on unmount
  useEffect(() => {
    // Return cleanup function that will only run when component unmounts
    return () => {
      if (mapInstanceRef.current) {
        // Clear MapStore reference before disposing map
        MapStore.setMapInstance(null);
        
        // Dispose map
        mapInstanceRef.current.setTarget(undefined);
        mapInstanceRef.current = null;
        Logger.info('misc', 'OpenLayers map disposed');
      }
    };
  }, []);
  
  return (
    <div 
      ref={mapContainerRef} 
      className="w-full h-full"
      style={{ position: 'relative' }}
      data-testid="map-instance"
    >
      {children}
    </div>
  );
};

export default MapInstance; 