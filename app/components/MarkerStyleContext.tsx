import React, { createContext, useContext, ReactNode } from 'react';
import { Style } from 'ol/style';
import { FeatureLike } from 'ol/Feature';
import { useMarkerStyles } from '../hooks/useMarkerStyles';

// Define the context type
interface MarkerStyleContextType {
  getMarkerStyle: (feature: FeatureLike, labelCategoryIds: Set<string>) => Style;
}

// Create the context with a default value
const MarkerStyleContext = createContext<MarkerStyleContextType | null>(null);

// Provider component
interface MarkerStyleProviderProps {
  children: ReactNode;
}

export function MarkerStyleProvider({ children }: MarkerStyleProviderProps) {
  // Use our centralized marker styles hook
  const markerStyles = useMarkerStyles();
  
  return (
    <MarkerStyleContext.Provider value={markerStyles}>
      {children}
    </MarkerStyleContext.Provider>
  );
}

// Hook for consuming the context
export function useMarkerStyleContext() {
  const context = useContext(MarkerStyleContext);
  
  if (context === null) {
    throw new Error('useMarkerStyleContext must be used within a MarkerStyleProvider');
  }
  
  return context;
} 