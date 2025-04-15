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

// Helper to create SVG Data URI from FA icon
// Customize color, size etc. here
const createFaDataUri = (
  iconDef: IconDefinition | undefined,
  color = "black"
) => {
  if (!iconDef) {
    iconDef = faQuestionCircle; // Fallback icon
  }
  const { icon } = iconDef;
  const pathData = Array.isArray(icon[4]) ? icon[4].join(" ") : icon[4];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${icon[0]} ${icon[1]}" width="24" height="24">
      <path d="${pathData}" fill="${color}"></path>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

// Cache for generated icon styles
const iconStyleCache: Record<string, Style> = {};

// Define Label Style
const labelStyleBase = new Style({
  text: new Text({
    font: "bold 18px Asul, sans-serif", // Use Asul font, adjust size/weight
    fill: new Fill({ color: "#FFFFFF" }),
    stroke: new Stroke({ color: "#000000", width: 2 }), // Text stroke for readability
    textAlign: "center",
    textBaseline: "middle",
    overflow: true, // Allow text to overflow if needed
  }),
});

const getMarkerStyle = (
  feature: FeatureLike,
  labelCategoryIds: Set<string>
): Style => {
  const categoryId = feature.get("categoryId") as string;

  // Check if the marker's category ID is in the set of label category IDs
  if (labelCategoryIds.has(categoryId)) {
    // Clone base style to avoid modifying it for all labels
    const style = labelStyleBase.clone();
    // Set the text for the label style dynamically
    style.getText()?.setText(feature.get("title") || "");
    return style;
  }

  // Existing Icon logic
  const cacheKey = categoryId || "default";

  // Log the category ID being looked up
  // Logger.debug("misc", `Getting style for categoryId: [${categoryId}]`);
  // Reduce log spam - enable if needed

  if (!iconStyleCache[cacheKey]) {
    const iconDefinition = categoryIconMap[categoryId]; // Direct lookup

    // Log if lookup failed
    if (!iconDefinition) {
      Logger.warn(
        `No icon definition found for categoryId: [${categoryId}], using fallback.`
      ); // Use string only
    }

    const iconDataUri = createFaDataUri(
      iconDefinition || faQuestionCircle,
      "#D92A2A"
    );

    iconStyleCache[cacheKey] = new Style({
      image: new Icon({
        anchor: [0.5, 0.9], // Adjust anchor if needed for new icons
        src: iconDataUri,
        // Optional: scale the icon
        // scale: 0.8,
      }),
    });
  }
  return iconStyleCache[cacheKey];
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
}) => {
  // Log received props
  Logger.debug(
    "misc",
    `[EthyrialMapFull] Received mapId: ${mapId}, mapData: ${
      mapData ? "Yes" : "No"
    }, markers: ${allMarkers?.length ?? 0}`
  );

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

  // === OpenLayers Setup Effect ===
  useEffect(() => {
    if (!mapRef.current || !mapId) {
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

      // Check URL hash for initial state
      const hash = window.location.hash.replace("#map=", "");
      if (hash) {
        const parts = hash.split("/");
        if (parts.length === 3) {
          const z = parseInt(parts[0], 10);
          const x = parseInt(parts[1], 10);
          const y = parseInt(parts[2], 10);
          if (!isNaN(z) && !isNaN(x) && !isNaN(y)) {
            initialZoom = z;
            initialCenter = [x, y];
            Logger.info(
              "misc",
              `Setting initial view from URL: zoom=${z}, center=[${x},${y}]`
            );
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
      vectorSourceRef.current = new VectorSource();
      heatmapSourceRef.current = new VectorSource();
      const tileLayer = new TileLayer({ source: tileSource });
      const markerLayer = new VectorLayer({
        source: vectorSourceRef.current,
        style: (feature) => getMarkerStyle(feature, labelCategoryIds),
        zIndex: 2,
      });
      const heatmapLayer = new HeatmapLayer({
        source: heatmapSourceRef.current,
        blur: 15,
        radius: 10,
        weight: (feature) => feature.get("weight") || 1,
        opacity: 0.7,
        zIndex: 1,
      });
      heatmapLayerRef.current = heatmapLayer;

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
      const map = new Map({
        target: mapRef.current,
        layers: [tileLayer, heatmapLayer, markerLayer],
        view,
        controls: [], // Start with no controls
      });
      mapInstanceRef.current = map;

      if (onMapReady) {
        onMapReady(map);
      }

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
        }, 150);
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
      Logger.info("misc", "OpenLayers map disposed");
    };
  }, [mapId, labelCategoryIds, onMapReady, onViewChange]);

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
    if (!heatmapSourceRef.current) {
      return;
    }

    heatmapSourceRef.current.clear();

    if (heatmapData && heatmapData.points.length > 0) {
      Logger.debug(
        "misc",
        `Updating heatmap with ${heatmapData.points.length} points.`
      );
      const heatmapFeatures = heatmapData.points
        .map((point) => {
          try {
            const feature = new Feature({
              geometry: new Point([point.x, point.y]),
              weight: point.weight,
            });
            return feature;
          } catch (error) {
            Logger.error(
              `Error creating heatmap feature for point at [${point.x}, ${point.y}]`,
              error
            );
            return null;
          }
        })
        .filter(Boolean) as Feature[];

      heatmapSourceRef.current.addFeatures(heatmapFeatures);
      Logger.debug(
        "misc",
        `Added ${heatmapFeatures.length} features to heatmap source.`
      );
    } else {
      Logger.debug("misc", "Clearing heatmap layer as no data was provided.");
    }
  }, [heatmapData]);

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
