import { useState, useCallback, useMemo } from 'react';
import { Style } from 'ol/style';
import { FeatureLike } from 'ol/Feature';
import { createLabelStyleBase, createStandardMarkerStyleFunction } from '../utils/markerStyleUtils';

/**
 * Shared hook for marker styling across the application
 * This centralizes the marker style logic to avoid duplication and inconsistencies
 */
export function useMarkerStyles() {
  // Use a single shared style cache across the application
  const [iconStyleCache] = useState<Record<string, Style>>({});
  
  // Create label style base once
  const labelStyleBase = useMemo(() => createLabelStyleBase(), []);
  
  // Create the style function with the shared cache
  const getMarkerStyle = useCallback(
    (feature: FeatureLike, labelCategoryIds: Set<string>): Style => {
      // Optional debug logging for development
      if (process.env.NODE_ENV === 'development') {
        console.log('[MARKER STYLE] Styling feature:', {
          categoryId: feature.get('categoryId'),
          id: feature.get('id'),
          isLabel: labelCategoryIds.has(feature.get('categoryId')),
        });
      }
      
      // Call the standard marker style function
      const style = createStandardMarkerStyleFunction(iconStyleCache, labelStyleBase)(
        feature, 
        labelCategoryIds
      );
      
      return style;
    },
    [iconStyleCache, labelStyleBase]
  );
  
  return {
    getMarkerStyle,
    iconStyleCache,
    labelStyleBase
  };
} 