import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faGem,
  faLeaf,
  faTree,
  faSkullCrossbones,
  faMapMarkerAlt,
  faQuestionCircle,
  faCity,
  faLandmark,
  faCrosshairs,
  faScroll,
  faDragon,
  // New/Alternative Icons
  faPaw, // Skin
  faStreetView, // Teleport
  faChessRook, // Dungeon
  faUniversity, // Bank
} from "@fortawesome/free-solid-svg-icons";
import * as ol from "ol";
import Feature from "ol/Feature";
import Map from "ol/Map";
import Overlay from "ol/Overlay";
import View from "ol/View";
import { getCenter, getTopLeft, getBottomLeft } from "ol/extent";
import Point from "ol/geom/Point";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import Projection from "ol/proj/Projection";
import TileImage from "ol/source/TileImage";
import VectorSource from "ol/source/Vector";
import { Icon, Style, Circle, Fill, Stroke } from "ol/style";
import TileGrid from "ol/tilegrid/TileGrid";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { v5 as uuidv5 } from "uuid";
import type { Coordinate } from "@server/models/Marker"; // Reuse type if possible
import Logger from "~/utils/Logger";
import { Coordinate as OlCoordinate } from 'ol/coordinate';

// Define the namespace used in the seeder
const NAMESPACE_UUID = "f5d7a4e8-6a3b-4e6f-8a4c-7f3d7a1b9e0f";

// Props expected by the component
type Props = {
  mapId: string;
  mapData: {
    // Data fetched by the parent scene
    id: string;
    title: string;
    // Add extent/bounds info here later if needed from API
  };
  markers: {
    // Data fetched by the parent scene
    id: string;
    title: string;
    description: string | null;
    coordinate: Coordinate | null;
    categoryId: string;
    iconUrl: string | null;
  }[];
};

// Styled component for the map container
const MapContainer = styled.div`
  width: 100%;
  height: 100%;
  background-color: ${(props) => props.theme.background};
`;

// Styled component for the popup (similar to example)
const PopupContainer = styled.div`
  position: absolute;
  background-color: white;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  padding: 15px;
  border-radius: 10px;
  border: 1px solid #cccccc;
  bottom: 12px;
  left: -50px;
  min-width: 200px;
  max-width: 300px;
  color: #333; // Ensure text is visible
  font-size: 13px;

  &:after,
  &:before {
    top: 100%;
    border: solid transparent;
    content: " ";
    height: 0;
    width: 0;
    position: absolute;
    pointer-events: none;
  }
  &:after {
    border-top-color: white;
    border-width: 10px;
    left: 48px;
    margin-left: -10px;
  }
  &:before {
    border-top-color: #cccccc;
    border-width: 11px;
    left: 48px;
    margin-left: -11px;
  }
`;

const PopupCloser = styled.a`
  text-decoration: none;
  position: absolute;
  top: 2px;
  right: 8px;
  font-size: 18px;
  color: #555;
  cursor: pointer;
`;

const PopupContent = styled.div`
  margin-top: 5px;
  margin-bottom: 5px;
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

const getMarkerStyle = (feature: Feature): Style => {
  const categoryId = feature.get("categoryId") as string;
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

// Define a default style for markers without icons
const defaultMarkerStyle = new Style({
  image: new Circle({
    radius: 5,
    fill: new Fill({ color: "rgba(255, 0, 0, 0.8)" }), // Red fill
    stroke: new Stroke({ color: "rgba(150, 0, 0, 1)", width: 1 }), // Darker red stroke
  }),
});

const EthyrialMapFull: React.FC<Props> = ({ mapId, mapData, markers }) => {
  // Log received props
  Logger.debug(
    "misc",
    `[EthyrialMapFull] Received mapId: ${mapId}, mapData: ${
      mapData ? "Yes" : "No"
    }, markers: ${markers?.length ?? 0}`
  );

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource>(new VectorSource());
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const popupContentRef = useRef<HTMLDivElement>(null);
  const popupCloserRef = useRef<HTMLAnchorElement>(null);
  const overlayRef = useRef<Overlay | null>(null);

  // === OpenLayers Setup Effect ===
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || !mapId) {
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
      const resolutions = [16, 8, 4, 2, 1, 0.5, 0.25]; // Added more zoom levels
      const maxZoom = resolutions.length -1 + 4; // Adjusted maxZoom to allow zooming in deeper
      const minZoom = 0; // Allow zooming OUT to the lowest resolution
      const displayZLevel = 1;

      // Initial view settings (will be potentially overridden by URL hash)
      let initialCenter = getCenter(mapExtent);
      let initialZoom = 4;

      // Check URL hash for initial state
      const hash = window.location.hash.replace('#map=', '');
      if (hash) {
        const parts = hash.split('/');
        if (parts.length === 3) {
          const z = parseInt(parts[0], 10);
          const x = parseInt(parts[1], 10);
          const y = parseInt(parts[2], 10);
          if (!isNaN(z) && !isNaN(x) && !isNaN(y)) {
            initialZoom = z;
            initialCenter = [x, y];
            Logger.info("misc", `Setting initial view from URL: zoom=${z}, center=[${x},${y}]`);
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
      const tileLayer = new TileLayer({ source: tileSource });
      const markerLayer = new VectorLayer({
        source: vectorSourceRef.current,
        style: getMarkerStyle,
      });

      // 5. Create View
      const view = new View({
        projection: customProjection,
        center: initialCenter,
        zoom: initialZoom,
        resolutions, // Provide all allowed resolutions for view scaling
        extent: mapExtent,
        // constrainResolution: true, // REMOVE this constraint
        minZoom, // Set minZoom
        maxZoom, // Keep maxZoom
      });

      // 6. Create Map Instance
      const map = new Map({
        target: mapRef.current,
        layers: [tileLayer, markerLayer],
        view,
        controls: [], // Start with no controls
      });
      mapInstanceRef.current = map;

      // Manual URL hash update on moveend
      let updateTimeout: number | undefined;
      map.on('moveend', () => {
        clearTimeout(updateTimeout);
        // Use timeout to avoid spamming history during rapid zooms
        updateTimeout = window.setTimeout(() => {
          const view = map.getView();
          const center = view.getCenter();
          const zoom = Math.round(view.getZoom() ?? initialZoom); // Round zoom
          if (center) {
            const roundedCenter = [Math.round(center[0]), Math.round(center[1])];
            const newHash = `#map=${zoom}/${roundedCenter[0]}/${roundedCenter[1]}`;
            // Use replaceState to avoid polluting browser history
            window.history.replaceState(null, '', newHash);
          }
        }, 100); // 100ms delay
      });

      // Create Popup Overlay
      if (
        popupRef.current &&
        popupContentRef.current &&
        popupCloserRef.current &&
        !overlayRef.current
      ) {
        const overlay = new Overlay({
          element: popupRef.current,
          autoPan: { animation: { duration: 250 } },
        });
        overlayRef.current = overlay;
        map.addOverlay(overlay);

        popupCloserRef.current.onclick = () => {
          overlay.setPosition(undefined);
          popupCloserRef.current?.blur();
          return false;
        };
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

          // Simple HTML content for popup
          contentEl.innerHTML = `<div style="font-weight: bold; margin-bottom: 5px;">${title}</div><div style="font-size: 0.9em;">${description}</div>`;
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
      mapInstanceRef.current?.setTarget(undefined);
      mapInstanceRef.current = null;
      Logger.info("misc", "OpenLayers map disposed");
    };
  }, [mapId]); // Re-initialize if mapId changes

  // === Marker Update Effect ===
  useEffect(() => {
    if (!vectorSourceRef.current) {
      // Logger.warn("[EthyrialMapFull] Marker useEffect ran before vectorSourceRef was ready.");
      return;
    }
    if (!markers) {
      // Logger.warn("[EthyrialMapFull] Marker useEffect ran but markers prop is null/undefined.");
      return;
    }

    // Logger.info("misc", "[EthyrialMapFull] Adding HARDCODED test marker.");
    vectorSourceRef.current.clear();

    /*
    // *** Hardcode a single test marker ***
    const testCoordinate = [1311, 2826];
    try {
      // ... hardcoded feature creation ...
      vectorSourceRef.current.addFeature(testFeature);
      Logger.info("misc", `[EthyrialMapFull] Added hardcoded test marker at ${JSON.stringify(testCoordinate)}.`);
    } catch(error) {
       Logger.error("[EthyrialMapFull] Error creating hardcoded test feature", error);
    }
    // ************************************
    */

    // *** Original logic using props - RE-ENABLED ***
    Logger.debug(
      "misc",
      `[EthyrialMapFull] Updating markers: ${markers.length} received.`
    );
    let featuresCreated = 0;
    const features = markers
      .map((marker) => {
        if (!marker.coordinate) {
          // Skip markers without coordinates
          return null;
        }
        // Skip markers without icons for now, use default style
        // if (!marker.iconUrl) {
        //   return null;
        // }
        try {
          const feature = new Feature({
            geometry: new Point([marker.coordinate.x, marker.coordinate.y]),
            id: marker.id,
            title: marker.title,
            description: marker.description,
            categoryId: marker.categoryId,
            iconUrl: marker.iconUrl,
          });
          feature.setId(marker.id);
          featuresCreated++;
          return feature;
        } catch (error) {
          Logger.error(
            `[EthyrialMapFull] Error creating feature for marker ${marker.id}`,
            error
          );
          return null;
        }
      })
      .filter(Boolean) as Feature[];

    vectorSourceRef.current.addFeatures(features);
    Logger.debug(
      "misc",
      `[EthyrialMapFull] Added ${featuresCreated} features (out of ${markers.length}) to vector source.`
    );
    // ****************************************************
  }, [markers]); // Add markers back to dependency array

  if (error) {
    return <MapContainer>Error: {error}</MapContainer>;
  }

  return (
    <MapContainer ref={mapRef}>
      {/* Popup structure */}
      <PopupContainer ref={popupRef}>
        <PopupCloser ref={popupCloserRef} href="#">
          &times;
        </PopupCloser>
        <PopupContent ref={popupContentRef} />
      </PopupContainer>
    </MapContainer>
  );
};

export default EthyrialMapFull;
