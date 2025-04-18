import {
  faSearch,
  faCaretDown,
  faCaretRight
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { observer } from "mobx-react";
import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import styled from "styled-components";
import Flex from "~/components/Flex";
import Input from "~/components/Input";
import IngameCheckbox from '~/components/EthyrialStyle/IngameCheckbox';
import IngameTooltip from '~/components/EthyrialStyle/IngameTooltip';
import BaseOverlay, { DefaultPosition } from './BaseOverlay';
import { Coordinate } from "ol/coordinate";

// Constants
const LOCAL_STORAGE_KEY = "map-overlay-panel-position";
const DRAG_TYPE = "map-overlay";

// Helper function to format category titles
const formatCategoryTitle = (title: string): string => {
  if (!title) return '';

  // Handle specific abbreviations first
  if (title.toUpperCase() === 'POI') return 'POI';
  if (title.toUpperCase() === 'NPC') return 'NPC';

  // General formatting for others
  return title
    .toLowerCase() // Convert to lowercase first
    .replace(/_/g, ' ') // Replace underscores with spaces
    .replace(/\b\w/g, char => char.toUpperCase()); // Capitalize first letter of each word
};

// Helper function to get the first letter of a category
const getCategoryLetter = (title: string): string => {
  if (!title) return '?';
  
  // Handle specific cases
  if (title.toUpperCase() === 'POI') return 'P';
  if (title.toUpperCase() === 'NPC') return 'N';
  
  // Get first letter for other categories
  return title.charAt(0).toUpperCase();
};

// Color mapping for different categories
const categoryColors: Record<string, string> = {
  ORE: '#c0c0c0',     // Silver
  HERB: '#7CFC00',    // Bright green
  SKIN: '#D2B48C',    // Tan
  TREE: '#228B22',    // Forest green
  CLOTH: '#FFD700',   // Gold
  ENEMY: '#FF4500',   // Red-orange
  POI: '#1E90FF',     // Dodger blue
  NPC: '#9932CC',     // Purple
  TOWN: '#8B4513',    // Brown
  DUNGEON: '#800000', // Maroon
  BANK: '#FFD700',    // Gold
  TELEPORT: '#00BFFF', // Deep sky blue
  DAILY_QUEST: '#FF69B4', // Hot pink
  RAID: '#8B0000',    // Dark red
  WORLD_BOSS: '#FF0000', // Bright red
  OTHER: '#808080',   // Gray
};

// Update Category type to include children and parentId
type Category = {
  id: string;
  title: string;
  iconUrl: string | null;
  parentId: string | null;
  children: Category[];
};

// Interface from MapScene was moved here for clarity
interface ApiCategoryData {
  id: string;
  slug: string;
  title: string;
  iconUrl: string | null;
  parentId: string | null;
  children: ApiCategoryData[];
  isLabel: boolean;
}

// Props interface matching MapScene
interface Props {
  labelCategories: ApiCategoryData[];
  markerCategories: ApiCategoryData[];
  visibleCategoryIds: Record<string, boolean>;
  onVisibilityChange: (visibilityState: Record<string, boolean>) => void;
  onSearch: (query: string) => void;
}

// Style for indentation
const CategoryItem = styled.li<{ $isChild: boolean }>`
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
  padding-left: ${(props) => (props.$isChild ? "10px" : "0")};

  label {
    flex-grow: 1;
    margin-left: 8px;
    cursor: pointer;
  }

  img {
    width: 16px;
    height: 16px;
    opacity: 0.7;
  }

  input[type="checkbox"] {
    cursor: pointer;
  }
`;

const CategoryList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 16px 0 0 0;
`;

const ParentCategoryToggle = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 5px 0 0;
  color: inherit;
  opacity: 0.7;
`;

// Styled category letter marker
const CategoryMarker = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: ${props => props.$color || '#808080'};
  color: #ffffff;
  font-weight: bold;
  font-size: 12px;
  margin-right: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.4);
`;

// Add a styled separator/header for divisions
const DivisionHeader = styled.div`
  font-weight: 600;
  font-size: 0.9em;
  margin-top: 16px;
  margin-bottom: 8px;
  color: ${(props) => props.theme.textSecondary};
  text-transform: uppercase;
  // Add flex for alignment
  display: flex;
  justify-content: space-between; // Align items (text and checkbox)
  align-items: center;
`;

const MapOverlayPanel: React.FC<Props> = ({
  labelCategories,
  markerCategories,
  visibleCategoryIds,
  onVisibilityChange,
  onSearch,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  // Calculate separate toggle states
  const areAllLabelsVisible = useMemo(() =>
    labelCategories.every(cat => visibleCategoryIds[cat.id] ?? true)
  , [labelCategories, visibleCategoryIds]);

  const areAllMarkersVisible = useMemo(() => {
    const checkVisibility = (cats: ApiCategoryData[]): boolean =>
        cats.every(cat => (visibleCategoryIds[cat.id] ?? true) && checkVisibility(cat.children || []));
    return checkVisibility(markerCategories);
  }, [markerCategories, visibleCategoryIds]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    onSearch(event.target.value);
  };

  // Init visibility AND expansion state
  useEffect(() => {
    const initialExp: Record<string, boolean> = {};
    const processCats = (cats: ApiCategoryData[]) => {
        cats.forEach(cat => {
            initialExp[cat.id] = false; // Start all collapsed
            if (cat.children) {
                processCats(cat.children);
            }
        });
    };
    processCats([...labelCategories, ...markerCategories]);
    setExpandedParents(initialExp);
  }, [labelCategories, markerCategories]); // Depend on categories

  // --- Visibility Handlers --- //
  const handleCombinedVisibilityChange = (updates: Record<string, boolean>) => {
      const newState = { ...visibleCategoryIds, ...updates };
      onVisibilityChange(newState);
  };
  
  // Toggle All handlers update visibility only
  const handleToggleAllLabels = (event: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = event.target.checked;
    const updates: Record<string, boolean> = {};
    labelCategories.forEach(cat => { updates[cat.id] = isChecked; });
    handleCombinedVisibilityChange(updates);
  };
  
  const handleToggleAllMarkers = (event: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = event.target.checked;
    const updates: Record<string, boolean> = {};
    const applyToChildren = (category: ApiCategoryData) => {
        updates[category.id] = isChecked;
        category.children?.forEach(applyToChildren);
    };
    markerCategories.forEach(applyToChildren);
    handleCombinedVisibilityChange(updates);
  };
  
  // Category change updates visibility only
  const handleCategoryChange = (categoryId: string, checked: boolean) => {
      const updates: Record<string, boolean> = { [categoryId]: checked };
      // Find the category (either label or marker)
      const allCats = [...labelCategories, ...markerCategories]; // Simple merge for finding
      const findCategory = (cats: ApiCategoryData[], id: string): ApiCategoryData | undefined => {
          for (const cat of cats) {
              if (cat.id === id) return cat;
              const foundInChildren = cat.children ? findCategory(cat.children, id) : undefined;
              if (foundInChildren) return foundInChildren;
          }
          return undefined;
      };
      const currentCat = findCategory(allCats, categoryId);

      if (currentCat) {
          // Apply to children (only if it's a marker category - labels don't have children here)
          if (!currentCat.isLabel) {
              const applyToChildren = (category: ApiCategoryData) => {
                  category.children?.forEach(child => {
                      updates[child.id] = checked;
                      applyToChildren(child);
                  });
              };
              applyToChildren(currentCat);
          }

          // Apply to parents if checking a child
          if (checked && currentCat.parentId) {
              let parent = findCategory(allCats, currentCat.parentId);
              while (parent) {
                  updates[parent.id] = true;
                  parent = parent.parentId ? findCategory(allCats, parent.parentId) : undefined;
              }
          }
      }
      handleCombinedVisibilityChange(updates);
  };

  // --- Expansion Handler --- //
  const toggleParent = (parentId: string) => {
    setExpandedParents((prev) => ({ ...prev, [parentId]: !prev[parentId] }));
  };

 // renderCategories function
 const renderCategories = (cats: ApiCategoryData[], isChild = false) => {
    return cats.map((category) => {
      const isParent = category.children && category.children.length > 0;
      // Use dedicated state for expansion
      const isExpanded = expandedParents[category.id] ?? false;
      const categoryName = category.title.toUpperCase();
      const categoryLetter = getCategoryLetter(category.title);
      const categoryColor = categoryColors[categoryName] || '#808080';

      return (
        <React.Fragment key={category.id}>
          <CategoryItem $isChild={isChild}>
            <div className="flex items-center justify-center w-5 h-5 mr-1">
              {isParent && (
                // Toggle uses dedicated handler now
                <ParentCategoryToggle onClick={() => toggleParent(category.id)} >
                  <FontAwesomeIcon icon={isExpanded ? faCaretDown : faCaretRight} />
                </ParentCategoryToggle>
              )}
            </div>
            <CategoryMarker $color={categoryColor}>
              {categoryLetter}
            </CategoryMarker>
            <IngameCheckbox
                id={`cat-${category.id}`}
                checked={visibleCategoryIds[category.id] ?? true} // Checked state from visibility
                onChange={(e) => handleCategoryChange(category.id, e.target.checked)} // Change affects visibility
                label={formatCategoryTitle(category.title)}
                labelClassName="ml-2 flex-grow cursor-pointer text-gray-300"
                className="flex-grow"
            />
          </CategoryItem>
          {/* Children rendered based on *expansion* state */} 
          {isParent && isExpanded && (
            <CategoryList>
              {renderCategories(category.children, true)}
            </CategoryList>
          )}
        </React.Fragment>
      );
    });
 };

  return (
    <BaseOverlay
      title="Labels & Markers"
      collapsedTitle="L&M"
      localStorageKey={LOCAL_STORAGE_KEY}
      defaultPosition={{ position: 'top-left' }}
      zIndex={20}
      dragType={DRAG_TYPE}
      className="w-[300px] min-w-[300px]"
      id="map-overlay"
    >
      <Input
        type="search"
        placeholder="Search markers/labels..."
        value={searchTerm}
        onChange={handleSearchChange}
        icon={<FontAwesomeIcon icon={faSearch} size="sm" />}
        className="w-full mb-2 pl-8 pr-2 py-1"
      />

      {/* --- Labels Section --- */}
      <DivisionHeader>
         <span>Labels</span>
         <IngameTooltip content="Toggle All Labels" placement="top">
          <IngameCheckbox
            id="toggle-all-labels"
            checked={areAllLabelsVisible}
            onChange={handleToggleAllLabels}
          />
        </IngameTooltip>
      </DivisionHeader>
      <CategoryList>
        {labelCategories.map(labelCat => (
            <CategoryItem key={labelCat.id} $isChild={false}>
                <div className="w-5 h-5 mr-1"></div>
                <CategoryMarker $color={'#1E90FF'}>
                  {getCategoryLetter(labelCat.title)}
                </CategoryMarker>
                <IngameCheckbox
                    id={`cat-${labelCat.id}`} // Use category ID
                    checked={visibleCategoryIds[labelCat.id] ?? true} // Use combined state
                    onChange={(e) => handleCategoryChange(labelCat.id, e.target.checked)} // Use combined handler
                    label={labelCat.title}
                    labelClassName="ml-2 flex-grow cursor-pointer text-gray-300"
                    className="flex-grow"
                />
            </CategoryItem>
        ))}
      </CategoryList>

      {/* --- Markers Section --- */}
      <DivisionHeader>
        <span>Markers</span>
        <IngameTooltip content="Toggle All Markers" placement="top">
          <IngameCheckbox
            id="toggle-all-markers"
            checked={areAllMarkersVisible}
            onChange={handleToggleAllMarkers}
          />
        </IngameTooltip>
      </DivisionHeader>
      <CategoryList>{renderCategories(markerCategories)}</CategoryList>
    </BaseOverlay>
  );
};

export default observer(MapOverlayPanel);
