import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronUp, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import IngameBorderedDiv from '../EthyrialStyle/IngameBorderedDiv';
import BaseOverlay, { DefaultPosition } from './BaseOverlay';
import Logger from '../../utils/Logger';

// Min and max Z values for the map
const MIN_Z_LAYER = -3;
const MAX_Z_LAYER = 40;

// Constants
const STORAGE_POSITION_KEY = 'z-layer-overlay-position';
const DRAG_TYPE = 'z-layer-overlay';

interface ZLayerOverlayProps {
  currentZLayer: number;
  onChange: (zLayer: number) => void;
}

const ZControlInner = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  background-color: #1A1A1A;
  color: #e0e0e0;
  font-family: 'Asul', sans-serif;
  padding: 0;
  overflow: hidden;
`;

const ControlButton = styled.button`
  width: 100%;
  padding: 8px 0;
  background-color: #2c2824;
  color: #e0e0e0;
  border: none;
  outline: none;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1px solid #4e443a;
  border-bottom: 1px solid #1A1A1A;

  &:hover {
    background-color: #4e443a;
    color: #ffd5ae;
  }

  &:active {
    background-color: #5a524a;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ZValueDisplay = styled.div`
  width: 100%;
  padding: 10px 0;
  font-size: 16px;
  font-weight: bold;
  text-align: center;
  border-top: 1px solid #1A1A1A;
  border-bottom: 1px solid #1A1A1A;
  background-color: #151515;
  color: #ffd5ae;
  border-left: 1px solid #4e443a;
  border-right: 1px solid #2c2824;
`;

/**
 * ZLayerOverlay component that displays a vertical slider to control the Z-layer of the map
 */
const ZLayerOverlay: React.FC<ZLayerOverlayProps> = ({ currentZLayer, onChange }) => {
  // Guard against invalid values
  const safeZLayer = Math.min(Math.max(currentZLayer, MIN_Z_LAYER), MAX_Z_LAYER);
  
  const handleIncrement = useCallback(() => {
    if (safeZLayer < MAX_Z_LAYER) {
      onChange(safeZLayer + 1);
    }
  }, [safeZLayer, onChange]);

  const handleDecrement = useCallback(() => {
    if (safeZLayer > MIN_Z_LAYER) {
      onChange(safeZLayer - 1);
    }
  }, [safeZLayer, onChange]);

  // Setup keyboard handlers
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if no input elements are focused
      if (document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'PageUp') {
        const newLayer = Math.min(currentZLayer + 1, MAX_Z_LAYER);
        onChange(newLayer);
      } else if (e.key === 'PageDown') {
        const newLayer = Math.max(currentZLayer - 1, MIN_Z_LAYER);
        onChange(newLayer);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentZLayer, onChange]);

  return (
    <BaseOverlay
      title="Z-Layer"
      collapsedTitle="Z"
      localStorageKey={STORAGE_POSITION_KEY}
      defaultPosition={{ position: 'middle-right' }}
      zIndex={15}
      dragType={DRAG_TYPE}
      className="w-[44px] min-w-[44px]"
      showHeader={false}
      noPadding={true}
    >
      <IngameBorderedDiv noPadding={true} style={{ overflow: 'hidden', width: '100%' }}>
        <ZControlInner>
          <ControlButton 
            onClick={handleIncrement}
            disabled={safeZLayer >= MAX_Z_LAYER}
            title="Move up one Z-layer"
          >
            <FontAwesomeIcon icon={faChevronUp} />
          </ControlButton>
          
          <ZValueDisplay title={`Current Z-layer: ${safeZLayer}`}>
            {safeZLayer}
          </ZValueDisplay>
          
          <ControlButton 
            onClick={handleDecrement}
            disabled={safeZLayer <= MIN_Z_LAYER}
            title="Move down one Z-layer"
          >
            <FontAwesomeIcon icon={faChevronDown} />
          </ControlButton>
        </ZControlInner>
      </IngameBorderedDiv>
    </BaseOverlay>
  );
};

export default ZLayerOverlay; 