import * as React from "react";
import { useState, useCallback } from "react";
import styled from "styled-components";
import { observer } from "mobx-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCompressAlt, // For Collapse
  faExpandAlt,   // For Expand
  faSearch,      // For Search Input
  faLeaf,        // Example Herb
  faGem,         // Example Ore
  faTree,        // Example Tree
  faSkullCrossbones, // Example Enemy
  faMapMarkerAlt, // Example POI/Other
  faQuestionCircle, // Default/Other
  faCity,        // Example Town
  faLandmark,    // Example Bank
  faCrosshairs,  // Example NPC
  faScroll,      // Example Quest
  faDragon,      // Example Boss/Raid
  faPaw,          // Updated
  faStreetView,  // Updated
  faChessRook,   // Updated
  faUniversity,  // Updated
  faCaretDown,   // Icons for dropdown
  faCaretRight   // Icons for dropdown
} from "@fortawesome/free-solid-svg-icons";
import Input from "~/components/Input";
import Flex from "~/components/Flex";
import Tooltip from "~/components/Tooltip";
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Logger from "~/utils/Logger"; // Import Logger

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
  onCategoryToggle: (categoryId: string, isVisible: boolean, includeChildren: boolean) => void;
  onSearch: (query: string) => void;
};

// Add ItemType for react-dnd
const ItemTypes = {
  PANEL: 'panel',
};

// Update PanelContainer to accept drag ref and styles
const PanelContainer = styled.div<{ $isCollapsed: boolean; $isDragging: boolean }>`
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
  background: ${(props) => props.theme.sidebarBackground};
  color: ${(props) => props.theme.sidebarText};
  border-radius: 8px;
  padding: ${(props) => props.$isCollapsed ? '8px' : '16px'};
  box-shadow: rgba(0, 0, 0, 0.15) 0px 3px 12px;
  transition: all 200ms ease-in-out;
  max-height: calc(100vh - 40px); // Prevent overflow
  overflow-y: auto;
  width: ${(props) => props.$isCollapsed ? 'auto' : '300px'};
  opacity: ${(props) => (props.$isDragging ? 0.5 : 1)};
  cursor: ${(props) => (props.$isDragging ? 'grabbing' : 'grab')};
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
  padding-left: ${(props) => (props.$isChild ? '20px' : '0')};

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

const MapOverlayPanel: React.FC<Props> = ({ categories, onCategoryToggle, onSearch }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleCategories, setVisibleCategories] = useState<Record<string, boolean>>({});
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({}); // State for parent dropdowns
  const panelRef = React.useRef<HTMLDivElement>(null); // Ref for the draggable element

  // Initialize visibility state
  React.useEffect(() => {
    // Log received categories prop structure
    Logger.debug("misc", "[MapOverlayPanel] Received categories:", categories);
    const initial: Record<string, boolean> = {};
    const initializeVisibility = (cats: Category[]) => {
      cats.forEach(cat => { 
        initial[cat.id] = true;
        if (cat.children) initializeVisibility(cat.children);
      });
    };
    initializeVisibility(categories);
    setVisibleCategories(initial);
  }, [categories]);

  // Drag and Drop Hooks
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.PANEL,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
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

  // Handle toggling for parent and children
  const handleCategoryChange = (categoryId: string, checked: boolean) => {
    setVisibleCategories(prev => {
      const newState = { ...prev, [categoryId]: checked };
      // If unchecking a parent, uncheck children
      if (!checked) {
        const findChildrenRecursive = (catId: string, allCats: Category[]): string[] => {
           let childIds: string[] = [];
           const parentCat = allCats.find(c => c.id === catId) || allCats.flatMap(c => c.children).find(c => c.id === catId);
           parentCat?.children?.forEach(child => {
               childIds.push(child.id);
               childIds = childIds.concat(findChildrenRecursive(child.id, categories)); // Use original categories
           });
           return childIds;
        }
        const childrenIds = findChildrenRecursive(categoryId, categories);
        childrenIds.forEach(id => newState[id] = false);
      }
      // If checking a child, ensure parent is checked
      else {
          const findParentRecursive = (catId: string, allCats: Category[]): Category | null => {
             for (const cat of allCats) {
                 if (cat.children?.some(child => child.id === catId)) return cat;
                 const parent = findParentRecursive(catId, cat.children || []);
                 if (parent) return parent;
             }
             return null;
          }
          let currentCatId = categoryId;
          let parent = findParentRecursive(currentCatId, categories);
          while(parent) {
              newState[parent.id] = true;
              currentCatId = parent.id;
              parent = findParentRecursive(currentCatId, categories);
          }
      }
      return newState;
    });
    // Notify parent immediately (filtering happens in MapScene based on visibleCategories)
    onCategoryToggle(categoryId, checked, true); 
  };

  const toggleParent = (parentId: string) => {
     setExpandedParents(prev => ({ ...prev, [parentId]: !prev[parentId] }));
  };

  // Recursive function to render categories
  const renderCategories = (cats: Category[], isChild = false) => {
    return cats.map((category) => {
      const isParent = category.children && category.children.length > 0;
      const isExpanded = !!expandedParents[category.id];

      return (
        <React.Fragment key={category.id}>
          <CategoryItem $isChild={isChild}>
            {isParent && (
              <ParentCategoryToggle onClick={() => toggleParent(category.id)}>
                <FontAwesomeIcon icon={isExpanded ? faCaretDown : faCaretRight} fixedWidth />
              </ParentCategoryToggle>
            )}
            {!isParent && <span style={{ width: 19, display: 'inline-block' }}></span>} {/* Spacer */} 
            <FontAwesomeIcon 
                className="fa-icon" 
                icon={categoryIconMap[category.title] || faQuestionCircle} 
                fixedWidth 
            />
            <input 
              type="checkbox" 
              id={`cat-${category.id}`}
              checked={visibleCategories[category.id] ?? true}
              onChange={(e) => handleCategoryChange(category.id, e.target.checked)}
            />
            <label htmlFor={`cat-${category.id}`}>{category.title}</label>
          </CategoryItem>
          {isParent && isExpanded && (
            <CategoryList style={{ marginLeft: 10, borderLeft: '1px solid #eee' }}>
              {renderCategories(category.children, true)}
            </CategoryList>
          )}
        </React.Fragment>
      );
    });
  };

  return (
    // Attach ref to the container
    <PanelContainer ref={panelRef} $isCollapsed={isCollapsed} $isDragging={isDragging}>
      <PanelHeader justify="space-between" align="center">
        {!isCollapsed && <span>Filters & Search</span>}
        <Tooltip content={isCollapsed ? "Expand Panel" : "Collapse Panel"} placement="right">
          <CollapseButton onClick={handleToggleCollapse} aria-label={isCollapsed ? "Expand Panel" : "Collapse Panel"}>
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

          <CategoryList>
            {renderCategories(categories)} 
          </CategoryList>
        </>
      )}
    </PanelContainer>
  );
};

// Wrap with DndProvider
const MapOverlayPanelWrapper: React.FC<Props> = (props) => (
  <DndProvider backend={HTML5Backend}>
    <MapOverlayPanel {...props} />
  </DndProvider>
);

export default observer(MapOverlayPanelWrapper); 