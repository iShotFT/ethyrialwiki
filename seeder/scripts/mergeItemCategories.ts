import fs from "fs";
import path from "path";
import Logger from "../../server/logging/Logger";

// Define types for the data structure
interface ItemData {
  slug: string;
  title: string;
  description: string;
  tier: number;
  weight: number;
  resourceCount: number;
  dropable: boolean;
  requiresSkillLevel: number;
  iconSlug: string | null;
  raritySlug: string | null;
}

interface CategoryData {
  slug: string;
  title: string;
  public: boolean;
  displayGroup: string | null;
  iconSlug: string | null;
}

interface CategoryWithItems {
  category: CategoryData;
  items: ItemData[];
  totalItems: number;
  totalResources: number;
}

interface RarityData {
  slug: string;
  title: string;
  colorHex: string;
  colorName: string;
}

interface ImportData {
  rarities: RarityData[];
  categories: CategoryWithItems[];
}

/**
 * Merges item data from a source JSON file into a target JSON file
 * Items in the source file will overwrite corresponding items in the target file
 * New items in the target file that don't exist in the source will be preserved
 */
async function mergeItemCategories(
  sourceFilePath: string,
  targetFilePath: string
) {
  console.log(`Starting item category merge...`);
  console.log(`Source: ${sourceFilePath}`);
  console.log(`Target: ${targetFilePath}`);

  try {
    // Read both JSON files
    const sourceContent = fs.readFileSync(sourceFilePath, "utf-8");
    const targetContent = fs.readFileSync(targetFilePath, "utf-8");
    
    const sourceData: ImportData = JSON.parse(sourceContent);
    const targetData: ImportData = JSON.parse(targetContent);
    
    // Validate the JSON structures
    if (!sourceData.rarities || !Array.isArray(sourceData.rarities)) {
      throw new Error('Invalid source JSON: missing or invalid rarities array');
    }
    if (!sourceData.categories || !Array.isArray(sourceData.categories)) {
      throw new Error('Invalid source JSON: missing or invalid categories array');
    }
    if (!targetData.rarities || !Array.isArray(targetData.rarities)) {
      throw new Error('Invalid target JSON: missing or invalid rarities array');
    }
    if (!targetData.categories || !Array.isArray(targetData.categories)) {
      throw new Error('Invalid target JSON: missing or invalid categories array');
    }
    
    console.log(`Source contains ${sourceData.categories.length} categories and ${
      sourceData.categories.reduce((total, cat) => total + cat.items.length, 0)
    } items`);
    
    console.log(`Target contains ${targetData.categories.length} categories and ${
      targetData.categories.reduce((total, cat) => total + cat.items.length, 0)
    } items`);
    
    // Create a lookup map for source items by slug
    const sourceItemsMap = new Map<string, ItemData>();
    
    // Populate the lookup map
    for (const category of sourceData.categories) {
      for (const item of category.items) {
        sourceItemsMap.set(item.slug, item);
      }
    }
    
    console.log(`Created lookup map with ${sourceItemsMap.size} source items`);
    
    // Merge rarities (usually this shouldn't change, but just in case)
    const rarityMap = new Map<string, RarityData>();
    for (const rarity of sourceData.rarities) {
      rarityMap.set(rarity.slug, rarity);
    }
    
    // Update target rarities if they exist in source
    for (let i = 0; i < targetData.rarities.length; i++) {
      const rarity = targetData.rarities[i];
      if (rarityMap.has(rarity.slug)) {
        targetData.rarities[i] = rarityMap.get(rarity.slug)!;
      }
    }
    
    // Track statistics
    let itemsUpdated = 0;
    let itemsPreserved = 0;
    
    // For each category in the target data
    for (const targetCategory of targetData.categories) {
      const updatedItems: ItemData[] = [];
      
      // For each item in this category
      for (const targetItem of targetCategory.items) {
        // Check if this item exists in the source data
        if (sourceItemsMap.has(targetItem.slug)) {
          // Update with source data
          const sourceItem = sourceItemsMap.get(targetItem.slug)!;
          
          // Make sure we preserve the resourceCount from the target
          const resourceCount = targetItem.resourceCount;
          
          // Merge the item, preferring source values
          const mergedItem = {
            ...targetItem,
            ...sourceItem,
            resourceCount // Always keep the original resourceCount
          };
          
          updatedItems.push(mergedItem);
          itemsUpdated++;
        } else {
          // Keep the original item
          updatedItems.push(targetItem);
          itemsPreserved++;
        }
      }
      
      // Update the items in this category
      targetCategory.items = updatedItems;
      
      // Recalculate totals for this category
      targetCategory.totalItems = updatedItems.length;
      targetCategory.totalResources = updatedItems.reduce(
        (sum, item) => sum + item.resourceCount, 
        0
      );
    }
    
    // Write the merged data back to the target file
    const backupPath = targetFilePath + '.backup';
    console.log(`Creating backup of original target file to ${backupPath}`);
    fs.copyFileSync(targetFilePath, backupPath);
    
    console.log(`Writing merged data to ${targetFilePath}`);
    fs.writeFileSync(
      targetFilePath, 
      JSON.stringify(targetData, null, 2)
    );
    
    console.log(`Merge completed successfully:`);
    console.log(`- Updated ${itemsUpdated} items with source data`);
    console.log(`- Preserved ${itemsPreserved} items only in target`);
    console.log(`- Total items in result: ${itemsUpdated + itemsPreserved}`);
    
  } catch (error) {
    console.error("Error merging item categories:", error);
    throw error;
  }
}

// Determine file paths
const targetPath = process.argv[2] || path.resolve(process.cwd(), "seeder", "output", "item-categories.json");
const sourcePath = process.argv[3] || path.resolve(process.cwd(), "seeder", "output", "item-categories_one.json");

// Verify both files exist
if (!fs.existsSync(targetPath)) {
  console.error(`Error: Target file not found at path: ${targetPath}`);
  process.exit(1);
}

if (!fs.existsSync(sourcePath)) {
  console.error(`Error: Source file not found at path: ${sourcePath}`);
  process.exit(1);
}

// Run the merge function
mergeItemCategories(sourcePath, targetPath)
  .then(() => {
    console.log("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  }); 