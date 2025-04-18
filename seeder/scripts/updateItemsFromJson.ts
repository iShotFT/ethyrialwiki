import "../../server/scripts/bootstrap";
import GameItemCategory from "../../server/models/GameItemCategory";
import GameItem from "../../server/models/GameItem";
import GameIcon from "../../server/models/GameIcon";
import GameItemRarity from "../../server/models/GameItemRarity";
import { sequelize } from "../../server/storage/database";
import fs from "fs";
import path from "path";
import { Transaction } from "sequelize";
import Logger from "../../server/logging/Logger";

interface ItemData {
  slug: string;
  title: string;
  description: string;
  tier: number;
  weight: number;
  dropable: boolean;
  requiresSkillLevel: number;
  iconSlug: string | null;
  raritySlug: string | null;
  resourceCount?: number; // Ignored during update
}

interface CategoryData {
  slug: string;
  title: string;
  public: boolean;
  displayGroup: string;
  iconSlug: string | null;
}

interface CategoryWithItems {
  category: CategoryData;
  items: ItemData[];
  totalItems?: number; // Ignored during update
  totalResources?: number; // Ignored during update
}

interface RarityData {
  slug: string;
  title: string;
  colorHex: string;
  colorName?: string; // Added but ignored during update
}

interface ImportData {
  rarities: RarityData[];
  categories: CategoryWithItems[];
}

/**
 * Updates game items based on an edited JSON file.
 * The JSON should follow the format generated by extractItemCategories.ts.
 * This script will find items by slug and update only tier, weight, rarity, and skill level.
 */
async function updateItemsFromJson(jsonFilePath: string) {
  console.log(`Starting item update from JSON file: ${jsonFilePath}`);

  try {
    // Read and parse the JSON file
    const jsonContent = fs.readFileSync(jsonFilePath, 'utf-8');
    const importData: ImportData = JSON.parse(jsonContent);

    // Validate the JSON structure
    if (!importData.rarities || !Array.isArray(importData.rarities)) {
      throw new Error('Invalid JSON: missing or invalid rarities array');
    }
    if (!importData.categories || !Array.isArray(importData.categories)) {
      throw new Error('Invalid JSON: missing or invalid categories array');
    }

    console.log(`Found ${importData.rarities.length} rarities and ${importData.categories.length} categories in JSON`);

    // Start a transaction for all database operations
    const transaction = await sequelize.transaction();

    try {
      // Prefetch all rarities for faster lookups
      const allRarities = await GameItemRarity.findAll({ transaction });
      const rarityMap = new Map(allRarities.map(r => [r.slug, r]));
      
      // Update items - focus on the specific fields we want to update
      let updatedItems = 0;
      let skippedItems = 0;
      
      for (const categoryData of importData.categories) {
        // Update each item in the category
        for (const itemData of categoryData.items) {
          // Find the item by slug
          const item = await GameItem.findOne({
            where: { slug: itemData.slug },
            transaction
          });
          
          if (!item) {
            console.log(`Item with slug '${itemData.slug}' not found, skipping`);
            skippedItems++;
            continue;
          }
          
          // Determine rarity ID from slug
          let rarityId = null;
          if (itemData.raritySlug) {
            const rarity = rarityMap.get(itemData.raritySlug);
            if (rarity) {
              rarityId = rarity.id;
            } else {
              console.log(`Rarity '${itemData.raritySlug}' not found for item '${itemData.slug}'`);
            }
          }
          
          // Only update the specific fields we're interested in
          await item.update({
            tier: itemData.tier,
            weight: itemData.weight,
            rarityId: rarityId,
            requiresSkillLevel: itemData.requiresSkillLevel
          }, { transaction });
          
          updatedItems++;
          
          // Log progress every 25 items
          if (updatedItems % 25 === 0) {
            console.log(`Updated ${updatedItems} items so far...`);
          }
        }
      }
      
      // Commit the transaction
      await transaction.commit();
      
      console.log(`Update completed successfully:`);
      console.log(`- Updated ${updatedItems} items (tier, weight, rarity, skill level)`);
      console.log(`- Skipped ${skippedItems} items (not found by slug)`);
      
    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error updating items from JSON:", error);
    throw error;
  }
}

// If no path provided, use the default path
const defaultPath = path.resolve(process.cwd(), "seeder", "output", "item-categories.json");
const jsonFilePath = process.argv[2] || defaultPath;

// Verify the file exists
if (!fs.existsSync(jsonFilePath)) {
  console.error(`Error: File not found at path: ${jsonFilePath}`);
  console.log(`Default path is: ${defaultPath}`);
  console.log("Usage: ts-node updateItemsFromJson.ts [optional-path-to-json-file]");
  process.exit(1);
}

// Run the update function
updateItemsFromJson(jsonFilePath)
  .then(() => {
    console.log("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  }); 