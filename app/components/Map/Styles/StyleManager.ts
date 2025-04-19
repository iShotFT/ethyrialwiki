import { Style, Circle as CircleStyle, Fill, Stroke, Text } from 'ol/style';
import { FeatureLike } from 'ol/Feature';
import Logger from '~/utils/Logger';
import { CATEGORY_COLORS, getCategoryColor } from '~/utils/categoryColorUtils';

// Default style settings
const DEFAULT_MARKER_RADIUS = 8;
const DEFAULT_MARKER_COLOR = '#1E90FF';
const DEFAULT_LABEL_FONT = '12px "Asul", sans-serif';
const DEFAULT_LABEL_COLOR = '#FFFFFF';
const DEFAULT_LABEL_OUTLINE_COLOR = '#000000';
const DEFAULT_LABEL_OUTLINE_WIDTH = 3;

// Cache for styles to improve performance
const styleCache: Record<string, Style> = {};
const labelStyleCache: Record<string, Style> = {};

/**
 * StyleManager centralizes all styling logic for the map components
 */
class StyleManager {
  /**
   * Get a style for a marker based on its category
   */
  getMarkerStyle(feature: FeatureLike, labelCategoryIds?: Set<string>): Style {
    // Check if feature is a label
    const categoryId = feature.get('categoryId');
    const isLabel = labelCategoryIds ? labelCategoryIds.has(categoryId) : feature.get('isLabel');
    
    if (isLabel) {
      return this.getLabelStyle(feature);
    }
    
    // Get feature properties
    const id = feature.get('id');
    const categoryName = feature.get('categoryName') || 'OTHER';
    
    // Create cache key based on properties that affect style
    const cacheKey = `marker-${id}-${categoryName}`;
    
    // Return cached style if available
    if (styleCache[cacheKey]) {
      return styleCache[cacheKey];
    }
    
    // Determine color based on category
    const categoryColor = getCategoryColor(categoryName);
    
    // Create new style - without text by default
    const style = new Style({
      image: new CircleStyle({
        radius: DEFAULT_MARKER_RADIUS,
        fill: new Fill({
          color: categoryColor
        }),
        stroke: new Stroke({
          color: '#FFFFFF',
          width: 2
        })
      })
      // No text by default - will be shown in tooltip
    });
    
    // Cache the style
    styleCache[cacheKey] = style;
    
    Logger.debug('misc', `[StyleManager] Created marker style for ${categoryName}`);
    return style;
  }
  
  /**
   * Get a style for a label
   */
  getLabelStyle(feature: FeatureLike): Style {
    const id = feature.get('id');
    const title = feature.get('title');
    const categoryId = feature.get('categoryId');
    
    // Create cache key
    const cacheKey = `label-${id}`;
    
    // Return cached style if available
    if (labelStyleCache[cacheKey]) {
      return labelStyleCache[cacheKey];
    }
    
    // Create label style
    const style = new Style({
      text: new Text({
        text: title,
        font: DEFAULT_LABEL_FONT,
        fill: new Fill({
          color: DEFAULT_LABEL_COLOR
        }),
        stroke: new Stroke({
          color: DEFAULT_LABEL_OUTLINE_COLOR,
          width: DEFAULT_LABEL_OUTLINE_WIDTH
        })
      })
    });
    
    // Cache the style
    labelStyleCache[cacheKey] = style;
    
    Logger.debug('misc', `[StyleManager] Created label style for ${title}`);
    return style;
  }
  
  /**
   * Clear style caches
   */
  clearStyleCache(): void {
    Object.keys(styleCache).forEach(key => delete styleCache[key]);
    Object.keys(labelStyleCache).forEach(key => delete labelStyleCache[key]);
    Logger.debug('misc', '[StyleManager] Style caches cleared');
  }
}

// Export a singleton instance
export default new StyleManager(); 