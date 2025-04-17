# Ethyrial Wiki Map and Heatmap System

## System Architecture

This document provides a comprehensive overview of the map and heatmap system used in Ethyrial Wiki. The system uses OpenLayers for map rendering and implements a complex layer management system to display both heatmaps and vector markers.

## Core Components

1. **MapStore** (`app/stores/MapStore.ts`): Central state management for map-related data using MobX (Note: Less direct interaction now, mainly via `MapScene`)
2. **useHeatmapData** (`app/hooks/useHeatmapData.ts`): Custom hook for fetching and managing heatmap data (Note: Fetching logic now mainly resides within `MapScene`)
3. **heatmapUtils** (`app/utils/heatmapUtils.ts`): Utilities for rendering and updating heatmap layers (still used)
4. **mapUtils** (`app/utils/mapUtils.ts`): Utilities for URL hash parsing/updating and resource encoding.
5. **markerStyleUtils** (`app/utils/markerStyleUtils.ts`): Utilities for creating marker styles.
6. **MapOverlays** (`app/components/MapOverlays/`): Directory containing all overlay components:
   - **BaseOverlay** (`app/components/MapOverlays/BaseOverlay.tsx`): Base component for all overlays with dragging capability and standardized positioning.
   - **CoordinateOverlay** (`app/components/MapOverlays/CoordinateOverlay.tsx`): Draggable overlay displaying cursor coordinates.
   - **HeatmapOverlayPanel** (`app/components/MapOverlays/HeatmapOverlayPanel.tsx`): Overlay for selecting heatmap items.
   - **MapOverlayPanel** (`app/components/MapOverlays/MapOverlayPanel.tsx`): Overlay for controlling marker visibility.
   - **ZLayerOverlay** (`app/components/MapOverlays/ZLayerOverlay.tsx`): Overlay for controlling the map's Z-layer.
   - **GlobalCustomDragLayer** (`app/components/MapOverlays/GlobalCustomDragLayer.tsx`): Component rendering the drag preview for all overlays.
   - **index.ts**: Exports all overlay components for easy importing.
7. **EthyrialMapFull** (`app/components/EthyrialMapFull.tsx`): The main OpenLayers map component handling rendering, layers, interactions, and embedding overlays.
8. **MapScene** (`app/scenes/Map/index.tsx`): The primary scene component orchestrating data fetching, state management, and rendering of `EthyrialMapFull` and its overlays. Manages the central `DndProvider`.

## Layer Structure

The map consists of three primary layers managed by `EthyrialMapFull` (in order of z-index):
1. `base-osm` (z-index: 1): Base map layer using custom tile source.
2. `main-heatmap` (z-index: 5): Heatmap layer for resource visualization.
3. `main-markers` (z-index: 10): Vector markers layer for point locations.

## UI Components

### Map Overlays

Several overlay components provide interactive controls and information on top of the map. They are all located in `app/components/MapOverlays/` and utilize `BaseOverlay` for common functionality like dragging, positioning, and styling.

* **MapOverlayPanel**: Controls marker and label category visibility. Default position: `top-left`.
* **HeatmapOverlayPanel**: Allows selection of heatmap categories and items. Default position: `top-right`.
* **CoordinateOverlay**: Displays real-time cursor coordinates (X, Y) and map zoom level (Z). Default position: `bottom-right`. Minimal UI style.
* **ZLayerOverlay**: Provides buttons to change the map's Z-layer (vertical level). Default position: `middle-right`.

## Overlay Component Standards

When creating overlay components that sit on top of the map, follow these standards to ensure consistency:

### Styling & Structure

1. **Container Hierarchy**: Use `BaseOverlay` which internally uses `IngameBorderedDiv`.
2. **Standard Border Styling**: Handled by `IngameBorderedDiv` within `BaseOverlay`.
3. **Text & Content**: Use standard Ethyrial style guide colors (`#e0e0e0`, `#a0a0a0`, `#ffd5ae`) and fonts (`Asul`).

### BaseOverlay (`app/components/MapOverlays/BaseOverlay.tsx`)

This component provides the foundation for draggable map overlays.

1. **Required Props**:
   - `title`: String displayed in the header (if shown).
   - `localStorageKey`: Unique string key for saving/loading position in `localStorage`.
   - `dragType`: Unique string identifier for React-DnD to distinguish draggable items.
2. **Optional Props**:
   - `collapsedTitle`: String or character shown when the overlay is collapsed (defaults to `title`'s first char).
   - `defaultPosition`: Object specifying the initial position if none is saved. Uses `{ position: StandardPosition, offset?: PositionOffset }`.
     - `position`: A `StandardPosition` string (e.g., `'top-left'`, `'bottom-right'`, `'middle-right'`).
     - `offset`: Optional `{ x?: number, y?: number }` for fine-tuning from the standard position. Defaults apply edge distance.
   - `zIndex`: Number controlling the stacking order (defaults to 10).
   - `className`: String for additional CSS classes on the root element.
   - `showHeader`: Boolean, whether to display the header with title and collapse button (defaults to true).
   - `noPadding`: Boolean, removes internal padding if true (defaults to false).
   - `noBorder`: Boolean, removes the inner 3D border effect if true (defaults to false).
3. **Positioning Logic**:
   - Loads position from `localStorage` based on `localStorageKey` on mount.
   - If no saved position exists or it's invalid, calculates position based on `defaultPosition` prop, element dimensions, and viewport size.
   - Uses `DEFAULT_EDGE_DISTANCE` (16px) if no offset is provided in `defaultPosition`.
   - Saves the current position to `localStorage` whenever it's changed by dragging.
4. **Usage Example**:
   ```jsx
   // Inside a component wrapped by DndProvider
   import BaseOverlay, { DefaultPosition } from './BaseOverlay';

   const MyOverlay = () => {
     const defaultPos: DefaultPosition = { position: 'bottom-left', offset: { y: -10 } };

     return (
       <BaseOverlay
         title="My Custom Overlay"
         localStorageKey="my-custom-overlay-pos"
         dragType="MY_OVERLAY_TYPE"
         defaultPosition={defaultPos}
         zIndex={12}
       >
         {/* Overlay content */}
       </BaseOverlay>
     );
   };
   ```

### Drag & Drop Implementation (Centralized)

The drag and drop system for overlays is now centralized in the `MapScene` component (`app/scenes/Map/index.tsx`).

1. **Single `DndProvider`**: `MapScene` wraps all overlays (`MapOverlayPanel`, `HeatmapOverlayPanel`, `CoordinateOverlay`) and the `EthyrialMapFull` component (which contains `ZLayerOverlay`) within a single `<DndProvider backend={HTML5Backend}>`.
2. **`BaseOverlay` Drag Logic**: The `useDrag` hook within `BaseOverlay` handles initiating the drag and updating the component's position state upon drag end. It passes necessary item information (`width`, `height`, `isCollapsed`, `title`, `dragType`) to the drag layer.
3. **`GlobalCustomDragLayer`**: Located in `app/components/MapOverlays/GlobalCustomDragLayer.tsx`, this component is rendered *once* within the `DndProvider` in `MapScene`. It uses the `useDragLayer` hook to listen for drag events from *any* overlay (identified by `dragType`) and renders a styled preview based on the dragged item's data (`title`, `isCollapsed`, `width`).
4. **No Individual Providers**: Overlay components (`ZLayerOverlay`, `CoordinateOverlay`, etc.) **do not** need to be wrapped in their own `DndProvider` or export a `*Wrapper` component anymore. They should import and use `BaseOverlay` directly.

### Overlay Behavior

1. **Z-index Hierarchy**: Managed by the `zIndex` prop passed to `BaseOverlay`. Drag previews are handled by `GlobalCustomDragLayer` with a high z-index (100).
2. **Opacity States**: The original overlay (`BaseOverlay`) is hidden (`opacity: 0`) while dragging. The `GlobalCustomDragLayer` renders the preview.
3. **Position Persistence**: Handled within `BaseOverlay` using `localStorage` and the `localStorageKey` prop. The `defaultPosition` prop defines the fallback.

## Critical Dependencies

### React-DnD Requirements (Centralized)

Drag-and-drop functionality relies on `react-dnd`. The core requirement is now fulfilled by wrapping the relevant part of the UI tree in `MapScene` with a single `DndProvider`:

```jsx
// app/scenes/Map/index.tsx
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import GlobalCustomDragLayer from '~/components/MapOverlays/GlobalCustomDragLayer';
// ... other imports

function MapScene() {
  // ... state and logic
  return (
    <MapSceneContainer>
      <DndProvider backend={HTML5Backend}>
        {/* Map Component */}
        <EthyrialMapFull {...mapProps} />

        {/* Overlay Components */}
        <MapOverlayPanel {...mapOverlayProps} />
        <HeatmapOverlayPanel {...heatmapPanelProps} />
        {mapState && <CoordinateOverlay mapInstance={mapState} />}
        {/* ZLayerOverlay is inside EthyrialMapFull */}

        {/* Global Drag Layer */}
        <GlobalCustomDragLayer />
      </DndProvider>
    </MapSceneContainer>
  );
}
```

**CRITICAL WARNING**: While individual components no longer need wrapping, the *entire interactive map area including all overlays* must exist within this single `DndProvider` context provided by `MapScene`. Forgetting this will cause the `Expected drag drop context` error.

## Critical Execution Paths

1. `fetchHeatmapData` in `useHeatmapData.ts` is called with an item ID (observed: `27c8be13-55da-56d0-ab11-798326269ffe`)
2. API request is made to `/game-data/heatmap/${mapId}/${itemId}/${intZoom}?minX=${minX}&minY=${minY}&maxX=${maxX}&maxY=${maxY}`
3. Response data (496 points observed in logs) is stored in MapStore via `MapStore.setHeatmapData()`
4. When heatmap data is set, `ensureLayerVisibility()` and `refreshVectorLayers()` are called with timeouts
5. `updateHeatmap()` in `heatmapUtils.ts` processes the points and adds features to the heatmap layer

## Code Evolution Context

This system has evolved to address specific challenges:
1. Initial implementation had issues with vector layers disappearing after heatmap updates
2. Multiple timeouts were added to ensure proper rendering sequence
3. Layer management logic was refined within `EthyrialMapFull` and utility functions
4. Type safety improvements were made
5. Coordinate and Z-Layer overlay components added for better user control/feedback
6. **Recent**: Drag and Drop was refactored from individual providers per overlay to a single, centralized `DndProvider` in `MapScene` using a `GlobalCustomDragLayer` to fix component disappearing issues and adhere to best practices
7. **Recent**: Overlay positioning was standardized using a `defaultPosition` prop in `BaseOverlay`, replacing the less flexible `initialPosition`

## Known Issues & Future Improvements

* The multi-timeout approach for layer visibility, while functional, indicates potential underlying complexity or race conditions in OpenLayers rendering that could be investigated further
* Default position calculation in `BaseOverlay` relies on `panelRef.current`, which might not be immediately available on the first render cycle, potentially causing a slight flicker or using estimated dimensions initially
* Consider abstracting common overlay state logic (like collapse state) into a custom hook if more overlays are added

## Observed Execution Flow

Based on console logs, the actual execution flow is:

1. `updateHeatmap` is called with 496 points
2. System logs "Getting ready to update heatmap with: source=true, layer=true"
3. Map reference is found with 3 layers:
   - Layer 0: id=base-osm, type=basemap, visible=true
   - Layer 1: id=main-heatmap, type=heatmap, visible=true
   - Layer 2: id=main-markers, type=marker, visible=true
4. Vector layer 'main-markers' is identified and stored
5. Visibility of 'main-markers' is preserved (true -> true)
6. After 200ms timeout, delayed check ensures vector layers remain visible
7. 'main-markers' visibility is confirmed (true -> true)
8. After nested 150ms timeout, super delayed final check forces rendering sequence
9. 'main-markers' layer receives final visibility update
10. `fetchHeatmapData` is called again for the same item
11. System logs "Received heatmap data with 496 points"
12. Layer state is logged BEFORE heatmap update (all layers visible)
13. Marker layer visibility and z-index are set (true -> true, zIndex: 5 -> 10 and 10 -> 10)
14. Layer state is logged AFTER z-index changes
15. Layer state in TIMEOUT is logged again
16. Marker layer visibility is reinforced in timeout (true -> true)
17. System forces marker feature refresh by updating visibleCategoryIds

This sequence repeats three times in the provided logs, showing the system's repetitive checks and enforcements of layer visibility.

## Type Safety Considerations

1. Layer type checking uses both instance checks and property comparisons:
   - `instanceof VectorLayer` for basic type checking
   - `l.get('id') !== layer.get('id')` to avoid TypeScript errors between incompatible layer types
   - Properties like `layerType === 'heatmap'` for semantic identification

2. HeatmapData interfaces are defined in multiple locations:
   - `MapStore.ts`: `points: Array<[number, number, number]>;` (x,y,weight)
   - `heatmapUtils.ts`: `points: AggregatedPoint[];`

3. Event handling in OpenLayers requires careful type management:
   - Using proper types for event handlers (`OLPointerEvent` for `pointermove`)
   - Ensuring handler references are maintained for proper cleanup

## Rendering Sequence

The system ensures proper layer rendering through a multi-step process:

1. Clear existing heatmap features
2. Process and normalize point weights (0.3-1.0 range)
3. Add features to heatmap source
4. Set heatmap z-index lower than marker layers (5 vs 10)
5. Force vector layers to maintain visibility
6. Apply multiple staged renders with timeouts to ensure proper visibility

## Common Debugging Patterns

Extensive logging is used throughout the system with consistent patterns:
- `[LayerManager]` prefix for layer management operations
- `[HeatmapDebug]` prefix for heatmap operations
- `===== CRITICAL PATH: ...` for important execution paths
- `===== CRITICAL: ...` for critical operations
- `===== DELAYED CHECK: ...` for timeout-based checks
- `===== SUPER DELAYED FINAL CHECK ...` for nested timeout checks
- Detailed layer state logging before/after operations

## Performance Considerations

1. Batch operations on features before adding to source
2. Normalize weights for better visualization
3. Use timeouts strategically to work around OpenLayers rendering issues
4. Only update when there's actual change in data

## Known Edge Cases

1. If map reference is not available from layer, a fallback rendering path is used
2. Weight normalization handles edge cases (min=max, zero weights)
3. Multiple safeguards ensure vector layers remain visible even after multiple heatmap operations

## Z-Index Management

Z-index values are explicitly set and enforced throughout the rendering process:
- Base map (base-osm): z-index 1
- Heatmap layer (main-heatmap): z-index 5
- Vector marker layer (main-markers): z-index 10
- In timeout reinforcement: z-index 20 (extra high to ensure top position)

## Local Storage Usage

The system uses LocalStorage for persisting user preferences:
- `coordinate-overlay-position`: Stores the position of the coordinate overlay panel

## Styling Patterns

The UI components follow consistent Ethyrial styling patterns:
- Dark theme with nested borders creating a 3D effect
- Primary backgrounds: `#38322c` (outer) and `#151515` (inner)
- Border colors: `#4e443a` (light) and `#2c2824` (dark)
- Monospace fonts for coordinate displays

## React-DnD Integration

The drag and drop functionality uses React-DnD with specific patterns:
- Separate refs for drag handles and component containers
- Position state synchronized with drag operations
- Persistence of positions across sessions via LocalStorage
- **CRITICAL**: Components using DnD hooks MUST be wrapped in a DndProvider
- Required imports:
  ```javascript
  import { DndProvider } from 'react-dnd';
  import { HTML5Backend } from 'react-dnd-html5-backend';
  ```

## Common Breaking Issues and Solutions

1. **React-DnD Context Missing**
   - **Error**: `Uncaught Invariant Violation: Expected drag drop context`
   - **Cause**: Using React-DnD hooks (like `useDrag`) without wrapping components in a `DndProvider`
   - **Solution**: Always wrap components that use DnD hooks in a `DndProvider` with a backend:
     ```jsx
     <DndProvider backend={HTML5Backend}>
       <ComponentUsingDragDrop />
     </DndProvider>
     ```

2. **OpenLayers Event Listener Type Errors**
   - **Cause**: OpenLayers has specific typing requirements for event listeners
   - **Solution**: Use proper handler signatures and ensure clean removal of listeners

## Dead Code and Optimizations

While seemingly redundant, the multiple checks and timeouts are intentional safeguards against OpenLayers rendering quirks. What might appear as "dead code" is actually critical for ensuring proper layer visibility in all scenarios. The system prioritizes reliability over code minimalism. 