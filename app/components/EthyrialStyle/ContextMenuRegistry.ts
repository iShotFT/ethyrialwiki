/**
 * Context Menu Registry
 * 
 * A centralized registry for managing context menu items in the Ethyrial Map.
 * This allows for dynamic registration and organization of context menu items
 * across the application.
 */

import { IconDefinition } from '@fortawesome/free-solid-svg-icons';

// Define the context menu item type
export interface ContextMenuItem {
  id: string;
  label: string;
  icon: IconDefinition;
  group: number;
  order: number;
  onClick: (coords: { x: number; y: number; z?: number }) => void;
  disabled?: boolean;
  closeOnClick?: boolean; // Controls if the menu should close when this item is clicked
}

// Group definition for visual separation
export interface ContextMenuGroup {
  id: number;
  order: number;
}

class ContextMenuRegistryClass {
  private items: Map<string, ContextMenuItem> = new Map();
  private groups: Map<number, ContextMenuGroup> = new Map();

  /**
   * Register a new context menu item
   */
  registerItem(item: ContextMenuItem): void {
    if (this.items.has(item.id)) {
      console.warn(`Context menu item with id "${item.id}" already exists. Overwriting.`);
    }
    
    // Default to closing menu on click if not specified
    if (item.closeOnClick === undefined) {
      item.closeOnClick = true;
    }
    
    this.items.set(item.id, item);
    
    // Make sure the group exists
    if (!this.groups.has(item.group)) {
      this.registerGroup({
        id: item.group,
        order: item.group * 10 // Default ordering by group ID if not specified
      });
    }
  }

  /**
   * Register a group for visual separation in the menu
   */
  registerGroup(group: ContextMenuGroup): void {
    if (this.groups.has(group.id)) {
      console.warn(`Context menu group with id "${group.id}" already exists. Overwriting.`);
    }
    
    this.groups.set(group.id, group);
  }

  /**
   * Unregister a menu item
   */
  unregisterItem(id: string): void {
    this.items.delete(id);
  }

  /**
   * Get all registered menu items, sorted by group and order
   */
  getItems(): ContextMenuItem[] {
    // Convert to array
    const itemsArray = Array.from(this.items.values());
    
    // Sort by group, then by order within group
    return itemsArray.sort((a, b) => {
      // Get group order
      const groupA = this.groups.get(a.group)?.order || a.group * 10;
      const groupB = this.groups.get(b.group)?.order || b.group * 10;
      
      // First sort by group
      if (groupA !== groupB) {
        return groupA - groupB;
      }
      
      // Then sort by item order within the group
      return a.order - b.order;
    });
  }

  /**
   * Get all groups in order
   */
  getGroups(): ContextMenuGroup[] {
    return Array.from(this.groups.values()).sort((a, b) => a.order - b.order);
  }

  /**
   * Get items for a specific group
   */
  getItemsByGroup(groupId: number): ContextMenuItem[] {
    return this.getItems().filter(item => item.group === groupId);
  }
}

// Export a singleton instance
export const ContextMenuRegistry = new ContextMenuRegistryClass();

export default ContextMenuRegistry; 