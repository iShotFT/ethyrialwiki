import { observer } from "mobx-react";
import type { Map as OlMap } from "ol";
import type { Extent } from "ol/extent";
import HeatmapLayer from "ol/layer/Heatmap";
import VectorSource from "ol/source/Vector";
import * as React from "react";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import styled from "styled-components";
import "react-toastify/dist/ReactToastify.css";
import EthyrialMapFull from "~/components/EthyrialMapFull";
import {
  HeatmapOverlayPanel,
  MapOverlayPanel,
  CoordinateOverlay,
  GlobalCustomDragLayer
} from "~/components/MapOverlays";
import ToastOverlay from "~/components/MapOverlays/ToastOverlay";
import { client } from "~/utils/ApiClient";
import Logger from "~/utils/Logger";
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useHeatmapData } from "~/hooks/useHeatmapData";
import MapStore from "~/stores/MapStore";
import { MarkerStyleProvider } from "~/components/MarkerStyleContext";

// Define the AggregatedPoint type to match the server definition
interface AggregatedPoint {
  x: number;
  y: number;
  weight: number;
  count: number;
  cellSize: number;
}

// Core data types
interface HeatmapData {
  points: AggregatedPoint[];
}

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

interface ApiCategoryData {
  id: string;
  slug: string;
  title: string;
  iconUrl: string | null;
  parentId: string | null;
  children: ApiCategoryData[];
  isLabel: boolean;
}

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

// Styled component for layout
const MapSceneContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
`;

const ErrorMessage = styled.div`
  padding: 40px;
  text-align: center;
`;

function MapScene() {
  // State for map data
  const [mapData, setMapData] = useState<any>(null);
  const [allMarkers, setAllMarkers] = useState<ApiMarkerData[]>([]);
  const [labelCategories, setLabelCategories] = useState<ApiCategoryData[]>([]);
  const [markerCategories, setMarkerCategories] = useState<ApiCategoryData[]>([]);
  const [visibleCategoryIds, setVisibleCategoryIds] = useState<Record<string, boolean>>({});
  const [heatmapCategories, setHeatmapCategories] = useState<HeatmapCategory[]>([]);
  const [heatmapItems, setHeatmapItems] = useState<Record<string, HeatmapItem[]>>({});
  const [activeHeatmapCategorySlug, setActiveHeatmapCategorySlug] = useState<string | null>(null);
  const [isLoadingHeatmapItems, setIsLoadingHeatmapItems] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [labelCategoryIds, setLabelCategoryIds] = useState<Set<string>>(new Set());
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [mapState, setMapState] = useState<OlMap | null>(null);

  // Get mapId from config
  const mapId = useMemo(() => window.env?.handlerConfig?.mapId, []);
  
  // View state tracking
  const viewStateRef = useRef<{ zoom: number; extent: Extent } | null>(null);
  
  // Use the heatmap hook - this is the key integration point
  const {
    fetchHeatmapData,
    clearHeatmap,
    currentHeatmapItemId,
    isLoading: isLoadingHeatmap,
    error: heatmapError,
    mapRef,
    heatmapSourceRef,
    heatmapLayerRef
  } = useHeatmapData();

  // Initial data fetching
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
            client.get(`/maps/${mapId}/categories`, {}),
            client.get(`/maps/${mapId}/markers`, {}),
            client.get(`/game-data/categories/by-group/HEATMAP`, {}),
          ]);

        // Process map data
        setMapData(mapJson.data);

        // Process categories
        const fetchedCategories: ApiCategoryData[] = categoriesJson.data || [];
        const labelCats = fetchedCategories.filter((c) => c.isLabel);
        const markerCats = fetchedCategories.filter((c) => !c.isLabel);
        setLabelCategories(labelCats);
        setMarkerCategories(markerCats);
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

        // Set markers
        setAllMarkers(markersJson.data || []);

        // Set heatmap categories
        const fetchedHeatmapCategories = heatmapCategoriesJson.data || [];
        setHeatmapCategories(fetchedHeatmapCategories);
        setHeatmapItems({});
        setActiveHeatmapCategorySlug(null);
      } catch (err: any) {
        Logger.error("Failed to load map data", err);
        setError(`Failed to load map data: ${err.message || "Unknown error"}`);
      } finally {
        setIsLoading(false);
      }
    };
    void fetchData();
  }, [mapId]);

  // Handle map ready event from EthyrialMapFull
  const handleMapReady = useCallback((map: OlMap) => {
    // Store the map reference for context
    setMapState(map);
    
    // Store the map reference in the mapRef from our hook
    mapRef.current = map;
    
    // Initialize view state
    const view = map.getView();
    const zoom = view.getZoom();
    const extent = view.calculateExtent(map.getSize());
    
    if (zoom !== undefined) {
      viewStateRef.current = { zoom, extent };
      Logger.info("misc", `Map ready. Initial view: zoom=${zoom}, extent=${extent}`);
    }
  }, [mapRef]);

  // Store heatmap layer and source references
  const handleHeatmapLayersReady = useCallback((layer: HeatmapLayer, source: VectorSource) => {
    heatmapLayerRef.current = layer;
    heatmapSourceRef.current = source;
    Logger.info("misc", "Heatmap layer and source references stored");
  }, [heatmapLayerRef, heatmapSourceRef]);

  // Handle view changes from map
  const handleViewChange = useCallback(
    (zoom: number, extent: Extent) => {
      // Store current view state
      viewStateRef.current = { zoom, extent };
      
      // Update MapStore's view state
      MapStore.setViewState({ zoom, extent });
      
      // If we have a selected heatmap item, update the heatmap
      if (currentHeatmapItemId) {
        // Fetch heatmap data with the updated view, but don't update store to prevent re-renders
        fetchHeatmapData({
          mapId,
          itemId: currentHeatmapItemId,
          viewState: { zoom, extent },
          map: mapRef.current,
          heatmapLayer: heatmapLayerRef.current,
          heatmapSource: heatmapSourceRef.current,
          updateStore: false // Prevent store updates during panning that might trigger React re-renders
        });
      }
    },
    [currentHeatmapItemId, fetchHeatmapData, heatmapLayerRef, heatmapSourceRef, mapId, mapRef]
  );

  // Handle visibility changes for markers
  const handleVisibilityChange = (newVisibilityState: Record<string, boolean>) => {
    setVisibleCategoryIds(newVisibilityState);
  };

  // Handle search (placeholder)
  const handleSearch = (query: string) => {
    Logger.debug("misc", `Search triggered with query: ${query}`);
  };

  // Handler for heatmap category clicks
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

  // Handle heatmap item selection
  const handleHeatmapItemClick = useCallback((itemId: string) => {
    Logger.info("misc", `Heatmap item clicked: ${itemId || 'none'} (current: ${currentHeatmapItemId || 'none'})`);
    
    // Toggle behavior: if clicking the same item, clear selection
    if (currentHeatmapItemId === itemId || itemId === "") {
      clearHeatmap();
      Logger.debug("misc", "Clearing heatmap selection");
    } else {
      // Always update the current item ID in MapStore for UI state
      MapStore.setCurrentHeatmapItemId(itemId);
      
      // Only fetch if we have the view state
      if (viewStateRef.current) {
        // Fetch new heatmap data using the hook - don't update store to prevent re-renders
        fetchHeatmapData({
          mapId,
          itemId,
          viewState: viewStateRef.current,
          map: mapRef.current,
          heatmapLayer: heatmapLayerRef.current,
          heatmapSource: heatmapSourceRef.current,
          updateStore: false // Prevent store updates that might trigger React re-renders
        });
      } else {
        Logger.warn("misc", new Error("Cannot fetch heatmap data: view state not initialized"));
      }
    }
  }, [clearHeatmap, currentHeatmapItemId, fetchHeatmapData, heatmapLayerRef, heatmapSourceRef, mapId, mapRef]);

  // Combine heatmap error with component error
  useEffect(() => {
    if (heatmapError && !error) {
      setError(heatmapError);
    }
  }, [heatmapError, error]);

  // Memoize props for EthyrialMapFull to prevent unnecessary rerenders
  const mapProps = useMemo(() => ({
    mapId,
    mapData,
    allMarkers,
    visibleCategoryIds,
    labelCategoryIds,
    // Use proper type conversion for MapStore.heatmapData to meet component expectations
    heatmapData: MapStore.heatmapData ? {
      points: MapStore.heatmapData.points.map(point => ({
        x: point[0],
        y: point[1],
        weight: point[2],
        count: 1,
        cellSize: 10 // Default cell size, since it's not available in the stored data
      }))
    } : null,
    onMapReady: handleMapReady,
    onViewChange: handleViewChange,
    onHeatmapLayersReady: handleHeatmapLayersReady
  }), [
    mapId, 
    mapData, 
    allMarkers, 
    visibleCategoryIds, 
    labelCategoryIds,
    // Add MapStore.heatmapData to dependencies
    MapStore.heatmapData,
    handleMapReady, 
    handleViewChange,
    handleHeatmapLayersReady
  ]);

  // Error handling
  if (error) {
    return <ErrorMessage>{error}</ErrorMessage>;
  }

  return (
    <MapSceneContainer className="font-asul">
      <DndProvider backend={HTML5Backend}>
        <MarkerStyleProvider>
          <EthyrialMapFull {...mapProps} />
          <MapOverlayPanel
            labelCategories={labelCategories}
            markerCategories={markerCategories}
            visibleCategoryIds={visibleCategoryIds}
            onVisibilityChange={handleVisibilityChange}
            onSearch={handleSearch}
          />
          <HeatmapOverlayPanel
            categories={heatmapCategories}
            itemsByCategory={heatmapItems}
            activeCategorySlug={activeHeatmapCategorySlug}
            isLoadingItems={isLoadingHeatmapItems}
            isLoadingHeatmap={isLoadingHeatmap}
            onCategoryClick={handleHeatmapCategoryClick}
            onItemClick={handleHeatmapItemClick}
            selectedItemId={currentHeatmapItemId}
          />
          <CoordinateOverlay mapInstance={mapState} />
          <GlobalCustomDragLayer />
          <ToastOverlay />
        </MarkerStyleProvider>
      </DndProvider>
    </MapSceneContainer>
  );
}

export default observer(MapScene);