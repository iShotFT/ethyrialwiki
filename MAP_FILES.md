# Map System Files and Architecture

## Core Components

### Main Scene
- `app/scenes/Map/index.tsx` - The main Map scene component that orchestrates everything

### Map Components
- `app/components/EthyrialMapFull.tsx` - Main map rendering component
- `app/components/Map/Layers/LayerManager.ts` - Layer management utilities (currently underutilized)

### Overlay Components
- `app/components/MapOverlays/MapOverlayPanel.tsx` - Panel for toggling marker visibility
- `app/components/MapOverlays/HeatmapOverlayPanel.tsx` - Panel for heatmap controls
- `app/components/MapOverlays/CoordinateOverlay.tsx` - Shows coordinates
- `app/components/MapOverlays/ToastOverlay.tsx` - Toast notifications
- `app/components/MapOverlays/BaseOverlay.tsx` - Base component for overlay panels

## State Management

### Stores
- `app/stores/MapStore.ts` - Central store for map state
- `app/stores/base/Store.ts` - Base store functionality

### Hooks
- `app/hooks/useHeatmapData.ts` - Hook for fetching and managing heatmap data
- `app/hooks/useMarkerStyles.ts` - Hook for marker styling (currently not fully integrated)
- `app/hooks/useMenuContext.tsx` - Generic menu context hook

## Utilities
- `app/utils/markerStyleUtils.ts` - Utilities for marker styling
- `app/utils/heatmapUtils.ts` - Utilities for heatmap rendering

## Current Architecture Issues

1. **Layer Management**
   - `LayerManager.ts` exists but is not integrated with heatmap rendering
   - Direct manipulation of OpenLayers objects instead of going through managers

2. **Styling**
   - Disconnected styling between `MapOverlayPanel.tsx` and actual marker rendering
   - Category colors defined in `MapOverlayPanel.tsx` not used for marker styling

3. **State Management**
   - Some state managed via hooks, some via stores, some directly in components
   - Unclear boundaries between different state management approaches

## Current Data Flow

1. **Map Initialization**
   - `Map/index.tsx` loads and sets up the map scene
   - `EthyrialMapFull.tsx` renders the actual OpenLayers map
   - Various overlay panels are rendered alongside the map

2. **Marker Management**
   - Categories and markers loaded in `Map/index.tsx`
   - Visibility toggled in `MapOverlayPanel.tsx`
   - Actual rendering likely happens in `EthyrialMapFull.tsx`

3. **Heatmap Management**
   - Heatmap categories and items loaded in `Map/index.tsx`
   - Selection happens in `HeatmapOverlayPanel.tsx`
   - Data fetched via `useHeatmapData.ts` hook
   - Direct manipulation of OpenLayers objects

## Planned Improvements

1. **Centralized Layer Management**
   - Integrate `LayerManager.ts` with all layer operations
   - Make it the single source of truth for layer manipulation

2. **Consistent Styling System**
   - Create a centralized marker styling system
   - Use category colors consistently across UI and map

3. **Clear State Management Boundaries**
   - Define what state belongs in stores vs. hooks vs. components
   - Standardize the approach for each type of state

4. **Logical Directory Structure**
   - Organize map-related code by domain/function rather than by type
   - Keep related functionalities together 