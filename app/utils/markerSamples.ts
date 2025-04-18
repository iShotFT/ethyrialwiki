import { 
  faSearch,
  faLeaf,
  faGem,
  faTree,
  faSkullCrossbones,
  faMapMarkerAlt,
  faQuestionCircle,
  faCity,
  faCrosshairs,
  faScroll,
  faDragon,
  faPaw,
  faStreetView,
  faChessRook,
  faUniversity
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { createEthyrialMarker } from './markerStyleUtils';

/**
 * Category to color mapping for Ethyrial map markers
 * Based on the exact category keys used in MapOverlayPanel.tsx
 */
export const CATEGORY_COLORS: Record<string, string> = {
  // Resources
  "ORE": "#c0c0ff",       // Light blue for ore
  "HERB": "#90ee90",      // Light green for herbs
  "SKIN": "#ffd700",      // Gold for skins
  "TREE": "#228b22",      // Forest green for trees
  "CLOTH": "#dda0dd",     // Light purple for cloth
  
  // Entities
  "ENEMY": "#ff4500",     // Red-orange for enemies
  "POI": "#ffd5ae",       // Default Ethyrial color for POIs
  "NPC": "#add8e6",       // Light blue for NPCs
  
  // Locations
  "TOWN": "#e6e6fa",      // Lavender for towns
  "DUNGEON": "#800080",   // Purple for dungeons
  "BANK": "#ffd700",      // Gold for banks
  "TELEPORT": "#00ffff",  // Cyan for teleports
  
  // Activities
  "DAILY_QUEST": "#4169e1", // Royal Blue for quests
  "RAID": "#ff4500",      // Red-orange for raids
  "WORLD_BOSS": "#ff0000" // Red for world bosses
};

/**
 * Category to icon mapping for Ethyrial map markers
 * Matches exactly the categoryIconMap from MapOverlayPanel.tsx
 */
export const CATEGORY_ICONS: Record<string, IconDefinition> = {
  "ORE": faGem,
  "HERB": faLeaf,
  "SKIN": faPaw,
  "TREE": faTree,
  "CLOTH": faScroll,
  "ENEMY": faSkullCrossbones,
  "POI": faMapMarkerAlt,
  "NPC": faCrosshairs,
  "TOWN": faCity,
  "OTHER": faQuestionCircle,
  "DUNGEON": faChessRook,
  "BANK": faUniversity,
  "TELEPORT": faStreetView,
  "DAILY_QUEST": faScroll,
  "RAID": faDragon,
  "WORLD_BOSS": faDragon,
};

/**
 * Generate a sample marker data URI for a given category
 * @param category The marker category
 * @param size Marker size (default: 32)
 * @returns SVG data URI string
 */
export function getSampleMarkerUri(category: string, size = 32): string {
  const icon = CATEGORY_ICONS[category] || faQuestionCircle;
  const color = CATEGORY_COLORS[category] || "#ffd5ae";
  
  return createEthyrialMarker(icon, color, "#38322c", size);
}

/**
 * Generate sample marker data for all categories
 * @returns Record of category to data URI
 */
export function getAllSampleMarkers(): Record<string, string> {
  const result: Record<string, string> = {};
  
  Object.keys(CATEGORY_COLORS).forEach(category => {
    result[category] = getSampleMarkerUri(category);
  });
  
  return result;
}

/**
 * HTML sample showing all markers (for testing)
 */
export const MARKER_SAMPLE_HTML = `
  <div style="background-color: #151515; padding: 20px; font-family: 'Asul', sans-serif;">
    <h2 style="color: #ffd5ae;">Ethyrial Map Marker Samples</h2>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 20px;">
      ${Object.keys(CATEGORY_COLORS).map(category => `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <img src="${getSampleMarkerUri(category)}" width="32" height="32" alt="${category}" />
          <span style="color: #e0e0e0; margin-top: 8px;">${category}</span>
        </div>
      `).join('')}
    </div>
  </div>
`; 