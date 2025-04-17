import { observer } from "mobx-react";
import type { Map as OlMap } from "ol";
import type { Extent } from "ol/extent";
import * as React from "react";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import styled from "styled-components";
import type { AggregatedPoint } from "@server/utils/PointAggregator";
import EthyrialMapFull from "~/components/EthyrialMapFull";
import {
  HeatmapOverlayPanel,
  MapOverlayPanel,
  CoordinateOverlay,
  ZLayerOverlay,
  GlobalCustomDragLayer
} from "~/components/MapOverlays";
import { LoadingIndicatorBar } from "~/components/LoadingIndicator";
import { client } from "~/utils/ApiClient";
import Logger from "~/utils/Logger";
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

// Define type for heatmap data prop passed to EthyrialMapFull
interface HeatmapData {
  points: AggregatedPoint[];
}

// Define types for heatmap data (can be moved later)
interface HeatmapCategory {
  id: string;
  slug: string;
  title: string;
  iconUrl: string | null;
}

interface HeatmapItem {
  id: string;
  slug: string;
  title: string;
  iconUrl: string | null;
  tier: number;
}

// Type for Categories fetched from API (ensure it includes isLabel)
interface ApiCategoryData {
  id: string;
  slug: string;
  title: string;
  iconUrl: string | null;
  parentId: string | null;
  children: ApiCategoryData[];
  isLabel: boolean;
}

// Add type for Markers fetched from API (add categoryIsLabel)
interface ApiMarkerData {
  id: string;
  title: string;
  description: string | null;
  coordinate: { x: number; y: number; z: number } | null;
  categoryId: string;
  iconId: string | null;
  iconUrl: string | null;
  isLabel: boolean;
  categoryIsLabel: boolean;
}

// Interface for MapOverlayPanel props
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface MapOverlayPanelProps {
  labelCategories: ApiCategoryData[]; // Use specific name
  markerCategories: ApiCategoryData[]; // Use specific name
  visibleCategoryIds: Record<string, boolean>; // Combined visibility state
  onVisibilityChange: (visibilityState: Record<string, boolean>) => void; // Callback for state change
  onSearch: (query: string) => void;
}

// Interface for EthyrialMapFull props
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface EthyrialMapFullProps {
  mapId: string;
  mapData: any; // Use specific type if available
  allMarkers: ApiMarkerData[];
  visibleCategoryIds: Record<string, boolean>; // Combined visibility state
  labelCategoryIds: Set<string>;
  heatmapData: HeatmapData | null;
  onMapReady: (map: OlMap) => void;
  onViewChange: (zoom: number, extent: Extent) => void;
}

// Styled components for layout
const MapSceneContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden; // Ensure map takes full space
`;

const ErrorMessage = styled.div`
  padding: 40px;
  text-align: center;
`;

function MapScene() {
  const [mapData, setMapData] = useState<any>(null);
  const [allMarkers, setAllMarkers] = useState<ApiMarkerData[]>([]);
  const [labelCategories, setLabelCategories] = useState<ApiCategoryData[]>([]);
  const [markerCategories, setMarkerCategories] = useState<ApiCategoryData[]>(
    []
  );
  const [visibleCategoryIds, setVisibleCategoryIds] = useState<
    Record<string, boolean>
  >({});
  const [heatmapCategories, setHeatmapCategories] = useState<HeatmapCategory[]>(
    []
  );
  const [heatmapItems, setHeatmapItems] = useState<
    Record<string, HeatmapItem[]>
  >({});
  const [activeHeatmapCategorySlug, setActiveHeatmapCategorySlug] = useState<
    string | null
  >(null);
  const [isLoadingHeatmapItems, setIsLoadingHeatmapItems] =
    useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [labelCategoryIds, setLabelCategoryIds] = useState<Set<string>>(
    new Set()
  );
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null); // Heatmap data state
  const [isLoadingHeatmap, setIsLoadingHeatmap] = useState<boolean>(false); // Loading state for heatmap
  const [currentHeatmapItemId, setCurrentHeatmapItemId] = useState<
    string | null
  >(null); // Track current item

  // Refs for map instance and view state
  const mapInstanceRef = useRef<OlMap | null>(null);
  const viewStateRef = useRef<{ zoom: number; extent: Extent } | null>(null);

  // Add mapState to track the OlMap instance
  const [mapState, setMapState] = useState<OlMap | null>(null);

  const mapId = useMemo(() => window.env?.handlerConfig?.mapId, []);

  useEffect(() => {
    if (!mapId) {
      setError("Map ID not found in configuration.");
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [mapJson, categoriesJson, markersJson, heatmapCategoriesJson] =
          await Promise.all([
            client.get(`/maps/${mapId}`, {}),
            client.get(`/maps/${mapId}/categories`, {}), // Fetches categories with isLabel
            client.get(`/maps/${mapId}/markers`, {}), // Fetches markers with categoryIsLabel
            client.get(`/game-data/categories/by-group/HEATMAP`, {}),
          ]);

        // Set map data
        setMapData(mapJson.data);

        // --- Process Categories --- //
        const fetchedCategories: ApiCategoryData[] = categoriesJson.data || [];
        const labelCats = fetchedCategories.filter((c) => c.isLabel);
        const markerCats = fetchedCategories.filter((c) => !c.isLabel);
        setLabelCategories(labelCats);
        setMarkerCategories(markerCats);
        // Create set of label category IDs
        setLabelCategoryIds(new Set(labelCats.map((c) => c.id)));

        // Initialize visibility (all true initially)
        const initialVisibility: Record<string, boolean> = {};
        fetchedCategories.forEach((cat: ApiCategoryData) => {
          const addChildren = (category: ApiCategoryData) => {
            initialVisibility[category.id] = true;
            category.children?.forEach(addChildren);
          };
          addChildren(cat);
        });
        setVisibleCategoryIds(initialVisibility);
        // --- End Process Categories --- //

        // Set all markers
        setAllMarkers(markersJson.data || []);

        // Set state for heatmap panel
        const fetchedHeatmapCategories = heatmapCategoriesJson.data || [];
        setHeatmapCategories(fetchedHeatmapCategories);
        setHeatmapItems({}); // Start with empty items
        setActiveHeatmapCategorySlug(null); // Ensure starts closed
      } catch (err: any) {
        Logger.error("Failed to load map data", err);
        setError(`Failed to load map data: ${err.message || "Unknown error"}`);
      } finally {
        setIsLoading(false);
      }
    };
    void fetchData();
  }, [mapId]);

  // --- Heatmap Fetching Logic ---
  const fetchHeatmapData = useCallback(
    async (itemId: string) => {
      Logger.info("misc", `===== CRITICAL EXECUTION PATH: fetchHeatmapData called for item ${itemId} =====`);
      
      if (!mapId || !viewStateRef.current) {
        Logger.warn(
          "utils",
          new Error("Map ID or view state not available for heatmap fetch.")
        );
        return;
      }

      const { zoom, extent } = viewStateRef.current;
      const [minX, minY, maxX, maxY] = extent;

      // Use integer zoom level
      const intZoom = Math.round(zoom);

      const apiUrl = `/game-data/heatmap/${mapId}/${itemId}/${intZoom}?minX=${minX}&minY=${minY}&maxX=${maxX}&maxY=${maxY}`;

      setIsLoadingHeatmap(true);
      try {
        Logger.debug("http", `Fetching heatmap data: ${apiUrl}`);
        const heatmapJson = await client.get(apiUrl, {});
        
        // CRITICAL: Log the actual heatmap data before setting it
        Logger.info(
          "misc", 
          `===== CRITICAL: Received heatmap data with ${heatmapJson.data?.length || 0} points =====`
        );
        
        // Set data and current item ID
        setHeatmapData({ points: heatmapJson.data || [] });
        setCurrentHeatmapItemId(itemId);
        
        Logger.debug(
          "http",
          `Received ${heatmapJson.data?.length || 0} heatmap points.`
        );
        
        // Simpler rendering approach that preserves all layers
        if (mapInstanceRef.current) {
          const map = mapInstanceRef.current;
          
          // CRITICAL: Log all layers before doing any manipulation
          Logger.info("misc", `===== CRITICAL: Logging layer state BEFORE heatmap update =====`);
          const allLayersBefore = map.getLayers().getArray();
          allLayersBefore.forEach((layer, index) => {
            Logger.info(
              "misc", 
              `Layer ${index}: id=${layer.get('id') || 'unknown'}, type=${layer.get('layerType') || 'unknown'}, visible=${layer.getVisible()}`
            );
          });
          
          // First, ensure all layers have correct z-index values
          // This is critical for maintaining visibility order
          const allLayers = map.getLayers().getArray();
          
          // Find marker/vector layers and ensure they have highest z-index
          allLayers.forEach(layer => {
            // Check if this is a VectorLayer (markers)
            if (layer.get('source') && layer.get('source').getFeatures) {
              // This looks like our marker layer - set highest z-index
              const beforeVisible = layer.getVisible();
              const beforeZIndex = layer.getZIndex();
              
              layer.setZIndex(10);
              
              // Explicitly ensure it's visible
              layer.setVisible(true);
              
              // Log that we're preserving marker layer
              Logger.info(
                "misc", 
                `===== CRITICAL: Setting marker layer visibility: ${beforeVisible} -> ${layer.getVisible()}, zIndex: ${beforeZIndex} -> ${layer.getZIndex()} =====`
              );
            }
            
            // Check if this is a HeatmapLayer
            if (layer.get('source') && layer.get('gradient')) {
              // This looks like a heatmap layer - set middle z-index
              layer.setZIndex(5);
              Logger.debug("http", "Set heatmap layer to z-index 5");
            }
          });
          
          // CRITICAL: Log all layers AFTER our attempted fix
          Logger.info("misc", `===== CRITICAL: Logging layer state AFTER z-index changes =====`);
          const allLayersAfter = map.getLayers().getArray();
          allLayersAfter.forEach((layer, index) => {
            Logger.info(
              "misc", 
              `Layer ${index}: id=${layer.get('id') || 'unknown'}, type=${layer.get('layerType') || 'unknown'}, visible=${layer.getVisible()}, zIndex=${layer.getZIndex() || 'default'}`
            );
          });
          
          // Trigger a render, but without modifying the view
          map.render();
          
          // Use a simple timeout to complete rendering and update loading state
          setTimeout(() => {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.render();
              
              // CRITICAL: Log all layers in the timeout
              Logger.info("misc", `===== CRITICAL: Logging layer state in TIMEOUT =====`);
              const timeoutLayers = mapInstanceRef.current.getLayers().getArray();
              timeoutLayers.forEach((layer, index) => {
                Logger.info(
                  "misc", 
                  `Layer ${index}: id=${layer.get('id') || 'unknown'}, type=${layer.get('layerType') || 'unknown'}, visible=${layer.getVisible()}, zIndex=${layer.getZIndex() || 'default'}`
                );
              });
              
              // CRITICAL FIX: Check if markers are still rendered and fix if not
              // This ensures markers don't disappear when heatmap loads
              const allLayersTimeout = mapInstanceRef.current.getLayers().getArray();
              allLayersTimeout.forEach(layer => {
                // For any layer that might be a marker layer, force visibility
                if (layer.setVisible) {
                  const isMarkerLayer = layer.get('source') && layer.get('source').getFeatures;
                  if (isMarkerLayer) {
                    const wasVisible = layer.getVisible();
                    layer.setVisible(true);
                    layer.setZIndex(10); // Force highest z-index again
                    Logger.info(
                      "misc", 
                      `===== CRITICAL: Re-enforced marker layer (timeout): ${wasVisible} -> ${layer.getVisible()} =====`
                    );
                  }
                }
              });
              
              // Force one more render
              mapInstanceRef.current.render();
              
              // CRITICAL NEW FIX: Explicitly force a refresh of the marker features
              // by simulating a change to visibleCategoryIds that will trigger the filter effect
              Logger.info(
                "misc",
                `===== CRITICAL: Forcing marker feature refresh by updating visibleCategoryIds =====`
              );
              
              // Make a shallow copy of the current state 
              const currentVisibility = {...visibleCategoryIds};
              
              // Apply the key fix: force a state update to trigger marker refresh
              setVisibleCategoryIds(currentVisibility);
            }
            
            // Complete loading
            setIsLoadingHeatmap(false);
          }, 100);
        } else {
          setIsLoadingHeatmap(false);
        }
      } catch (err: any) {
        Logger.error(`Failed to load heatmap data for item ${itemId}`, err);
        setError(
          `Failed to load heatmap data: ${err.message || "Unknown error"}`
        );
        setHeatmapData(null);
        setCurrentHeatmapItemId(null);
        setIsLoadingHeatmap(false);
      }
    },
    [mapId, visibleCategoryIds]
  );

  // Callback to receive map instance from EthyrialMapFull
  const handleMapReady = useCallback((map: OlMap) => {
    mapInstanceRef.current = map;
    setMapState(map); // Update state with map instance
    const view = map.getView();
    const zoom = view.getZoom();
    const extent = view.calculateExtent(map.getSize());
    if (zoom !== undefined) {
      viewStateRef.current = { zoom, extent }; // Store initial state
      Logger.info(
        "misc",
        `Map ready. Initial view: zoom=${zoom}, extent=${extent}`
      );
    }
  }, []);

  // Callback triggered by EthyrialMapFull on view change
  const handleViewChange = useCallback(
    (zoom: number, extent: Extent) => {
      const roundedZoom = Math.round(zoom);
      // Check if zoom or extent actually changed significantly to avoid rapid refetching
      const previousState = viewStateRef.current;
      if (
        previousState &&
        previousState.zoom === roundedZoom &&
        previousState.extent.every((val, i) => Math.abs(val - extent[i]) < 1)
      ) {
        // Skip refetch if view hasn't changed significantly
        return;
      }

      viewStateRef.current = { zoom: roundedZoom, extent };
      if (currentHeatmapItemId) {
        // Debounce or throttle this call in a real app if needed
        void fetchHeatmapData(currentHeatmapItemId);
      }
    },
    [currentHeatmapItemId, fetchHeatmapData]
  ); // Dependencies

  // Visibility handler needs to accept the full state from the panel
  const handleVisibilityChange = (
    newVisibilityState: Record<string, boolean>
  ) => {
    setVisibleCategoryIds(newVisibilityState);
  };

  const handleSearch = (query: string) => {
    // Placeholder for future search implementation
    Logger.debug("misc", `Search triggered with query: ${query}`);
  };

  // Handler for heatmap CATEGORY clicks (fetch items)
  const handleHeatmapCategoryClick = async (slug: string) => {
    if (activeHeatmapCategorySlug === slug) {
      setActiveHeatmapCategorySlug(null); // Toggle off
    } else {
      setActiveHeatmapCategorySlug(slug);
      // Fetch items only if not already fetched
      if (!heatmapItems[slug]) {
        setIsLoadingHeatmapItems(true);
        try {
          const itemsJson = await client.get(
            `/game-data/items/by-category/${slug}`,
            {}
          );
          setHeatmapItems((prev) => ({
            ...prev,
            [slug]: itemsJson.data || [],
          }));
        } catch (itemError) {
          Logger.error(
            `Failed to fetch heatmap items for ${slug}`,
            itemError as Error
          );
          setHeatmapItems((prev) => ({ ...prev, [slug]: [] })); // Set empty on error
        } finally {
          setIsLoadingHeatmapItems(false);
        }
      }
    }
  };

  // Update heatmap item click handler
  const handleHeatmapItemClick = (itemId: string) => {
    Logger.info("misc", `Heatmap item clicked: ${itemId || 'none'} (current: ${currentHeatmapItemId || 'none'})`);
    
    // Toggle behavior: if clicking the same item or sending empty string, clear the selection
    if (currentHeatmapItemId === itemId || itemId === "") {
      // Clear selection
      setHeatmapData(null);
      setCurrentHeatmapItemId(null);
      Logger.debug("misc", "Clearing heatmap selection");
    } else {
      // New selection - fetch data
      void fetchHeatmapData(itemId);
    }
  };

  if (error) {
    return <ErrorMessage>{error}</ErrorMessage>;
  }

  if (isLoading || !mapData) {
    return <LoadingIndicatorBar />; // Use Outline's loading indicator
  }

  return (
    <MapSceneContainer className="font-asul">
      <DndProvider backend={HTML5Backend}>
        <EthyrialMapFull
          mapId={mapId}
          mapData={mapData}
          allMarkers={allMarkers}
          visibleCategoryIds={visibleCategoryIds}
          labelCategoryIds={labelCategoryIds}
          heatmapData={heatmapData} // Pass heatmap data
          onMapReady={handleMapReady} // Pass callback
          onViewChange={handleViewChange} // Pass callback
        />
        <MapOverlayPanel
          labelCategories={labelCategories}
          markerCategories={markerCategories}
          visibleCategoryIds={visibleCategoryIds}
          onVisibilityChange={handleVisibilityChange}
          onSearch={handleSearch}
        />
        {/* Add loading indicator specifically for heatmap */}
        {isLoadingHeatmap && <LoadingIndicatorBar />}
        <HeatmapOverlayPanel
          categories={heatmapCategories}
          itemsByCategory={heatmapItems}
          activeCategorySlug={activeHeatmapCategorySlug}
          isLoadingItems={isLoadingHeatmapItems}
          onCategoryClick={handleHeatmapCategoryClick}
          onItemClick={handleHeatmapItemClick}
          selectedItemId={currentHeatmapItemId}
        />
        <CoordinateOverlay mapInstance={mapState} />
        <GlobalCustomDragLayer />
      </DndProvider>
    </MapSceneContainer>
  );
}

export default observer(MapScene);
