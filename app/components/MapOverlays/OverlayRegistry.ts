import { DefaultPosition } from './BaseOverlay';

// Define the overlay registry entry type
export interface OverlayRegistryEntry {
  id: string;
  localStorageKey: string;
  defaultPosition: DefaultPosition;
  title: string;
}

// Static registry of all overlay components
const overlayRegistry: OverlayRegistryEntry[] = [
  {
    id: 'coordinate-overlay',
    localStorageKey: 'coordinate-overlay-position',
    defaultPosition: { position: 'bottom-right' },
    title: 'Coordinates'
  },
  {
    id: 'heatmap-overlay',
    localStorageKey: 'heatmap-overlay-position',
    defaultPosition: { position: 'top-right' },
    title: 'Heatmaps'
  },
  {
    id: 'map-overlay',
    localStorageKey: 'map-overlay-panel-position',
    defaultPosition: { position: 'top-left' },
    title: 'Labels & Markers'
  },
  {
    id: 'z-layer-overlay',
    localStorageKey: 'z-layer-overlay-position',
    defaultPosition: { position: 'middle-right' },
    title: 'Z-Layer'
  }
];

/**
 * Gets all registered overlays
 */
export const getAllOverlays = (): OverlayRegistryEntry[] => {
  return [...overlayRegistry];
};

/**
 * Gets a specific overlay by ID
 */
export const getOverlayById = (id: string): OverlayRegistryEntry | undefined => {
  return overlayRegistry.find(overlay => overlay.id === id);
};

/**
 * Gets a specific overlay by localStorage key
 */
export const getOverlayByStorageKey = (key: string): OverlayRegistryEntry | undefined => {
  return overlayRegistry.find(overlay => overlay.localStorageKey === key);
};

/**
 * Gets all localStorage keys for registered overlays
 */
export const getAllStorageKeys = (): string[] => {
  return overlayRegistry.map(overlay => overlay.localStorageKey);
};

/**
 * Register a new overlay
 */
export const registerOverlay = (entry: OverlayRegistryEntry): void => {
  // Check if an overlay with this ID already exists
  const existingIndex = overlayRegistry.findIndex(o => o.id === entry.id);
  
  if (existingIndex >= 0) {
    // Replace the existing entry
    overlayRegistry[existingIndex] = entry;
  } else {
    // Add a new entry
    overlayRegistry.push(entry);
  }
};

/**
 * Reset all overlay positions in localStorage and dispatch event
 */
export const resetAllOverlayPositions = (): void => {
  // Remove all overlay localStorage entries
  overlayRegistry.forEach(overlay => {
    localStorage.removeItem(overlay.localStorageKey);
  });
  
  // Dispatch reset event
  const resetEvent = new CustomEvent('reset-ui-positions');
  window.dispatchEvent(resetEvent);
};

export default {
  getAllOverlays,
  getOverlayById,
  getOverlayByStorageKey,
  getAllStorageKeys,
  registerOverlay,
  resetAllOverlayPositions
}; 