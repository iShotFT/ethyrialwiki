# Legacy Heatmap Code Documentation

This document contains code and implementation details from previous versions of the heatmap system that have been refactored or removed. It serves as a reference for understanding past approaches and the evolution of the codebase.

## Deprecated handleHeatmapUpdate Approach

Originally, the EthyrialMapFull component had a direct `handleHeatmapUpdate` function that was called to update the heatmap data. This has been replaced by:

1. The reusable `updateHeatmap` utility function in `heatmapUtils.ts`
2. The `useHeatmapData` hook which manages heatmap data and updates internally

### Legacy Pattern

```tsx
// This pattern is no longer used:
map.once('rendercomplete', () => {
  heatmapInitializedRef.current = true;
  
  // Force an update of the heatmap after initialization is confirmed
  if (heatmapData && heatmapSourceRef.current) {
    handleHeatmapUpdate(heatmapData);
  }
});

// The handleHeatmapUpdate function would look something like:
const handleHeatmapUpdate = useCallback((data: HeatmapData) => {
  if (isProcessingHeatmapRef.current) return;
  isProcessingHeatmapRef.current = true;
  
  try {
    // Process points and update heatmap layer
    // ...
  } finally {
    isProcessingHeatmapRef.current = false;
  }
}, []);

// Removed unused processing flag
const isProcessingHeatmapRef = useRef<boolean>(false);
```

### Current Approach

```tsx
// Current pattern:
map.once('rendercomplete', () => {
  heatmapInitializedRef.current = true;
  
  // Force an update of the heatmap after initialization is confirmed
  if (heatmapData && heatmapSourceRef.current) {
    Logger.debug("misc", `[HeatmapDebug] Map ready for heatmap rendering after initial render`);
    // The hook will handle heatmap updates
  }
});

// The hook-based approach uses the updateHeatmap utility:
// From useHeatmapData.ts:
updateHeatmap({ points }, heatmapSourceRef.current, heatmapLayerRef.current, mapRef.current);
```

## Removed RenderMode Properties

Earlier versions of the OpenLayers HeatmapLayer might have included a `renderMode` property that is no longer needed or supported. This property was used to specify how the heatmap should be rendered.

```tsx
// Old approach with renderMode (no longer needed):
heatmapLayerRef.current = new HeatmapLayer({
  source: heatmapSourceRef.current,
  opacity: 0.8,
  blur: 15,
  radius: 10,
  weight: function(feature) {
    return feature.get('weight') || 1;
  },
  renderMode: 'vector', // This property is no longer needed/supported
  gradient: ['rgba(0, 0, 255, 0)', 'rgba(0, 0, 255, 1)', 'rgba(0, 255, 0, 1)', 'rgba(255, 255, 0, 1)', 'rgba(255, 0, 0, 1)'],
});

// Current approach (correctly configured):
heatmapLayerRef.current = new HeatmapLayer({
  source: heatmapSourceRef.current,
  opacity: 0.8,
  blur: 15,
  radius: 10,
  weight: function(feature) {
    return feature.get('weight') || 1;
  },
  // No renderMode property
  gradient: ['rgba(0, 0, 255, 0)', 'rgba(0, 0, 255, 1)', 'rgba(0, 255, 0, 1)', 'rgba(255, 255, 0, 1)', 'rgba(255, 0, 0, 1)'],
});
```

## Migration from Component-Based to Hook-Based Approach

The heatmap system has evolved from a component-internal implementation to a more reusable hook-based approach. This provides better separation of concerns:

1. `useHeatmapData` hook handles data fetching and processing
2. `heatmapUtils.ts` contains reusable utility functions
3. Component only needs to use the hook and pass references

### Benefits of the Current Approach

- Better separation of concerns
- Improved reusability
- More efficient updates by bypassing React re-renders
- Easier to test and maintain
- Consistent pattern across the application

## Cleanup Summary

The following items were identified and removed during the cleanup:

1. References to the non-existent `handleHeatmapUpdate` function
2. The unused `isProcessingHeatmapRef` ref that was used to prevent cascading updates
3. Comments mentioning the old approach were updated to reflect the current hook-based pattern

No actual `renderMode` property was found in the codebase, but documentation was added to explain this potential legacy property for future reference. 