import { Style, Circle, Fill, Stroke, Text } from "ol/style";
import { FeatureLike } from "ol/Feature";

/**
 * Creates a base label style for map features
 * @returns Style object for map labels
 */
export const createLabelStyleBase = (): Style => {
  return new Style({
    text: new Text({
      font: "bold 18px 'Asul', sans-serif",
      fill: new Fill({ color: "#FFFFFF" }),
      stroke: new Stroke({ color: "#000000", width: 2 }),
      textAlign: "center",
      textBaseline: "middle",
      overflow: true,
    }),
  });
};

/**
 * Get style function for map markers - using standard OpenLayers circle style
 * @param iconStyleCache Cache for styles to avoid recreation
 * @param labelStyleBase Base style for labels
 * @returns Function that returns appropriate style for a feature
 */
export const createStandardMarkerStyleFunction = (
  iconStyleCache: Record<string, Style>,
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
        let fontSize = 16; // Default font size
        let strokeWidth = 2; // Default stroke width
        
        // Make text larger when zoomed out
        if (zoom <= 2) {
          fontSize = 20;
          strokeWidth = 3;
        } else if (zoom <= 3) {
          fontSize = 18;
          strokeWidth = 2.5;
        }
        
        // Update text style with adjusted size
        style.getText()?.setFont(`bold ${fontSize}px 'Asul', sans-serif`);
        style.getText()?.getStroke()?.setWidth(strokeWidth);
      }
      
      return style;
    }
  
    // For regular markers, add zoom to cache key if available
    const zoomSuffix = zoom !== undefined ? `-z${zoom}` : '';
    const cacheKey = `${categoryId || "default"}${zoomSuffix}`;
  
    if (!iconStyleCache[cacheKey]) {
      // Calculate scale based on zoom if available
      let radius = 8; // Default radius
      
      if (zoom !== undefined) {
        if (zoom <= 2) {
          radius = 12; // Larger when very zoomed out
        } else if (zoom <= 3) {
          radius = 10; // Slightly larger when moderately zoomed out
        }
      }
      
      // Create standard OpenLayers circle style
      iconStyleCache[cacheKey] = new Style({
        image: new Circle({
          radius: radius,
          fill: new Fill({
            color: '#3399CC'
          }),
          stroke: new Stroke({
            color: '#fff',
            width: 2
          })
        })
      });
    }
    
    return iconStyleCache[cacheKey];
  };
};

/**
 * Creates a basic marker style with a given fill color
 */
export const createMarkerStyle = (fillColor: string): Style => {
  return new Style({
    image: new Circle({
      radius: 8,
      fill: new Fill({
        color: fillColor
      }),
      stroke: new Stroke({
        color: '#fff',
        width: 2
      })
    })
  });
};

// Also ensure we update text font in any places where it's modified dynamically
export const createMarkerStyleWithLabel = (
  text: string,
  fillColor: string,
  fontSize: number = 14
): Style => {
  const style = createMarkerStyle(fillColor);
  style.setText(
    new Text({
      text,
      font: `bold ${fontSize}px 'Asul', sans-serif`,
      fill: new Fill({
        color: "#fff",
      }),
      stroke: new Stroke({
        color: "#000",
        width: 3,
      }),
      offsetY: 20,
    })
  );
  return style;
};

// Update any function that modifies font directly
export const updateLabelFontSize = (style: Style, fontSize: number): void => {
  if (style.getText()) {
    style.getText()?.setFont(`bold ${fontSize}px 'Asul', sans-serif`);
  }
}; 