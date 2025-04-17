import React, { useState, useRef } from 'react';
import { observer } from 'mobx-react';
import styled from 'styled-components';
import { forwardRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Flex from '~/components/Flex';
import { cn } from '~/utils/twMerge';
import GameItemIcon from '~/components/EthyrialStyle/GameItemIcon';
import IngameScrollableContainer from '~/components/EthyrialStyle/IngameScrollableContainer';
import IngameTooltip from '~/components/EthyrialStyle/IngameTooltip';
import BaseOverlay, { DefaultPosition } from './BaseOverlay';

// Constants
const LOCAL_STORAGE_KEY = "heatmap-overlay-position";
const DRAG_TYPE = "heatmap-overlay"; 

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

// --- Styled Components ---

// CategoryBar for tabs
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

// Main component
const HeatmapOverlayPanel: React.FC<Props> = ({
  categories,
  itemsByCategory,
  activeCategorySlug,
  isLoadingItems,
  onCategoryClick,
  onItemClick,
  selectedItemId,
}) => {
  const categoryButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeButtonLeft, setActiveButtonLeft] = useState<number | null>(null);

  // Call the prop handler when category is clicked
  const handleCategoryClick = (slug: string) => {
    onCategoryClick(slug);
  };

  // Handle item click with toggle functionality
  const handleItemClick = (itemId: string) => {
    // If item is already selected, toggle it off by passing empty string
    if (selectedItemId === itemId) {
      onItemClick(""); // Pass empty string to deselect
    } else {
      // Otherwise, select the item
      onItemClick(itemId);
    }
  };

  // Get items for the *currently active* category from props
  const activeItems = activeCategorySlug ? itemsByCategory[activeCategorySlug] || [] : [];

  return (
    <BaseOverlay
      title="Heatmaps"
      collapsedTitle="H"
      localStorageKey={LOCAL_STORAGE_KEY}
      defaultPosition={{ position: 'top-right' }}
      zIndex={10}
      dragType={DRAG_TYPE}
      className="max-w-[450px] min-w-[300px]"
    >
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
    </BaseOverlay>
  );
};

export default observer(HeatmapOverlayPanel); 