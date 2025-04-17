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

const DragPreview = styled.div<{ $isCollapsed: boolean, $width?: number | null }>`
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: rgba(0, 0, 0, 0.25) 0px 5px 15px;
  border: 1px dashed rgba(255, 255, 255, 0.3); // Use a lighter color for better visibility
  box-sizing: border-box;
  width: ${(props) => props.$isCollapsed ? "auto" : (props.$width ? `${props.$width}px` : '200px') }; // Use item width, fallback
  min-width: 40px; // Prevent collapsing too small
  padding: ${props => props.$isCollapsed ? '4px 8px' : '8px 12px'}; // Smaller padding when collapsed

  // Semi-transparent background
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #38322c; // Match overlay background
    opacity: 0.85; // Slightly more opaque
    border-radius: inherit;
    z-index: -1;
  }
`;

const PreviewTitle = styled.div`
  color: #ffd5ae; // Match title color
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
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
    // Log if drag is active but item is invalid
    if (isDragging) {
      Logger.warn("dnd", new Error("Dragging active but drag layer item is missing or invalid."));
    }
    return null;
  }

  // Render different previews based on itemType or other item properties if needed
  // For now, a generic preview using title and collapsed state
  const displayTitle = item.isCollapsed ? (item.title.charAt(0)) : item.title;

  return (
    <DragLayerContainer>
      <div style={getItemStyles(initialOffset, currentOffset)}>
        <DragPreview $isCollapsed={item.isCollapsed} $width={item.width}>
          <PreviewTitle>{displayTitle}</PreviewTitle>
          {/* Add more preview details here if needed based on itemType */}
        </DragPreview>
      </div>
    </DragLayerContainer>
  );
};

export default GlobalCustomDragLayer; 