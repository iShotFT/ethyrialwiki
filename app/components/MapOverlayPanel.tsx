import {
  faCompressAlt, // For Collapse
  faExpandAlt, // For Expand
  faSearch, // For Search Input
  faLeaf, // Example Herb
  faGem, // Example Ore
  faTree, // Example Tree
  faSkullCrossbones, // Example Enemy
  faMapMarkerAlt, // Example POI/Other
  faQuestionCircle, // Default/Other
  faCity, // Example Bank
  faCrosshairs, // Example NPC
  faScroll, // Example Quest
  faDragon, // Example Boss/Raid
  faPaw, // Updated
  faStreetView, // Updated
  faChessRook, // Updated
  faUniversity, // Updated
  faCaretDown, // Icons for dropdown
  faCaretRight
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { observer } from "mobx-react";
import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { DndProvider, useDrag, useDragLayer } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import styled, { CSSProperties } from "styled-components";
import Flex from "~/components/Flex";
import Input from "~/components/Input";
import Logger from "~/utils/Logger"; // Import Logger
import IngameBorderedDiv from '~/components/EthyrialStyle/IngameBorderedDiv';
import { cn } from "~/utils/twMerge";
import IngameCheckbox from '~/components/EthyrialStyle/IngameCheckbox';
import IngameTooltip from '~/components/EthyrialStyle/IngameTooltip';
// Define Coordinate type locally
type Coordinate = { x: number; y: number };

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

// Local storage key
const LOCAL_STORAGE_KEY = "mapOverlayPanelPosition";

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

// Add ItemType for react-dnd
const ItemTypes = {
  PANEL: "panel",
};

const PanelHeader = styled(Flex)`
  margin-bottom: 12px;
  font-weight: 600;
`;

const CategoryList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 16px 0 0 0;
`;

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

  .fa-icon {
    margin-right: 8px;
    width: 16px; // Ensure icon width consistency
    text-align: center;
    opacity: 0.7;
  }
`;

const ParentCategoryToggle = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 5px 0 0;
  color: inherit;
  opacity: 0.7;
`;

// Update icon map to match EthyrialMapFull
const categoryIconMap: Record<string, any> = {
  ORE: faGem,
  HERB: faLeaf,
  SKIN: faPaw, // Updated
  TREE: faTree,
  CLOTH: faScroll,
  ENEMY: faSkullCrossbones,
  POI: faMapMarkerAlt,
  NPC: faCrosshairs,
  TOWN: faCity,
  OTHER: faQuestionCircle,
  DUNGEON: faChessRook, // Updated
  BANK: faUniversity, // Updated
  TELEPORT: faStreetView, // Updated
  DAILY_QUEST: faScroll,
  RAID: faDragon,
  WORLD_BOSS: faDragon,
};

// Styled button for collapse/expand (using FA icons now)
const CollapseButton = styled.button`
  background: none;
  border: none;
  padding: 4px;
  margin: 0;
  cursor: pointer;
  color: inherit; // Inherit color from panel
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 16px; // Adjust size if needed for FA icons

  &:hover {
    background: ${(props) => props.theme.tooltipBackground};
  }

  svg {
    display: block;
  }
`;

// Style for the Toggle All checkbox
const ToggleAllContainer = styled(Flex)`
  padding-bottom: 10px;
  margin-bottom: 10px;
  border-bottom: 1px solid ${(props) => props.theme.divider};
`;

// --- Custom Drag Layer --- //
const DragLayerContainer = styled.div`
  position: fixed; // Use fixed to position relative to viewport
  pointer-events: none; // Prevent interference with other elements
  z-index: 100; // Ensure it's on top
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
`;

const DragPreview = styled.div<{ $isCollapsed: boolean }>`
  position: relative; // Needed for pseudo-element positioning
  overflow: hidden; // Ensure pseudo-element respects border-radius
  border-radius: 8px;
  box-shadow: rgba(0, 0, 0, 0.25) 0px 5px 15px;
  border: 1px dashed ${(props) => props.theme.sidebarText}; // Opaque border
  box-sizing: border-box;
  width: ${(props) => (props.$isCollapsed ? "auto" : "300px")};

  // Pseudo-element for semi-transparent background
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: ${(props) => props.theme.sidebarBackground};
    opacity: 0.3; // Apply opacity only to background
    border-radius: inherit; // Match parent's border radius
    z-index: -1; // Place behind content/border
  }
`;

function getItemStyles(
  initialOffset: Coordinate | null,
  currentOffset: Coordinate | null,
  // Add width and height parameters
  width: number | null,
  height: number | null
): CSSProperties {
  if (!initialOffset || !currentOffset || width === null || height === null) {
    return { display: 'none' };
  }
  const transform = `translate(${currentOffset.x}px, ${currentOffset.y}px)`;
  return {
    transform,
    WebkitTransform: transform, // Vendor prefix
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
    initialOffset: monitor.getInitialSourceClientOffset(),
    currentOffset: monitor.getSourceClientOffset(),
    isDragging: monitor.isDragging(),
  }));

  // Read dimensions from the dragged item
  const { width, height, isCollapsed } = item || {};

  if (!isDragging || itemType !== ItemTypes.PANEL) {
    return null;
  }

  return (
    <DragLayerContainer>
      <DragPreview $isCollapsed={isCollapsed} style={getItemStyles(initialOffset, currentOffset, width, height)} />
    </DragLayerContainer>
  );
};
// ------------------------- //

// Type for Marker/Label data passed from MapScene
// Remove this duplicate if not needed
/*
interface MarkerData {
  id: string;
  title: string;
}
*/

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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleLabels, setVisibleLabels] = useState<Record<string, boolean>>({});
  const [visibleMarkerCats, setVisibleMarkerCats] = useState<Record<string, boolean>>({});
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

  const panelRef = React.useRef<HTMLDivElement>(null); // Ref for the draggable element

  // State for panel position
  const [position, setPosition] = useState<Coordinate>({
    // Default position
    x: 16,
    y: 16,
  });

  // Load position from local storage on mount
  useEffect(() => {
    const savedPosition = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedPosition) {
      try {
        const parsed = JSON.parse(savedPosition);
        // Basic validation
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
           setPosition(parsed);
        }
      } catch (e) {
        Logger.warn("Failed to parse saved panel position", e);
        localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear invalid data
      }
    }
  }, []);

  // Save position to local storage when it changes
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(position));
  }, [position]);

  // Drag and Drop Hooks
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.PANEL,
    item: () => ({
        width: panelRef.current?.offsetWidth,
        height: panelRef.current?.offsetHeight,
        isCollapsed: isCollapsed,
    }),
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
    // Update position when drag ends
    end: (item, monitor) => {
      const delta = monitor.getDifferenceFromInitialOffset();
      if (delta) {
        setPosition((prevPos: Coordinate) => ({
            x: Math.round(prevPos.x + delta.x),
            y: Math.round(prevPos.y + delta.y),
        }));
      }
    },
  }));

  // Log dragging state
  React.useEffect(() => {
    Logger.debug("misc", `[MapOverlayPanel] isDragging state: ${isDragging}`);
  }, [isDragging]);

  // Attach drag ref to the panel
  drag(panelRef);

  const handleToggleCollapse = () => setIsCollapsed(!isCollapsed);
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    onSearch(event.target.value);
  };

  // Init visibility AND expansion state
  useEffect(() => {
    const initialVis: Record<string, boolean> = {};
    const initialExp: Record<string, boolean> = {};
    const processCats = (cats: ApiCategoryData[]) => {
        cats.forEach(cat => {
            initialVis[cat.id] = true; // Start all visible
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
            <FontAwesomeIcon
              className="fa-icon"
              icon={categoryIconMap[category.title] || faQuestionCircle}
              fixedWidth
            />
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
    <IngameBorderedDiv
      ref={panelRef}
      style={{ 
        top: `${position.y}px`, 
        left: `${position.x}px`,
        opacity: isDragging ? 0 : 1, // Hide original while dragging
      }}
      className={cn(
        'absolute',
        'w-[300px]', // Base width when expanded
        isCollapsed && 'w-auto', // Override width when collapsed
        'min-w-[300px]', // Add min-width
        'z-20' // Add z-index to ensure it's above the map
      )}
    >
      <PanelHeader justify="space-between" align="center">
        <span className="text-[#ffd5ae]">{!isCollapsed ? "Labels & Markers" : "L&M"}</span>
        <IngameTooltip content={isCollapsed ? "Expand Panel" : "Collapse Panel"} placement="left">
          <CollapseButton
            onClick={handleToggleCollapse}
            aria-label={isCollapsed ? "Expand Panel" : "Collapse Panel"}
            className="text-[#ffd5ae]"
          >
            <FontAwesomeIcon icon={isCollapsed ? faExpandAlt : faCompressAlt} />
          </CollapseButton>
        </IngameTooltip>
      </PanelHeader>

      {!isCollapsed && (
        <>
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
            {labelCategories.map(labelCat => ( // Use labelCategories
                <CategoryItem key={labelCat.id} $isChild={false}>
                    <div className="w-5 h-5 mr-1"></div>
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
        </>
      )}
    </IngameBorderedDiv>
  );
};

// Wrap with DndProvider
const MapOverlayPanelWrapper: React.FC<Props> = (props) => (
  <DndProvider backend={HTML5Backend}>
    <MapOverlayPanel {...props} />
    {/* Render the custom drag layer */}
    <CustomDragLayer />
  </DndProvider>
);

export default observer(MapOverlayPanelWrapper);
