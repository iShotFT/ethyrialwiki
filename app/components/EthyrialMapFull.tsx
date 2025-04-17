import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faGem,
  faLeaf,
  faTree,
  faSkullCrossbones,
  faMapMarkerAlt,
  faQuestionCircle,
  faCity,
  faCrosshairs,
  faScroll,
  faDragon,
  // New/Alternative Icons
  faPaw, // Skin
  faStreetView, // Teleport
  faChessRook, // Dungeon
  faUniversity, // Bank
} from "@fortawesome/free-solid-svg-icons";
import type { Map as OlMap } from "ol";
import Feature, { FeatureLike } from "ol/Feature";
import Map from "ol/Map";
import Overlay from "ol/Overlay";
import View from "ol/View";
import { getCenter, getBottomLeft } from "ol/extent";
import type { Extent } from "ol/extent";
import Point from "ol/geom/Point";
import HeatmapLayer from "ol/layer/Heatmap";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import Projection from "ol/proj/Projection";
import TileImage from "ol/source/TileImage";
import VectorSource from "ol/source/Vector";
import { Icon, Style, Fill, Stroke, Text } from "ol/style";
import TileGrid from "ol/tilegrid/TileGrid";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { v5 as uuidv5 } from "uuid";
import type { Coordinate as ServerCoordinate } from "@server/models/Marker";
import type { AggregatedPoint } from "@server/utils/PointAggregator";
import Logger from "~/utils/Logger";
import { encodeResource, decodeResource, parseMapHash, updateMapHash } from "../utils/mapUtils";
import { updateHeatmap, getHeatmapParams } from "../utils/heatmapUtils";
import { createFaDataUri, createLabelStyleBase, createMarkerStyleFunction } from "../utils/markerStyleUtils";

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

  // Replace updateUrlWithResource with the utility function
  const updateUrlWithResource = (resourceId: string | undefined) => {
    if (!mapInstanceRef.current) return;
    
    const map = mapInstanceRef.current;
    const currentView = map.getView();
    const zoom = Math.round(currentView.getZoom() || 0);
    const center = currentView.getCenter();
    
    if (!center || zoom === undefined) return;
    
    // Use the utility function
    updateMapHash(zoom, center as [number, number], resourceId);
    
    if (resourceId) {
      Logger.debug("misc", `[ResourceDebug] Updated URL with resource: ${resourceId}`);
    }
  };

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
      const minZoom = 0;
      const displayZLevel = 1;

      // Initial view settings (will be potentially overridden by URL hash)
      let initialCenter = getCenter(mapExtent);
      let initialZoom = 4;
      let initialResourceId: string | null = null;

      // Change the hash parsing to use the utility function
      // When you get to the URL hash parsing section:
      const hash = window.location.hash.replace("#map=", "");
      if (hash) {
        const parsedHash = parseMapHash(hash);
        if (parsedHash) {
          initialZoom = parsedHash.zoom;
          initialCenter = parsedHash.center;
          Logger.info(
            "misc",
            `Setting initial view from URL: zoom=${parsedHash.zoom}, center=[${parsedHash.center.join(',')}]`
          );
          
          if (parsedHash.resourceId) {
            initialResourceId = parsedHash.resourceId;
            Logger.info(
              "misc",
              `Found resource in URL hash: ${initialResourceId}`
            );
            
            // Set the last encoded resource ref to avoid immediate re-encoding
            lastEncodedResourceRef.current = initialResourceId;
            
            // Trigger resource selection callback if provided
            if (onResourceSelect) {
              // Use setTimeout to ensure this happens after component initialization
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

      // 3. Create TileImage Source
      const tileSource = new TileImage({
        projection: customProjection,
        tileGrid,
        wrapX: false,
        tileUrlFunction: (tileCoord) => {
          const ol_z_idx = tileCoord[0]; // OL zoom level index (always 0)
          const x = tileCoord[1];
          const y_ol = tileCoord[2];
          const z_filename = displayZLevel;

          // Apply the y = -y_ol - 1 transformation
          const filenameY = -y_ol - 1;

          Logger.debug(
            "misc",
            `Tile Request: OLCoord=[${ol_z_idx},${x},${y_ol}] -> TransformedY=${filenameY} -> FileNameCoords=[${z_filename},${x},${filenameY}]`
          );

          // Check bounds based on filename ranges (0-5 for x, 0-4 for y)
          if (x < minX || x > maxX || filenameY < minY || filenameY > maxY) {
            return undefined;
          }

          return `/api/maps/${mapId}/tiles/${z_filename}/${x}/${filenameY}`;
        },
        transition: 0,
      });

      // 4. Vector Source & Layers
      Logger.debug("misc", `[HeatmapDebug] Creating vector sources and layers`);
      vectorSourceRef.current = new VectorSource();
      heatmapSourceRef.current = new VectorSource();
      
      Logger.debug("misc", `[HeatmapDebug] Vector sources created: vectorSource=${!!vectorSourceRef.current}, heatmapSource=${!!heatmapSourceRef.current}`);
      
      const tileLayer = new TileLayer({ source: tileSource });
      const markerLayer = new VectorLayer({
        source: vectorSourceRef.current,
        style: (feature) => getMarkerStyle(feature, labelCategoryIds),
        zIndex: 2,
        // Make marker layer properly visible at all zoom levels
        minZoom,
        maxZoom,
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
        zIndex: 1,
        // Add enhanced gradient for better visibility with more steps
        gradient: [
          'rgba(0,0,255,0.6)', // Blue with transparency
          'rgba(0,255,255,0.7)', 
          'rgba(0,255,0,0.7)', 
          'rgba(255,255,0,0.8)', 
          'rgba(255,128,0,0.9)', 
          'rgba(255,0,0,1.0)' // Red fully opaque
        ],
        // Explicitly set visible to ensure it's shown
        visible: true
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
        minZoom, // Set minZoom
        maxZoom, // Keep maxZoom
      });

      // 6. Create Map Instance
      Logger.debug("misc", `[HeatmapDebug] Creating map instance with layers`);
      const map = new Map({
        target: mapRef.current,
        layers: [tileLayer, heatmapLayer, markerLayer],
        view,
        controls: [], // Start with no controls
      });
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

      // Define handleMoveEnd and store it in the ref
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
          interactionStateRef.current.viewUpdatesPending--;
          const currentView = map.getView();
          const zoom = currentView.getZoom();
          const center = currentView.getCenter();

          // Update URL Hash
          if (center && zoom !== undefined) {
            // Use the updateMapHash utility
            updateUrlWithResource(selectedResourceId);
          }

          // Trigger onViewChange callback
          if (onViewChange && zoom !== undefined) {
            const extent = currentView.calculateExtent(map.getSize());
            onViewChange(Math.round(zoom), extent);
          }
          
          // Log that map movement has triggered a view update
          Logger.debug("misc", `[DragDebug] View updated: zoom=${zoom}, center=${center?.join(',')}`);
          
          // Triple-ensure map is interactive after view update
          if (map.getTargetElement()) {
            map.getTargetElement().style.pointerEvents = 'auto';
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
      // Use the map instance and handler from refs/closure
      if (mapInstance && handler) {
        mapInstance.un("moveend", handler);
        mapInstance.setTarget(undefined);
      }
      mapInstanceRef.current = null;
      moveEndHandlerRef.current = null; // Clear handler ref
      heatmapInitializedRef.current = false;
      Logger.info("misc", "OpenLayers map disposed");
    };
  }, [mapId, labelCategoryIds, onMapReady, onViewChange, onResourceSelect, selectedResourceId]);

  // Track if we're currently processing a heatmap update to prevent flash
  const isProcessingHeatmapRef = useRef<boolean>(false);

  // Replace the updateHeatmap function with a wrapper that uses the utility function
  const handleHeatmapUpdate = (data: HeatmapData | null) => {
    // Skip if already processing to avoid cascading updates
    if (isProcessingHeatmapRef.current) {
      Logger.debug("misc", `[HeatmapDebug] Skipping duplicate heatmap update during processing`);
      return;
    }

    // Set processing flag
    isProcessingHeatmapRef.current = true;
    
    try {
      if (!heatmapSourceRef.current || !heatmapLayerRef.current || !mapInstanceRef.current) {
        Logger.warn("misc", new Error("[HeatmapDebug] Missing required references for heatmap update"));
        return;
      }
      
      // Use the utility function
      updateHeatmap(data, heatmapSourceRef.current, heatmapLayerRef.current);
    } catch (e) {
      Logger.error("misc", new Error(`[HeatmapDebug] Exception in heatmap update wrapper: ${e}`));
    } finally {
      // Always reset processing flag
      isProcessingHeatmapRef.current = false;
    }
  };

  // === Marker Update/Filter Effect ===
  useEffect(() => {
    if (!vectorSourceRef.current || !allMarkers) {
      return;
    }
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
    Logger.debug(
      "misc",
      `Added ${features.length} visible features to vector source.`
    );
  }, [allMarkers, visibleCategoryIds]);

  // === Heatmap Update Effect ===
  useEffect(() => {
    // Skip empty updates
    if (!heatmapData || heatmapData.points.length === 0) {
      Logger.debug("misc", `[HeatmapDebug] Skipping empty heatmap update`);
      
      // If we have a heatmap layer but no data, clear it
      if (heatmapLayerRef.current && heatmapSourceRef.current) {
        heatmapSourceRef.current.clear();
        heatmapSourceRef.current.changed();
        heatmapLayerRef.current.changed();
      }
      
      return;
    }
    
    Logger.debug("misc", `[HeatmapDebug] Heatmap effect triggered: data=${!!heatmapData}, points=${heatmapData?.points?.length || 0}`);
    
    // Check if map is initialized
    const mapInitialized = !!mapInstanceRef.current;
    Logger.debug("misc", `[HeatmapDebug] Map initialized: ${mapInitialized}`);
    
    // Only proceed with update if initialized or schedule update for later
    if (mapInitialized) {
      Logger.debug("misc", `[HeatmapDebug] Proceeding with immediate heatmap update`);
      
      // Force the heatmap layer to be visible
      if (heatmapLayerRef.current) {
        heatmapLayerRef.current.setVisible(true);
      }
      
      // Use requestAnimationFrame to ensure we're not disrupting any current renders
      requestAnimationFrame(() => {
        // Update heatmap with data
        handleHeatmapUpdate(heatmapData);
        
        // Force a map render - this helps ensure the heatmap displays
        if (mapInstanceRef.current) {
          mapInstanceRef.current.renderSync();
          
          // Also render again after a brief delay (helps with OpenLayers rendering)
          setTimeout(() => {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.renderSync();
              Logger.debug("misc", `[HeatmapDebug] Triggered additional render for heatmap visibility`);
            }
          }, 100);
        }
      });
    } else {
      Logger.debug("misc", `[HeatmapDebug] Map not initialized, update will be triggered after initialization`);
      // The updateHeatmap will be called by the 'rendercomplete' event handler
    }
  }, [heatmapData]);
  
  // === Enhanced drag prevention effects ===
  useEffect(() => {
    // Add a cleanup function for the movestart event
    if (mapInstanceRef.current && heatmapLayerRef.current) {
      const map = mapInstanceRef.current;
      const heatmapLayer = heatmapLayerRef.current;
      
      // Save original heatmap visibility state on movestart
      const handleMoveStart = () => {
        Logger.debug("misc", `[DragDebug] movestart triggered`);
        
        // Set flag to indicate we're dragging the map
        interactionStateRef.current.isDragging = true;
        
        if (isProcessingHeatmapRef.current) {
          // Already processing a heatmap update during move - prevent flash
          Logger.debug("misc", `[DragDebug] Cancelled heatmap processing during movestart`);
          isProcessingHeatmapRef.current = false;
        }
        
        // Ensure the map target is ready for interaction
        if (map.getTargetElement()) {
          map.getTargetElement().style.pointerEvents = 'auto';
        }
      };

      // Add handler for preventing position reset on moveend
      const handleMoveEnd = () => {
        Logger.debug("misc", `[DragDebug] Custom moveend handler triggered`);
        
        // Reset drag flag
        interactionStateRef.current.isDragging = false;
        
        // Aggressive approach: use multiple RAF calls to ensure map stays interactive
        const makeInteractive = () => {
          if (map && map.getTargetElement()) {
            map.getTargetElement().style.pointerEvents = 'auto';
            // Force layout calculation to ensure change is applied
            void map.getTargetElement().offsetHeight;
          }
        };
        
        // Immediately make map ready for next interaction
        makeInteractive();
        
        // Also ensure it happens in next animation frame
        requestAnimationFrame(() => {
          makeInteractive();
          // And again after a brief delay to catch potential resets
          setTimeout(makeInteractive, 0);
          setTimeout(makeInteractive, 10);
          setTimeout(makeInteractive, 50);
        });
      };
      
      // Add handler for pointer down to track quick drags
      const handlePointerDown = () => {
        if (performance.now() - interactionStateRef.current.lastDragEnd < 100) {
          Logger.debug("misc", `[DragDebug] Quick pointer down detected after drag!`);
          // Ensure map is interactive
          if (map.getTargetElement()) {
            map.getTargetElement().style.pointerEvents = 'auto';
          }
        }
      };
      
      map.on('movestart', handleMoveStart);
      map.on('moveend', handleMoveEnd);
      
      // Add pointerdown listener directly to viewport element
      const viewport = map.getViewport();
      if (viewport) {
        viewport.addEventListener('pointerdown', handlePointerDown);
      }
      
      return () => {
        map.un('movestart', handleMoveStart);
        map.un('moveend', handleMoveEnd);
        if (viewport) {
          viewport.removeEventListener('pointerdown', handlePointerDown);
        }
      };
    }
  }, []);

  // Define moveEndHandlerRef setup separate from normal moveend (position reset issue)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    const map = mapInstanceRef.current;
    
    // Define handleMoveEnd and store it in the ref
    moveEndHandlerRef.current = () => {
      // Clear previous timeout using the ref
      clearTimeout(timeoutIdRef.current);
      
      // Set new timeout and store its ID in the ref
      timeoutIdRef.current = window.setTimeout(() => {
        const currentView = map.getView();
        const zoom = currentView.getZoom();
        const center = currentView.getCenter();

        // Update URL Hash
        if (center && zoom !== undefined) {
          const roundedZoom = Math.round(zoom);
          const roundedCenter = [
            Math.round(center[0]),
            Math.round(center[1]),
          ];
          const newHash = `#map=${roundedZoom}/${roundedCenter[0]}/${roundedCenter[1]}`;
          window.history.replaceState(null, "", newHash);
        }

        // Trigger onViewChange callback
        if (onViewChange && zoom !== undefined) {
          const extent = currentView.calculateExtent(map.getSize());
          onViewChange(Math.round(zoom), extent);
        }
        
        // Log that map movement has triggered a view update
        Logger.debug("misc", `[DragDebug] Handler view updated: zoom=${zoom}, center=${center?.join(',')}`);
        
        // Ensure map is interactive
        if (map.getTargetElement()) {
          map.getTargetElement().style.pointerEvents = 'auto';
        }
      }, 50); // Reduced timeout
    };

    // Attach listener using the handler ref
    map.on("moveend", moveEndHandlerRef.current);
    
    return () => {
      if (map && moveEndHandlerRef.current) {
        map.un("moveend", moveEndHandlerRef.current);
      }
    };
  }, [onViewChange]);

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
    </MapContainer>
  );
};

export default EthyrialMapFull;
