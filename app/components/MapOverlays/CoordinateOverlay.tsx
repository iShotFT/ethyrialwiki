import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { observer } from 'mobx-react';
import type { Map as OLMap } from 'ol';
import type { MapBrowserEvent } from 'ol';
import BaseOverlay, { DefaultPosition } from './BaseOverlay';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMapMarkerAlt, faSearchPlus } from '@fortawesome/free-solid-svg-icons';
import Logger from '~/utils/Logger';

// Constants
const STORAGE_POSITION_KEY = 'coordinate-overlay-position';
const DRAG_TYPE = 'coordinate-overlay';

// Types for the component props
interface CoordinateOverlayProps {
  mapInstance: OLMap | null;
}

// Styled components for the horizontal layout
const CoordinateContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px;
  color: #e0e0e0;
  font-family: 'Asul', sans-serif;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
`;

const CoordinateItem = styled.div`
  display: flex;
  align-items: center;
  margin: 0 4px;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  border: 1px solid rgba(78, 68, 58, 0.5);

  &:first-child {
    margin-left: 0;
  }

  &:last-child {
    margin-right: 0;
  }
`;

const CoordinateValue = styled.span`
  font-weight: 600;
  color: #ffd5ae;
  margin-left: 4px;
  font-family: 'Asul', sans-serif;
`;

const CoordinateLabel = styled.span`
  color: #a0a0a0;
  margin-right: 2px;
  font-family: 'Asul', sans-serif;
`;

/**
 * CoordinateOverlay component that displays the current cursor coordinates on the map
 */
const CoordinateOverlay: React.FC<CoordinateOverlayProps> = ({ mapInstance }) => {
  // State to track cursor position
  const [coordinates, setCoordinates] = useState<{ x: number; y: number; zoom: number | undefined }>({
    x: 0,
    y: 0,
    zoom: undefined,
  });
  
  // Set up map event listeners to track cursor position
  useEffect(() => {
    if (!mapInstance) {
      Logger.debug("misc", "[CoordinateOverlay] No map instance provided");
      return;
    }
    
    Logger.debug("misc", "[CoordinateOverlay] Setting up event listeners");
    
    // Handler function for pointer movement with proper typing
    const handlePointerMove = (event: MapBrowserEvent<PointerEvent>) => {
      if (!mapInstance) return;
      
      // Get map pixel coordinates
      const pixel = event.pixel;
      
      // Convert to map coordinates
      const coord = mapInstance.getCoordinateFromPixel(pixel);
      
      // Get current zoom level
      const zoom = mapInstance.getView().getZoom();
      
      if (coord) {
        setCoordinates({
          x: Math.round(coord[0]),
          y: Math.round(coord[1]),
          zoom: zoom !== undefined ? Math.round(zoom) : undefined
        });
      }
    };
    
    // Handler for resolution (zoom) changes
    const handleResolutionChange = () => {
      if (!mapInstance) return;
      
      const zoom = mapInstance.getView().getZoom();
      setCoordinates(prev => ({
        ...prev,
        zoom: zoom !== undefined ? Math.round(zoom) : undefined
      }));
    };
    
    try {
      // Register event listeners
      mapInstance.on('pointermove', handlePointerMove);
      
      // Get the view and register resolution change listener
      const view = mapInstance.getView();
      if (view) {
        view.on('change:resolution', handleResolutionChange);
      }
      
      Logger.debug("misc", "[CoordinateOverlay] Event listeners registered successfully");
    } catch (error) {
      Logger.error("misc", new Error(`[CoordinateOverlay] Error setting up event listeners: ${error}`));
    }
    
    // Cleanup function to remove event listeners
    return () => {
      try {
        if (mapInstance) {
          // Remove pointermove listener
          mapInstance.un('pointermove', handlePointerMove);
          
          // Remove resolution change listener from view
          const view = mapInstance.getView();
          if (view) {
            view.un('change:resolution', handleResolutionChange);
          }
          
          Logger.debug("misc", "[CoordinateOverlay] Event listeners cleaned up");
        }
      } catch (error) {
        Logger.error("misc", new Error(`[CoordinateOverlay] Error cleaning up event listeners: ${error}`));
      }
    };
  }, [mapInstance]);
  
  return (
    <BaseOverlay
      id="coordinate-overlay"
      title="Coordinates"
      collapsedTitle="C"
      localStorageKey={STORAGE_POSITION_KEY}
      defaultPosition={{ position: 'bottom-right' }}
      zIndex={10}
      dragType={DRAG_TYPE}
      className="min-w-[140px] w-auto"
      showHeader={false}
      noPadding={true}
      noBorder={true}
    >
      <CoordinateContainer>
        <CoordinateItem>
          <CoordinateLabel>X:</CoordinateLabel>
          <CoordinateValue>{coordinates.x}</CoordinateValue>
        </CoordinateItem>
        
        <CoordinateItem>
          <CoordinateLabel>Y:</CoordinateLabel>
          <CoordinateValue>{coordinates.y}</CoordinateValue>
        </CoordinateItem>
        
        <CoordinateItem>
          <CoordinateLabel>Z:</CoordinateLabel>
          <CoordinateValue>{coordinates.zoom ?? 'N/A'}</CoordinateValue>
        </CoordinateItem>
      </CoordinateContainer>
    </BaseOverlay>
  );
};

export default observer(CoordinateOverlay); 