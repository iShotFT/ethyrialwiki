import { observer } from "mobx-react";
import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { useRouteMatch } from "react-router-dom";
import styled from "styled-components";
import RootStore from "~/stores/RootStore";
import EthyrialMapFull from "~/components/EthyrialMapFull";
import { LoadingIndicatorBar } from "~/components/LoadingIndicator";
import MapOverlayPanel from "~/components/MapOverlayPanel";
import useStores from "~/hooks/useStores";
import { client } from "~/utils/ApiClient";

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
  const [allMarkers, setAllMarkers] = useState<any[]>([]); // Store all fetched markers
  const [filteredMarkers, setFilteredMarkers] = useState<any[]>([]); // Markers to display
  const [categories, setCategories] = useState<any[]>([]);
  const [visibleCategories, setVisibleCategories] = useState<
    Record<string, boolean>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        // Use the default shared client instance (relative paths)
        // client.get returns the parsed JSON data directly or throws on error
        const [mapJson, categoriesJson, markersJson] = await Promise.all([
          client.get(`/maps/${mapId}`, {}),
          client.get(`/maps/${mapId}/categories`, {}),
          client.get(`/maps/${mapId}/markers`, {}),
        ]);

        // Access the .data property directly from the resolved promises
        setMapData(mapJson.data);
        setCategories(categoriesJson.data);
        setAllMarkers(markersJson.data); // Store all markers
        setFilteredMarkers(markersJson.data); // Initially show all

        // Initialize visibility state based on fetched categories
        const initialVisibility: Record<string, boolean> = {};
        categoriesJson.data.forEach(
          (cat: any) => (initialVisibility[cat.id] = true)
        );
        setVisibleCategories(initialVisibility);
      } catch (err: any) {
        // ApiClient throws specific error types, catch them if needed
        // For now, just display the message
        setError(`Failed to load map data: ${err.message || "Unknown error"}`);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, [mapId]);

  // Effect to filter markers based on visibility state
  useEffect(() => {
    const newFilteredMarkers = allMarkers.filter(
      (marker) => visibleCategories[marker.categoryId] !== false // Show if true or undefined (default)
    );
    setFilteredMarkers(newFilteredMarkers);
  }, [visibleCategories, allMarkers]);

  // Handler for visibility changes from the overlay panel
  const handleVisibilityChange = (newVisibilityState: Record<string, boolean>) => {
    setVisibleCategories(newVisibilityState);
  };

  const handleSearch = (query: string) => {
    // TODO: Implement logic to filter/highlight markers based on search query
    console.log("Search Query:", query);
  };

  if (error) {
    return <ErrorMessage>{error}</ErrorMessage>;
  }

  if (isLoading || !mapData) {
    return <LoadingIndicatorBar />; // Use Outline's loading indicator
  }

  return (
    <MapSceneContainer>
      <EthyrialMapFull
        mapId={mapId}
        mapData={mapData}
        markers={filteredMarkers}
      />
      <MapOverlayPanel
        categories={categories}
        onVisibilityChange={handleVisibilityChange}
        onSearch={handleSearch}
      />
    </MapSceneContainer>
  );
}

export default observer(MapScene);
