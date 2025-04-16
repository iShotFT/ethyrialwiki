import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { Style, Icon, Fill, Stroke, Text } from "ol/style";
import { FeatureLike } from "ol/Feature";
import { faQuestionCircle } from "@fortawesome/free-solid-svg-icons";
import Logger from "./Logger";

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
  
    // Check if the marker's category ID is in the set of label category IDs
    if (labelCategoryIds.has(categoryId)) {
      // Clone base style to avoid modifying it for all labels
      const style = labelStyleBase.clone();
      // Set the text for the label style dynamically
      style.getText()?.setText(feature.get("title") || "");
      return style;
    }
  
    // Existing Icon logic
    const cacheKey = categoryId || "default";
  
    if (!iconStyleCache[cacheKey]) {
      const iconDefinition = categoryIconMap[categoryId]; // Direct lookup
  
      // Log if lookup failed
      if (!iconDefinition) {
        Logger.warn(
          "misc",
          new Error(`No icon definition found for categoryId: [${categoryId}], using fallback.`)
        );
      }
  
      const iconDataUri = createFaDataUri(
        iconDefinition || faQuestionCircle,
        "#D92A2A"
      );
  
      iconStyleCache[cacheKey] = new Style({
        image: new Icon({
          anchor: [0.5, 0.9], // Adjust anchor if needed for new icons
          src: iconDataUri,
          // Optional: scale the icon
          // scale: 0.8,
        }),
      });
    }
    return iconStyleCache[cacheKey];
  };
}; 