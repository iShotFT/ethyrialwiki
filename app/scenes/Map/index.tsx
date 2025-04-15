import { observer } from "mobx-react";
import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { useRouteMatch } from "react-router-dom";
import styled from "styled-components";
import RootStore from "~/stores/RootStore";
import EthyrialMapFull from "~/components/EthyrialMapFull";
import { LoadingIndicatorBar } from "~/components/LoadingIndicator";
import MapOverlayPanel from "~/components/MapOverlayPanel";
import HeatmapOverlayPanel from "~/components/HeatmapOverlayPanel";
import useStores from "~/hooks/useStores";
import { client } from "~/utils/ApiClient";
import Logger from "~/utils/Logger";

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
}

// Interface for MapOverlayPanel props
interface MapOverlayPanelProps {
  labelCategories: ApiCategoryData[]; // Use specific name
  markerCategories: ApiCategoryData[]; // Use specific name
  visibleCategoryIds: Record<string, boolean>; // Combined visibility state
  onVisibilityChange: (visibilityState: Record<string, boolean>) => void; // Callback for state change
  onSearch: (query: string) => void;
}

// Interface for EthyrialMapFull props
interface EthyrialMapFullProps {
  mapId: string;
  mapData: any; // Use specific type if available
  allMarkers: ApiMarkerData[];
  visibleCategoryIds: Record<string, boolean>; // Combined visibility state
  labelCategoryIds: Set<string>;
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
  const stores = useStores();
  const { ui } = stores;
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

  const mapId = useMemo(() => window.env?.handlerConfig?.mapId, []);

  /* Remove background color effect
  useEffect(() => {
    // Set the background directly for fullscreen effect
    ui.setBackgroundColor(ui.theme.background);
    return () => ui.resetBackgroundColor();
  }, [ui, ui.theme]);
  */

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
        const [mapJson, categoriesJson, markersJson, heatmapCategoriesJson] = await Promise.all([
          client.get(`/maps/${mapId}`, {}),
          client.get(`/maps/${mapId}/categories`, {}), // Fetches categories with isLabel
          client.get(`/maps/${mapId}/markers`, {}), // Fetches markers with categoryIsLabel
          client.get(`/game-data/categories/by-group/HEATMAP`, {}),
        ]);

        // Set map data
        setMapData(mapJson.data);

        // --- Process Categories --- //
        const fetchedCategories: ApiCategoryData[] = categoriesJson.data || [];
        const labelCats = fetchedCategories.filter(c => c.isLabel);
        const markerCats = fetchedCategories.filter(c => !c.isLabel);
        setLabelCategories(labelCats);
        setMarkerCategories(markerCats);
        // Create set of label category IDs
        setLabelCategoryIds(new Set(labelCats.map(c => c.id)));

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

  // Visibility handler needs to accept the full state from the panel
  const handleVisibilityChange = (newVisibilityState: Record<string, boolean>) => {
      setVisibleCategoryIds(newVisibilityState);
  };

  const handleSearch = (query: string) => {
    console.log("Search Query:", query);
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
          const itemsJson = await client.get(`/game-data/items/by-category/${slug}`, {});
          setHeatmapItems(prev => ({ ...prev, [slug]: itemsJson.data || [] }));
        } catch (itemError) {
            Logger.error(`Failed to fetch heatmap items for ${slug}`, itemError as Error);
            setHeatmapItems(prev => ({ ...prev, [slug]: [] })); // Set empty on error
        } finally {
            setIsLoadingHeatmapItems(false);
        }
      }
    }
  };

  // Handler for heatmap ITEM clicks (placeholder)
  const handleHeatmapItemClick = (itemId: string) => {
    console.log("Heatmap item clicked:", itemId);
    // TODO: Implement heatmap display logic here
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
      />
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
        onCategoryClick={handleHeatmapCategoryClick}
        onItemClick={handleHeatmapItemClick}
      />
    </MapSceneContainer>
  );
}

export default observer(MapScene);
