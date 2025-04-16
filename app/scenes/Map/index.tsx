import { observer } from "mobx-react";
import type { Map as OlMap } from "ol";
import type { Extent } from "ol/extent";
import * as React from "react";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import styled from "styled-components";
import type { AggregatedPoint } from "@server/utils/PointAggregator";
import EthyrialMapFull from "~/components/EthyrialMapFull";
import HeatmapOverlayPanel from "~/components/HeatmapOverlayPanel";
import { LoadingIndicatorBar } from "~/components/LoadingIndicator";
import MapOverlayPanel from "~/components/MapOverlayPanel";
import { client } from "~/utils/ApiClient";
import Logger from "~/utils/Logger";

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
        
        // Set data and current item ID
        setHeatmapData({ points: heatmapJson.data || [] });
        setCurrentHeatmapItemId(itemId);
        
        Logger.debug(
          "http",
          `Received ${heatmapJson.data?.length || 0} heatmap points.`
        );
        
        // Use a more comprehensive approach to ensure rendering works properly
        // This will trigger multiple rendering techniques in sequence with appropriate timing
        if (mapInstanceRef.current) {
          const map = mapInstanceRef.current;
          const view = map.getView();
          
          // Store current state
          const currentCenter = view.getCenter();
          const currentZoom = view.getZoom();
          
          if (currentCenter && currentZoom !== undefined) {
            // Multi-stage approach to force rendering
            
            // First force an immediate render
            map.render();
            
            // Then apply a sequence of small view changes with delays between them
            setTimeout(() => {
              // Stage 1: Shift map slightly (less than 1 pixel, users won't notice)
              view.setCenter([currentCenter[0] + 0.2, currentCenter[1]]);
              map.render();
              
              // Stage 2: Continue sequence after short delay
              setTimeout(() => {
                // Return to original position
                view.setCenter(currentCenter);
                map.render();
                
                // Stage 3: Final render with sync
                setTimeout(() => {
                  map.renderSync();
                  
                  // Finally, mark loading as complete after everything has settled
                  setTimeout(() => {
                    setIsLoadingHeatmap(false);
                  }, 100);
                }, 100);
              }, 100);
            }, 100);
          } else {
            setIsLoadingHeatmap(false);
          }
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
    [mapId]
  );

  // Callback to receive map instance from EthyrialMapFull
  const handleMapReady = useCallback((map: OlMap) => {
    mapInstanceRef.current = map;
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
    Logger.info("misc", `Heatmap item clicked: ${itemId}`);
    
    // If it's the same item, clean and re-fetch to ensure refresh
    if (currentHeatmapItemId === itemId) {
      setHeatmapData(null);
      // Small delay to ensure clear happens first
      setTimeout(() => {
        void fetchHeatmapData(itemId);
      }, 50);
    } else {
      // Fetch data using the new function
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
        onItemClick={handleHeatmapItemClick} // Use updated handler
      />
    </MapSceneContainer>
  );
}

export default observer(MapScene);
