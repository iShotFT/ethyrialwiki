import React, { useState, useEffect, useRef, forwardRef } from 'react';
import { observer } from 'mobx-react';
import styled, { CSSProperties } from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronRight, faCompressAlt, faExpandAlt } from '@fortawesome/free-solid-svg-icons';
import Flex from '~/components/Flex';
import Tooltip from '~/components/Tooltip';
import { cn } from '~/utils/twMerge';
import IngameBorderedDiv from '~/components/EthyrialStyle/IngameBorderedDiv';
import GameItemIcon from '~/components/EthyrialStyle/GameItemIcon';
import IngameScrollableContainer from '~/components/EthyrialStyle/IngameScrollableContainer';
import IngameTooltip from '~/components/EthyrialStyle/IngameTooltip';
import { DndProvider, useDrag, useDragLayer } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import Logger from "~/utils/Logger";

// Define Coordinate type if not already defined globally
// Rename local type alias
type PositionState = { x: number; y: number };

// Types for props (adjust as needed based on API response)
interface HeatmapCategory {
  id: string;
  slug: string;
  title: string;
  iconUrl: string | null;
}

interface HeatmapItem {
  id: string;
  slug: string;
  title: string;
  iconUrl: string | null;
  tier: number;
  rarityColorHex?: string | null;
}

type Props = {
  categories: HeatmapCategory[];
  itemsByCategory: Record<string, HeatmapItem[]>; // { categorySlug: [item1, item2, ...] }
  activeCategorySlug: string | null; // Slug of the currently selected category
  isLoadingItems: boolean; // Loading state for items
  onCategoryClick: (categorySlug: string) => void; // Callback when category is clicked
  onItemClick: (itemId: string) => void; // Callback when an item is clicked
};

// --- DND Setup --- //
const ItemTypes = {
  HEATMAP_PANEL: "heatmapPanel", // Unique type for this panel
};
const LOCAL_STORAGE_KEY = "heatmapOverlayPosition";
// --- End DND Setup ---

// Remove old PanelContainer
/*
const PanelContainer = styled.div`
  position: absolute;
  top: 16px;
  right: 16px;
  // ... rest of styles
`;
*/

// Modify CategoryBar to be relative for chevron positioning
const PanelHeader = styled(Flex)`
  margin-bottom: 12px;
  font-weight: 600;
  padding: 0 4px; // Add some padding
`;

const CollapseButton = styled.button`
  background: none; border: none; padding: 4px; margin: 0;
  cursor: pointer; color: inherit; display: inline-flex;
  align-items: center; justify-content: center; border-radius: 4px;
  font-size: 16px;
  &:hover { background: ${(props) => props.theme.tooltipBackground}; }
  svg { display: block; }
`;

const CategoryBar = styled(Flex)`
  // No longer needs position relative for chevron
`;

// Revert CategoryButton to standard styled button
const CategoryButton = styled.button<{$isActive: boolean}>`
  background: none;
  border: none;
  padding: 4px;
  margin: 0 2px; // Adjust spacing
  cursor: pointer;
  opacity: ${props => props.$isActive ? 1 : 0.6};
  transition: opacity 150ms ease-in-out;
  border-radius: 4px; // Add rounding
  position: relative; // For optional ::after pseudo-element highlight
  border: 1px solid transparent; // Add transparent border for layout consistency

  ${props => props.$isActive && `
    background: rgba(255, 255, 255, 0.15); // Highlight background
    border-color: #ffd5ae; // Highlight border
    opacity: 1;
  `}

  &:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
  }

  img {
    width: 24px;
    height: 24px;
    display: block;
  }
`;

// Wrap the styled component with forwardRef separately
const ForwardedCategoryButton = forwardRef<HTMLButtonElement, React.ComponentProps<typeof CategoryButton>>((props, ref) => (
    <CategoryButton ref={ref} {...props} />
));

// Horizontal ItemList - Remove direct overflow styling
const ItemListContainer = styled.div`
  padding-top: 8px;
  margin-top: 8px;
  border-top: 1px solid #4e443a; // Separator line
`;

const ItemList = styled.div`
  display: flex;
  gap: 6px;
`;

const ItemButton = styled.button`
  // Use Ingame style? For now, simpler button
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 4px;
  cursor: pointer;
  transition: background-color 150ms ease-in-out;
  flex-shrink: 0; // Prevent buttons from shrinking

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  img {
    width: 32px;
    height: 32px;
    display: block;
  }
`;

// --- Custom Drag Layer (Copied and adapted) --- //
const DragLayerContainer = styled.div`
  position: fixed; pointer-events: none; z-index: 100; left: 0; top: 0; width: 100%; height: 100%;
`;
const DragPreview = styled.div`
  position: relative; overflow: hidden; border-radius: 8px;
  box-shadow: rgba(0, 0, 0, 0.25) 0px 5px 15px;
  border: 1px dashed ${(props) => props.theme.sidebarText};
  box-sizing: border-box;
  &::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    background: ${(props) => props.theme.sidebarBackground}; opacity: 0.3;
    border-radius: inherit; z-index: -1; }
`;

function getItemStyles(
  initialOffset: PositionState | null, // Use PositionState
  currentOffset: PositionState | null, // Use PositionState
  width: number | null,
  height: number | null
): CSSProperties {
  if (!initialOffset || !currentOffset || width === null || height === null) {
    return { display: 'none' };
  }
  const transform = `translate(${currentOffset.x}px, ${currentOffset.y}px)`;
  return {
    transform,
    WebkitTransform: transform,
    width: `${width}px`,
    height: `${height}px`,
  };
}

const CustomDragLayer: React.FC = () => {
  const {
    itemType,
    isDragging,
    item,
    initialOffset,
    currentOffset
  } = useDragLayer((monitor) => ({
    item: monitor.getItem(),
    itemType: monitor.getItemType(),
    // Ensure correct type casting if necessary
    initialOffset: monitor.getInitialSourceClientOffset() as PositionState | null,
    currentOffset: monitor.getSourceClientOffset() as PositionState | null,
    isDragging: monitor.isDragging(),
  }));

  const { width, height } = item || {};

  // Use HEATMAP_PANEL type
  if (!isDragging || itemType !== ItemTypes.HEATMAP_PANEL) {
    return null;
  }

  return (
    <DragLayerContainer>
      {/* Ensure types match for getItemStyles call */}
      <DragPreview style={getItemStyles(initialOffset, currentOffset, width, height)} />
    </DragLayerContainer>
  );
};
// --- End Custom Drag Layer --- //

const HeatmapOverlayPanel: React.FC<Props> = ({
  categories,
  itemsByCategory,
  activeCategorySlug,
  isLoadingItems,
  onCategoryClick,
  onItemClick,
}) => {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const categoryButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // Use renamed type for state
  const [position, setPosition] = useState<PositionState>({ x: window.innerWidth - 450, y: 16 });
  const [activeButtonLeft, setActiveButtonLeft] = useState<number | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load/Save Position useEffects
  useEffect(() => {
    const savedPosition = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedPosition) {
      try {
        const parsed = JSON.parse(savedPosition);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
           setPosition(parsed as PositionState); // Use type assertion
        }
      } catch (e) {
        Logger.warn("utils", new Error(`Failed to parse saved heatmap panel position: ${e instanceof Error ? e.message : String(e)}`)); // Correct warn call
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(position));
  }, [position]);

  // Drag Hook
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.HEATMAP_PANEL,
    item: () => ({ // Capture dimensions AND collapsed state
        width: panelRef.current?.offsetWidth,
        height: panelRef.current?.offsetHeight,
        isCollapsed: isCollapsed,
    }),
    collect: (monitor) => ({ isDragging: !!monitor.isDragging() }),
    end: (item, monitor) => { // Update position on end
        const delta = monitor.getDifferenceFromInitialOffset();
        if (delta) {
            // Use renamed type in callback
            setPosition((prevPos: PositionState) => ({
                x: Math.round(prevPos.x + delta.x),
                y: Math.round(prevPos.y + delta.y),
            }));
        }
    },
  }));
  drag(panelRef);

  // Call the prop handler when category is clicked
  const handleCategoryClick = (slug: string) => {
    onCategoryClick(slug);
  };

  const handleToggleCollapse = () => setIsCollapsed(!isCollapsed);

  // Get items for the *currently active* category from props
  const activeItems = activeCategorySlug ? itemsByCategory[activeCategorySlug] || [] : [];

  // Sort items by tier (only if activeItems is populated)
  if (activeItems.length > 0) {
      activeItems.sort((a, b) => a.tier - b.tier);
  }

  return (
    // Remove outer wrapper, position applied directly to IngameBorderedDiv
    <IngameBorderedDiv
      ref={panelRef}
      style={{ top: `${position.y}px`, left: `${position.x}px`, opacity: isDragging ? 0 : 1 }}
      className={cn(
          'absolute',
          // Apply width based on collapsed state
          isCollapsed ? 'w-auto' : 'max-w-[450px]',
          'min-w-[300px]', // Add min-width
          'z-10'
      )}
    >
      <PanelHeader justify="space-between" align="center">
        {/* Show title even when collapsed if needed, or hide content */} 
        <span className="text-[#ffd5ae]">{!isCollapsed ? "Heatmaps" : "H"}</span> 
        <Tooltip content={isCollapsed ? "Expand" : "Collapse"} placement="left">
           <CollapseButton onClick={handleToggleCollapse} className="text-[#ffd5ae]">
             <FontAwesomeIcon icon={isCollapsed ? faExpandAlt : faCompressAlt} />
           </CollapseButton>
        </Tooltip>
      </PanelHeader>

      {/* Content shown only when not collapsed */} 
      {!isCollapsed && (
        <>
          <CategoryBar justify="flex-start" className="mb-0 pb-1">
             {categories.map(cat => (
                <IngameTooltip key={cat.id} content={cat.title} placement="bottom">
                  <ForwardedCategoryButton
                    ref={el => { categoryButtonRefs.current[cat.slug] = el; }}
                    $isActive={activeCategorySlug === cat.slug}
                    onClick={() => handleCategoryClick(cat.slug)}
                  >
                    <GameItemIcon
                      iconId={cat.iconUrl?.split('/').pop() || null}
                      altText={cat.title}
                      size="md"
                    />
                  </ForwardedCategoryButton>
                </IngameTooltip>
             ))}
          </CategoryBar>

          {activeCategorySlug && (
            <ItemListContainer>
              <IngameScrollableContainer direction="horizontal" className="h-auto pb-4">
                 <ItemList>
                     {isLoadingItems ? (
                       <div className="text-center w-full p-4 text-xs text-gray-400">Loading...</div>
                     ) : activeItems.length > 0 ? (
                       activeItems.map(item => (
                         <IngameTooltip key={item.id} content={item.title} placement="top">
                           <ItemButton onClick={() => onItemClick(item.id)}>
                             <GameItemIcon
                               iconId={item.iconUrl?.split('/').pop() || null}
                               altText={item.title}
                               rarityColorHex={item.rarityColorHex}
                               size="md"
                             />
                           </ItemButton>
                         </IngameTooltip>
                       ))
                     ) : (
                        <div className="text-center w-full p-4 text-xs text-gray-400">No items found.</div>
                     )}
                 </ItemList>
              </IngameScrollableContainer>
            </ItemListContainer>
          )}
        </>
      )}
    </IngameBorderedDiv>
  );
};

// Wrap with DndProvider
const HeatmapOverlayPanelWrapper: React.FC<Props> = (props) => (
  <DndProvider backend={HTML5Backend}>
    <HeatmapOverlayPanel {...props} />
    {/* Render the custom drag layer */}
    <CustomDragLayer />
  </DndProvider>
);

export default observer(HeatmapOverlayPanelWrapper); 