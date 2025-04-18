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

### 2. Data Fetching with useHeatmapData Hook
- The `useHeatmapData` hook encapsulates heatmap data fetching and processing logic
- `fetchHeatmapData` method in the hook handles data retrieval with direct OpenLayers references
- Makes API call to `/game-data/heatmap/${mapId}/${itemId}/${intZoom}?minX=${minX}&minY=${minY}&maxX=${maxX}&maxY=${maxY}`
- Includes viewport bounds and zoom level to optimize data retrieval
- Sets loading state via MapStore

### 3. Backend Processing
- Server endpoint in `gameData.ts` receives the request
- Queries database for resource nodes matching the mapId and itemId
- Filters data using bounding box parameters
- Uses `PointAggregator` to aggregate points based on zoom level
- Returns aggregated points as response

### 4. Data Storage and Rendering
- Front-end receives data and stores it in MapStore using `MapStore.setHeatmapData({ points })`
- Updates are applied directly to OpenLayers objects to bypass React re-rendering
- `EthyrialMapFull` component uses the hook and passes layer/source references
- The hook directly updates the heatmap layer with received data

### 5. Heatmap Update Process
- `updateHeatmap` utility function from `heatmapUtils.ts` handles updating the heatmap
- The hook calls this utility after successful data fetching
- Utility function:
  - Clears existing features
  - Converts each data point to an OpenLayers Feature with appropriate weight
  - Adds features to the vector source
  - Notifies the source of changes
  - Forces layer visibility and redraw if needed

### 6. Heatmap Rendering Configuration
- `getHeatmapParams` in `heatmapUtils.ts` provides zoom-dependent styling
- Parameters adjust radius, blur, and opacity based on zoom level
- Creates more spread-out heatmap when zoomed out, more focused when zoomed in

### 7. View Change Handling
- Map view changes trigger `onViewChange` callback in EthyrialMapFull
- This passes the new extent and zoom to parent components
- Updates trigger new data fetching if a heatmap item is selected

### 8. Toggle Behavior
- Clicking the same item twice clears the selection (toggle behavior)
- Sets heatmapData to null and clears currentHeatmapItemId in the store

## Key Components

1. **HeatmapOverlayPanel**: UI for selecting heatmap categories and items
2. **EthyrialMapFull**: Main map component that manages the heatmap layer
3. **useHeatmapData**: Custom hook for fetching and applying heatmap data
4. **MapStore**: Centralized store for map state including heatmap data
5. **MapScene**: Container component that coordinates interactions

## Utilities
- `heatmapUtils.ts`: Contains helper functions for updating the heatmap and calculating rendering parameters
- `PointAggregator`: Server-side utility for aggregating points based on zoom level 