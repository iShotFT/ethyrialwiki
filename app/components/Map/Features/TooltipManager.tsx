import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import type { Map as OlMap } from 'ol';
import IngameTooltip from '~/components/EthyrialStyle/IngameTooltip';
import Logger from '~/utils/Logger';

// Context for tooltip functionality
interface TooltipContextType {
  showTooltip: (content: React.ReactNode, targetElement: HTMLElement) => void;
  hideTooltip: () => void;
  registerMap: (map: OlMap) => void;
}

const TooltipContext = createContext<TooltipContextType | null>(null);

export const useTooltipManager = () => {
  const context = useContext(TooltipContext);
  if (!context) {
    throw new Error('useTooltipManager must be used within a TooltipProvider');
  }
  return context;
};

interface TooltipState {
  isVisible: boolean;
  content: React.ReactNode;
  position: { x: number, y: number } | null;
}

interface TooltipProviderProps {
  children: React.ReactNode;
}

export const TooltipProvider: React.FC<TooltipProviderProps> = ({ children }) => {
  const [tooltipState, setTooltipState] = useState<TooltipState>({
    isVisible: false,
    content: null,
    position: null
  });
  
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<OlMap | null>(null);
  
  // Hide tooltip when map is moved
  useEffect(() => {
    if (!mapRef.current) return;
    
    const handleMapMove = () => {
      setTooltipState(prev => ({
        ...prev,
        isVisible: false
      }));
    };
    
    mapRef.current.on('movestart', handleMapMove);
    
    return () => {
      if (mapRef.current) {
        mapRef.current.un('movestart', handleMapMove);
      }
    };
  }, [mapRef.current]);
  
  const showTooltip = (content: React.ReactNode, targetElement: HTMLElement) => {
    Logger.debug('misc', 'TooltipManager: Showing tooltip');
    
    // Get the target element's position
    const rect = targetElement.getBoundingClientRect();
    const position = {
      x: rect.left + rect.width / 2, // Center of the element
      y: rect.top // Top of the element
    };
    
    setTooltipState({
      isVisible: true,
      content,
      position
    });
  };
  
  const hideTooltip = () => {
    Logger.debug('misc', 'TooltipManager: Hiding tooltip');
    setTooltipState(prev => ({
      ...prev,
      isVisible: false
    }));
  };
  
  const registerMap = (map: OlMap) => {
    Logger.debug('misc', 'TooltipManager: Registering map');
    mapRef.current = map;
  };
  
  return (
    <TooltipContext.Provider value={{ showTooltip, hideTooltip, registerMap }}>
      {children}
      
      {/* Render the tooltip without virtual reference elements */}
      {tooltipState.isVisible && tooltipState.content && tooltipState.position && (
        <div
          ref={tooltipRef}
          style={{
            position: 'absolute',
            left: `${tooltipState.position.x}px`,
            top: `${tooltipState.position.y}px`,
            zIndex: 1000,
            pointerEvents: 'none',
            transform: 'translate(-50%, -100%)',
            marginTop: '-5px'
          }}
        >
          <IngameTooltip
            content={tooltipState.content}
            placement="top"
            showArrow={true}
          >
            <div style={{ width: '1px', height: '1px' }} />
          </IngameTooltip>
        </div>
      )}
    </TooltipContext.Provider>
  );
};

// Helper function to create tooltip content from a feature
export const createFeatureTooltipContent = (feature: any) => {
  const title = feature.get('title') || 'Unnamed Marker';
  const categoryName = feature.get('categoryName') || '';
  
  return (
    <div>
      <div className="font-bold">{title}</div>
      {categoryName && <div className="text-xs text-gray-300 my-1">{categoryName}</div>}
    </div>
  );
};

export default {
  TooltipProvider,
  useTooltipManager,
  createFeatureTooltipContent
}; 