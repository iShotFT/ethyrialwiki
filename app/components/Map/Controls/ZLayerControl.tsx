import * as React from 'react';
import { useCallback } from 'react';
import styled from 'styled-components';
import { useMapContext } from '../Context/MapContext';

const ControlContainer = styled.div`
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 20;
`;

const ZButton = styled.button<{ isActive?: boolean }>`
  width: 36px;
  height: 36px;
  background-color: ${(props) => (props.isActive ? '#38322c' : '#151515')};
  color: ${(props) => (props.isActive ? '#ffd5ae' : '#a0a0a0')};
  border: 1px solid #4e443a;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Asul', sans-serif;
  font-size: 14px;
  font-weight: ${(props) => (props.isActive ? 'bold' : 'normal')};
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  
  &:hover {
    background-color: #38322c;
    color: #ffd5ae;
  }
  
  &:active {
    transform: translateY(1px);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }
`;

const LayerInfo = styled.div`
  background-color: #151515;
  color: #e0e0e0;
  border: 1px solid #4e443a;
  border-radius: 4px;
  padding: 4px 8px;
  font-family: 'Asul', sans-serif;
  font-size: 12px;
  text-align: center;
  margin-bottom: 4px;
`;

interface Props {
  maxLayers?: number;
}

/**
 * Control for changing map Z-layer
 */
const ZLayerControl: React.FC<Props> = ({ maxLayers = 5 }) => {
  const { currentZLayer, setCurrentZLayer, map } = useMapContext();
  
  // Generate layers to display
  const layers = React.useMemo(() => {
    const result = [];
    
    // Always include current layer
    result.push(currentZLayer);
    
    // Add layers above current
    for (let i = 1; i <= 2; i++) {
      if (currentZLayer + i <= 40) {
        result.push(currentZLayer + i);
      }
    }
    
    // Add layers below current
    for (let i = 1; i <= 2; i++) {
      if (currentZLayer - i >= -3) {
        result.unshift(currentZLayer - i);
      }
    }
    
    return result;
  }, [currentZLayer]);
  
  // Handle layer change
  const handleLayerChange = useCallback((layer: number) => {
    setCurrentZLayer(layer);
  }, [setCurrentZLayer]);
  
  if (!map) return null;
  
  return (
    <ControlContainer>
      <LayerInfo>Z-Layer</LayerInfo>
      {layers.map((layer) => (
        <ZButton
          key={`z-layer-${layer}`}
          isActive={layer === currentZLayer}
          onClick={() => handleLayerChange(layer)}
          title={`Switch to Z-Layer ${layer}`}
        >
          {layer}
        </ZButton>
      ))}
    </ControlContainer>
  );
};

export default ZLayerControl; 