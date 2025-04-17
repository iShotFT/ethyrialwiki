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
import { faMapMarkerAlt, faShare, faTimes, faPlus, faCheck, faCopy } from '@fortawesome/free-solid-svg-icons';

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

// Add notification component - Improve its visibility
const CopyNotification = styled.div<{ show: boolean }>`
  position: absolute;
  top: -50px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #38322c;
  border: 1px solid #ffd5ae;
  color: #ffd5ae;
  padding: 8px 12px;
  border-radius: 3px;
  font-size: 14px;
  opacity: ${props => props.show ? 1 : 0};
  transition: opacity 0.3s;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  z-index: 1001;
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
 * IngameContextMenu component that displays a styled context menu at the current cursor position
 */
const IngameContextMenu: React.FC<IngameContextMenuProps> = ({ coordX, coordY, coordZ, position, onClose }) => {
  // State to track if coordinates were copied
  const [copied, setCopied] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  
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

  // Handle copy to clipboard with improved feedback
  const handleCopyCoords = () => {
    if (coordX === undefined || coordY === undefined) {
      console.error('Cannot copy coordinates: coordinates are undefined');
      return;
    }
    
    // Create a formatted string of coordinates
    const coords = `${coordX}, ${coordY}${coordZ !== undefined ? `, ${coordZ}` : ''}`;
    
    try {
      // For broader browser support, try multiple clipboard methods
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(coords)
          .then(() => {
            setCopied(true);
            setShowNotification(true);
            
            // Reset states after delays
            setTimeout(() => {
              setCopied(false);
            }, 2000);
            
            setTimeout(() => {
              setShowNotification(false);
            }, 1800);
            
            console.log(`Coordinates copied to clipboard: ${coords}`);
          })
          .catch(err => {
            console.error('Clipboard API failed:', err);
            fallbackCopyToClipboard(coords);
          });
      } else {
        fallbackCopyToClipboard(coords);
      }
    } catch (err) {
      console.error('Failed to copy coordinates:', err);
    }
  };

  // Add a fallback method for copying to clipboard
  const fallbackCopyToClipboard = (text: string) => {
    // Create temporary element
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Make the textarea out of viewport
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    
    // Select and copy
    textArea.focus();
    textArea.select();
    
    let success = false;
    try {
      success = document.execCommand('copy');
      if (success) {
        setCopied(true);
        setShowNotification(true);
        
        // Reset states after delays
        setTimeout(() => {
          setCopied(false);
        }, 2000);
        
        setTimeout(() => {
          setShowNotification(false);
        }, 1800);
        
        console.log(`Coordinates copied to clipboard using fallback: ${text}`);
      }
    } catch (err) {
      console.error('Fallback clipboard copy failed:', err);
    }
    
    // Cleanup
    document.body.removeChild(textArea);
  };

  // Apply the position directly to avoid type errors
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Calculate effective menu width and height (estimate)
  const menuWidth = 200;
  const menuHeight = 150;

  // Adjust position to keep menu within viewport
  let adjustedX = position.x;
  let adjustedY = position.y;

  // Check if menu would extend beyond right edge
  if (position.x + menuWidth > viewportWidth) {
    adjustedX = position.x - menuWidth;
  }

  // Check if menu would extend beyond bottom edge
  if (position.y + menuHeight > viewportHeight) {
    adjustedY = position.y - menuHeight;
  }

  // Make sure we don't position outside the left or top edge
  adjustedX = Math.max(5, adjustedX);
  adjustedY = Math.max(5, adjustedY);

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
            className="context-menu-bordered-div"
            style={{ 
              overflow: 'hidden',
              borderRadius: '4px 4px 0 0'  // Only round the top corners
            }}
          >
            <MenuInnerContainer>
              <div style={{ position: 'relative', overflow: 'hidden' }}>
                {/* Copy notification */}
                <CopyNotification show={showNotification}>
                  Coordinates copied to clipboard!
                </CopyNotification>
                
                {/* Menu Title */}
                <MenuTitle>Map Actions</MenuTitle>
                
                {/* Menu Items */}
                <MenuItemComponent
                  icon={<FontAwesomeIcon icon={faMapMarkerAlt} />}
                  label="Add marker"
                  disabled={true}
                />
                
                <MenuItemComponent
                  icon={<FontAwesomeIcon icon={copied ? faCheck : faCopy} />}
                  label="Copy XYZ"
                  onClick={handleCopyCoords}
                />
              </div>
            </MenuInnerContainer>
          </IngameBorderedDiv>
          {/* Render close button outside of IngameBorderedDiv for seamless integration */}
          <CloseButton onClick={closeMenu}>
            <FontAwesomeIcon icon={faTimes} className="mr-1" />
            Close
          </CloseButton>
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