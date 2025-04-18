import "react-toastify/dist/ReactToastify.css"; // Add direct import of toast styles

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useDismiss,
  useInteractions,
  FloatingPortal,
} from '@floating-ui/react';
import styled from 'styled-components';
import { cn } from '~/utils/twMerge';
import IngameBorderedDiv from './IngameBorderedDiv';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMapMarkerAlt, faShare, faTimes, faPlus, faCheck, faCopy, faUndoAlt } from '@fortawesome/free-solid-svg-icons';
import { resetAllOverlayPositions } from '../MapOverlays/OverlayRegistry';
import ContextMenuRegistry, { ContextMenuItem } from './ContextMenuRegistry';
import { showSuccessToast, showErrorToast } from '~/utils/toastUtils';

interface IngameContextMenuProps {
  coordX?: number;
  coordY?: number;
  coordZ?: number;
  position: { x: number, y: number };
  onClose: () => void;
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

// Styled menu container
const MenuContainer = styled.div`
  min-width: 215px;
  width: 228px;
  overflow: hidden;
`;

// Style the inner container of the context menu with custom padding
const MenuInnerContainer = styled.div`
  padding: 0;
  overflow: hidden;
  margin: 0;
  
  /* Apply custom padding to the menu content but not to dividers */
  & > div {
    position: relative;
    margin-bottom: 0;
    padding-bottom: 0;
  }
`;

// Add menu title with more compact styling
const MenuTitle = styled.div`
  font-size: 14px;
  color: #ffd5ae;
  font-weight: 600;
  padding: 5px 10px 7px;
  border-bottom: 1px solid #2c2824;
  text-align: center;
  margin-bottom: 2px;
  font-family: 'Asul', sans-serif;
  letter-spacing: 0.5px;
`;

// Styled menu item - make more compact
const MenuItem = styled.button`
  display: flex;
  align-items: center;
  width: 100%;
  padding: 6px 12px;
  color: #e0e0e0;
  font-size: 14px;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 2px;
  transition: background-color 0.15s, color 0.15s;
  font-family: 'Asul', sans-serif;

  &:hover:not(:disabled) {
    background-color: rgba(78, 68, 58, 0.5);
    color: #ffd5ae;
    cursor: pointer;
  }

  &:active:not(:disabled) {
    background-color: rgba(78, 68, 58, 0.8);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// Divider for menu sections
const MenuDivider = styled.div`
  height: 1px;
  background-color: #2c2824;
  margin: 4px 0;
`;

// Adjust the close button container's padding
const CloseButtonContainer = styled.div`
  display: flex;
  justify-content: center;
  padding: 0;
  margin: 0;
  border: 0;
  overflow: hidden;
`;

// Styled close button
const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 6px 0;
  color: #e0e0e0;
  font-size: 14px;
  background-color: #38322c;
  border: none;
  border-top: none;
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
  margin: 0;
  outline: none;
  transition: background-color 0.15s, color 0.15s;
  font-family: 'Asul', sans-serif;
  box-shadow: none;
  text-shadow: none;

  &:hover {
    background-color: #4e443a;
    color: #ffd5ae;
    cursor: pointer;
  }

  &:active {
    background-color: #5a524a;
  }
`;

// Menu item component
const MenuItemComponent: React.FC<MenuItemProps> = ({ icon, label, disabled = false, onClick, className }) => {
  return (
    <MenuItem onClick={onClick} disabled={disabled} className={className}>
      <span className="w-5 text-center mr-2" style={{ color: '#a0a0a0' }}>
        {icon}
      </span>
      <span>{label}</span>
    </MenuItem>
  );
};

/**
 * Initialize default context menu items
 */
const initializeDefaultMenuItems = () => {
  // Register "Copy XYZ" menu item
  ContextMenuRegistry.registerItem({
    id: 'copy-xyz',
    label: 'Copy XYZ',
    icon: faCopy,
    group: 1,
    order: 10,
    onClick: () => {}, // Will be overridden in the component
    closeOnClick: false // Don't close when copying coordinates
  });

  // Register "Reset UI positions" menu item
  ContextMenuRegistry.registerItem({
    id: 'reset-ui-positions',
    label: 'Reset UI positions',
    icon: faUndoAlt,
    group: 2,
    order: 10,
    onClick: () => {
      resetAllOverlayPositions();
    },
    closeOnClick: true // Close the menu when resetting UI positions
  });

  // Register "Add marker" menu item (disabled)
  ContextMenuRegistry.registerItem({
    id: 'add-marker',
    label: 'Add marker',
    icon: faMapMarkerAlt,
    group: 1,
    order: 5,
    onClick: () => {},
    disabled: true,
    closeOnClick: true
  });
};

// Initialize default items
initializeDefaultMenuItems();

/**
 * IngameContextMenu component that displays a styled context menu at the current cursor position
 */
const IngameContextMenu: React.FC<IngameContextMenuProps> = ({ coordX, coordY, coordZ, position, onClose }) => {
  // State to track if coordinates were copied (for icon display)
  const [copied, setCopied] = useState(false);
  
  // Fix dismiss to properly handle outside clicks and Escape key
  const { refs, floatingStyles, context } = useFloating({
    open: true,
    placement: 'right-start',
    strategy: 'fixed',
    middleware: [
      offset(5),
      flip(),
      shift({ padding: 10 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  // Set up dismiss interactions correctly
  const dismiss = useDismiss(context, {
    outsidePress: true,
    escapeKey: true,
  });

  // Function to close the menu
  const closeMenu = useCallback(() => {
    onClose();
  }, [onClose]);

  // Add effect to close on outside click or escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const floatingEl = refs.floating.current;
      if (floatingEl && !floatingEl.contains(e.target as Node)) {
        closeMenu();
      }
    };

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [closeMenu, refs.floating]);

  // Get props from interactions
  const { getFloatingProps } = useInteractions([dismiss]);

  // Handle copy to clipboard with toast notifications
  const handleCopyCoords = () => {
    if (coordX === undefined || coordY === undefined) {
      console.error('Cannot copy coordinates: coordinates are undefined');
      showErrorToast('Failed to copy coordinates: Invalid position');
      return;
    }
    
    // Create a formatted string of coordinates
    const coords = `${coordX}, ${coordY}${coordZ !== undefined ? `, ${coordZ}` : ''}`;
    
    // Debug toast
    console.log('[TOAST_DEBUG] Attempting to show toast notification for coordinates:', coords);
    
    // Try the modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(coords)
        .then(() => {
          setCopied(true);
          console.log('[TOAST_DEBUG] Clipboard API successful, showing success toast');
          showSuccessToast(`Coordinates copied: ${coords}`, { 
            autoClose: 3000,
            icon: <FontAwesomeIcon icon={faCopy} />
          });
          
          // Reset the icon after a delay
          setTimeout(() => {
            setCopied(false);
          }, 2500);
        })
        .catch(err => {
          console.error('Failed to copy: ', err);
          console.log('[TOAST_DEBUG] Clipboard API failed, showing error toast');
          showErrorToast('Failed to copy coordinates to clipboard');
          
          // Fall back to alternative method
          fallbackCopyToClipboard(coords);
        });
    } else {
      // Use fallback for browsers without clipboard API
      fallbackCopyToClipboard(coords);
    }
  };

  // Handle reset UI with close menu
  const handleItemClick = (item: ContextMenuItem) => {
    // Call the item's onClick handler with coordinates
    item.onClick({
      x: coordX || 0,
      y: coordY || 0,
      z: coordZ
    });
    
    // Close the menu if this item is configured to do so
    if (item.closeOnClick) {
      closeMenu();
    }
  };

  // Handle default fallback copy method
  const fallbackCopyToClipboard = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Make the textarea out of viewport
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setCopied(true);
        showSuccessToast(`Coordinates copied: ${text}`, { 
          autoClose: 3000,
          icon: <FontAwesomeIcon icon={faCopy} />
        });
        
        // Reset the icon after a delay
        setTimeout(() => {
          setCopied(false);
        }, 2500);
      } else {
        showErrorToast('Copy failed. Please try again.');
      }
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
      showErrorToast('Copy failed. Please try again.');
    }
    
    document.body.removeChild(textArea);
  };
  
  // Get all registry items organized by groups
  const menuItems = ContextMenuRegistry.getItems();
  const menuGroups = ContextMenuRegistry.getGroups();
  
  // Adjust position to avoid edge overflow
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight
  };
  
  const adjustedX = Math.min(position.x, viewport.width - 250);
  const adjustedY = Math.min(position.y, viewport.height - 300);
  
  // Override the copy XYZ action with our handler
  const copyItem = menuItems.find(item => item.id === 'copy-xyz');
  if (copyItem) {
    copyItem.onClick = handleCopyCoords;
    copyItem.icon = copied ? faCheck : faCopy;
  }

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        style={{
          position: 'fixed',
          top: adjustedY,
          left: adjustedX,
          zIndex: 1000,
        }}
        {...getFloatingProps()}
      >
        <MenuContainer>
          <IngameBorderedDiv 
            noPadding={true} 
            noBorder={false}
            className="context-menu-bordered-div"
            style={{ 
              overflow: 'hidden',
              borderRadius: '4px 4px 0 0'  // Only round the top corners
            }}
          >
            <MenuInnerContainer>
              <div style={{ position: 'relative', overflow: 'hidden' }}>
                {/* Menu Title */}
                <MenuTitle>Map Actions</MenuTitle>
                
                {/* Dynamic Menu Items by Group */}
                {menuGroups.map((group, groupIndex) => {
                  const groupItems = ContextMenuRegistry.getItemsByGroup(group.id);
                  if (groupItems.length === 0) return null;
                  
                  return (
                    <React.Fragment key={`group-${group.id}`}>
                      {/* Add divider between groups (except before the first group) */}
                      {groupIndex > 0 && <MenuDivider />}
                      
                      {/* Render items in this group */}
                      {groupItems.map(item => (
                        <MenuItemComponent
                          key={item.id}
                          icon={<FontAwesomeIcon icon={item.icon} />}
                          label={item.label}
                          disabled={item.disabled}
                          onClick={() => handleItemClick(item)}
                        />
                      ))}
                    </React.Fragment>
                  );
                })}
              </div>
            </MenuInnerContainer>
          </IngameBorderedDiv>
          
          {/* Render close button outside of IngameBorderedDiv for seamless integration */}
          <CloseButtonContainer>
            <CloseButton onClick={closeMenu}>
              <FontAwesomeIcon icon={faTimes} size="sm" className="mr-1" />
              <span>Close</span>
            </CloseButton>
          </CloseButtonContainer>
        </MenuContainer>
      </div>
    </FloatingPortal>
  );
};

/**
 * Hook to manage context menu state and position
 */
export const useContextMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [coords, setCoords] = useState({ x: 0, y: 0, z: undefined as number | undefined });
  const targetRef = useRef<HTMLElement | null>(null);

  // Handle context menu open
  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLElement> | MouseEvent, mapCoords: { x: number, y: number, z?: number }) => {
    event.preventDefault();
    targetRef.current = event.currentTarget as HTMLElement;
    
    setPosition({ x: event.clientX, y: event.clientY });
    setCoords({
      x: mapCoords.x,
      y: mapCoords.y,
      z: mapCoords.z
    });
    
    setIsOpen(true);
  }, []);

  // Handle context menu close
  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    position,
    coords,
    targetRef,
    handleContextMenu,
    handleClose,
  };
};

export default IngameContextMenu; 