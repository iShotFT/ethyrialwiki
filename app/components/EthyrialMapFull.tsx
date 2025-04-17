import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faChessRook,
  faCity,
  faCrosshairs,
  faDragon,
  faGem,
  faLeaf,
  faMapMarkerAlt,
  // New/Alternative Icons
  faPaw,
  faQuestionCircle,
  faScroll,
  faSkullCrossbones, // Skin
  faStreetView,
  faTree, // Dungeon
  faUniversity, // Bank
} from "@fortawesome/free-solid-svg-icons";
import type { Coordinate as ServerCoordinate } from "@server/models/Marker";
import type { AggregatedPoint } from "@server/utils/PointAggregator";
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
import { Style } from "ol/style";
import TileGrid from "ol/tilegrid/TileGrid";
import * as React from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import styled from "styled-components";
import { v5 as uuidv5 } from "uuid";
import Logger from "~/utils/Logger";
import { getHeatmapParams, updateHeatmap } from "../utils/heatmapUtils";
import { parseMapHash, updateMapHash, encodeResource, updateMapHashWithZ } from "../utils/mapUtils";
import { createLabelStyleBase, createMarkerStyleFunction } from "../utils/markerStyleUtils";
import IngameContextMenu, { useContextMenu } from './EthyrialStyle/IngameContextMenu';
import { ZLayerOverlay } from './MapOverlays';

// Define the namespace used in the seeder
const NAMESPACE_UUID = "f5d7a4e8-6a3b-4e6f-8a4c-7f3d7a1b9e0f";

// Type for marker data from API
interface ApiMarkerData {
  id: string;
  title: string;
  description: string | null;
  coordinate: ServerCoordinate | null; // Use ServerCoordinate type alias
  categoryId: string;
  iconId: string | null;
  iconUrl: string | null; // We might not need this if using GameItemIcon everywhere?
  isLabel: boolean; // Added isLabel
  categoryIsLabel: boolean; // Added categoryIsLabel
}

// Type for heatmap data prop (update to match Scene)
interface HeatmapData {
  points: AggregatedPoint[];
}

// Props expected by the component
type Props = {
  mapId: string;
  mapData: any; // Use specific type
  allMarkers: ApiMarkerData[];
  visibleCategoryIds: Record<string, boolean>;
  labelCategoryIds: Set<string>;
  heatmapData: HeatmapData | null;
  onMapReady: (map: OlMap) => void;
  onViewChange: (zoom: number, extent: Extent) => void;
  selectedResourceId?: string; // Add prop for currently selected resource
  onResourceSelect?: (resourceId: string | null) => void; // Callback when resource is selected from URL
};

// Styled component for the map container
const MapContainer = styled.div`
  width: 100%;
  height: 100%;
  background-color: #2a61e2;
`;

// Reuse the category icon map (could be moved to a shared file)
const categoryIconMap: Record<string, IconDefinition> = {
  [uuidv5("ORE", NAMESPACE_UUID)]: faGem,
  [uuidv5("HERB", NAMESPACE_UUID)]: faLeaf,
  [uuidv5("SKIN", NAMESPACE_UUID)]: faPaw,
  [uuidv5("TREE", NAMESPACE_UUID)]: faTree,
  [uuidv5("CLOTH", NAMESPACE_UUID)]: faScroll,
  [uuidv5("ENEMY", NAMESPACE_UUID)]: faSkullCrossbones,
  [uuidv5("POI", NAMESPACE_UUID)]: faMapMarkerAlt,
  [uuidv5("NPC", NAMESPACE_UUID)]: faCrosshairs,
  [uuidv5("TOWN", NAMESPACE_UUID)]: faCity,
  [uuidv5("DUNGEON", NAMESPACE_UUID)]: faChessRook,
  [uuidv5("BANK", NAMESPACE_UUID)]: faUniversity,
  [uuidv5("TELEPORT", NAMESPACE_UUID)]: faStreetView,
  [uuidv5("DAILY_QUEST", NAMESPACE_UUID)]: faScroll,
  [uuidv5("RAID", NAMESPACE_UUID)]: faDragon,
  [uuidv5("WORLD_BOSS", NAMESPACE_UUID)]: faDragon,
  [uuidv5("OTHER", NAMESPACE_UUID)]: faQuestionCircle,
};

// Log the generated map keys once for verification
Logger.debug(
  "misc",
  `Category Icon Map Keys: ${JSON.stringify(Object.keys(categoryIconMap))}`
);

// Keep the icon style cache
const iconStyleCache: Record<string, Style> = {};

// Replace the inline label style with the utility function
const labelStyleBase = createLabelStyleBase();

// Replace getMarkerStyle function with the utility version
const getMarkerStyle = createMarkerStyleFunction(iconStyleCache, categoryIconMap, labelStyleBase);

// Helper function to get a unique identifier for a layer
const getLayerIdentifier = (layer: any): string => {
  // Try to get a meaningful identifier
  if (layer.get && typeof layer.get === 'function') {
    const layerType = layer.get('layerType');
    if (layerType) return layerType;
    
    const id = layer.get('id');
    if (id) return id.toString();
  }
  
  // Fallback to a generic identifier with layer index
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
  // Log received props
  Logger.debug(
    "misc",
    `[EthyrialMapFull] Received mapId: ${mapId}, mapData: ${
      mapData ? "Yes" : "No"
    }, markers: ${allMarkers?.length ?? 0}`
  );

  // Add debug logging for heatmap data
  useEffect(() => {
    if (heatmapData) {
      Logger.debug(
        "misc", 
        `[HeatmapDebug] Received new heatmap data with ${heatmapData.points.length} points`
      );
    } else {
      Logger.debug("misc", `[HeatmapDebug] Received null heatmap data`);
    }
  }, [heatmapData]);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource>(new VectorSource());
  const heatmapSourceRef = useRef<VectorSource>(new VectorSource());
  const heatmapLayerRef = useRef<HeatmapLayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const popupContentRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<Overlay | null>(null);
  // Ref to store the moveend handler function
  const moveEndHandlerRef = useRef<(() => void) | null>(null);
  // Ref to store the timeout ID for moveend debouncing
  const timeoutIdRef = useRef<number | undefined>();
  // Add ref to track heatmap initialization state
  const heatmapInitializedRef = useRef<boolean>(false);

  // Context menu state
  const {
    isOpen: isContextMenuOpen,
    position: contextMenuPosition,
    coords: contextMenuCoords,
    handleContextMenu,
    handleClose: handleContextMenuClose
  } = useContextMenu();

  // === Track interaction state to help debug drag issues ===
  const interactionStateRef = useRef({
    isDragging: false,
    lastDragEnd: 0,
    dragCount: 0,
    quickDragAttempts: 0,
    viewUpdatesPending: 0,
  });

  // Track the last resource we encoded in the URL to avoid unnecessary updates
  const lastEncodedResourceRef = useRef<string | null>(null);

  // Store a reference to the event handler functions
  const contextMenuHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);
  const preventContextMenuRef = useRef<((e: MouseEvent) => void) | null>(null);

  // Add state for the current Z-layer (height)
  const [currentZLayer, setCurrentZLayer] = useState<number>(1);

  // Add a handler for Z-layer changes
  const handleZLayerChange = useCallback((newZLayer: number) => {
    Logger.debug("misc", `[ZLayerDebug] Changing Z-layer from ${currentZLayer} to ${newZLayer}`);
    
    // Find the tile layer
    if (mapInstanceRef.current) {
      const tileLayer = mapInstanceRef.current.getLayers().getArray().find(
        layer => layer.get('layerType') === 'basemap'
      );
      
      if (tileLayer) {
        // Create a smooth transition by temporarily reducing opacity
        // and creating a cross-fade effect
        const originalOpacity = tileLayer.getOpacity();
        
        // Start transition - reduce opacity
        tileLayer.setOpacity(0.3);
        
        // Delay the actual Z-layer update to allow transition to be visible
        setTimeout(() => {
          // Update the Z-layer state - this will trigger a re-render of tiles
          setCurrentZLayer(newZLayer);
          
          // Delay restoring opacity until after new tiles have loaded
          setTimeout(() => {
            // Smoothly restore original opacity
            const fadeIn = (step: number) => {
              if (step <= 10) {
                const newOpacity = 0.3 + (originalOpacity - 0.3) * (step / 10);
                tileLayer.setOpacity(newOpacity);
                setTimeout(() => fadeIn(step + 1), 20);
              }
            };
            
            fadeIn(1);
          }, 100);
        }, 50);
      } else {
        // No fade if we can't find the layer
        setCurrentZLayer(newZLayer);
      }
      
      // Update URL hash to include Z-layer
      const view = mapInstanceRef.current.getView();
      const zoom = view.getZoom();
      const center = view.getCenter();
      
      if (center && zoom !== undefined) {
        updateMapHashWithZ(Math.round(zoom), center as [number, number], newZLayer, selectedResourceId);
      }
    } else {
      // No map instance, just update the state
      setCurrentZLayer(newZLayer);
    }
  }, [currentZLayer, mapInstanceRef, selectedResourceId]);

  // Replace updateUrlWithResource with an improved version
  const updateUrlWithResource = useCallback((resourceId: string | undefined) => {
    if (!mapInstanceRef.current) return;
    
    const map = mapInstanceRef.current;
    const currentView = map.getView();
    const zoom = Math.round(currentView.getZoom() || 0);
    const center = currentView.getCenter();
    
    if (!center || zoom === undefined) return;
    
    // Only update if resourceId has changed to avoid unnecessary URL updates
    if (resourceId === lastEncodedResourceRef.current) {
      Logger.debug("misc", `[ResourceDebug] Skip URL update, unchanged resource: ${resourceId}`);
      return;
    }
    
    // Update reference BEFORE any async operations to prevent race conditions
    lastEncodedResourceRef.current = resourceId || null;
    
    // Use requestAnimationFrame to avoid React update conflicts during drag operations
    requestAnimationFrame(() => {
      try {
        // Build the base hash with position and z-layer - moved inside the RAF callback
        let newHash = `#map=${Math.round(zoom)}/${Math.round(center[0])}/${Math.round(center[1])}/${currentZLayer}`;
        
        // Add resource info if available
        if (resourceId) {
          // Do the encoding in a try/catch to handle any potential errors
          try {
            const encodedResource = encodeResource(resourceId);
            if (encodedResource) {
              newHash += `/${encodedResource}`;
            }
          } catch (err) {
            Logger.warn("misc", new Error(`Failed to encode resource ID: ${err}`));
          }
        }
        
        // Update URL without triggering a navigation
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, "", newHash);
          Logger.debug("misc", `[ZLayerDebug] Updated URL hash: ${newHash}`);
        }
      } catch (error) {
        Logger.error("misc", new Error(`Error updating URL with resource: ${error}`));
      }
    });
  }, [currentZLayer, mapInstanceRef]);

  // === OpenLayers Setup Effect ===
  useEffect(() => {
    Logger.debug("misc", `[HeatmapDebug] Map setup starting. mapRef.current: ${!!mapRef.current}, mapId: ${!!mapId}`);
    
    if (!mapRef.current || !mapId) {
      Logger.debug("misc", `[HeatmapDebug] Map setup aborted - missing refs or mapId`);
      return;
    }
    if (mapInstanceRef.current) {
      Logger.warn(
        "utils",
        new Error("Attempted to re-initialize map that already exists.")
      );
      return;
    }

    try {
      // 1. Define Custom Projection & Extent
      const tileWidth = 1000;
      const tileHeight = 1000;
      const minX = 0;
      const maxX = 5;
      const minY = 0;
      const maxY = 4;
      const mapExtent = [0, 0, 6000, 5000];

      Logger.debug("misc", `[HeatmapDebug] Creating projection with extent: ${JSON.stringify(mapExtent)}`);
      const customProjection = new Projection({
        code: "pixel-coords", // More descriptive code
        units: "pixels",
        extent: mapExtent,
      });

      // 2. Define Resolutions & TileGrid
      // Only one resolution level since we always load the same detailed tiles
      // const resolutions = [1];
      // Define multiple resolutions to ALLOW zooming out (scaling tiles)
      const resolutions = [32, 16, 8, 4, 2, 1, 0.5, 0.25]; // Added 32
      const maxZoom = resolutions.length - 1 + 4;
      const minZoom = 4;
      const displayZLevel = 1;

      // Initial view settings (will be potentially overridden by URL hash)
      let initialCenter = getCenter(mapExtent);
      let initialZoom = 4;
      let initialResourceId: string | null = null;
      let initialZLayer = 1; // Default Z-layer

      // Parse URL hash to extract Z-layer if present
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
        resolutions: [1], // Grid based on the single *source* resolution
        tileSize: [tileWidth, tileHeight],
      });

      // 3. Create TileImage Source with Z-layer support
      const tileSource = new TileImage({
        projection: customProjection,
        tileGrid,
        wrapX: false,
        transition: 200, // Add transition time for smoother tile loading
        tileUrlFunction: (tileCoord) => {
          const ol_z_idx = tileCoord[0]; // OL zoom level index (always 0)
          const x = tileCoord[1];
          const y_ol = tileCoord[2];
          
          // Use the current Z-layer from state instead of a fixed value
          const z_filename = currentZLayer;

          // Apply the y = -y_ol - 1 transformation
          const filenameY = -y_ol - 1;

          Logger.debug(
            "misc",
            `Tile Request: OLCoord=[${ol_z_idx},${x},${y_ol}] -> TransformedY=${filenameY}, Z=${z_filename} -> FileNameCoords=[${z_filename},${x},${filenameY}]`
          );

          // Check bounds based on filename ranges (0-5 for x, 0-4 for y)
          if (x < minX || x > maxX || filenameY < minY || filenameY > maxY) {
            return undefined;
          }

          return `/api/maps/${mapId}/tiles/${z_filename}/${x}/${filenameY}`;
        },
      });

      // 4. Vector Source & Layers
      Logger.debug("misc", `[HeatmapDebug] Creating vector sources and layers`);
      vectorSourceRef.current = new VectorSource();
      heatmapSourceRef.current = new VectorSource();
      
      Logger.debug("misc", `[HeatmapDebug] Vector sources created: vectorSource=${!!vectorSourceRef.current}, heatmapSource=${!!heatmapSourceRef.current}`);
      
      // Create a base tile layer
      const tileLayer = new TileLayer({ 
        source: tileSource,
        zIndex: 1,  // Lowest z-index for base layer
        properties: {
          layerType: 'basemap',
          id: 'base-osm'
        }
      });

      // Create the marker layer with high z-index to stay on top
      const markerLayer = new VectorLayer({
        source: vectorSourceRef.current,
        style: (feature) => getMarkerStyle(feature, labelCategoryIds),
        zIndex: 10, // Highest z-index to ensure it stays on top
        maxZoom,
        properties: {
          layerType: 'marker',
          id: 'main-markers'
        }
      });
      
      Logger.debug("misc", `[HeatmapDebug] Creating heatmap layer`);
      
      // Get initial heatmap parameters based on initial zoom
      const initialHeatmapParams = getHeatmapParams(initialZoom);
      
      // Create heatmap layer with initial parameters
      const heatmapLayer = new HeatmapLayer({
        source: heatmapSourceRef.current,
        blur: initialHeatmapParams.blur,
        radius: initialHeatmapParams.radius,
        weight: (feature) => {
          // Get weight from feature, defaulting to 1 if not set
          const weight = feature.get("weight");
          return typeof weight === 'number' ? weight : 1;
        },
        opacity: initialHeatmapParams.opacity,
        zIndex: 5, // Middle z-index, between base and markers
        gradient: [
          'rgba(0,0,255,0.6)', // Blue with transparency
          'rgba(0,255,255,0.7)', 
          'rgba(0,255,0,0.7)', 
          'rgba(255,255,0,0.8)', 
          'rgba(255,128,0,0.9)', 
          'rgba(255,0,0,1.0)' // Red fully opaque
        ],
        visible: true,
        properties: {
          layerType: 'heatmap',
          id: 'main-heatmap'
        }
      });
      heatmapLayerRef.current = heatmapLayer;
      Logger.debug("misc", `[HeatmapDebug] Heatmap layer created: ${!!heatmapLayerRef.current}`);

      // 5. Create View
      const view = new View({
        projection: customProjection,
        center: initialCenter,
        zoom: initialZoom,
        resolutions, // Provide all allowed resolutions for view scaling
        extent: mapExtent,
        minZoom: 1, // Lower minZoom to 1 to allow more zoom out
        maxZoom, // Keep maxZoom
      });

      // 6. Create Map Instance
      Logger.debug("misc", `[HeatmapDebug] Creating map instance with layers`);
      const map = new Map({
        target: mapRef.current,
        // Change the layer order to ensure markers appear above heatmap
        // Put the marker layer LAST in the array so it will render on top
        layers: [tileLayer, heatmapLayer, markerLayer],
        view,
        controls: [], // Start with no controls
      });

      // Explicitly set zIndex values to ensure proper stacking order
      tileLayer.setZIndex(1);
      heatmapLayer.setZIndex(5);
      markerLayer.setZIndex(10); // Ensure marker layer has highest zIndex

      mapInstanceRef.current = map;
      Logger.debug("misc", `[HeatmapDebug] Map instance created: ${!!mapInstanceRef.current}`);

      // Add a listener to detect when map is actually rendered for the first time
      map.once('rendercomplete', () => {
        Logger.debug("misc", `[HeatmapDebug] Map initial render complete`);
        heatmapInitializedRef.current = true;
        
        // Force an update of the heatmap after initialization is confirmed
        if (heatmapData && heatmapSourceRef.current) {
          Logger.debug("misc", `[HeatmapDebug] Forcing heatmap update after initial render`);
          handleHeatmapUpdate(heatmapData);
        }
      });

      // Add listener to update heatmap parameters on zoom change
      // Keep track of last zoom to avoid unnecessary updates
      let lastProcessedZoom = initialZoom;
      
      // Use a timeout to debounce parameter updates during continuous zooming
      let zoomTimeoutId: number | undefined;
      
      map.getView().on('change:resolution', () => {
        const currentZoom = Math.round(map.getView().getZoom() || 0);
        
        // Skip if no heatmap layer or zoom hasn't changed
        if (!heatmapLayerRef.current || currentZoom === lastProcessedZoom) return;
        
        // Update last processed zoom
        lastProcessedZoom = currentZoom;
        
        // Clear any pending zoom timeout
        clearTimeout(zoomTimeoutId);
        
        // Wait for zooming to settle before applying parameter changes
        zoomTimeoutId = window.setTimeout(() => {
          if (!heatmapLayerRef.current) return;
          
          // Get parameters for current zoom level
          const params = getHeatmapParams(currentZoom);
          
          // Apply new parameters without logging to reduce console spam
          heatmapLayerRef.current.setRadius(params.radius);
          heatmapLayerRef.current.setBlur(params.blur);
          heatmapLayerRef.current.setOpacity(params.opacity);
        }, 50); // Apply parameters after zooming settles
      });

      if (onMapReady) {
        onMapReady(map);
      }

      // Add listeners for drag debugging
      map.on('pointerdrag', (event) => {
        // Set dragging state to true
        interactionStateRef.current.isDragging = true;
        interactionStateRef.current.dragCount++;
        
        // Log every 10th drag event to avoid flooding console
        if (interactionStateRef.current.dragCount % 10 === 0) {
          Logger.debug("misc", `[DragDebug] Drag in progress (#${interactionStateRef.current.dragCount})`);
        }
        
        // Cancel any pending view updates during drag
        if (timeoutIdRef.current) {
          clearTimeout(timeoutIdRef.current);
          interactionStateRef.current.viewUpdatesPending--;
          Logger.debug("misc", `[DragDebug] Cancelled pending view update during drag (${interactionStateRef.current.viewUpdatesPending} pending)`);
        }
      });

      // Add pointer up to catch drag end
      map.getViewport().addEventListener('pointerup', () => {
        if (interactionStateRef.current.isDragging) {
          const now = performance.now();
          const timeSinceLastDrag = now - interactionStateRef.current.lastDragEnd;
          
          // Log and track quick attempts at dragging
          if (timeSinceLastDrag < 200) {
            interactionStateRef.current.quickDragAttempts++;
            Logger.debug("misc", `[DragDebug] Quick drag detected! ${timeSinceLastDrag.toFixed(0)}ms since last drag (attempt #${interactionStateRef.current.quickDragAttempts})`);
          } else {
            interactionStateRef.current.quickDragAttempts = 0;
          }
          
          interactionStateRef.current.isDragging = false;
          interactionStateRef.current.lastDragEnd = now;
          Logger.debug("misc", `[DragDebug] Drag ended after ${interactionStateRef.current.dragCount} movements`);
          interactionStateRef.current.dragCount = 0;
        }
      });

      // Define handleMoveEnd and store it in the ref - with safeguards against React errors
      moveEndHandlerRef.current = () => {
        // Log moveend firing
        Logger.debug("misc", `[DragDebug] moveend triggered, isDragging=${interactionStateRef.current.isDragging}`);
        
        // Immediately ensure the map is interactive - do this BEFORE any other operations
        if (map.getTargetElement()) {
          requestAnimationFrame(() => {
            if (map.getTargetElement()) {
              map.getTargetElement().style.pointerEvents = 'auto';
              Logger.debug("misc", `[DragDebug] Ensured pointer-events:auto on moveend`);
            }
          });
        }
        
        // Clear previous timeout using the ref
        if (timeoutIdRef.current) {
          clearTimeout(timeoutIdRef.current);
          interactionStateRef.current.viewUpdatesPending--;
          Logger.debug("misc", `[DragDebug] Cleared existing timeout (${interactionStateRef.current.viewUpdatesPending} pending)`);
        }
        
        // Set new timeout and store its ID in the ref - reduce timeout to avoid delay
        interactionStateRef.current.viewUpdatesPending++;
        timeoutIdRef.current = window.setTimeout(() => {
          try {
            interactionStateRef.current.viewUpdatesPending--;
            const currentView = map.getView();
            const zoom = currentView.getZoom();
            const center = currentView.getCenter();

            // Use requestAnimationFrame for URL updates to avoid React conflicts
            if (center && zoom !== undefined) {
              // Defer URL updates to avoid React reconciliation conflicts
              requestAnimationFrame(() => {
                updateUrlWithResource(selectedResourceId);
              });
            }

            // Trigger onViewChange callback in a separate RAF to avoid batched state updates
            if (onViewChange && zoom !== undefined) {
              requestAnimationFrame(() => {
                try {
                  const extent = currentView.calculateExtent(map.getSize());
                  onViewChange(Math.round(zoom), extent);
                } catch (error) {
                  Logger.error("misc", new Error(`Error in onViewChange callback: ${error}`));
                }
              });
            }
            
            // Log that map movement has triggered a view update
            Logger.debug("misc", `[DragDebug] View updated: zoom=${zoom}, center=${center?.join(',')}`);
            
            // Triple-ensure map is interactive after view update
            if (map.getTargetElement()) {
              map.getTargetElement().style.pointerEvents = 'auto';
            }
          } catch (error) {
            // Catch and log any errors that might occur during view updates
            Logger.error("misc", new Error(`Error in moveEnd handler: ${error}`));
          }
        }, 50); // Reduced from 150ms to make it feel more responsive
      };

      // Attach listener using the handler ref
      map.on("moveend", moveEndHandlerRef.current);

      // Create Popup Overlay (The element exists in JSX below)
      if (popupRef.current && !overlayRef.current) {
        const overlay = new Overlay({
          element: popupRef.current,
          autoPan: { animation: { duration: 250 } },
          positioning: "bottom-center", // Adjust positioning if needed
          offset: [0, -10], // Offset slightly above the point
        });
        overlayRef.current = overlay;
        map.addOverlay(overlay);

        // Setup closer click handler (Target the button inside the popup now)
        const closerElement = popupRef.current.querySelector(".popup-closer");
        if (closerElement) {
          closerElement.addEventListener("click", () => {
            overlay.setPosition(undefined);
            // No need to blur a button usually
            return false;
          });
        }
      }

      // Add Click Handler
      map.on("click", (evt) => {
        const feature = map.forEachFeatureAtPixel(
          evt.pixel,
          (feature) => feature
        );
        const overlay = overlayRef.current;
        const contentEl = popupContentRef.current;

        if (feature && overlay && contentEl) {
          const coordinates = (feature.getGeometry() as Point).getCoordinates();
          const title = feature.get("title") || "Unnamed Marker";
          const description = feature.get("description") || "No description.";

          // Update content using innerHTML (keep simple)
          contentEl.innerHTML = `<div class="font-bold mb-1">${title}</div><div class="text-xs">${description}</div>`;
          overlay.setPosition(coordinates);
        } else if (overlay) {
          overlay.setPosition(undefined);
        }
        
        // Debug log when map is clicked
        Logger.debug("misc", `[HeatmapDebug] Map clicked at pixel ${evt.pixel.join(',')}, feature=${!!feature}`);
      });

      // Add Pointer Move Handler (change cursor)
      map.on("pointermove", (e) => {
        const pixel = map.getEventPixel(e.originalEvent);
        const hit = map.hasFeatureAtPixel(pixel);
        const target = map.getTargetElement();
        if (target) {
          target.style.cursor = hit ? "pointer" : "";
        }
      });

      // Create the context menu handler
      const handleContextMenuEvent = (e: MouseEvent) => {
        e.preventDefault(); // Prevent default browser context menu
        
        // Convert DOM event position to map pixel
        const pixel = map.getEventPixel({ clientX: e.clientX, clientY: e.clientY });
        const coord = map.getCoordinateFromPixel(pixel);
        const zoom = Math.round(map.getView().getZoom() || 0);
        
        if (coord) {
          // Open context menu with map coordinates
          handleContextMenu(e, {
            x: Math.round(coord[0]),
            y: Math.round(coord[1]),
            z: zoom
          });
        }
      };

      // Store the handler in a ref for cleanup
      contextMenuHandlerRef.current = handleContextMenuEvent;

      // Prevent default context menu on the entire map container
      const preventContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        return false;
      };

      // Store in ref for cleanup
      preventContextMenuRef.current = preventContextMenu;

      // Add the event listeners
      map.getViewport().addEventListener('contextmenu', handleContextMenuEvent);
      map.getTargetElement().addEventListener('contextmenu', preventContextMenu);

      Logger.info("misc", "OpenLayers map initialized");
    } catch (err: any) {
      Logger.error("Failed to initialize map", err);
      setError(`Failed to initialize map: ${err.message || "Unknown error"}`);
    }

    // Cleanup on unmount
    return () => {
      // Clear any pending timeout on unmount using the ref
      clearTimeout(timeoutIdRef.current);

      const mapInstance = mapInstanceRef.current;
      const handler = moveEndHandlerRef.current;
      const contextMenuHandler = contextMenuHandlerRef.current;
      
      // Use the map instance and handler from refs/closure
      if (mapInstance) {
        if (handler) {
          mapInstance.un("moveend", handler);
        }
        
        // Remove context menu handler
        if (contextMenuHandler) {
          mapInstance.getViewport().removeEventListener('contextmenu', contextMenuHandler);
        }
        
        // Remove the context menu prevention handler
        const preventHandler = preventContextMenuRef.current;
        if (mapInstance.getTargetElement() && preventHandler) {
          mapInstance.getTargetElement().removeEventListener('contextmenu', preventHandler);
        }
        
        mapInstance.setTarget(undefined);
      }
      
      mapInstanceRef.current = null;
      moveEndHandlerRef.current = null; // Clear handler ref
      contextMenuHandlerRef.current = null;
      heatmapInitializedRef.current = false;
      Logger.info("misc", "OpenLayers map disposed");

      // Remove the event listener
      if (mapInstance && mapInstance.getTargetElement()) {
        const preventHandler = preventContextMenuRef.current;
        if (preventHandler) {
          mapInstance.getTargetElement().removeEventListener('contextmenu', preventHandler);
        }
      }
    };
  }, [mapId, labelCategoryIds, onMapReady, onViewChange, onResourceSelect, selectedResourceId, currentZLayer, updateUrlWithResource]);

  // Track if we're currently processing a heatmap update to prevent flash
  const isProcessingHeatmapRef = useRef<boolean>(false);

  // Replace the updateHeatmap function with a wrapper that uses the utility function
  const handleHeatmapUpdate = (data: HeatmapData | null) => {
    // Skip if already processing to avoid cascading updates
    if (isProcessingHeatmapRef.current) {
      Logger.debug("misc", `[HeatmapDebug] Skipping duplicate heatmap update during processing`);
      return;
    }

    Logger.debug("misc", `[HeatmapVisibilityTracking] === HANDLE_HEATMAP_UPDATE CALLED ===`);

    // Set processing flag
    isProcessingHeatmapRef.current = true;
    
    try {
      if (!heatmapSourceRef.current || !heatmapLayerRef.current || !mapInstanceRef.current) {
        Logger.warn("misc", new Error("[HeatmapDebug] Missing required references for heatmap update"));
        return;
      }
      
      const map = mapInstanceRef.current;
      
      // Log all layer visibility BEFORE updateHeatmap call
      Logger.debug("misc", `[HeatmapVisibilityTracking] === BEFORE updateHeatmap CALL - Layer Status ===`);
      const beforeLayers = map.getLayers().getArray();
      beforeLayers.forEach((layer, index) => {
        const id = layer.get('id') || `unknown-${index}`;
        const type = layer.get('layerType') || 'unknown';
        const visible = layer.getVisible();
        Logger.debug("misc", `[HeatmapVisibilityTracking] PRE-UPDATE Layer ${index}: id=${id}, type=${type}, visible=${visible}`);
      });
      
      // Use the utility function
      Logger.debug("misc", `[HeatmapVisibilityTracking] Calling updateHeatmap utility...`);
      updateHeatmap(data, heatmapSourceRef.current, heatmapLayerRef.current);
      
      // Add a slight delay then log all layers AFTER updateHeatmap call
      setTimeout(() => {
        Logger.debug("misc", `[HeatmapVisibilityTracking] === AFTER updateHeatmap CALL - Layer Status ===`);
        const afterLayers = map.getLayers().getArray();
        afterLayers.forEach((layer, index) => {
          const id = layer.get('id') || `unknown-${index}`;
          const type = layer.get('layerType') || 'unknown';
          const visible = layer.getVisible();
          Logger.debug("misc", `[HeatmapVisibilityTracking] POST-UPDATE Layer ${index}: id=${id}, type=${type}, visible=${visible}`);
        });
        
        // Force visible on marker layer if we can find it
        const markerLayer = afterLayers.find(layer => 
          layer instanceof VectorLayer && 
          layer.get('layerType') === 'marker' &&
          layer.getSource() === vectorSourceRef.current
        );
        
        if (markerLayer) {
          const wasVisible = markerLayer.getVisible();
          markerLayer.setVisible(true);
          markerLayer.setZIndex(10);
          Logger.debug("misc", `[HeatmapVisibilityTracking] FINAL INSURANCE: Found marker layer, setting visible=true (was ${wasVisible}), zIndex=10`);
          map.render();
        } else {
          Logger.debug("misc", `[HeatmapVisibilityTracking] FINAL INSURANCE: Could not find marker layer to ensure visibility`);
        }
      }, 150);
    } catch (e) {
      Logger.error("misc", new Error(`[HeatmapDebug] Exception in heatmap update wrapper: ${e}`));
    } finally {
      // Always reset processing flag
      isProcessingHeatmapRef.current = false;
      Logger.debug("misc", `[HeatmapVisibilityTracking] handleHeatmapUpdate complete, reset processing flag`);
    }
  };

  // === Marker Update/Filter Effect ===
  useEffect(() => {
    if (!vectorSourceRef.current || !allMarkers || !mapInstanceRef.current) {
      return;
    }
    
    Logger.debug("misc", `[MarkerDebug] Updating marker features, count: ${allMarkers.length}`);
    
    // Get current zoom for scaling markers appropriately
    const currentZoom = mapInstanceRef.current.getView().getZoom();
    const roundedZoom = currentZoom !== undefined ? Math.round(currentZoom) : undefined;
    
    // First, find the marker layer and its current visibility
    let markerLayer: VectorLayer<any> | null = null;
    if (mapInstanceRef.current) {
      const allLayers = mapInstanceRef.current.getLayers().getArray();
      // Find marker layer by property or source reference
      for (const layer of allLayers) {
        if (layer instanceof VectorLayer && 
            ((layer.get('layerType') === 'marker') || 
             (layer.getSource() === vectorSourceRef.current))) {
          markerLayer = layer;
          break;
        }
      }
    }
    
    // Remember current marker layer visibility to preserve it
    const wasVisible = markerLayer ? markerLayer.getVisible() : true;
    
    // Clear and update features
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
            _mapZoom: roundedZoom, // Add zoom information for styling
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
    
    // Ensure features are rendered with consistent visibility
    if (markerLayer) {
      // If features were previously visible, keep them visible
      if (wasVisible) {
        markerLayer.setVisible(true);
      }
      
      // Ensure marker layer is on top by setting high z-index
      markerLayer.setZIndex(10);
      
    Logger.debug(
      "misc",
        `[MarkerDebug] Updated ${features.length} features. wasVisible=${wasVisible}, nowVisible=${markerLayer.getVisible()}`
      );
    } else {
      Logger.warn("misc", new Error(`[MarkerDebug] Could not find marker layer when updating features`));
    }
  }, [allMarkers, visibleCategoryIds, mapInstanceRef, labelCategoryIds]);

  // Add an effect to ensure marker layer remains on top and visible when heatmap data changes
  useEffect(() => {
    // Skip if map or vector source is not initialized
    if (!mapInstanceRef.current || !vectorSourceRef.current) {
      return;
    }
    
    Logger.debug("misc", `[HeatmapVisibilityTracking] EFFECT TRIGGERED: heatmapData changed, has data: ${!!heatmapData}`);
    
    const map = mapInstanceRef.current;
    
    // First log ALL layers in map before making any changes
    const allLayers = map.getLayers().getArray();
    Logger.debug("misc", `[HeatmapVisibilityTracking] Total layer count: ${allLayers.length}`);
    
    allLayers.forEach((layer, index) => {
      const id = layer.get('id') || `unknown-${index}`;
      const type = layer.get('layerType') || 'unknown';
      const visible = layer.getVisible();
      Logger.debug("misc", `[HeatmapVisibilityTracking] BEFORE CHANGES - Layer ${index}: id=${id}, type=${type}, visible=${visible}`);
    });
    
    // *** CRITICAL FIX: Keep track of marker layer explicitly to preserve its state ***
    let markerLayerVisible = false;
    let markerLayer = null;
    
    // First pass: find marker layer and its current visibility
    for (const layer of allLayers) {
      // Check if this is the marker layer using a type-safe approach
      if (
        layer instanceof VectorLayer && 
        typeof layer.getSource === 'function' && 
        layer.getSource() === vectorSourceRef.current
      ) {
        markerLayer = layer;
        markerLayerVisible = layer.getVisible();
        const markerLayerId = layer.get('id') || 'main-markers';
        Logger.debug("misc", `[HeatmapVisibilityTracking] Found marker layer id=${markerLayerId}, current visibility: ${markerLayerVisible}`);
        break;
      }
    }
    
    // Second pass: update all layers while preserving marker visibility
    allLayers.forEach(layer => {
      const layerId = layer.get('id') || 'unknown';
      
      // For vector (marker) layer
      if (layer === markerLayer) {
        // Always set marker layer on top
        const beforeZIndex = layer.getZIndex() || 'default';
        layer.setZIndex(10);
        
        // IMPORTANT: Explicitly preserve visibility
        const beforeVisible = layer.getVisible();
        
        // FORCIBLY SET TO TRUE FOR TESTING
        layer.setVisible(true);
        
        Logger.debug("misc", `[HeatmapVisibilityTracking] MARKER LAYER UPDATED: id=${layerId}, visibility: ${beforeVisible}->${layer.getVisible()}, zIndex: ${beforeZIndex}->10`);
      }
      
      // For heatmap layer
      if (
        layer instanceof HeatmapLayer && 
        typeof layer.getSource === 'function' && 
        layer.getSource() === heatmapSourceRef.current
      ) {
        const beforeZIndex = layer.getZIndex() || 'default';
        layer.setZIndex(5);
        
        const beforeVisible = layer.getVisible();
        const newVisible = !!heatmapData;
        layer.setVisible(newVisible); // Only show if we have data
        
        Logger.debug("misc", `[HeatmapVisibilityTracking] HEATMAP LAYER UPDATED: id=${layerId}, visibility: ${beforeVisible}->${newVisible}, zIndex: ${beforeZIndex}->5`);
      }
    });
    
    if (!markerLayer) {
      Logger.warn("misc", new Error(`[HeatmapVisibilityTracking] Could not find marker layer when processing heatmap data!`));
    } else {
      Logger.debug("misc", `[HeatmapVisibilityTracking] Marker layer final state: visible=${markerLayer.getVisible()}, zIndex=${markerLayer.getZIndex()}`);
    }
    
    // Log all layers AFTER changes
    Logger.debug("misc", `[HeatmapVisibilityTracking] === AFTER CHANGES - Layer Status ===`);
    allLayers.forEach((layer, index) => {
      const id = layer.get('id') || `unknown-${index}`;
      const type = layer.get('layerType') || 'unknown';
      const visible = layer.getVisible();
      const zIndex = layer.getZIndex() || 'default';
      Logger.debug("misc", `[HeatmapVisibilityTracking] Layer ${index}: id=${id}, type=${type}, visible=${visible}, zIndex=${zIndex}`);
    });
    
    // Force a render to apply the changes
    Logger.debug("misc", `[HeatmapVisibilityTracking] Forcing map render to apply visibility changes`);
    map.render();
    
    // Set a timeout to double-check visibility after the map renders
    setTimeout(() => {
      Logger.debug("misc", `[HeatmapVisibilityTracking] === DELAYED CHECK - Layer Visibility ===`);
      const finalLayers = map.getLayers().getArray();
      finalLayers.forEach((layer, index) => {
        const id = layer.get('id') || `unknown-${index}`;
        const type = layer.get('layerType') || 'unknown';
        const visible = layer.getVisible();
        Logger.debug("misc", `[HeatmapVisibilityTracking] AFTER TIMEOUT - Layer ${index}: id=${id}, type=${type}, visible=${visible}`);
      });
      
      // Force another render just to be sure
      map.render();
    }, 100);
    
  }, [heatmapData, mapInstanceRef, vectorSourceRef, heatmapSourceRef]);

  // Add the return statement that was missing
  if (error) {
    return <MapContainer>Error: {error}</MapContainer>;
  }

  return (
    <MapContainer ref={mapRef}>
      {/* Popup structure with Tailwind classes mimicking IngameTooltip */}
      <div
        ref={popupRef}
        className="absolute hidden z-20 border border-[#1A1A1A] rounded-sm p-1.5 bg-[#38322c] min-w-[150px] max-w-[300px]"
        // Start hidden, OpenLayers controls visibility via overlay
        // positioning: bottom-center is set in OL Overlay options
      >
        {/* Optional: Add arrow element if desired, requires more complex positioning sync */}
        {/* Innermost content area */}
        <div className="relative bg-[#151515] text-white px-2 py-1 rounded-sm border-t border-l border-[#4e443a] border-b border-r border-[#2c2824]">
          {/* Closer button */}
          <button
            className="popup-closer absolute top-0 right-0 px-1 text-lg text-gray-400 hover:text-white"
            aria-label="Close popup"
          >
            &times;
          </button>
          {/* Content will be set via innerHTML */}
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
      
      {/* Add Z-layer control */}
      <ZLayerOverlay 
        currentZLayer={currentZLayer} 
        onChange={handleZLayerChange} 
      />
    </MapContainer>
  );
};

export default EthyrialMapFull;