import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { Style, Icon, Fill, Stroke, Text } from "ol/style";
import { FeatureLike } from "ol/Feature";
import { 
  faQuestionCircle, 
  faGem, 
  faLeaf, 
  faPaw, 
  faTree, 
  faScroll, 
  faSkullCrossbones, 
  faMapMarkerAlt, 
  faCity, 
  faCrosshairs,
  faChessRook,
  faUniversity,
  faStreetView,
  faDragon
} from "@fortawesome/free-solid-svg-icons";
import Logger from "./Logger";

// Direct import of FontAwesome icons with explicit mapping
const KNOWN_CATEGORY_ICONS: Record<string, IconDefinition> = {
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
 * Creates a data URI for a FontAwesome icon
 * @param iconDef FontAwesome icon definition
 * @param color Color for the icon
 * @returns Data URI string for the icon
 */
export const createFaDataUri = (
  iconDef: IconDefinition | undefined,
  color = "black"
): string => {
  if (!iconDef) {
    iconDef = faQuestionCircle; // Fallback icon
  }
  const { icon } = iconDef;
  const pathData = Array.isArray(icon[4]) ? icon[4].join(" ") : icon[4];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${icon[0]} ${icon[1]}" width="24" height="24">
      <path d="${pathData}" fill="${color}"></path>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

/**
 * Creates an enhanced styled SVG marker with Ethyrial styling
 * @param iconDef FontAwesome icon definition
 * @param primaryColor Main color for the marker (defaults to Ethyrial theme color)
 * @param secondaryColor Optional accent color
 * @param size Size of the marker (default: 32)
 * @returns Data URI string for the styled marker
 */
export const createEthyrialMarker = (
  iconDef: IconDefinition | undefined,
  primaryColor = "#ffd5ae", // Ethyrial theme color
  secondaryColor = "#38322c", // Dark background
  size = 32
): string => {
  // Absolutely ensure we have an icon definition to prevent failures
  if (!iconDef) {
    console.error("No icon definition provided to createEthyrialMarker, using fallback");
    iconDef = faQuestionCircle; // Fallback icon
  }
  
  try {
    const { icon } = iconDef;
    // Get the path data from the icon definition
    const pathData = Array.isArray(icon[4]) ? icon[4].join(" ") : icon[4];
    
    // Calculate icon proportions and positioning
    const originalWidth = icon[0];
    const originalHeight = icon[1];
    const iconScale = Math.min(size * 0.5 / originalWidth, size * 0.5 / originalHeight);
    const iconWidth = originalWidth * iconScale;
    const iconHeight = originalHeight * iconScale;
    const iconX = (size - iconWidth) / 2;
    const iconY = (size - iconHeight) / 2;
    
    // Calculate pin dimensions
    const pinWidth = size * 0.8; // 80% of total size
    const pinHeight = size * 0.9; // 90% of total size
    const pinX = (size - pinWidth) / 2;
    const pinY = size * 0.05; // 5% from top
    const pinPointHeight = size * 0.2; // Height of the pin's point
    
    // Create the SVG with Ethyrial styling
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <!-- Drop shadow filter -->
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.5" />
        </filter>
        <linearGradient id="pinGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${primaryColor}" stop-opacity="1" />
          <stop offset="100%" stop-color="${darkenColor(primaryColor, 30)}" stop-opacity="1" />
        </linearGradient>
      </defs>
      
      <!-- Pin body with 3D effect -->
      <path d="M${pinX + pinWidth/2},${pinY + pinHeight - pinPointHeight} L${pinX},${pinY + pinHeight - pinPointHeight} 
        Q${pinX},${pinY} ${pinX + pinWidth/2},${pinY} 
        Q${pinX + pinWidth},${pinY} ${pinX + pinWidth},${pinY + pinHeight - pinPointHeight} 
        L${pinX + pinWidth/2},${pinY + pinHeight - pinPointHeight} 
        L${pinX + pinWidth/2},${pinY + pinHeight}z" 
        fill="url(#pinGradient)" 
        stroke="#1A1A1A" 
        stroke-width="1"
        filter="url(#shadow)" />
      
      <!-- Inner background for icon -->
      <rect 
        x="${pinX + pinWidth*0.15}" 
        y="${pinY + pinHeight*0.15}" 
        width="${pinWidth*0.7}" 
        height="${pinHeight*0.5}" 
        rx="${pinWidth*0.1}" 
        fill="${secondaryColor}" 
        stroke="#4e443a" 
        stroke-width="1" />
      
      <!-- Icon -->
      <g transform="translate(${iconX}, ${iconY}) scale(${iconScale})">
        <path d="${pathData}" fill="${primaryColor}"></path>
      </g>
    </svg>`;
    
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  } catch (error) {
    console.error(`Failed to create marker SVG: ${error}`, error);
    // Fallback: Create a simpler marker SVG that is guaranteed to work
    const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect x="${size*0.1}" y="${size*0.1}" width="${size*0.8}" height="${size*0.8}" fill="${primaryColor}" />
      <circle cx="${size/2}" cy="${size/2}" r="${size*0.3}" fill="${secondaryColor}" />
    </svg>`;
    
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fallbackSvg)}`;
  }
};

/**
 * Helper function to darken a color
 */
function darkenColor(hex: string, percent: number): string {
  if (!hex || hex.length < 6 || hex.length > 7 || hex[0] !== '#') {
    return '#000000'; // Default dark color on invalid input
  }
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);

  // Darken by percentage
  const factor = 1 - percent / 100;
  r = Math.max(0, Math.floor(r * factor));
  g = Math.max(0, Math.floor(g * factor));
  b = Math.max(0, Math.floor(b * factor));

  // Convert back to hex
  const rHex = r.toString(16).padStart(2, '0');
  const gHex = g.toString(16).padStart(2, '0');
  const bHex = b.toString(16).padStart(2, '0');

  return `#${rHex}${gHex}${bHex}`;
}

/**
 * Get an icon definition using case-insensitive lookup
 * @param categoryKey The category key to lookup
 * @param iconMap The custom icon map to check first
 * @returns IconDefinition for the category or fallback icon
 */
function getIconForCategory(categoryKey: string, iconMap: Record<string, IconDefinition>): IconDefinition {
  // Try direct lookup first
  if (iconMap[categoryKey]) {
    return iconMap[categoryKey];
  }

  // Normalize to uppercase for consistent lookup
  const normalizedKey = categoryKey.toUpperCase();
  
  // Check the custom map first 
  if (iconMap[normalizedKey]) {
    return iconMap[normalizedKey];
  }
  
  // Check built-in known icon map
  if (KNOWN_CATEGORY_ICONS[normalizedKey]) {
    return KNOWN_CATEGORY_ICONS[normalizedKey];
  }
  
  // Try alternative fallbacks
  for (const key of Object.keys(iconMap)) {
    if (key.toUpperCase() === normalizedKey) {
      return iconMap[key];
    }
  }
  
  // Fallback to built-in map with case-insensitive check
  for (const key of Object.keys(KNOWN_CATEGORY_ICONS)) {
    if (key.toUpperCase() === normalizedKey) {
      return KNOWN_CATEGORY_ICONS[key];
    }
  }
  
  // Last resort fallback
  return faQuestionCircle;
}

/**
 * Creates a base label style for map features
 * @returns Style object for map labels
 */
export const createLabelStyleBase = (): Style => {
  return new Style({
    text: new Text({
      font: "bold 18px Asul, sans-serif", // Use Asul font, adjust size/weight
      fill: new Fill({ color: "#FFFFFF" }),
      stroke: new Stroke({ color: "#000000", width: 2 }), // Text stroke for readability
      textAlign: "center",
      textBaseline: "middle",
      overflow: true, // Allow text to overflow if needed
    }),
  });
};

/**
 * Get style function for map markers
 * @param iconStyleCache Cache for styles to avoid recreation
 * @param categoryIconMap Map of category IDs to icons
 * @param labelStyleBase Base style for labels
 * @returns Function that returns appropriate style for a feature
 */
export const createMarkerStyleFunction = (
  iconStyleCache: Record<string, Style>,
  categoryIconMap: Record<string, IconDefinition>,
  labelStyleBase: Style
) => {
  return (feature: FeatureLike, labelCategoryIds: Set<string>): Style => {
    const categoryId = feature.get("categoryId") as string;
    
    // Use resolution or zoom from feature if available
    const zoom = feature.get("_mapZoom") as number | undefined;
    
    // Check if the marker's category ID is in the set of label category IDs
    if (labelCategoryIds.has(categoryId)) {
      // Clone base style to avoid modifying it for all labels
      const style = labelStyleBase.clone();
      
      // Set the text for the label style dynamically
      const titleText = feature.get("title") || "";
      style.getText()?.setText(titleText);
      
      // Adjust text size based on zoom if available
      if (zoom !== undefined) {
        let fontSize = 18; // Default font size
        let strokeWidth = 2; // Default stroke width
        
        // Make text larger when zoomed out
        if (zoom <= 2) {
          fontSize = 24; // Much bigger for very zoomed out
          strokeWidth = 3;
        } else if (zoom <= 3) {
          fontSize = 21; // Slightly bigger for moderately zoomed out
          strokeWidth = 2.5;
        }
        
        // Update text style with adjusted size
        style.getText()?.setFont(`bold ${fontSize}px Asul, sans-serif`);
        style.getText()?.getStroke()?.setWidth(strokeWidth);
      }
      
      return style;
    }
  
    // For regular markers, add zoom to cache key if available
    const zoomSuffix = zoom !== undefined ? `-z${zoom}` : '';
    const cacheKey = `${categoryId || "default"}${zoomSuffix}`;
  
    if (!iconStyleCache[cacheKey]) {
      // Direct console logging for debugging
      console.log(`Creating marker style for categoryId: ${categoryId}`);
      
      // Use our helper to get the icon, handling case sensitivity
      let iconDefinition: IconDefinition | undefined;
      
      // Direct match based on categoryId - use uppercase for case-insensitive matching
      const upperId = categoryId?.toUpperCase() || '';
      console.log(`[ICON DEBUG] Direct category check: ${upperId}`);
      
      // Direct hardcoded mapping to guarantee icons display
      switch (upperId) {
        case 'ORE':
          iconDefinition = faGem;
          break;
        case 'HERB':
          iconDefinition = faLeaf;
          break;
        case 'SKIN':
          iconDefinition = faPaw;
          break;
        case 'TREE':
          iconDefinition = faTree;
          break;
        case 'CLOTH':
          iconDefinition = faScroll;
          break;
        case 'ENEMY':
          iconDefinition = faSkullCrossbones;
          break;
        case 'POI':
          iconDefinition = faMapMarkerAlt;
          break;
        case 'NPC':
          iconDefinition = faCrosshairs;
          break;
        case 'TOWN':
          iconDefinition = faCity;
          break;
        case 'DUNGEON':
          iconDefinition = faChessRook;
          break;
        case 'BANK':
          iconDefinition = faUniversity;
          break;
        case 'TELEPORT':
          iconDefinition = faStreetView;
          break;
        case 'DAILY_QUEST':
          iconDefinition = faScroll;
          break;
        case 'RAID':
          iconDefinition = faDragon;
          break;
        case 'WORLD_BOSS':
          iconDefinition = faDragon;
          break;
        case 'OTHER':
          iconDefinition = faQuestionCircle;
          break;
        default:
          // If we get here, use the helper function as a fallback
          console.log(`[ICON DEBUG] No direct match for ${upperId}, trying helper...`);
          iconDefinition = getIconForCategory(categoryId, categoryIconMap);
          break;
      }
      
      if (iconDefinition === faQuestionCircle) {
        console.log(`Using fallback icon (question mark) for ${categoryId}`);
      } else {
        console.log(`Found icon match for ${categoryId}`);
      }
      
      // Color map with consistent names 
      const colorMap: Record<string, string> = {
        "ORE": "#c0c0ff", // Light blue for ore
        "HERB": "#90ee90", // Light green for herbs
        "SKIN": "#ffd700", // Gold for skins
        "TREE": "#228b22", // Forest green for trees
        "CLOTH": "#dda0dd", // Light purple for cloth
        "ENEMY": "#ff4500", // Red-orange for enemies
        "POI": "#ffd5ae", // Default Ethyrial color for POIs
        "NPC": "#add8e6", // Light blue for NPCs
        "TOWN": "#e6e6fa", // Lavender for towns
        "DUNGEON": "#800080", // Purple for dungeons
        "BANK": "#ffd700", // Gold for banks
        "TELEPORT": "#00ffff", // Cyan for teleports
        "DAILY_QUEST": "#4169e1", // Royal Blue for quests
        "RAID": "#ff4500", // Red-orange for raids
        "WORLD_BOSS": "#ff0000", // Red for world bosses
      };
      
      // Find the color using case-insensitive lookup
      let markerColor = "#ffd5ae"; // Default to Ethyrial theme color
      const categoryTitle = feature.get("_categoryTitle") as string || '';
      const normalizedTitle = categoryTitle.toUpperCase();
      console.log(`[ICON DEBUG] Checking colors for category ${upperId} / title ${normalizedTitle}`);
      
      // Check direct matches
      if (colorMap[upperId]) {
        markerColor = colorMap[upperId];
        console.log(`[ICON DEBUG] Found color match for ID: ${markerColor}`);
      } else if (colorMap[normalizedTitle]) {
        markerColor = colorMap[normalizedTitle];
        console.log(`[ICON DEBUG] Found color match for title: ${markerColor}`);
      } else {
        // Try case-insensitive matching
        for (const key of Object.keys(colorMap)) {
          if (key.toUpperCase() === upperId || key.toUpperCase() === normalizedTitle) {
            markerColor = colorMap[key];
            console.log(`[ICON DEBUG] Found case-insensitive color match: ${markerColor}`);
            break;
          }
        }
      }
      
      // Calculate scale based on zoom if available
      let scale = 1.0; // Default scale
      
      if (zoom !== undefined) {
        if (zoom <= 2) {
          scale = 1.5; // Much larger when very zoomed out
        } else if (zoom <= 3) {
          scale = 1.25; // Larger when moderately zoomed out
        }
      }
      
      // Create the styled marker with Ethyrial look
      const iconDataUri = createEthyrialMarker(
        iconDefinition,
        markerColor
      );
  
      iconStyleCache[cacheKey] = new Style({
        image: new Icon({
          anchor: [0.5, 0.95], // Anchored at bottom-center of pin
          src: iconDataUri,
          scale: scale, // Apply calculated scale
        }),
      });
    }
    return iconStyleCache[cacheKey];
  };
};

/**
 * Creates a styled SVG marker with a letter instead of an icon
 * @param letter The letter to display in the marker
 * @param primaryColor Main color for the marker (defaults to Ethyrial theme color)
 * @param secondaryColor Optional accent color
 * @param size Size of the marker (default: 32)
 * @returns Data URI string for the styled marker
 */
export const createLetterMarker = (
  letter: string,
  primaryColor = "#ffd5ae", // Ethyrial theme color
  secondaryColor = "#38322c", // Dark background
  size = 32
): string => {
  // Ensure we have a letter (use '?' as fallback)
  const displayLetter = letter.trim().charAt(0).toUpperCase() || '?';
  
  console.log(`[MARKER DEBUG] Creating letter marker: letter=${displayLetter}, primaryColor=${primaryColor}, secondaryColor=${secondaryColor}, size=${size}`);
  
  try {
    // Calculate pin dimensions
    const pinWidth = size * 0.8; // 80% of total size
    const pinHeight = size * 0.9; // 90% of total size
    const pinX = (size - pinWidth) / 2;
    const pinY = size * 0.05; // 5% from top
    const pinPointHeight = size * 0.2; // Height of the pin's point
    
    // Create the SVG with Ethyrial styling
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <!-- Drop shadow filter -->
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.5" />
        </filter>
        <linearGradient id="pinGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${primaryColor}" stop-opacity="1" />
          <stop offset="100%" stop-color="${darkenColor(primaryColor, 30)}" stop-opacity="1" />
        </linearGradient>
      </defs>
      
      <!-- Pin body with 3D effect -->
      <path d="M${pinX + pinWidth/2},${pinY + pinHeight - pinPointHeight} L${pinX},${pinY + pinHeight - pinPointHeight} 
        Q${pinX},${pinY} ${pinX + pinWidth/2},${pinY} 
        Q${pinX + pinWidth},${pinY} ${pinX + pinWidth},${pinY + pinHeight - pinPointHeight} 
        L${pinX + pinWidth/2},${pinY + pinHeight - pinPointHeight} 
        L${pinX + pinWidth/2},${pinY + pinHeight}z" 
        fill="url(#pinGradient)" 
        stroke="#1A1A1A" 
        stroke-width="1"
        filter="url(#shadow)" />
      
      <!-- Inner background for letter -->
      <rect 
        x="${pinX + pinWidth*0.15}" 
        y="${pinY + pinHeight*0.15}" 
        width="${pinWidth*0.7}" 
        height="${pinHeight*0.5}" 
        rx="${pinWidth*0.1}" 
        fill="${secondaryColor}" 
        stroke="#4e443a" 
        stroke-width="1" />
      
      <!-- Letter -->
      <text 
        x="${size/2}" 
        y="${pinY + pinHeight*0.4}" 
        font-family="Asul, sans-serif" 
        font-size="${size*0.4}" 
        font-weight="bold" 
        fill="${primaryColor}" 
        text-anchor="middle" 
        dominant-baseline="middle">${displayLetter}</text>
    </svg>`;
    
    const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    console.log(`[MARKER DEBUG] Generated SVG data URI length: ${dataUri.length}`);
    return dataUri;
  } catch (error) {
    console.error(`Failed to create letter marker SVG: ${error}`, error);
    // Fallback: Create a simpler marker SVG that is guaranteed to work
    const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${size*0.4}" fill="${primaryColor}" stroke="#4e443a" stroke-width="1" />
      <text x="${size/2}" y="${size/2}" font-family="Arial" font-size="${size*0.5}" fill="${secondaryColor}" text-anchor="middle" dominant-baseline="middle">${displayLetter}</text>
    </svg>`;
    
    console.log(`[MARKER DEBUG] Using fallback SVG for letter ${displayLetter}`);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fallbackSvg)}`;
  }
};

/**
 * Get style function for map markers using letter-based markers
 * @param iconStyleCache Cache for styles to avoid recreation
 * @param labelStyleBase Base style for labels
 * @returns Function that returns appropriate style for a feature
 */
export const createLetterMarkerStyleFunction = (
  iconStyleCache: Record<string, Style>,
  labelStyleBase: Style
) => {
  return (feature: FeatureLike, labelCategoryIds: Set<string>): Style => {
    const categoryId = feature.get("categoryId") as string;
    
    // Use resolution or zoom from feature if available
    const zoom = feature.get("_mapZoom") as number | undefined;
    
    console.log(`[STYLE DEBUG] Processing style for feature with categoryId=${categoryId}, zoom=${zoom}`);
    
    // Check if the marker's category ID is in the set of label category IDs
    if (labelCategoryIds.has(categoryId)) {
      console.log(`[STYLE DEBUG] Rendering as label: categoryId=${categoryId}`);
      // Clone base style to avoid modifying it for all labels
      const style = labelStyleBase.clone();
      
      // Set the text for the label style dynamically
      const titleText = feature.get("title") || "";
      style.getText()?.setText(titleText);
      
      // Adjust text size based on zoom if available
      if (zoom !== undefined) {
        let fontSize = 18; // Default font size
        let strokeWidth = 2; // Default stroke width
        
        // Make text larger when zoomed out
        if (zoom <= 2) {
          fontSize = 24; // Much bigger for very zoomed out
          strokeWidth = 3;
        } else if (zoom <= 3) {
          fontSize = 21; // Slightly bigger for moderately zoomed out
          strokeWidth = 2.5;
        }
        
        console.log(`[STYLE DEBUG] Label font size adjusted: categoryId=${categoryId}, zoom=${zoom}, fontSize=${fontSize}`);
        
        // Update text style with adjusted size
        style.getText()?.setFont(`bold ${fontSize}px Asul, sans-serif`);
        style.getText()?.getStroke()?.setWidth(strokeWidth);
      }
      
      return style;
    }
  
    // For regular markers, add zoom to cache key if available
    const zoomSuffix = zoom !== undefined ? `-z${zoom}` : '';
    const cacheKey = `${categoryId || "default"}${zoomSuffix}`;
    
    console.log(`[STYLE DEBUG] Marker cache key: ${cacheKey}`);
  
    if (!iconStyleCache[cacheKey]) {
      console.log(`[STYLE DEBUG] Creating new style for categoryId=${categoryId}, cache miss`);
      
      // Color map with consistent names
      const colorMap: Record<string, string> = {
        "ORE": "#c0c0ff",
        "HERB": "#90ee90", 
        "SKIN": "#ffd700", 
        "TREE": "#228b22", 
        "CLOTH": "#dda0dd", 
        "ENEMY": "#ff4500", 
        "POI": "#ffd5ae", 
        "NPC": "#add8e6", 
        "TOWN": "#e6e6fa", 
        "DUNGEON": "#800080", 
        "BANK": "#ffd700", 
        "TELEPORT": "#00ffff", 
        "DAILY_QUEST": "#4169e1", 
        "RAID": "#ff4500", 
        "WORLD_BOSS": "#ff0000",
        "OTHER": "#a0a0a0", 
      };
      
      // Extract first letter of category name for the marker
      const letter = categoryId.charAt(0);
      console.log(`[STYLE DEBUG] Using letter "${letter}" for category ${categoryId}`);
      
      // Get color for this category (case-insensitive lookup)
      const upperId = categoryId.toUpperCase();
      const markerColor = colorMap[upperId] || "#ffd5ae"; // Default to Ethyrial theme color
      console.log(`[STYLE DEBUG] Color for category ${categoryId}: ${markerColor}`);
      
      // Calculate scale based on zoom if available
      let scale = 1.0; // Default scale
      
      if (zoom !== undefined) {
        if (zoom <= 2) {
          scale = 1.5; // Much larger when very zoomed out
        } else if (zoom <= 3) {
          scale = 1.25; // Larger when moderately zoomed out
        }
        console.log(`[STYLE DEBUG] Scale adjusted: categoryId=${categoryId}, zoom=${zoom}, scale=${scale}`);
      }
      
      // Create the letter-based marker
      const markerUrl = createLetterMarker(letter, markerColor);
      
      // Create the OpenLayers Icon style - this is what actually gets rendered
      console.log(`[STYLE DEBUG] Creating OpenLayers Icon style with anchor=[0.5, 0.95], scale=${scale}`);
      iconStyleCache[cacheKey] = new Style({
        image: new Icon({
          anchor: [0.5, 0.95], // Anchored at bottom-center of pin
          src: markerUrl,
          scale: scale, // Apply calculated scale
        }),
      });
    } else {
      console.log(`[STYLE DEBUG] Using cached style for ${cacheKey}`);
    }
    
    return iconStyleCache[cacheKey];
  };
}; 