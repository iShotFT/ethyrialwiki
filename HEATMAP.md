# Heatmap Implementation Documentation

## Overview
This document outlines the heatmap functionality implementation in the Ethyrial map system, detailing the data flow, component structure, and key interactions.

## HeatmapData Structure
- The `HeatmapData` interface is defined consistently across components: `{ points: AggregatedPoint[] }`
- Points represent aggregated data with x/y coordinates and weight attributes
- Aggregation happens server-side for performance optimization

## Data Flow Path

### 1. User Interaction
- Users interact with the `HeatmapOverlayPanel` component
- Panel displays categories and items organized hierarchically
- When a user clicks an item, `handleHeatmapItemClick` is triggered in `Map/index.tsx`

### 2. Data Fetching
- `fetchHeatmapData` callback function in `Map/index.tsx` handles data retrieval
- Makes API call to `/game-data/heatmap/${mapId}/${itemId}/${intZoom}?minX=${minX}&minY=${minY}&maxX=${maxX}&maxY=${maxY}`
- Includes viewport bounds and zoom level to optimize data retrieval
- Sets loading state with `setIsLoadingHeatmap(true)`

### 3. Backend Processing
- Server endpoint in `gameData.ts` receives the request
- Queries database for resource nodes matching the mapId and itemId
- Filters data using bounding box parameters
- Uses `PointAggregator` to aggregate points based on zoom level
- Returns aggregated points as response

### 4. Data Storage and Rendering
- Front-end receives data and stores it using `setHeatmapData({ points: heatmapJson.data || [] })`
- Uses multi-stage rendering approach with timeouts to ensure map updates properly
- `EthyrialMapFull` component receives the heatmap data as a prop
- Inside `EthyrialMapFull`, `handleHeatmapUpdate` is called when heatmap data changes

### 5. Heatmap Update Process
- `handleHeatmapUpdate` in `EthyrialMapFull.tsx` uses a processing flag to prevent cascading updates
- Calls the `updateHeatmap` utility function from `heatmapUtils.ts`
- Utility function:
  - Clears existing features
  - Converts each data point to an OpenLayers Feature with appropriate weight
  - Adds features to the vector source
  - Notifies the source of changes

### 6. Heatmap Rendering Configuration
- `getHeatmapParams` in `heatmapUtils.ts` provides zoom-dependent styling
- Parameters adjust radius, blur, and opacity based on zoom level
- Creates more spread-out heatmap when zoomed out, more focused when zoomed in

### 7. View Change Handling
- Map view changes trigger `handleViewChange` callback
- Checks if view changed significantly to avoid rapid refetching
- Updates viewStateRef and triggers fetchHeatmapData if an item is selected

### 8. Toggle Behavior
- Clicking the same item twice clears the selection (toggle behavior)
- Sets heatmapData to null and clears currentHeatmapItemId

## Key Components

1. **HeatmapOverlayPanel**: UI for selecting heatmap categories and items
2. **EthyrialMapFull**: Main map component that renders the heatmap layer
3. **MapScene**: Container component that manages state and coordinates interactions

## Utilities
- `heatmapUtils.ts`: Contains helper functions for updating the heatmap and calculating rendering parameters
- `PointAggregator`: Server-side utility for aggregating points based on zoom level 