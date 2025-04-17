import "../../server/scripts/bootstrap";
import GameItemCategory from "../../server/models/GameItemCategory";
import GameItem from "../../server/models/GameItem";
import GameIcon from "../../server/models/GameIcon";
import GameItemRarity from "../../server/models/GameItemRarity";
import fs from "fs";
import path from "path";

// Missing?
// Fibres: Shadowbud

// Unsure?
// Fibres or Herbs: Mysticbloom
// Fibres or Herbs: Duskthorn


/**
 * Gets an approximate color name from a hex value
 * @param hex The hex color code
 * @returns A human-readable color name
 */
function getColorNameFromHex(hex: string): string {
  // Strip the # if it exists
  hex = hex.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Define basic color ranges
  if (r > 220 && g > 220 && b > 220) return "White";
  if (r < 50 && g < 50 && b < 50) return "Black";
  
  // Define color hue ranges
  if (r > 200 && g > 200 && b < 100) return "Yellow";
  if (r > 200 && g < 100 && b < 100) return "Red";
  if (r < 100 && g > 180 && b < 100) return "Green";
  if (r < 100 && g < 100 && b > 200) return "Blue";
  if (r > 200 && g < 130 && b > 200) return "Purple";
  if (r > 200 && g > 100 && b < 50) return "Orange";
  if (r > 90 && g > 90 && b > 90 && r < 180 && g < 180 && b < 180) return "Gray";
  
  // More specific color detection
  if (r > g && r > b) {
    if (g > 150) return "Orange-Yellow";
    return "Red";
  }
  if (g > r && g > b) return "Green";
  if (b > r && b > g) return "Blue";
  
  return "Unknown";
}

/**
 * Sorts rarities in game order from lowest to highest
 * @param rarities Array of rarity objects
 * @returns Sorted array of rarities
 */
function sortRaritiesByLevel(rarities: GameItemRarity[]): GameItemRarity[] {
  // Define the order (from lowest to highest)
  const rarityOrder: Record<string, number> = {
    "none": 0,
    "common": 1,
    "uncommon": 2,
    "rare": 3,
    "epic": 4,
    "legendary": 5,
    "relic": 6,
    "quest-item": 7 // Special case, considered separate
  };
  
  // Sort by the predefined order
  return [...rarities].sort((a, b) => {
    const orderA = rarityOrder[a.slug] !== undefined ? rarityOrder[a.slug] : 999;
    const orderB = rarityOrder[b.slug] !== undefined ? rarityOrder[b.slug] : 999;
    return orderA - orderB;
  });
}

/**
 * Script to extract data about item categories including:
 * - Items associated with each category
 * - Number of resources associated with each item
 * - Item details (tier, icon, etc.)
 * 
 * Output is in JSON format with rarities at the top and categories below.
 * All references use slugs instead of IDs for better editability.
 */
async function extractItemCategories() {
  console.log("Starting item category data extraction...");
  
  try {
    // First, fetch all rarities to add at the top of the output
    const rarities = await GameItemRarity.findAll();
    
    console.log(`Found ${rarities.length} rarities`);
    
    // Sort rarities from lowest to highest
    const sortedRarities = sortRaritiesByLevel(rarities);
    
    // Format rarities for easy copy-paste into items
    const formattedRarities = sortedRarities.map((rarity: GameItemRarity) => ({
      slug: rarity.slug,
      title: rarity.title,
      colorHex: rarity.colorHex,
      colorName: getColorNameFromHex(rarity.colorHex) // Add human-readable color name
    }));
    
    // Fetch all categories with their related items
    const categories = await GameItemCategory.findAll({
      include: [
        {
          model: GameIcon, 
          as: "icon"
        },
        {
          model: GameItem,
          as: "items",
          include: [
            {
              model: GameIcon,
              as: "icon"
            },
            {
              model: GameItemRarity,
              as: "rarity"
            }
          ]
        }
      ],
      order: [["title", "ASC"]]
    });
    
    console.log(`Found ${categories.length} categories`);
    
    // Format the data for output with proper type annotations, focusing on slugs
    const formattedCategories = await Promise.all(categories.map(async (category: GameItemCategory) => {
      // Map items with counts of associated resources
      const itemsWithCounts = await Promise.all(category.items.map(async (item: GameItem) => {
        // Count resources associated with this item
        const resourceCount = await item.$count('resourceNodes');
        
        return {
          slug: item.slug,
          title: item.title,
          description: item.description,
          tier: item.tier,
          weight: item.weight,
          resourceCount: resourceCount,
          dropable: item.dropable,
          requiresSkillLevel: item.requiresSkillLevel,
          iconSlug: item.icon ? item.icon.slug : null,
          raritySlug: item.rarity ? item.rarity.slug : null
        };
      }));
      
      return {
        category: {
          slug: category.slug,
          title: category.title,
          public: category.public,
          displayGroup: category.displayGroup,
          iconSlug: category.icon ? category.icon.slug : null
        },
        items: itemsWithCounts,
        totalItems: itemsWithCounts.length,
        totalResources: itemsWithCounts.reduce((sum, item) => sum + item.resourceCount, 0)
      };
    }));
    
    // Combine rarities and categories into the final output
    const finalOutput = {
      rarities: formattedRarities,
      categories: formattedCategories
    };
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, "../../seeder/output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write the output to a JSON file
    const outputPath = path.join(outputDir, "item-categories.json");
    fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 2));
    
    console.log(`Data extracted successfully and saved to ${outputPath}`);
    console.log(`- ${rarities.length} rarities included at the top of the file, sorted from lowest to highest`);
    console.log(`- Added human-readable color names for each rarity`);
    console.log(`- ${categories.length} categories with their items included`);
    console.log(`- References use slugs instead of IDs for better editability`);
  } catch (error) {
    console.error("Error extracting item category data:", error);
  }
}

// Run the function
extractItemCategories()
  .then(() => {
    console.log("Script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  }); 