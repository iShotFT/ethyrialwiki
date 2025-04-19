/**
 * Centralized category color mapping for consistent styling across the application
 */
export const CATEGORY_COLORS: Record<string, string> = {
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

/**
 * Get the color for a category
 */
export function getCategoryColor(categoryName: string): string {
  // Normalize category name to uppercase for lookup
  const normalizedName = categoryName.toUpperCase();
  
  // Return color from mapping or default
  return CATEGORY_COLORS[normalizedName] || CATEGORY_COLORS.OTHER;
}

/**
 * Format a category title for display
 */
export function formatCategoryTitle(title: string): string {
  if (!title) return '';

  // Handle specific abbreviations first
  if (title.toUpperCase() === 'POI') return 'POI';
  if (title.toUpperCase() === 'NPC') return 'NPC';

  // General formatting for others
  return title
    .toLowerCase() // Convert to lowercase first
    .replace(/_/g, ' ') // Replace underscores with spaces
    .replace(/\b\w/g, char => char.toUpperCase()); // Capitalize first letter of each word
}

/**
 * Get the first letter of a category name
 */
export function getCategoryLetter(title: string): string {
  if (!title) return '?';
  
  // Handle specific cases
  if (title.toUpperCase() === 'POI') return 'P';
  if (title.toUpperCase() === 'NPC') return 'N';
  
  // Get first letter for other categories
  return title.charAt(0).toUpperCase();
} 