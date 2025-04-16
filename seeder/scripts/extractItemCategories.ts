import "../../server/bootstrap";
import GameItemCategory from "../../server/models/GameItemCategory";
import GameItem from "../../server/models/GameItem";
import GameIcon from "../../server/models/GameIcon";
import GameItemRarity from "../../server/models/GameItemRarity";
import fs from "fs";
import path from "path";

/**
 * Script to extract data about item categories including:
 * - Items associated with each category
 * - Number of resources associated with each item
 * - Item details (tier, icon, etc.)
 * 
 * Output is in JSON format with one object per category.
 */
async function extractItemCategories() {
  console.log("Starting item category data extraction...");
  
  try {
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
    
    // Format the data for output with proper type annotations
    const formattedData = await Promise.all(categories.map(async (category: GameItemCategory) => {
      // Map items with counts of associated resources
      const itemsWithCounts = await Promise.all(category.items.map(async (item: GameItem) => {
        // Count resources associated with this item
        const resourceCount = await item.$count('resourceNodes');
        
        return {
          id: item.id,
          slug: item.slug,
          title: item.title,
          description: item.description,
          tier: item.tier,
          weight: item.weight,
          resourceCount: resourceCount,
          dropable: item.dropable,
          requiresSkillLevel: item.requiresSkillLevel,
          icon: item.icon ? {
            id: item.icon.id,
            slug: item.icon.slug,
            title: item.icon.title,
            path: item.icon.path
          } : null,
          rarity: item.rarity ? {
            id: item.rarity.id,
            slug: item.rarity.slug,
            title: item.rarity.title
          } : null
        };
      }));
      
      return {
        category: {
          id: category.id,
          slug: category.slug,
          title: category.title,
          public: category.public,
          displayGroup: category.displayGroup,
          icon: category.icon ? {
            id: category.icon.id,
            slug: category.icon.slug,
            title: category.icon.title,
            path: category.icon.path
          } : null
        },
        items: itemsWithCounts,
        totalItems: itemsWithCounts.length,
        totalResources: itemsWithCounts.reduce((sum, item) => sum + item.resourceCount, 0)
      };
    }));
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, "../../output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    
    // Write the output to a JSON file
    const outputPath = path.join(outputDir, "item-categories.json");
    fs.writeFileSync(outputPath, JSON.stringify(formattedData, null, 2));
    
    console.log(`Data extracted successfully and saved to ${outputPath}`);
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