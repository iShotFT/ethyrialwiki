import React, { useEffect, useRef } from 'react';
import { Map as OlMap } from 'ol';
import { MapBrowserEvent } from 'ol';
import { FeatureLike } from 'ol/Feature';
import { Point } from 'ol/geom';
import * as ReactDOM from 'react-dom';
import { cn } from '~/utils/twMerge';
import Logger from '~/utils/Logger';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMapMarkerAlt, faMapPin } from '@fortawesome/free-solid-svg-icons';

interface MapFeatureTooltipProps {
  map: OlMap;
}

/**
 * MapFeatureTooltip - A custom tooltip component for OpenLayers map features
 * Uses direct DOM manipulation for better performance
 * Displays tooltip on click instead of hover
 */
const MapFeatureTooltip: React.FC<MapFeatureTooltipProps> = ({ map }) => {
  // Reference to the current feature being displayed
  const currentFeatureRef = useRef<FeatureLike | null>(null);
  // Reference to the tooltip DOM element
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  
  // Get the screen position of a feature
  const getFeatureScreenPosition = (feature: FeatureLike) => {
    try {
      // Get the geometry (assuming it's a point)
      const geometry = feature.getGeometry();
      if (!geometry || !(geometry instanceof Point)) {
        return null;
      }
      
      // Get the center of the feature
      const coordinates = geometry.getCoordinates();
      
      // Convert map coordinates to pixel coordinates
      const pixel = map.getPixelFromCoordinate(coordinates);
      if (!pixel) {
        return null;
      }
      
      // Convert pixel to screen coordinates
      const mapElement = map.getTargetElement();
      if (!mapElement) {
        return null;
      }
      
      const rect = mapElement.getBoundingClientRect();
      const x = rect.left + pixel[0];
      const y = rect.top + pixel[1];
      
      return { 
        screenX: x, 
        screenY: y,
        mapX: Math.round(coordinates[0]),
        mapY: Math.round(coordinates[1])
      };
    } catch (error) {
      Logger.error('misc', new Error(`MapFeatureTooltip: Error getting feature position: ${error}`));
      return null;
    }
  };

  // Create the tooltip content component
  const TooltipContent = ({ 
    title, 
    categoryName, 
    coordinates 
  }: { 
    title: string; 
    categoryName?: string; 
    coordinates?: { x: number; y: number; z?: number }; 
  }) => (
    <div 
      className={cn(
        "z-[9999]", // Very high z-index to ensure visibility
        "border border-[#1A1A1A] rounded-sm",
        "p-1.5 bg-[#38322c]",
        "tooltip-container", // Class for custom styling
        "absolute top-0 left-0 pointer-events-none" // Positioning
      )}
    >
      {/* Content */}
      <div className="bg-[#151515] text-white text-xs px-3 py-2 rounded-sm border-t border-l border-[#4e443a] border-b border-r border-[#2c2824] font-asul min-w-[200px]">
        {/* Header with title in styled yellowish color */}
        <div className="text-[#ffd5ae] font-bold text-sm border-b border-[#2c2824] pb-1 mb-2 flex items-center">
          <FontAwesomeIcon icon={faMapPin} className="mr-2 text-[#ffd5ae]" />
          {title}
        </div>
        
        {/* Category (if available) */}
        {categoryName && (
          <div className="text-gray-300 mb-1.5">
            <FontAwesomeIcon icon={faMapPin} className="text-[#ffd5ae] mr-2" />
            {categoryName}
          </div>
        )}
        
        {/* Coordinates section */}
        {coordinates && (
          <div className="mt-2 pt-1.5 border-t border-[#2c2824] text-xs text-gray-400 flex items-center">
            <FontAwesomeIcon icon={faMapMarkerAlt} className="mr-1.5 text-[#a09083]" />
            <div>
              <span className="font-mono">X: {coordinates.x}, Y: {coordinates.y}</span>
              {coordinates.z !== undefined && (
                <span className="font-mono">, Z: {coordinates.z}</span>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Arrow - simplified version */}
      <div 
        className="absolute w-0 h-0 -top-2 left-1/2 -translate-x-1/2"
        style={{
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderBottom: '10px solid #38322c'
        }}
      />
    </div>
  );

  // Function to show tooltip for a feature
  const showTooltip = (feature: FeatureLike) => {
    const title = feature.get('title');
    const categoryName = feature.get('categoryName');
    
    // Get feature position
    const position = getFeatureScreenPosition(feature);
    if (!position) return;
    
    // Create tooltip content data
    const tooltipData = {
      title,
      categoryName,
      coordinates: {
        x: position.mapX,
        y: position.mapY,
        z: feature.get('z')
      }
    };
    
    // Create or update tooltip element
    if (!tooltipRef.current) {
      // Create tooltip element
      tooltipRef.current = document.createElement('div');
      tooltipRef.current.className = 'map-feature-tooltip';
      document.body.appendChild(tooltipRef.current);
    }
    
    // Render tooltip content using React 17's ReactDOM.render
    ReactDOM.render(<TooltipContent {...tooltipData} />, tooltipRef.current);
    
    // Position the tooltip
    if (tooltipRef.current) {
      tooltipRef.current.style.position = 'absolute';
      tooltipRef.current.style.left = '0';
      tooltipRef.current.style.top = '0';
      tooltipRef.current.style.transform = `translate3d(${position.screenX}px, ${position.screenY - 10}px, 0)`;
      tooltipRef.current.style.display = 'block';
    }
    
    // Store current feature
    currentFeatureRef.current = feature;
  };
  
  // Function to hide tooltip
  const hideTooltip = () => {
    if (tooltipRef.current) {
      tooltipRef.current.style.display = 'none';
    }
    currentFeatureRef.current = null;
  };
  
  // Function to update tooltip position
  const updateTooltipPosition = () => {
    if (!currentFeatureRef.current || !tooltipRef.current) return;
    
    const position = getFeatureScreenPosition(currentFeatureRef.current);
    if (position) {
      tooltipRef.current.style.transform = `translate3d(${position.screenX}px, ${position.screenY - 10}px, 0)`;
    } else {
      hideTooltip();
    }
  };

  // Set up event handlers and cleanup
  useEffect(() => {
    if (!map) return;
    
    Logger.debug('misc', 'MapFeatureTooltip: Setting up map event handlers');
    
    // Handle pointer movement for cursor changes
    const handlePointerMove = (evt: MapBrowserEvent<PointerEvent>) => {
      // Skip if dragging
      if (evt.dragging) return;
      
      const pixel = map.getEventPixel(evt.originalEvent);
      
      // Check if we have a feature at this pixel
      const hasFeature = map.hasFeatureAtPixel(pixel, {
        hitTolerance: 5
      });
      
      // Update cursor
      const targetElement = map.getTargetElement();
      if (targetElement) {
        targetElement.style.cursor = hasFeature ? 'pointer' : '';
      }
    };
    
    // Handle click events to show tooltip
    const handleClick = (evt: MapBrowserEvent<PointerEvent>) => {
      try {
        const pixel = map.getEventPixel(evt.originalEvent);
        
        // Check if we have a feature at this pixel
        const hasFeature = map.hasFeatureAtPixel(pixel, {
          hitTolerance: 5
        });
        
        // If click is not on a feature, close any open tooltip
        if (!hasFeature) {
          hideTooltip();
          return;
        }
        
        // Get feature data
        let shouldToggle = false;
        let clickedFeature: FeatureLike | null = null;
        
        map.forEachFeatureAtPixel(
          pixel,
          (feature) => {
            const title = feature.get('title');
            
            if (title) {
              // Check if clicking the same feature (for toggle)
              if (currentFeatureRef.current === feature && tooltipRef.current?.style.display !== 'none') {
                shouldToggle = true;
              }
              
              clickedFeature = feature;
              return true; // Stop after first feature
            }
            return false;
          },
          { hitTolerance: 5 }
        );
        
        if (shouldToggle) {
          // Toggle off
          hideTooltip();
        } else if (clickedFeature) {
          // Show tooltip for new feature
          showTooltip(clickedFeature);
        }
      } catch (error) {
        Logger.error('misc', new Error(`MapFeatureTooltip: Error in click handler: ${error}`));
        hideTooltip();
      }
    };
    
    // Handle map render for position updates
    const handlePostRender = () => {
      if (currentFeatureRef.current && tooltipRef.current?.style.display !== 'none') {
        requestAnimationFrame(updateTooltipPosition);
      }
    };
    
    // Register event handlers
    map.on('pointermove', handlePointerMove);
    map.on('singleclick', handleClick);
    map.on('postrender', handlePostRender);
    
    // Cleanup on unmount
    return () => {
      // Remove event handlers
      map.un('pointermove', handlePointerMove);
      map.un('singleclick', handleClick);
      map.un('postrender', handlePostRender);
      
      // Clean up tooltip
      if (tooltipRef.current) {
        ReactDOM.unmountComponentAtNode(tooltipRef.current);
        document.body.removeChild(tooltipRef.current);
        tooltipRef.current = null;
      }
      
      currentFeatureRef.current = null;
    };
  }, [map]);
  
  // No render output - all handled via direct DOM
  return null;
};

export default MapFeatureTooltip; 