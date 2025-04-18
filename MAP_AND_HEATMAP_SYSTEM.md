# Ethyrial Wiki Map and Heatmap System

## System Architecture

This document provides a comprehensive overview of the map and heatmap system used in Ethyrial Wiki. The system uses OpenLayers for map rendering and implements a complex layer management system to display both heatmaps and vector markers.

## Core Components

1. **MapStore** (`app/stores/MapStore.ts`): Central state management for map-related data using MobX. Stores heatmap data, loading states, and error states.
2. **useHeatmapData** (`app/hooks/useHeatmapData.ts`): Custom hook for fetching and managing heatmap data. Provides direct layer updating methods that bypass React re-rendering for performance.
3. **Map Components** (`app/components/Map/`): Organized directory of React components and utilities for map rendering:
   - **Core**: Base components and utilities
   - **Context**: React context for sharing map state
   - **Layers**: Layer creation and management
   - **Controls**: UI controls for map interaction
   - **URL**: Hash management for keeping state in URL

### Map Component Structure

* **MapContainer** (`app/components/Map/Core/MapContainer.tsx`): Styled container component with optimized rendering settings
* **MapInstance** (`app/components/Map/Core/MapInstance.tsx`): Handles OpenLayers map initialization and syncs with MapStore
* **useMapInteractions** (`app/components/Map/Core/useMapInteractions.ts`): Hook for managing map interactions
* **MapEvents** (`app/components/Map/Core/MapEvents.ts`): Utilities for handling map events and synchronizing with MapStore
* **MapContext** (`app/components/Map/Context/MapContext.tsx`): React context for sharing map references
* **BaseTileLayer** (`app/components/Map/Layers/BaseTileLayer.ts`): Utility for creating the base tile layer
* **LayerManager** (`app/components/Map/Layers/LayerManager.ts`): Utilities for layer management
* **HeatmapLayer** (`app/components/Map/Layers/HeatmapLayer.tsx`): Dedicated component for managing heatmap layer visualization
* **ZLayerControl** (`app/components/Map/Controls/ZLayerControl.tsx`): UI component for changing map Z-layer
* **HashManager** (`app/components/Map/URL/HashManager.ts`): Utilities for URL hash management

4. **Utility files** located in `app/utils/`:
   - **heatmapUtils** (`app/utils/heatmapUtils.ts`): Utilities for rendering and updating heatmap layers.
   - **mapUtils** (`app/utils/mapUtils.ts`): Utilities for map operation (mostly moved to Map/URL components).
   - **markerStyleUtils** (`app/utils/markerStyleUtils.ts`): Utilities for creating marker styles.
   - **layerManager** (`app/utils/layerManager.ts`): Legacy layer management (mostly moved to Map/Layers components).

5. **MapOverlays** (`app/components/MapOverlays/`): Directory containing all overlay components:
   - **OverlayRegistry** (`app/components/MapOverlays/OverlayRegistry.ts`): Central registry for managing all UI overlays with dynamic registration and position management.
   - **BaseOverlay** (`app/components/MapOverlays/BaseOverlay.tsx`): Base component for all overlays with dragging capability and standardized positioning.
   - **CoordinateOverlay** (`app/components/MapOverlays/CoordinateOverlay.tsx`): Draggable overlay displaying cursor coordinates.
   - **HeatmapOverlayPanel** (`app/components/MapOverlays/HeatmapOverlayPanel.tsx`): Overlay for selecting heatmap items.
   - **MapOverlayPanel** (`app/components/MapOverlays/MapOverlayPanel.tsx`): Overlay for controlling marker visibility.
   - **ZLayerOverlay** (`app/components/MapOverlays/ZLayerOverlay.tsx`): Overlay for controlling the map's Z-layer.
   - **GlobalCustomDragLayer** (`app/components/MapOverlays/GlobalCustomDragLayer.tsx`): Component rendering the drag preview for all overlays.
   - **index.ts**: Exports all overlay components for easy importing.

6. **EthyrialMapFull** (`app/components/EthyrialMapFull.tsx`): The main map component that now uses the modular components from `app/components/Map/`.

7. **MapScene** (`app/scenes/Map/index.tsx`): The primary scene component orchestrating data fetching, state management, and rendering of `EthyrialMapFull` and its overlays. Manages the central `DndProvider`.

## Layer Structure

The map consists of three primary layers managed by the LayerManager (in order of z-index):
1. `base-osm` (z-index: 1): Base map layer using custom tile source.
2. `main-heatmap` (z-index: 5): Heatmap layer for resource visualization.
3. `main-markers` (z-index: 10): Vector markers layer for point locations.

## State Management

The application uses a combination of state management approaches:

1. **MobX Store**: `MapStore` provides central state management for application-wide map data
2. **React Context**: `MapContext` provides component-level sharing of OpenLayers instances
3. **URL Hash**: `HashManager` synchronizes state with the URL for shareable links
4. **Component State**: Local component state for UI-specific concerns

## Heatmap Data Flow

The heatmap data flow has been refactored for better performance and separation of concerns:

1. `MapScene` uses the `useHeatmapData` hook which provides access to methods and refs
2. When the user clicks a heatmap item, `handleHeatmapItemClick` in `MapScene` calls `fetchHeatmapData` from the hook
3. The hook makes an API request to `/game-data/heatmap/${mapId}/${itemId}/${intZoom}?minX=${minX}&minY=${minY}&maxX=${maxX}&maxY=${maxY}`
4. After receiving data, the hook:
   - Updates the heatmap layer and source directly via OpenLayers (bypassing React)
   - Stores the data in `MapStore` for state tracking
5. Both approaches use the same `updateHeatmap` utility from `heatmapUtils.ts`
6. The direct OpenLayers update prevents flash/flicker by avoiding React re-renders

### Key Synchronization Points

The system maintains synchronization between React context and the MobX store:

1. In `MapInstance.tsx`:
   - Sets the map instance in `MapStore` via `MapStore.setMapInstance(mapInstance)`
   - Sets the initial view state via `MapStore.setViewState()`
   - Cleans up references on unmount

2. In `MapEvents.ts`:
   - Updates the store on view changes with `MapStore.setViewState()`

3. In `useHeatmapData.ts`:
   - Directly updates OpenLayers objects for performance
   - Updates the store with minimal changes to prevent unnecessary re-renders

## UI Components

### Map Overlays

Several overlay components provide interactive controls and information on top of the map. They are all located in `app/components/MapOverlays/` and utilize `BaseOverlay` for common functionality like dragging, positioning, and styling.

* **MapOverlayPanel**: Controls marker and label category visibility. Default position: `top-left`. Fixed width of 300px.
* **HeatmapOverlayPanel**: Allows selection of heatmap categories and items. Default position: `top-right`. Fixed width of 450px.
* **CoordinateOverlay**: Displays real-time cursor coordinates (X, Y) and map zoom level (Z). Default position: `bottom-right`. Minimal UI style.
* **ZLayerOverlay**: Provides buttons to change the map's Z-layer (vertical level). Default position: `middle-right`.

### Overlay Registry System

All overlay positioning and management is now centralized through the `OverlayRegistry` system:

* **OverlayRegistry** (`app/components/MapOverlays/OverlayRegistry.ts`): Central registry that manages all overlay components automatically.
* All overlay components automatically register themselves with the registry upon mount via `BaseOverlay`.
* The registry keeps track of default positions, localStorage keys, and other essential details for each overlay.
* The right-click context menu includes a "Reset UI positions" option that resets all overlays to their default positions simultaneously.

Benefits of the registry system:
1. Adding a new overlay automatically integrates it with the position management system
2. Resetting UI positions affects all registered overlays consistently
3. Centralized storage key management prevents conflicts
4. Engineers can create new overlays without modifying multiple files

## Overlay Component Standards

When creating overlay components that sit on top of the map, follow these standards to ensure consistency:

### Styling & Structure

1. **Container Hierarchy**: Use `BaseOverlay` which internally uses `IngameBorderedDiv`.
2. **Standard Border Styling**: Handled by `IngameBorderedDiv` within `BaseOverlay`.
3. **Text & Content**: Use standard Ethyrial style guide colors (`#e0e0e0`, `#a0a0a0`, `#ffd5ae`) and fonts (`Asul`).
4. **Fixed Widths**: For consistent UI, use fixed widths for overlays (e.g., `w-[450px]` in Tailwind or a styled container with width constant).

### BaseOverlay (`app/components/MapOverlays/BaseOverlay.tsx`)

This component provides the foundation for draggable map overlays.

1. **Required Props**:
   - `title`: String displayed in the header (if shown).
   - `localStorageKey`: Unique string key for saving/loading position in `localStorage`.
   - `dragType`: Unique string identifier for React-DnD to distinguish draggable items.
2. **Optional Props**:
   - `id`: String identifier for the overlay in the OverlayRegistry. If not provided, `dragType` is used.
   - `collapsedTitle`: String or character shown when the overlay is collapsed (defaults to `title`'s first char).
   - `defaultPosition`: Object specifying the initial position if none is saved. Uses `{ position: StandardPosition, offset?: PositionOffset }`.
     - `position`: A `StandardPosition` string (e.g., `'top-left'`, `'bottom-right'`, `'middle-right'`).
     - `offset`: Optional `{ x?: number, y?: number }` for fine-tuning from the standard position. Defaults apply edge distance.
   - `zIndex`: Number controlling the stacking order (defaults to 10).
   - `className`: String for additional CSS classes on the root element.
   - `showHeader`: Boolean, whether to display the header with title and collapse button (defaults to true).
   - `noPadding`: Boolean, removes internal padding if true (defaults to false).
   - `noBorder`: Boolean, removes the inner 3D border effect if true (defaults to false).

### Creating a New Overlay

To create a new overlay that automatically integrates with the positioning system:

```tsx
import React from 'react';
import { BaseOverlay } from '~/components/MapOverlays';

// Define constants for your overlay
const OVERLAY_ID = 'my-custom-overlay';  
const STORAGE_KEY = 'my-custom-overlay-position';
const DRAG_TYPE = 'my-custom-overlay';

const MyCustomOverlay: React.FC = () => {
  return (
    <BaseOverlay
      id={OVERLAY_ID}  // Optional but recommended for clarity
      title="My Custom Panel"
      collapsedTitle="MCP"  // Optional abbreviated title when collapsed
      localStorageKey={STORAGE_KEY}
      defaultPosition={{ position: 'middle-top' }}
      zIndex={15}
      dragType={DRAG_TYPE}
      className="w-[250px]"
    >
      {/* Your overlay content here */}
      <div>Content goes here</div>
    </BaseOverlay>
  );
};

export default MyCustomOverlay;
```

That's it! The new overlay will automatically:
- Register itself with the OverlayRegistry
- Save/load its position from localStorage
- Reset to its default position when the "Reset UI" option is used
- Support dragging with the proper preview

### Drag & Drop Implementation (Centralized)

The drag and drop system for overlays is now centralized in the `MapScene` component (`app/scenes/Map/index.tsx`).

1. **Single `DndProvider`**: `MapScene` wraps all overlays and the map components within a single `<DndProvider backend={HTML5Backend}>`.
2. **`BaseOverlay` Drag Logic**: The `useDrag` hook within `BaseOverlay` handles initiating the drag and updating the component's position state upon drag end.
3. **`GlobalCustomDragLayer`**: Rendered once within the `DndProvider` in `MapScene` to handle all drag previews.
4. **Accurate Preview Dimensions**: The drag process now captures and uses exact component dimensions for the preview:
   - `BaseOverlay` measures the component via `getBoundingClientRect()` before drag starts
   - `GlobalCustomDragLayer` uses these dimensions to render an accurately-sized preview
   - Preview appearance is consistent for both collapsed and expanded states

### Position Snapping

Overlay components feature a position snapping system that allows them to automatically snap back to their default positions when dragged close to their original location:

1. **Automatic Snapping**: When an overlay is dragged within `SNAP_THRESHOLD` (30px) of its default position, it will automatically snap back to that position upon release.
2. **Visual Indicator**: A "Will snap" tooltip appears above the overlay when it's close to its default position, providing visual feedback to the user that snapping will occur.
3. **Dynamic Default Positions**: Default positions are recalculated on window resize to ensure proper snapping regardless of viewport dimensions.
4. **Position Types**:
   - Standard positions include: `top-left`, `top-right`, `bottom-left`, `bottom-right`, `middle-left`, `middle-right`, `middle-top`, and `middle-bottom`
   - Each position can include optional x/y offsets for fine-tuning

Example of how snapping works:
1. User drags an overlay away from its default position
2. If they drag it back near the original position, the "Will snap" indicator appears
3. When released within the threshold, the overlay snaps precisely to its default position
4. This helps maintain a tidy UI while still allowing for customization

## Critical Dependencies

### React-DnD Requirements (Centralized)

Drag-and-drop functionality relies on `react-dnd`. The core requirement is now fulfilled by wrapping the relevant part of the UI tree in `MapScene` with a single `DndProvider`.

**CRITICAL WARNING**: The *entire interactive map area including all overlays* must exist within this single `DndProvider` context provided by `MapScene`. Forgetting this will cause the `Expected drag drop context` error.

### MobX Version Considerations

The application uses MobX version 4.15, which requires using the `decorate` pattern for making classes observable instead of newer `makeObservable` approach.

```javascript
// Example pattern used in MapStore.ts
decorate(MapStore, {
  // Properties
  mapInstance: observable,
  viewState: observable,
  // Computed
  hasHeatmapData: computed,
  // Actions
  setMapInstance: action,
  setViewState: action,
});
```

## Code Evolution Context

This system has evolved to address specific challenges:
1. Initial implementation had issues with vector layers disappearing after heatmap updates
2. Multiple timeouts were added to ensure proper rendering sequence
3. Layer management logic was refined and moved to dedicated files
4. Type safety improvements were made
5. Coordinate and Z-Layer overlay components added for better user control/feedback
6. Drag and Drop was refactored from individual providers per overlay to a single, centralized `DndProvider` in `MapScene`
7. Overlay positioning was standardized using a `defaultPosition` prop in `BaseOverlay`
8. Heatmap update flow was optimized to bypass React rendering and directly update OpenLayers objects
9. Component-specific logic was moved to a reusable `useHeatmapData` hook
10. Map component was completely refactored into smaller, focused components in a dedicated directory structure
11. Implemented fixed-width overlays and accurate drag previews
12. Created a centralized OverlayRegistry system for managing all map overlays, with automatic registration and a unified reset mechanism via the context menu
13. **LATEST**: Enhanced heatmap visualization with adaptive parameters based on zoom level for optimal visibility at all zoom levels

## Using the Modular Map Components

The new modular architecture makes it easier to build map-based interfaces. Here's a simple example of using the components:

```jsx
import { 
  MapContainer, 
  MapInstance, 
  MapProvider, 
  ZLayerControl,
  HeatmapLayer
} from '~/components/Map';

const MyMapComponent = ({ mapId }) => {
  return (
    <MapProvider>
      <MapContainer>
        <MapInstance mapId={mapId}>
          <HeatmapLayer />
        </MapInstance>
        <ZLayerControl />
      </MapContainer>
    </MapProvider>
  );
};
```

## Performance Optimizations

1. **Direct OpenLayers Updates**: Bypassing React's rendering cycle for performance-critical operations
2. **Debounced API Calls**: Preventing rapid API calls during map navigation
3. **Centralized State**: Using MapStore for sharing state between components
4. **Reusable Hooks**: Encapsulating complex logic in reusable hooks
5. **Memoized Props**: Using useMemo to prevent unnecessary rerenders
6. **Modular Architecture**: Breaking down large components into smaller, focused pieces
7. **Context API**: Using React Context to avoid excessive prop drilling
8. **Performance Logging**: Detailed timing logs in useHeatmapData for identifying bottlenecks (can be disabled in production)

## Styling Patterns

The UI components follow consistent Ethyrial styling patterns:
- Dark theme with nested borders creating a 3D effect
- Primary backgrounds: `#38322c` (outer) and `#151515` (inner)
- Border colors: `#4e443a` (light) and `#2c2824` (dark)
- Monospace fonts for coordinate displays
- Font family: 'Asul' for UI elements
- Fixed widths for overlays to ensure consistent UI (e.g., HeatmapOverlayPanel: 450px, MapOverlayPanel: 300px)

## Heatmap Visualization

The heatmap visualization uses carefully designed gradient colors and dynamic parameters based on zoom level to ensure optimal visibility in all circumstances.

### Ultra High-Visibility Gradient

The `ETHYRIAL_GRADIENT` constant in `heatmapUtils.ts` defines an enhanced color gradient that maintains the Ethyrial theme while maximizing visibility:

```javascript
export const ETHYRIAL_GRADIENT = [
  'rgba(255, 255, 255, 0)',    // Transparent
  'rgba(255, 255, 255, 0.85)', // Nearly opaque white
  'rgba(255, 236, 139, 0.9)',  // Bright yellow
  'rgba(255, 215, 0, 0.95)',   // Vibrant gold
  'rgba(255, 165, 0, 1)',      // Pure orange
  'rgba(255, 69, 0, 1)',       // Red-orange (stronger)
  'rgba(255, 0, 0, 1)',        // Pure red
  'rgba(255, 20, 147, 1)',     // Deep pink
  'rgba(128, 0, 255, 1)',      // Vibrant purple
  'rgba(255, 255, 255, 1)'     // Center white
];
```

These colors provide maximum contrast and visibility across all zoom levels, especially when dealing with sparse data points.

### Adaptive Zoom Parameters

The system adapts heatmap rendering parameters based on the current zoom level, enhancing visibility at higher zoom levels where traditional heatmaps tend to become less visible.

The `getHeatmapParams` function in `heatmapUtils.ts` handles this by returning different radius, blur, and opacity settings for different zoom ranges:

```javascript
export const getHeatmapParams = (zoom: number) => {
  // Enhanced parameters for Ethyrial-themed heatmap
  if (zoom <= 2) {
    // Very zoomed out - make the heatmap spread out significantly more
    return { radius: 45, blur: 30, opacity: 0.95 };
  } else if (zoom <= 4) {
    // Moderately zoomed out - make the heatmap spread out more
    return { radius: 35, blur: 25, opacity: 0.92 };
  } else if (zoom === 5) {
    // Medium zoom - slightly less spread
    return { radius: 28, blur: 22, opacity: 0.88 };
  } else {
    // Zoomed in - focused heatmap with glow effect
    return { radius: 22, blur: 18, opacity: 0.85 };
  }
};
```

This ensures that resource points remain clearly visible at any zoom level, with appropriate visual styling that matches the current view context.

### Weight Normalization

The system employs an intelligent weight normalization algorithm in the `updateHeatmap` function to ensure that:

1. All points are clearly visible, with a minimum threshold to prevent fading out
2. Weight differentiation is preserved to show density variations
3. Points are enhanced with a gently curved weight scale that boosts visibility

The normalization approach:
- Sets a minimum weight of 0.5 for points to ensure visibility even for low-density data
- Uses a power curve with exponent 0.8 to boost mid-range values
- Handles edge cases where all points have the same weight
- Dynamically sets the gradient for consistent styling

## Known Issues & Future Improvements

* Data type conversion between MapStore and components could be more efficient with standardized types
* Consider moving more OpenLayers-specific logic to dedicated hooks for better separation of concerns
* Layer visibility management could be simplified further
* Direct map updates could be extended to other aspects of the system for better performance
* Add environment flag to disable verbose performance logging in production
* React-toastify version must be kept at v9.1.3 for React 17 compatibility (current React version)

## Type Safety Considerations

1. Layer type checking uses both instance checks and property comparisons:
   - `instanceof VectorLayer` for basic type checking
   - `l.get('id') !== layer.get('id')` to avoid TypeScript errors between incompatible layer types
   - Properties like `layerType === 'heatmap'` for semantic identification

2. HeatmapData interfaces have two formats:
   - In MapStore: `points: Array<[number, number, number]>;` (x,y,weight as tuple array)
   - In components: `points: AggregatedPoint[];` (with x, y, weight, count, cellSize properties)
   - Conversion is needed between these formats

3. AggregatedPoint interface follows the server-side definition:
   ```typescript
   interface AggregatedPoint {
     x: number;          // X coordinate 
     y: number;          // Y coordinate
     weight: number;     // Combined weight of the point
     count: number;      // Number of original points in this cell
     cellSize: number;   // Size of the cell that created this aggregation
   }
   ```

4. Event handling in OpenLayers requires careful type management:
   - Using proper types for event handlers (`OLPointerEvent` for `pointermove`)
   - Ensuring handler references are maintained for proper cleanup

## Rendering Sequence

The system ensures proper layer rendering through:

1. Using direct OpenLayers references through useHeatmapData hook
2. Clearing existing features and adding new ones in a batch
3. Ensuring proper z-index values for layers (heatmap at 5, markers at 10)
4. Setting appropriate visibility based on state
5. Forcing layer redraw with layer.changed() when needed
6. Applying the custom gradient and adaptive parameters based on zoom level

## Local Storage Usage

The system uses LocalStorage for persisting user preferences:
- Overlay positioning: Managed through the OverlayRegistry
- Standard keys:
  - `coordinate-overlay-position`: Coordinate overlay position
  - `heatmap-overlay-position`: Heatmap overlay position
  - `map-overlay-panel-position`: Map/marker control panel position
  - `z-layer-overlay-position`: Z-layer control position
- New overlays should use unique keys following the pattern: `[overlay-id]-position`

## Context Menu Integration

The map includes a right-click context menu with useful functions that is now managed through a dynamic registry system:

### Context Menu Registry

A centralized registry (`ContextMenuRegistry`) allows for easy addition, organization, and configuration of context menu items:

- **Dynamic Item Registration**: New menu items can be added from anywhere in the codebase.
- **Grouping System**: Items are organized into logical groups with visual separators.
- **Control Over Menu Closing**: Each item can specify whether clicking it should close the menu.
- **Ordering Control**: Items can be precisely ordered within and between groups.

Example of registering a new context menu item:

```typescript
import ContextMenuRegistry from '~/components/EthyrialStyle/ContextMenuRegistry';
import { faWrench } from '@fortawesome/free-solid-svg-icons';

// Register a new menu item
ContextMenuRegistry.registerItem({
  id: 'my-custom-action',
  label: 'My Custom Action',
  icon: faWrench,
  group: 3, // Will appear after built-in groups 1-2
  order: 10,
  onClick: (coords) => {
    console.log(`Action at coords: ${coords.x}, ${coords.y}, z=${coords.z}`);
    // Perform your action here
  },
  closeOnClick: true // Menu will close when this item is clicked
});
```

### Default Context Menu Items

The system comes with pre-registered items:
- **Copy XYZ**: Copies coordinates to clipboard (group 1)
- **Add marker**: Placeholder for future functionality (group 1, disabled)
- **Reset UI positions**: Resets all overlay positions (group 2, closes menu on click)

To customize or extend the context menu, see `app/components/EthyrialStyle/ContextMenuRegistry.ts`.

### Z-Layer Controls

The Z-layer system allows viewing different vertical levels of the map:

- **Default Z-Layer**: The map initializes at Z-layer 2 when first loaded.
- **Range**: Z-layers range from -3 (underground) to 40 (high elevation).
- **Keyboard Controls**: PageUp/PageDown can be used to navigate Z-layers.
- **Visual Control**: The Z-layer overlay provides a UI for changing levels.

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

3. **Overlay Width Expansion**
   - **Issue**: Overlays expanding width when content changes (e.g., selecting a category)
   - **Solution**: Apply fixed width constraints using styled components or Tailwind classes:
     ```tsx
     // Styled component approach
     const FixedWidthContainer = styled.div`
       width: ${PANEL_WIDTH};
       max-width: ${PANEL_WIDTH};
     `;
     
     // Or Tailwind approach
     <div className="w-[450px] min-w-[450px]">...</div>
     ```

4. **New Overlay Not Registering**
   - **Issue**: A new overlay component doesn't reset properly with the "Reset UI" option
   - **Cause**: Missing `id` prop or incorrect registration with the OverlayRegistry
   - **Solution**: Ensure the overlay uses `BaseOverlay` with a proper `id` prop matching its entry in the registry

5. **Heatmap Visibility Issues at High Zoom Levels**
   - **Issue**: Heatmap becomes difficult to see or disappears at high zoom levels
   - **Cause**: Default OpenLayers heatmap settings don't adapt well to different zoom contexts
   - **Solution**: 
     - Use the enhanced gradient with bright, high-visibility colors
     - Apply the adaptive zoom parameters that increase radius, adjust blur, and optimize opacity at high zoom levels
     - Implement the enhanced weight normalization to boost point visibility

## Dead Code and Optimizations

While seemingly redundant, the multiple checks and timeouts are intentional safeguards against OpenLayers rendering quirks. What might appear as "dead code" is actually critical for ensuring proper layer visibility in all scenarios. The system prioritizes reliability over code minimalism.

## Overlay System Components

The map interface utilizes a flexible overlay system for UI components. Each overlay is independently positioned and can be dragged by the user.

### Core Overlays

1. **MapOverlayPanel**: Controls visibility of map markers and labels
2. **HeatmapOverlayPanel**: Manages resource heatmap data display
3. **CoordinateOverlay**: Shows the current cursor position on the map 
4. **ZLayerOverlay**: Controls the current Z-level view of the map 

## Toast Notification System

The map interface includes a toast notification system based on `react-toastify` for displaying non-intrusive notifications to the user. The system is structured as follows:

1. **ToastOverlay** (`app/components/MapOverlays/ToastOverlay.tsx`): A component that renders the `ToastContainer` from react-toastify, positioned at the bottom-left of the screen by default. It applies custom styling to match the Ethyrial visual theme.

2. **Toast Utilities** (`app/utils/toastUtils.ts`): Helper functions for displaying different types of toast notifications:
   - `showInfoToast`: For informational messages
   - `showSuccessToast`: For success messages
   - `showWarningToast`: For warning messages
   - `showErrorToast`: For error messages
   - `showToast`: For generic messages
   - `dismissAllToasts`: For dismissing all active toasts

3. **Usage in ContextMenu**: The right-click context menu uses toast notifications for user feedback (e.g., when copying coordinates).

### Implementation Notes

- **React 17 Compatibility**: The system requires `react-toastify@9.1.3` for compatibility with React 17. Later versions of react-toastify require React 18+ as they use the `useSyncExternalStore` hook.
- **Styling**: Custom styles are applied to match the Ethyrial theme, including specific colors for success and error notifications.
- **Automatic Integration**: The `ToastOverlay` component is included in the `MapScene`, making toast notifications available throughout the map interface.

### Example Usage

```typescript
import { showSuccessToast, showErrorToast } from '~/utils/toastUtils';

// Display a success toast
showSuccessToast('Resource created successfully!');

// Display an error toast
showErrorToast('Failed to save changes');

// Display a success toast with custom options
showSuccessToast('Coordinates copied', { 
  autoClose: 3000,
  icon: <FontAwesomeIcon icon={faCopy} />
});
```

## Known Issues & Future Improvements

* Data type conversion between MapStore and components could be more efficient with standardized types
* Consider moving more OpenLayers-specific logic to dedicated hooks for better separation of concerns
* Layer visibility management could be simplified further
* Direct map updates could be extended to other aspects of the system for better performance
* Add environment flag to disable verbose performance logging in production
* React-toastify version must be kept at v9.1.3 for React 17 compatibility (current React version)