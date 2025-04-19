import type { Map as OlMap } from "ol";
import Feature from "ol/Feature";
import Map from "ol/Map";
import Overlay from "ol/Overlay";
import View from "ol/View";
import type { Extent } from "ol/extent";
import { getBottomLeft, getCenter } from "ol/extent";
import Point from "ol/geom/Point";
import HeatmapLayer from "ol/layer/Heatmap";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import Projection from "ol/proj/Projection";
import TileImage from "ol/source/TileImage";
import VectorSource from "ol/source/Vector";
import { Style, Circle } from "ol/style";
import TileGrid from "ol/tilegrid/TileGrid";
import * as React from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import styled from "styled-components";
import Logger from "~/utils/Logger";
import { getHeatmapParams, ETHYRIAL_GRADIENT } from "../utils/heatmapUtils";
import { parseMapHash, updateMapHashWithZ, encodeResource } from "../utils/mapUtils";
import { createLabelStyleBase, createStandardMarkerStyleFunction } from "../utils/markerStyleUtils";
import IngameContextMenu, { useContextMenu } from './EthyrialStyle/IngameContextMenu';
import { ZLayerOverlay } from './MapOverlays';
import type { Coordinate as ServerCoordinate } from "@server/models/Marker";
import type { AggregatedPoint } from "@server/utils/PointAggregator";
import { useMarkerStyleContext } from './MarkerStyleContext';
import LayerManager from '~/components/Map/Layers/LayerManager';
import MapFeatureTooltip from './Map/Features/MapFeatureTooltip';
import { MapBrowserEvent } from 'ol';

// Core data types
interface ApiMarkerData {
  id: string;
  title: string;
  description: string | null;
  coordinate: ServerCoordinate | null;
  categoryId: string;
  iconId: string | null;
  iconUrl: string | null;
  isLabel: boolean;
  categoryIsLabel: boolean;
}

interface HeatmapData {
  points: AggregatedPoint[];
}

type Props = {
  mapId: string;
  mapData: any;
  allMarkers: ApiMarkerData[];
  visibleCategoryIds: Record<string, boolean>;
  labelCategoryIds: Set<string>;
  heatmapData: HeatmapData | null;
  onMapReady: (map: OlMap) => void;
  onViewChange: (zoom: number, extent: Extent) => void;
  selectedResourceId?: string;
  onResourceSelect?: (resourceId: string | null) => void;
};

const MapContainer = styled.div`
  width: 100%;
  height: 100%;
  background-color: #2a61e2;
  transform: translateZ(0);
  backface-visibility: hidden;
  perspective: 1000;
  will-change: transform;
  isolation: isolate;
`;

const getLayerIdentifier = (layer: any): string => {
  if (layer.get && typeof layer.get === 'function') {
    const layerType = layer.get('layerType');
    if (layerType) return layerType;
    
    const id = layer.get('id');
    if (id) return id.toString();
  }
  
  return `layer-${Math.random().toString(36).substr(2, 9)}`;
};

const EthyrialMapFull: React.FC<Props> = ({
  mapId,
  mapData,
  allMarkers,
  visibleCategoryIds,
  labelCategoryIds,
  heatmapData,
  onMapReady,
  onViewChange,
  selectedResourceId,
  onResourceSelect,
}) => {
  // Get marker styling from context
  const { getMarkerStyle } = useMarkerStyleContext();

  // Debug logging for props
  useEffect(() => {
    if (heatmapData) {
      Logger.debug("misc", `[HEATMAP_FLOW] EthyrialMapFull received new heatmap data with ${heatmapData.points.length} points`);
    } else {
      Logger.debug("misc", `[HEATMAP_FLOW] EthyrialMapFull received null heatmap data`);
    }
  }, [heatmapData]);

  // Core refs for map elements
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource>(new VectorSource());
  const heatmapSourceRef = useRef<VectorSource>(new VectorSource());
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const popupContentRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<Overlay | null>(null);
  const moveEndHandlerRef = useRef<(() => void) | null>(null);
  const timeoutIdRef = useRef<number | undefined>();

  // Context menu state
  const {
    isOpen: isContextMenuOpen,
    position: contextMenuPosition,
    coords: contextMenuCoords,
    handleContextMenu,
    handleClose: handleContextMenuClose
  } = useContextMenu();

  // Interaction state tracking
  const interactionStateRef = useRef({
    isDragging: false,
    lastDragEnd: 0,
    dragCount: 0,
    quickDragAttempts: 0,
    viewUpdatesPending: 0,
  });

  // URL encoding state
  const lastEncodedResourceRef = useRef<string | null>(null);
  const contextMenuHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);
  const preventContextMenuRef = useRef<((e: MouseEvent) => void) | null>(null);
  const [currentZLayer, setCurrentZLayer] = useState<number>(1);

  // Z-layer change handler
  const handleZLayerChange = useCallback((newZLayer: number) => {
    Logger.debug("misc", `[ZLayerDebug] Changing Z-layer from ${currentZLayer} to ${newZLayer}`);
    
    if (mapInstanceRef.current) {
      setCurrentZLayer(newZLayer);
      
      // Update URL hash to include Z-layer
      const view = mapInstanceRef.current.getView();
      const zoom = view.getZoom();
      const center = view.getCenter();
      
      if (center && zoom !== undefined) {
        updateMapHashWithZ(Math.round(zoom), center as [number, number], newZLayer, selectedResourceId);
      }
    } else {
      setCurrentZLayer(newZLayer);
    }
  }, [currentZLayer, selectedResourceId]);

  // URL update with resource
  const updateUrlWithResource = useCallback((resourceId: string | undefined) => {
    if (!mapInstanceRef.current) return;
    
    const map = mapInstanceRef.current;
    const currentView = map.getView();
    const zoom = Math.round(currentView.getZoom() || 0);
    const center = currentView.getCenter();
    
    if (!center || zoom === undefined) return;
    
    if (resourceId === lastEncodedResourceRef.current) {
      Logger.debug("misc", `[ResourceDebug] Skip URL update, unchanged resource: ${resourceId}`);
      return;
    }
    
    lastEncodedResourceRef.current = resourceId || null;
    
    requestAnimationFrame(() => {
      try {
        // Use the updateMapHashWithZ function from our HashManager
        // This will automatically use the new URL format
        updateMapHashWithZ(zoom, center as [number, number], currentZLayer, resourceId);
      } catch (error) {
        Logger.error("misc", new Error(`Error updating URL with resource: ${error}`));
      }
    });
  }, [currentZLayer]);

  // === Map initialization effect ===
  useEffect(() => {
    Logger.debug("misc", `[HeatmapDebug] Map setup starting. mapRef.current: ${!!mapRef.current}, mapId: ${!!mapId}`);
    
    if (!mapRef.current || !mapId) {
      Logger.debug("misc", `[HeatmapDebug] Map setup aborted - missing refs or mapId`);
      return;
    }
    if (mapInstanceRef.current) {
      Logger.warn("utils", new Error("Attempted to re-initialize map that already exists."));
      return;
    }

    try {
      // 1. Define map projection and extent
      const tileWidth = 1000;
      const tileHeight = 1000;
      const mapExtent = [0, 0, 6000, 5000];

      Logger.debug("misc", `[HeatmapDebug] Creating projection with extent: ${JSON.stringify(mapExtent)}`);
      const customProjection = new Projection({
        code: "pixel-coords",
        units: "pixels",
        extent: mapExtent,
      });

      // 2. Resolutions and tile grid setup
      const resolutions = [32, 16, 8, 4, 2, 1, 0.5, 0.25];
      const maxZoom = resolutions.length - 1 + 4;
      const minZoom = 4;

      // Parse URL hash for initial view settings
      let initialCenter = getCenter(mapExtent);
      let initialZoom = 4;
      let initialResourceId: string | null = null;
      let initialZLayer = 1;

      const hash = window.location.hash.replace("#map=", "");
      if (hash) {
        const parts = hash.split("/");
        if (parts.length >= 4) {
          const parsedZLayer = parseInt(parts[3], 10);
          if (!isNaN(parsedZLayer) && parsedZLayer >= -3 && parsedZLayer <= 40) {
            initialZLayer = parsedZLayer;
            setCurrentZLayer(parsedZLayer);
            Logger.debug("misc", `[ZLayerDebug] Found Z-layer in URL: ${parsedZLayer}`);
          }
        }
        
        const parsedHash = parseMapHash(hash);
        if (parsedHash) {
          initialZoom = parsedHash.zoom;
          initialCenter = parsedHash.center;
          
          if (parsedHash.resourceId) {
            initialResourceId = parsedHash.resourceId;
            lastEncodedResourceRef.current = initialResourceId;
            
            if (onResourceSelect) {
              setTimeout(() => {
                onResourceSelect(initialResourceId);
              }, 0);
            }
          }
        }
      }

      const tileGrid = new TileGrid({
        origin: getBottomLeft(mapExtent),
        extent: mapExtent,
        resolutions: [1],
        tileSize: [tileWidth, tileHeight],
      });

      // 3. Create tile source with Z-layer support
      const tileSource = new TileImage({
        projection: customProjection,
        tileGrid,
        wrapX: false,
        transition: 200,
        tileUrlFunction: (tileCoord) => {
          const ol_z_idx = tileCoord[0];
          const x = tileCoord[1];
          const y_ol = tileCoord[2];
          
          const z_filename = currentZLayer;
          const filenameY = -y_ol - 1;

          // Check bounds
          if (x < 0 || x > 5 || filenameY < 0 || filenameY > 4) {
            return undefined;
          }

          return `/api/maps/${mapId}/tiles/${z_filename}/${x}/${filenameY}`;
        },
      });

      // 4. Vector and heatmap sources
      Logger.debug("misc", `[HeatmapDebug] Creating vector sources and layers`);
      vectorSourceRef.current = new VectorSource();
      heatmapSourceRef.current = new VectorSource();
      
      // Create the base tile layer
      const tileLayer = new TileLayer({ 
        source: tileSource,
        zIndex: LayerManager.LAYER_Z_INDEXES.BASE_TILE,
        properties: {
          layerType: LayerManager.LayerType.BASEMAP,
          id: LayerManager.LAYER_IDS.BASE_TILE
        }
      });

      // Create marker layer
      const markerLayer = new VectorLayer({
        source: vectorSourceRef.current,
        style: (feature) => getMarkerStyle(feature, labelCategoryIds),
        zIndex: LayerManager.LAYER_Z_INDEXES.MARKERS,
        maxZoom,
        properties: {
          layerType: LayerManager.LayerType.MARKER,
          id: LayerManager.LAYER_IDS.MARKERS
        }
      });
      
      // Get initial heatmap parameters
      const initialHeatmapParams = getHeatmapParams(initialZoom);
      
      // Create heatmap layer using LayerManager approach to ensure consistency
      // Create a bare heatmap layer with source only, other properties will be set via LayerManager
      const heatmapLayer = new HeatmapLayer({
        source: heatmapSourceRef.current,
        blur: initialHeatmapParams.blur,
        radius: initialHeatmapParams.radius,
        // Enhanced weight function that considers both weight and radiusFactor
        weight: (feature) => {
          const weight = feature.get("weight");
          // Also consider radiusFactor if available (we'll slightly adjust weight instead)
          const radiusFactor = feature.get("radiusFactor");
          const baseWeight = typeof weight === 'number' ? weight : 1;
          
          // Use a more balanced power factor to distribute colors more evenly
          return typeof radiusFactor === 'number' ? 
            baseWeight * Math.pow(radiusFactor, 1.7) : baseWeight;
        },
        opacity: initialHeatmapParams.opacity,
        zIndex: LayerManager.LAYER_Z_INDEXES.HEATMAP,
        // Use ETHYRIAL_GRADIENT from heatmapUtils for consistency across components
        gradient: ETHYRIAL_GRADIENT,
        visible: true,
        properties: {
          layerType: LayerManager.LayerType.HEATMAP,
          id: LayerManager.LAYER_IDS.HEATMAP
        }
      });

      // 5. Create map view
      const view = new View({
        projection: customProjection,
        center: initialCenter,
        zoom: initialZoom,
        resolutions,
        extent: mapExtent,
        minZoom: 1,
        maxZoom,
      });

      // 6. Create map instance
      const map = new Map({
        target: mapRef.current,
        layers: [tileLayer, heatmapLayer, markerLayer],
        view,
        controls: [],
      });

      // Store the map instance
      mapInstanceRef.current = map;

      // Set willReadFrequently on all canvas contexts to fix performance warnings
      const applyWillReadFrequently = () => {
        const canvases = map.getViewport().querySelectorAll('canvas');
        canvases.forEach(canvas => {
          // Get existing context
          const existingContext = canvas.getContext('2d');
          if (existingContext) {
            // Create a new context with willReadFrequently set to true
            canvas.getContext('2d', { willReadFrequently: true });
          }
        });
        Logger.debug("misc", "Applied willReadFrequently to all map canvases");
      };
      
      // Apply immediately and also after first render
      applyWillReadFrequently();
      map.once('rendercomplete', applyWillReadFrequently);

      // Ensure proper layer visibility and z-indexes
      LayerManager.ensureLayerVisibility(map, { logMessages: true });

      // Add listener for initial render completion
      map.once('rendercomplete', () => {
        Logger.debug("misc", `Map initial render complete`);
        
        // If we have heatmap data, update it via LayerManager
        if (heatmapData && map) {
          Logger.debug("misc", `Initializing heatmap via LayerManager after render`);
          LayerManager.updateHeatmapLayer(map, heatmapData);
        }
        
        // Ensure proper heatmap gradient is set using the gradient from utils
        const heatmapLayer = LayerManager.getLayerById(map, LayerManager.LAYER_IDS.HEATMAP) as HeatmapLayer;
        if (heatmapLayer) {
          Logger.debug("misc", `Setting consistent ETHYRIAL_GRADIENT on heatmap layer`);
          heatmapLayer.setGradient(ETHYRIAL_GRADIENT);
          heatmapLayer.changed();
        }
      });

      // Add listener for zoom changes to update heatmap parameters
      let lastProcessedZoom = initialZoom;
      let zoomTimeoutId: number | undefined;
      
      map.getView().on('change:resolution', () => {
        const currentZoom = Math.round(map.getView().getZoom() || 0);
        
        if (currentZoom === lastProcessedZoom) return;
        
        lastProcessedZoom = currentZoom;
        clearTimeout(zoomTimeoutId);
        
        zoomTimeoutId = window.setTimeout(() => {
          const heatmapLayer = LayerManager.getLayerById(map, LayerManager.LAYER_IDS.HEATMAP) as HeatmapLayer;
          if (!heatmapLayer) return;
          
          const params = getHeatmapParams(currentZoom);
          heatmapLayer.setRadius(params.radius);
          heatmapLayer.setBlur(params.blur);
          heatmapLayer.setOpacity(params.opacity);
        }, 50);
      });

      if (onMapReady) {
        onMapReady(map);
      }

      // Add drag tracking
      map.on('pointerdrag', () => {
        interactionStateRef.current.isDragging = true;
        interactionStateRef.current.dragCount++;
        
        if (timeoutIdRef.current) {
          clearTimeout(timeoutIdRef.current);
          interactionStateRef.current.viewUpdatesPending--;
        }
      });

      map.getViewport().addEventListener('pointerup', () => {
        if (interactionStateRef.current.isDragging) {
          const now = performance.now();
          const timeSinceLastDrag = now - interactionStateRef.current.lastDragEnd;
          
          if (timeSinceLastDrag < 200) {
            interactionStateRef.current.quickDragAttempts++;
          } else {
            interactionStateRef.current.quickDragAttempts = 0;
          }
          
          setTimeout(() => {
            interactionStateRef.current.isDragging = false;
          }, 50);
          
          interactionStateRef.current.lastDragEnd = now;
          interactionStateRef.current.dragCount = 0;
        }
      });

      // Handle view changes
      moveEndHandlerRef.current = () => {
        if (interactionStateRef.current.isDragging) {
          return;
        }
        
        if (map.getTargetElement()) {
          map.getTargetElement().style.pointerEvents = 'auto';
        }
        
        if (timeoutIdRef.current) {
          clearTimeout(timeoutIdRef.current);
          interactionStateRef.current.viewUpdatesPending--;
        }
        
        interactionStateRef.current.viewUpdatesPending++;
        timeoutIdRef.current = window.setTimeout(() => {
          try {
            interactionStateRef.current.viewUpdatesPending--;
            
            if (!mapInstanceRef.current) return;
            
            const currentView = map.getView();
            const zoom = currentView.getZoom();
            const center = currentView.getCenter();

            if (center && zoom !== undefined) {
              if (interactionStateRef.current.viewUpdatesPending > 0) return;
              updateUrlWithResource(selectedResourceId);
            }

            if (onViewChange && zoom !== undefined && !interactionStateRef.current.isDragging) {
              if (interactionStateRef.current.viewUpdatesPending > 0) return;
              
              const extent = currentView.calculateExtent(map.getSize());
              onViewChange(Math.round(zoom), extent);
            }
          } catch (error) {
            Logger.error("misc", new Error(`Error in moveEnd handler: ${error}`));
          }
        }, 100);
      };

      map.on("moveend", moveEndHandlerRef.current);

      // Set cursor style on hover for features
      map.on('pointermove', (evt) => {
        if (evt.dragging) return;
        
        const pixel = map.getEventPixel(evt.originalEvent);
        const hit = map.hasFeatureAtPixel(pixel);
        
        map.getTargetElement().style.cursor = hit ? 'pointer' : '';
      });

      // Setup context menu
      const handleContextMenuEvent = (e: MouseEvent) => {
        e.preventDefault();
        
        const pixel = map.getEventPixel({ clientX: e.clientX, clientY: e.clientY });
        const coord = map.getCoordinateFromPixel(pixel);
        const zoom = Math.round(map.getView().getZoom() || 0);
        
        if (coord) {
          handleContextMenu(e, {
            x: Math.round(coord[0]),
            y: Math.round(coord[1]),
            z: zoom
          });
        }
      };

      contextMenuHandlerRef.current = handleContextMenuEvent;
      
      const preventContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        return false;
      };

      preventContextMenuRef.current = preventContextMenu;
      
      map.getViewport().addEventListener('contextmenu', handleContextMenuEvent);
      map.getTargetElement().addEventListener('contextmenu', preventContextMenu);
    } catch (err: any) {
      Logger.error("Failed to initialize map", err);
      setError(`Failed to initialize map: ${err.message || "Unknown error"}`);
    }

    // Cleanup on unmount
    return () => {
      clearTimeout(timeoutIdRef.current);

      const mapInstance = mapInstanceRef.current;
      const handler = moveEndHandlerRef.current;
      const contextMenuHandler = contextMenuHandlerRef.current;
      
      if (mapInstance) {
        if (handler) {
          mapInstance.un("moveend", handler);
        }
        
        if (contextMenuHandler) {
          mapInstance.getViewport().removeEventListener('contextmenu', contextMenuHandler);
        }
        
        const preventHandler = preventContextMenuRef.current;
        if (mapInstance.getTargetElement() && preventHandler) {
          mapInstance.getTargetElement().removeEventListener('contextmenu', preventHandler);
        }
        
        mapInstance.setTarget(undefined);
      }
      
      mapInstanceRef.current = null;
      moveEndHandlerRef.current = null;
      contextMenuHandlerRef.current = null;
      Logger.info("misc", "OpenLayers map disposed");
    };
  }, [mapId, labelCategoryIds, onMapReady, onViewChange, onResourceSelect, selectedResourceId, currentZLayer, updateUrlWithResource, getMarkerStyle, heatmapData]);

  // Update heatmap data effect - use LayerManager
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    if (heatmapData) {
      Logger.debug("misc", `Updating heatmap via LayerManager with ${heatmapData.points.length} points`);
      LayerManager.updateHeatmapLayer(mapInstanceRef.current, heatmapData);
    } else {
      Logger.debug("misc", "Clearing heatmap via LayerManager");
      LayerManager.clearHeatmapLayer(mapInstanceRef.current);
    }
  }, [heatmapData]);

  // Marker update effect - using LayerManager now happens in Map/index.tsx

  if (error) {
    return <MapContainer>Error: {error}</MapContainer>;
  }

  return (
    <MapContainer ref={mapRef} className="font-asul">
      {/* Use our custom MapFeatureTooltip for OpenLayers integration */}
      {mapInstanceRef.current && (
        <MapFeatureTooltip map={mapInstanceRef.current} />
      )}
      
      {/* Popup container remains for backward compatibility */}
      <div
        ref={popupRef}
        className="absolute hidden z-20 border border-[#1A1A1A] rounded-sm p-1.5 bg-[#38322c] min-w-[150px] max-w-[300px]"
      >
        <div className="relative bg-[#151515] text-white px-2 py-1 rounded-sm border-t border-l border-[#4e443a] border-b border-r border-[#2c2824]">
          <button
            className="popup-closer absolute top-0 right-0 px-1 text-lg text-gray-400 hover:text-white"
            aria-label="Close popup"
          >
            &times;
          </button>
          <div ref={popupContentRef} className="pt-1 pr-4" />
        </div>
      </div>
      
      {isContextMenuOpen && (
        <IngameContextMenu
          coordX={contextMenuCoords.x}
          coordY={contextMenuCoords.y}
          coordZ={contextMenuCoords.z}
          position={contextMenuPosition}
          onClose={handleContextMenuClose}
        />
      )}
      
      <ZLayerOverlay 
        currentZLayer={currentZLayer} 
        onChange={handleZLayerChange} 
      />
    </MapContainer>
  );
};

export default EthyrialMapFull;