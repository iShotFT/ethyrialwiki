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
  faCity, // Example Town
  faLandmark, // Example Bank
  faCrosshairs, // Example NPC
  faScroll, // Example Quest
  faDragon, // Example Boss/Raid
  faPaw, // Updated
  faStreetView, // Updated
  faChessRook, // Updated
  faUniversity, // Updated
  faCaretDown, // Icons for dropdown
  faCaretRight, // Icons for dropdown
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { observer } from "mobx-react";
import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import { DndProvider, useDrag, useDrop, useDragLayer } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import styled, { CSSProperties } from "styled-components";
import Flex from "~/components/Flex";
import Input from "~/components/Input";
import Tooltip from "~/components/Tooltip";
import Logger from "~/utils/Logger"; // Import Logger

// Define Coordinate type locally
type Coordinate = { x: number; y: number };

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

type Props = {
  categories: Category[]; // Now includes nested children
  onVisibilityChange: (visibilityState: Record<string, boolean>) => void;
  onSearch: (query: string) => void;
};

// Add ItemType for react-dnd
const ItemTypes = {
  PANEL: "panel",
};

// Update PanelContainer to accept drag ref and styles
const PanelContainer = styled.div<{
  $isCollapsed: boolean;
  $isDragging: boolean;
  // Add style props for top/left
  style: React.CSSProperties;
}>`
  position: absolute;
  // top: 16px; // Removed fixed value
  // left: 16px; // Removed fixed value
  z-index: 10;
  background: ${(props) => props.theme.sidebarBackground};
  color: ${(props) => props.theme.sidebarText};
  border-radius: 8px;
  padding: ${(props) => (props.$isCollapsed ? "8px" : "16px")};
  box-shadow: rgba(0, 0, 0, 0.15) 0px 3px 12px;
  max-height: calc(100vh - 40px); // Prevent overflow
  overflow-y: auto;
  width: ${(props) => (props.$isCollapsed ? "auto" : "300px")};
  // Hide original element while dragging, show preview instead
  opacity: ${(props) => (props.$isDragging ? 0 : 1)};
  cursor: ${(props) => (props.$isDragging ? "grabbing" : "grab")};
  user-select: none;
`;

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

const DragPreview = styled.div`
  position: relative; // Needed for pseudo-element positioning
  overflow: hidden; // Ensure pseudo-element respects border-radius
  border-radius: 8px;
  box-shadow: rgba(0, 0, 0, 0.25) 0px 5px 15px;
  border: 1px dashed ${(props) => props.theme.sidebarText}; // Opaque border
  box-sizing: border-box;

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
  const { width, height } = item || {}; // Get width/height from item

  if (!isDragging || itemType !== ItemTypes.PANEL) {
    return null;
  }

  return (
    <DragLayerContainer>
      {/* Pass dimensions to getItemStyles */}
      <DragPreview style={getItemStyles(initialOffset, currentOffset, width, height)} />
    </DragLayerContainer>
  );
};
// ------------------------- //

const MapOverlayPanel: React.FC<Props> = ({
  categories,
  onVisibilityChange,
  onSearch,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleCategories, setVisibleCategories] = useState<
    Record<string, boolean>
  >({});
  const [expandedParents, setExpandedParents] = useState<
    Record<string, boolean>
  >({}); // State for parent dropdowns
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

  // Calculate if all categories are currently visible
  const areAllVisible = React.useMemo(() =>
    Object.values(visibleCategories).every(v => v)
  , [visibleCategories]);

  // Effect to call onVisibilityChange *after* state update
  useEffect(() => {
    // Check if visibleCategories is not empty to avoid initial call
    if (Object.keys(visibleCategories).length > 0) {
      onVisibilityChange(visibleCategories);
    }
  }, [visibleCategories, onVisibilityChange]);

  // Initialize visibility state
  React.useEffect(() => {
    // Log received categories prop structure
    Logger.debug("misc", "[MapOverlayPanel] Received categories:", categories);
    const initial: Record<string, boolean> = {};
    const initializeVisibility = (cats: Category[]) => {
      cats.forEach((cat) => {
        initial[cat.id] = true;
        if (cat.children) {
          initializeVisibility(cat.children);
        }
      });
    };
    initializeVisibility(categories);
    setVisibleCategories(initial);
  }, [categories]);

  // Drag and Drop Hooks
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.PANEL,
    // Capture and pass dimensions in the item factory function
    item: () => ({
        width: panelRef.current?.offsetWidth,
        height: panelRef.current?.offsetHeight,
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

  // Handler to toggle all categories on/off
  const handleToggleAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = event.target.checked;
    setVisibleCategories(prev => {
      const newState: Record<string, boolean> = {};
      for (const key in prev) {
        newState[key] = isChecked;
      }
      // onVisibilityChange will be called by the useEffect hook
      return newState;
    });
  };

  // Handle toggling for parent and children
  const handleCategoryChange = (categoryId: string, checked: boolean) => {
    let newState: Record<string, boolean> = {}; // Declare newState outside

    setVisibleCategories((prev) => {
      newState = { ...prev, [categoryId]: checked };
      // Helper to find children recursively
      const findChildrenRecursive = (
        catId: string,
        allCats: Category[]
      ): string[] => {
        let childIds: string[] = [];
        const parentCat =
          allCats.find((c) => c.id === catId) ||
          allCats.flatMap((c) => c.children || []).find((c) => c.id === catId);
        parentCat?.children?.forEach((child) => {
          childIds.push(child.id);
          childIds = childIds.concat(
            findChildrenRecursive(child.id, categories) // Use original categories
          );
        });
        return childIds;
      };

      // Apply state to children based on parent's new state
      const childrenIds = findChildrenRecursive(categoryId, categories);
      childrenIds.forEach((id) => (newState[id] = checked)); // Update children state

      // If checking a child, ensure parent is checked (only if checked is true)
      if (checked) {
        const findParentRecursive = (
          catId: string,
          allCats: Category[]
        ): Category | null => {
          for (const cat of allCats) {
            if (cat.children?.some((child) => child.id === catId)) {
              return cat;
            }
            const parent = findParentRecursive(catId, cat.children || []);
            if (parent) {
              return parent;
            }
          }
          return null;
        };
        let currentCatId = categoryId;
        let parent = findParentRecursive(currentCatId, categories);
        while (parent) {
          newState[parent.id] = true;
          currentCatId = parent.id;
          parent = findParentRecursive(currentCatId, categories);
        }
      }
      return newState;
    });
  };

  const toggleParent = (parentId: string) => {
    setExpandedParents((prev) => ({ ...prev, [parentId]: !prev[parentId] }));
  };

  // Recursive function to render categories
  const renderCategories = (cats: Category[], isChild = false) =>
    cats.map((category) => {
      const isParent = category.children && category.children.length > 0;
      const isExpanded = !!expandedParents[category.id];

      return (
        <React.Fragment key={category.id}>
          <CategoryItem $isChild={isChild}>
            {isParent && (
              <ParentCategoryToggle onClick={() => toggleParent(category.id)}>
                <FontAwesomeIcon
                  icon={isExpanded ? faCaretDown : faCaretRight}
                  fixedWidth
                />
              </ParentCategoryToggle>
            )}
            {!isParent && (
              <span style={{ width: 19, display: "inline-block" }} />
            )}{" "}
            {/* Spacer */}
            <FontAwesomeIcon
              className="fa-icon"
              icon={categoryIconMap[category.title] || faQuestionCircle}
              fixedWidth
            />
            <input
              type="checkbox"
              id={`cat-${category.id}`}
              checked={visibleCategories[category.id] ?? true}
              onChange={(e) =>
                handleCategoryChange(category.id, e.target.checked)
              }
            />
            <label htmlFor={`cat-${category.id}`}>{category.title}</label>
          </CategoryItem>
          {isParent && isExpanded && (
            <CategoryList>
              {renderCategories(category.children, true)}
            </CategoryList>
          )}
        </React.Fragment>
      );
    });

  return (
    // Attach ref to the container
    <PanelContainer
      ref={panelRef}
      $isCollapsed={isCollapsed}
      $isDragging={isDragging}
      // Apply dynamic style for position
      style={{ top: `${position.y}px`, left: `${position.x}px` }}
    >
      <PanelHeader justify="space-between" align="center">
        {!isCollapsed && <span>Filters & Search</span>}
        <Tooltip
          content={isCollapsed ? "Expand Panel" : "Collapse Panel"}
          placement="right"
        >
          <CollapseButton
            onClick={handleToggleCollapse}
            aria-label={isCollapsed ? "Expand Panel" : "Collapse Panel"}
          >
            <FontAwesomeIcon icon={isCollapsed ? faExpandAlt : faCompressAlt} />
          </CollapseButton>
        </Tooltip>
      </PanelHeader>

      {!isCollapsed && (
        <>
          <Input
            type="search"
            placeholder="Search markers..."
            value={searchTerm}
            onChange={handleSearchChange}
            icon={<FontAwesomeIcon icon={faSearch} size="sm" />}
            short
          />

          <ToggleAllContainer align="center">
            <input
              type="checkbox"
              id="toggle-all-categories"
              checked={areAllVisible}
              onChange={handleToggleAll}
              style={{ marginRight: '8px', cursor: 'pointer' }}
            />
            <label htmlFor="toggle-all-categories" style={{ cursor: 'pointer' }}>
              Toggle All
            </label>
          </ToggleAllContainer>

          <CategoryList>{renderCategories(categories)}</CategoryList>
        </>
      )}
    </PanelContainer>
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
