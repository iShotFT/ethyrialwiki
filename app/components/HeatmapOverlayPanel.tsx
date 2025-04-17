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
  rarityItemBackgroundColorHex?: string | null;
}

type Props = {
  categories: HeatmapCategory[];
  itemsByCategory: Record<string, HeatmapItem[]>; // { categorySlug: [item1, item2, ...] }
  activeCategorySlug: string | null; // Slug of the currently selected category
  isLoadingItems: boolean; // Loading state for items
  onCategoryClick: (categorySlug: string) => void; // Callback when category is clicked
  onItemClick: (itemId: string) => void; // Callback when an item is clicked
  selectedItemId: string | null; // Currently selected item ID
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
  border-bottom: 1px solid #4e443a;
  margin-bottom: 12px;
  padding-bottom: 2px;
  width: 100%;
  overflow-x: auto;
  scrollbar-width: thin;
  &::-webkit-scrollbar {
    height: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: rgba(255, 213, 174, 0.3);
    border-radius: 4px;
  }
`;

// Revert CategoryButton to standard styled button
const CategoryButton = styled.button<{$isActive: boolean}>`
  background: none;
  border: none;
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
  padding: 6px 12px;
  margin: 0 1px;
  margin-bottom: -1px; /* Overlap the border */
  cursor: pointer;
  color: ${props => props.$isActive ? '#ffd5ae' : '#ccc'};
  font-weight: ${props => props.$isActive ? 600 : 400};
  font-size: 14px;
  transition: all 150ms ease-in-out;
  position: relative;
  white-space: nowrap;
  
  ${props => props.$isActive && `
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid #4e443a;
    border-bottom: 1px solid #38322c; /* Match panel background */
  `}

  &:hover {
    color: #ffd5ae;
    background: ${props => props.$isActive ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)'};
  }
`;

// Wrap the styled component with forwardRef separately
const ForwardedCategoryButton = forwardRef<HTMLButtonElement, React.ComponentProps<typeof CategoryButton>>((props, ref) => (
    <CategoryButton ref={ref} {...props} />
));

// Horizontal ItemList - Remove direct overflow styling
const ItemListContainer = styled.div`
  padding: 8px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 0 6px 6px 6px;
  position: relative; /* Add position relative for absolute positioned scrollbar */
  width: 100%; /* Ensure full width */
`;

const ItemList = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: nowrap; /* Prevent wrapping */
  width: max-content; /* Allow content to determine width */
`;

const ItemButton = styled.button<{ $isSelected?: boolean }>`
  // Use Ingame style? For now, simpler button
  background: ${props => props.$isSelected 
    ? 'rgba(255, 213, 174, 0.15)' 
    : 'rgba(255, 255, 255, 0.05)'
  };
  border: 1px solid ${props => props.$isSelected 
    ? 'rgba(255, 213, 174, 0.4)' 
    : 'rgba(255, 255, 255, 0.1)'
  };
  border-radius: 6px; // Increased from 4px
  padding: 6px; // Increased from 4px
  cursor: pointer;
  transition: all 150ms ease-in-out;
  flex-shrink: 0; // Prevent buttons from shrinking
  position: relative; // For the tier badge positioning
  outline: ${props => props.$isSelected ? '2px solid rgba(255, 213, 174, 0.3)' : 'none'};
  outline-offset: 2px;

  &:hover {
    background: ${props => props.$isSelected 
      ? 'rgba(255, 213, 174, 0.2)' 
      : 'rgba(255, 255, 255, 0.1)'
    };
  }

  img {
    width: 45px; // Adjusted to account for sizeMultiplier of 1.4 (32px * 1.4 ≈ 45px)
    height: 45px; // Adjusted to account for sizeMultiplier of 1.4
    display: block;
  }
`;

// Styled component for the tier badge
const TierBadge = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.65);
  color: #ffd5ae;
  font-size: 12px; // Increased from 9px
  font-weight: bold;
  padding: 0 4px; // Increased from 3px
  border-bottom-left-radius: 5px; // Increased from 4px
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.5);
  border-left: 1px solid rgba(255, 213, 174, 0.3);
  border-bottom: 1px solid rgba(255, 213, 174, 0.3);
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

// Custom tooltip component for items with tier display
interface ItemTooltipProps {
  children: JSX.Element;
  title: string;
  tier: number;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

const ItemTooltip: React.FC<ItemTooltipProps> = ({ children, title, tier, placement = 'top' }) => {
  const content = (
    <div className="flex items-center">
      <span className="inline-block px-2 py-0.5 mr-2 text-[10px] font-bold bg-black/40 rounded border border-[#ffd5ae]/40 text-[#ffd5ae]">
        T{tier}
      </span>
      <span className="text-sm">
        {title}
      </span>
    </div>
  );
  
  return (
    <IngameTooltip content={content} placement={placement} className="text-base">
      {children}
    </IngameTooltip>
  );
};

const HeatmapOverlayPanel: React.FC<Props> = ({
  categories,
  itemsByCategory,
  activeCategorySlug,
  isLoadingItems,
  onCategoryClick,
  onItemClick,
  selectedItemId,
}) => {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const categoryButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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

  // Handle mouse wheel horizontal scrolling
  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (scrollContainerRef.current) {
      event.preventDefault();
      // Adjust scroll speed as needed
      scrollContainerRef.current.scrollLeft += event.deltaY;
    }
  };

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

  // Handle item click with toggle functionality
  const handleItemClick = (itemId: string) => {
    // If item is already selected, toggle it off by passing null
    if (selectedItemId === itemId) {
      onItemClick(""); // Pass empty string to deselect
    } else {
      // Otherwise, select the item
      onItemClick(itemId);
    }
  };

  const handleToggleCollapse = () => setIsCollapsed(!isCollapsed);

  // Get items for the *currently active* category from props
  const activeItems = activeCategorySlug ? itemsByCategory[activeCategorySlug] || [] : [];

  // No need to sort items - they're already sorted by the backend
  // if (activeItems.length > 0) {
  //     activeItems.sort((a, b) => a.tier - b.tier);
  // }

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
                <ForwardedCategoryButton
                  key={cat.id}
                  ref={el => { categoryButtonRefs.current[cat.slug] = el; }}
                  $isActive={activeCategorySlug === cat.slug}
                  onClick={() => handleCategoryClick(cat.slug)}
                >
                  {cat.title}
                </ForwardedCategoryButton>
             ))}
          </CategoryBar>

          {activeCategorySlug && (
            <ItemListContainer>
              <IngameScrollableContainer 
                direction="horizontal" 
                className="h-auto pb-4 w-full"
                ref={scrollContainerRef}
              >
                <ItemList>
                  {isLoadingItems ? (
                    <div className="text-center w-full p-4 text-xs text-gray-400">Loading...</div>
                  ) : activeItems.length > 0 ? (
                    activeItems.map(item => (
                      <ItemTooltip key={item.id} title={item.title} tier={item.tier}>
                        <ItemButton
                          $isSelected={selectedItemId === item.id}
                          onClick={() => handleItemClick(item.id)}
                        >
                          <GameItemIcon
                            iconId={item.iconUrl?.split('/').pop() || null}
                            altText={item.title}
                            rarityColorHex={item.rarityColorHex}
                            rarityItemBackgroundColorHex={item.rarityItemBackgroundColorHex}
                            size="md"
                            sizeMultiplier={1.4}
                            isSelected={selectedItemId === item.id}
                          />
                          <TierBadge>T{item.tier}</TierBadge>
                        </ItemButton>
                      </ItemTooltip>
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