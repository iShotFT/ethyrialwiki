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
import { getHeatmapParams } from "../utils/heatmapUtils";
import { parseMapHash, updateMapHashWithZ, encodeResource } from "../utils/mapUtils";
import { createLabelStyleBase, createStandardMarkerStyleFunction } from "../utils/markerStyleUtils";
import IngameContextMenu, { useContextMenu } from './EthyrialStyle/IngameContextMenu';
import { ZLayerOverlay } from './MapOverlays';
import type { Coordinate as ServerCoordinate } from "@server/models/Marker";
import type { AggregatedPoint } from "@server/utils/PointAggregator";
import { useMarkerStyleContext } from './MarkerStyleContext';

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
  onHeatmapLayersReady?: (layer: HeatmapLayer, source: VectorSource) => void;
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
  onHeatmapLayersReady,
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
  const heatmapLayerRef = useRef<HeatmapLayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const popupContentRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<Overlay | null>(null);
  const moveEndHandlerRef = useRef<(() => void) | null>(null);
  const timeoutIdRef = useRef<number | undefined>();
  const heatmapInitializedRef = useRef<boolean>(false);

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
        zIndex: 1,
        properties: {
          layerType: 'basemap',
          id: 'base-osm'
        }
      });

      // Create marker layer with shared style function
      const markerLayer = new VectorLayer({
        source: vectorSourceRef.current,
        style: (feature) => getMarkerStyle(feature, labelCategoryIds),
        zIndex: 10,
        maxZoom,
        properties: {
          layerType: 'marker',
          id: 'main-markers'
        }
      });
      
      // Get initial heatmap parameters
      const initialHeatmapParams = getHeatmapParams(initialZoom);
      
      // Create heatmap layer
      const heatmapLayer = new HeatmapLayer({
        source: heatmapSourceRef.current,
        blur: initialHeatmapParams.blur,
        radius: initialHeatmapParams.radius,
        weight: (feature) => {
          const weight = feature.get("weight");
          return typeof weight === 'number' ? weight : 1;
        },
        opacity: initialHeatmapParams.opacity,
        zIndex: 5,
        gradient: [
          'rgba(0,0,255,0.6)',
          'rgba(0,255,255,0.7)', 
          'rgba(0,255,0,0.7)', 
          'rgba(255,255,0,0.8)', 
          'rgba(255,128,0,0.9)', 
          'rgba(255,0,0,1.0)'
        ],
        visible: true,
        properties: {
          layerType: 'heatmap',
          id: 'main-heatmap'
        }
      });
      heatmapLayerRef.current = heatmapLayer;

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

      // Ensure proper layer order
      tileLayer.setZIndex(1);
      heatmapLayer.setZIndex(5);
      markerLayer.setZIndex(10);

      mapInstanceRef.current = map;

      // Add listener for initial render completion
      map.once('rendercomplete', () => {
        Logger.debug("misc", `[HeatmapDebug] Map initial render complete`);
        heatmapInitializedRef.current = true;
        
        if (heatmapData && heatmapSourceRef.current) {
          Logger.debug("misc", `[HeatmapDebug] Map ready for heatmap rendering after initial render`);
          // The hook will handle heatmap updates
        }
      });

      // Add listener for zoom changes to update heatmap parameters
      let lastProcessedZoom = initialZoom;
      let zoomTimeoutId: number | undefined;
      
      map.getView().on('change:resolution', () => {
        const currentZoom = Math.round(map.getView().getZoom() || 0);
        
        if (!heatmapLayerRef.current || currentZoom === lastProcessedZoom) return;
        
        lastProcessedZoom = currentZoom;
        clearTimeout(zoomTimeoutId);
        
        zoomTimeoutId = window.setTimeout(() => {
          if (!heatmapLayerRef.current) return;
          
          const params = getHeatmapParams(currentZoom);
          heatmapLayerRef.current.setRadius(params.radius);
          heatmapLayerRef.current.setBlur(params.blur);
          heatmapLayerRef.current.setOpacity(params.opacity);
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

      // Create popup overlay
      if (popupRef.current && !overlayRef.current) {
        const overlay = new Overlay({
          element: popupRef.current,
          autoPan: { animation: { duration: 250 } },
          positioning: "bottom-center",
          offset: [0, -10],
        });
        overlayRef.current = overlay;
        map.addOverlay(overlay);

        const closerElement = popupRef.current.querySelector(".popup-closer");
        if (closerElement) {
          closerElement.addEventListener("click", () => {
            overlay.setPosition(undefined);
            return false;
          });
        }
      }

      // Add click handler for features
      map.on("click", (evt) => {
        const feature = map.forEachFeatureAtPixel(evt.pixel, (feature) => feature);
        const overlay = overlayRef.current;
        const contentEl = popupContentRef.current;

        if (feature && overlay && contentEl) {
          const coordinates = (feature.getGeometry() as Point).getCoordinates();
          const title = feature.get("title") || "Unnamed Marker";
          const description = feature.get("description") || "No description.";

          contentEl.innerHTML = `<div class="font-bold mb-1">${title}</div><div class="text-xs">${description}</div>`;
          overlay.setPosition(coordinates);
        } else if (overlay) {
          overlay.setPosition(undefined);
        }
      });

      // Add cursor change on hover
      map.on("pointermove", (e) => {
        const pixel = map.getEventPixel(e.originalEvent);
        const hit = map.hasFeatureAtPixel(pixel);
        const target = map.getTargetElement();
        if (target) {
          target.style.cursor = hit ? "pointer" : "";
        }
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

      // Expose heatmap layer and source to parent component
      if (typeof onHeatmapLayersReady === 'function') {
        Logger.debug("misc", `[HEATMAP_FLOW] Calling onHeatmapLayersReady with layer and source references`);
        onHeatmapLayersReady(heatmapLayer, heatmapSourceRef.current);
      }
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
      heatmapInitializedRef.current = false;
      Logger.info("misc", "OpenLayers map disposed");
    };
  }, [mapId, labelCategoryIds, onMapReady, onViewChange, onResourceSelect, selectedResourceId, currentZLayer, updateUrlWithResource, onHeatmapLayersReady, getMarkerStyle]);

  // Marker update effect
  useEffect(() => {
    if (!vectorSourceRef.current || !allMarkers || !mapInstanceRef.current) {
      return;
    }
    
    const currentZoom = mapInstanceRef.current.getView().getZoom();
    const roundedZoom = currentZoom !== undefined ? Math.round(currentZoom) : undefined;
    
    let markerLayer: VectorLayer<any> | null = null;
    if (mapInstanceRef.current) {
      const allLayers = mapInstanceRef.current.getLayers().getArray();
      for (const layer of allLayers) {
        if (layer instanceof VectorLayer && 
            ((layer.get('layerType') === 'marker') || 
             (layer.getSource() === vectorSourceRef.current))) {
          markerLayer = layer;
          break;
        }
      }
    }
    
    const wasVisible = markerLayer ? markerLayer.getVisible() : true;
    
    vectorSourceRef.current.clear();
    const features = allMarkers
      .filter((marker) => visibleCategoryIds[marker.categoryId] !== false)
      .map((marker) => {
        if (!marker.coordinate) {
          return null;
        }
        try {
          const feature = new Feature({
            geometry: new Point([marker.coordinate.x, marker.coordinate.y]),
            id: marker.id,
            title: marker.title,
            description: marker.description,
            categoryId: marker.categoryId,
            iconId: marker.iconId,
            _mapZoom: roundedZoom,
          });
          feature.setId(marker.id);
          return feature;
        } catch (error) {
          Logger.error(`Error creating feature for marker ${marker.id}`, error);
          return null;
        }
      })
      .filter(Boolean) as Feature[];

    vectorSourceRef.current.addFeatures(features);
    
    if (markerLayer) {
      if (wasVisible) {
        markerLayer.setVisible(true);
      }
      markerLayer.setZIndex(10);
    }
  }, [allMarkers, visibleCategoryIds, mapInstanceRef, labelCategoryIds]);

  // Heatmap layer visibility effect
  useEffect(() => {
    if (!mapInstanceRef.current || !vectorSourceRef.current) {
      return;
    }
    
    Logger.debug("misc", `[HEATMAP_FLOW] Layer visibility effect triggered - heatmap data changed, has data: ${!!heatmapData}`);
    
    const map = mapInstanceRef.current;
    let markerLayer = null;
    let heatmapLayer = null;
    
    const allLayers = map.getLayers().getArray();
    
    for (const layer of allLayers) {
      if (layer instanceof VectorLayer && 
          typeof layer.getSource === 'function' && 
          layer.getSource() === vectorSourceRef.current) {
        markerLayer = layer;
      }
      
      if (layer instanceof HeatmapLayer && 
          typeof layer.getSource === 'function' && 
          layer.getSource() === heatmapSourceRef.current) {
        heatmapLayer = layer;
      }
      
      if (markerLayer && heatmapLayer) break;
    }
    
    if (markerLayer) {
      markerLayer.setZIndex(10);
      markerLayer.setVisible(true);
    }
    
    if (heatmapLayer) {
      heatmapLayer.setZIndex(5);
      const newVisible = !!heatmapData;
      heatmapLayer.setVisible(newVisible);
    }
  }, [heatmapData, mapInstanceRef, vectorSourceRef, heatmapSourceRef]);

  // Heatmap layer initialization
  useEffect(() => {
    if (mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      
      if (!heatmapSourceRef.current) {
        heatmapSourceRef.current = new VectorSource({
          wrapX: false,
        });
      }
      
      if (heatmapLayerRef.current) {
        map.removeLayer(heatmapLayerRef.current);
        heatmapLayerRef.current = null;
      }
      
      const hasWebGL = (typeof document !== 'undefined' && 
        !!document.createElement('canvas').getContext('webgl2'));
      
      if (hasWebGL) {
        heatmapLayerRef.current = new HeatmapLayer({
          source: heatmapSourceRef.current,
          opacity: 0.8,
          blur: 15,
          radius: 10,
          weight: function(feature) {
            return feature.get('weight') || 1;
          },
          gradient: ['rgba(0, 0, 255, 0)', 'rgba(0, 0, 255, 1)', 'rgba(0, 255, 0, 1)', 'rgba(255, 255, 0, 1)', 'rgba(255, 0, 0, 1)'],
        });
      } else {
        heatmapLayerRef.current = new HeatmapLayer({
          source: heatmapSourceRef.current,
          opacity: 0.8,
          blur: 15,
          radius: 10,
          weight: function(feature) {
            return feature.get('weight') || 1;
          },
          gradient: ['rgba(0, 0, 255, 0)', 'rgba(0, 0, 255, 1)', 'rgba(0, 255, 0, 1)', 'rgba(255, 255, 0, 1)', 'rgba(255, 0, 0, 1)'],
        });
      }
      
      heatmapLayerRef.current.set('id', 'heatmap');
      heatmapLayerRef.current.set('layerType', 'heatmap');
      heatmapLayerRef.current.setVisible(false);
      heatmapLayerRef.current.setZIndex(5);
      map.addLayer(heatmapLayerRef.current);
      
      Logger.debug("misc", `[HeatmapInit] Created ${hasWebGL ? 'WebGL' : 'standard'} heatmap layer`);
    }
  }, []);

  if (error) {
    return <MapContainer>Error: {error}</MapContainer>;
  }

  return (
    <MapContainer ref={mapRef}>
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