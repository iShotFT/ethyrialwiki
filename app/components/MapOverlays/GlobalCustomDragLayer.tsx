import React from 'react';
import { useDragLayer } from 'react-dnd';
import styled from 'styled-components';
import { XYCoord } from 'react-dnd';
import Logger from '~/utils/Logger';

// Styled Components for Drag Layer
const DragLayerContainer = styled.div`
  position: fixed; // Use fixed to position relative to viewport
  pointer-events: none; // Prevent interference with other elements
  z-index: 100; // Ensure it's on top
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
`;

// Function to calculate transform style
function getItemStyles(
  initialOffset: XYCoord | null,
  currentOffset: XYCoord | null,
): React.CSSProperties {
  if (!initialOffset || !currentOffset) {
    return { display: 'none' };
  }
  
  const transform = `translate(${currentOffset.x}px, ${currentOffset.y}px)`;
  return {
    transform,
    WebkitTransform: transform,
  };
}

const PreviewTitle = styled.div`
  color: #ffd5ae; // Match title color
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  padding: 6px 10px;
`;

const DragPreview = styled.div<{ 
  $isCollapsed: boolean; 
  $width: number;
  $height: number;
}>`
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: rgba(0, 0, 0, 0.25) 0px 5px 15px;
  border: 2px dashed rgba(255, 213, 174, 0.6); // Ethyrial gold color with transparency
  box-sizing: border-box;
  width: ${props => `${props.$width}px`};
  height: ${props => `${props.$height}px`};
  min-width: 40px; // Prevent collapsing too small
  min-height: 24px; // Ensure minimum height

  // Semi-transparent background
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #38322c; // Match overlay background
    opacity: 0.6; // More transparent for a better preview
    border-radius: inherit;
    z-index: -1;
  }
`;

// Global Custom Drag Layer Component
const GlobalCustomDragLayer: React.FC = () => {
  const {
    itemType,
    isDragging,
    item,
    initialOffset,
    currentOffset
  } = useDragLayer((monitor) => ({
    item: monitor.getItem(), // Contains { width, height, isCollapsed, title, dragType }
    itemType: monitor.getItemType(),
    initialOffset: monitor.getInitialSourceClientOffset(),
    currentOffset: monitor.getSourceClientOffset(),
    isDragging: monitor.isDragging(),
  }));

  // Ensure item is defined and has necessary properties
  if (!isDragging || !item || !itemType || typeof item.isCollapsed === 'undefined' || !item.title) {
    return null;
  }

  // Get dimensions with proper defaults
  const width = typeof item.width === 'number' ? item.width : 200;
  const height = typeof item.height === 'number' ? item.height : 40;

  // For debugging only
  if (isDragging && (!width || !height)) {
    Logger.debug("misc", `Drag preview dimensions: ${width}x${height}, isCollapsed: ${item.isCollapsed}`);
  }

  return (
    <DragLayerContainer>
      <div style={getItemStyles(initialOffset, currentOffset)}>
        <DragPreview 
          $isCollapsed={item.isCollapsed} 
          $width={width}
          $height={height}
        >
          {/* Optionally show title for debugging */}
          {/* <PreviewTitle>{item.isCollapsed ? item.title.charAt(0) : item.title}</PreviewTitle> */}
        </DragPreview>
      </div>
    </DragLayerContainer>
  );
};

export default GlobalCustomDragLayer; 