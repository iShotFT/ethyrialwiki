import { useCallback } from 'react';
import { Style } from 'ol/style';
import { FeatureLike } from 'ol/Feature';
import StyleManager from '~/components/Map/Styles/StyleManager';

/**
 * Shared hook for marker styling across the application
 * This uses the centralized StyleManager for consistent styling
 */
export function useMarkerStyles() {
  // Create a wrapper around the StyleManager to maintain hook interface
  const getMarkerStyle = useCallback(
    (feature: FeatureLike, labelCategoryIds: Set<string>): Style => {
      return StyleManager.getMarkerStyle(feature, labelCategoryIds);
    },
    []
  );
  
  return {
    getMarkerStyle,
  };
} 