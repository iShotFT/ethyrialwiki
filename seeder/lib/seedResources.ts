import fs from "fs/promises";
import path from "path";
import { Transaction } from "sequelize";
import Logger from "@server/logging/Logger";
import {
  GameIcon,
  GameItem,
  GameResource,
  GameMap,
  GameItemCategory,
  GameItemItemCategory as GameItemItemCategoryModel,
} from "@server/models";
import { DisplayGroup } from "@server/models/GameItemCategory";
import { generateSlug, formatTitle, generateId, INPUT_DIR } from "./utils";
import { sequelize } from "@server/storage/database";
import { seederLogger } from "./seederLogger";

// Type alias for the mapping structure
type ResourceIconMap = Record<string, { icon: string; category: string }>;

// Define expected structure from scraped_objects.json
interface ScrapedResourceData {
  search_pattern: string;
  position: { x: number; y: number; z: number };
  parent_name: string;
  world: string;
  zone: string;
}

/**
 * Seeds GameResource nodes based on scraped JSON data.
 * Creates necessary GameItemCategory, GameIcon, GameItem records if they don't exist.
 * Links items to categories.
 * @param mapTitle - The title of the map to associate resources with.
 * @param parentTransaction - The parent Sequelize transaction (optional, will create own transactions if null)
 * @param batchSize - Optional batch size for processing large datasets (default: 100)
 */
export async function seedResources(
  mapTitle: string,
  parentTransaction: Transaction | null = null,
  batchSize: number = 100
): Promise<void> {
  Logger.info("utils", "Seeding game resources...");
  Logger.info("utils", `Using batch size of ${batchSize}`);
  
  // If we weren't provided a transaction, we'll create our own for each step
  const useParentTransaction = parentTransaction !== null;

  // Load resource icon mapping from JSON
  const mappingJsonPath = path.join(INPUT_DIR, "resource_icon_map.json");
  let resourceIconMapping: ResourceIconMap;
  try {
    const mappingFileContent = await fs.readFile(mappingJsonPath, "utf-8");
    resourceIconMapping = JSON.parse(mappingFileContent) as ResourceIconMap;
    Logger.info(
      "utils",
      `Loaded resource icon mapping from ${mappingJsonPath}`
    );
  } catch (error) {
    Logger.error(
      "utils",
      new Error(
        `Failed to load or parse resource icon map from ${mappingJsonPath}`
      ),
      error as Error
    );
    throw error;
  }

  const resourceJsonPath = path.join(INPUT_DIR, "scraped_objects.json");
  let rawResourceData: Record<string, ScrapedResourceData>;
  try {
    const fileContent = await fs.readFile(resourceJsonPath, "utf-8");
    rawResourceData = JSON.parse(fileContent);
    Logger.info(
      "utils",
      `Loaded ${
        Object.keys(rawResourceData).length
      } raw resource entries from JSON.`
    );
  } catch (error) {
    Logger.error(
      "utils",
      new Error(
        `Failed to load or parse resource JSON from ${resourceJsonPath}`
      ),
      error as Error
    );
    throw error;
  }

  // Find the target map ID - use parent transaction if provided
  const targetMap = await GameMap.findOne({
    where: { title: mapTitle },
    transaction: parentTransaction,
  });
  if (!targetMap) {
    throw new Error(`Target map "${mapTitle}" not found in database.`);
  }
  const mapId = targetMap.dataValues.id;

  // ----- STEP 1: Prepare & Seed Categories (small operation, uses parent transaction) -----
  
  // Collect category data
  const categoryData = new Map<
    string,
    { name: string; slug: string; iconFilename: string | null }
  >();
  for (const key in resourceIconMapping) {
    const mapping = resourceIconMapping[key];
    if (!categoryData.has(mapping.category)) {
      categoryData.set(mapping.category, {
        name: mapping.category,
        slug: generateSlug(mapping.category),
        iconFilename: mapping.icon, // Use first icon found for category
      });
    }
  }

  // Create or get category icons in a separate transaction if needed
  // Map to keep track of icon IDs for categories
  const categoryIconIds: Record<string, string> = {};
  
  // Use parent transaction or create a new one for icons
  const iconsTransaction = useParentTransaction ? parentTransaction : await sequelize.transaction();
  
  try {
    // Pre-find/create icons needed for categories
    for (const cat of categoryData.values()) {
      if (cat.iconFilename) {
        const iconSlug = generateSlug(path.parse(cat.iconFilename).name);
        const iconId = generateId(iconSlug);
        const iconTitle = formatTitle(path.parse(cat.iconFilename).name);
        // Use findOrCreate for icons
        const [icon] = await GameIcon.findOrCreate({
          where: { id: iconId },
          defaults: {
            id: iconId,
            slug: iconSlug,
            title: iconTitle,
            originalName: cat.iconFilename,
            path: `icons/${cat.iconFilename}`, // Assume icons are uploaded/available at this path
            public: true,
          } as any,
          transaction: iconsTransaction,
        });
        
        if (icon) {
          categoryIconIds[cat.slug] = icon.id;
        }
      }
    }
    
    // Commit icon transaction if we're not using a parent
    if (!useParentTransaction) {
      await iconsTransaction.commit();
      Logger.info("utils", "Icons transaction committed.");
    }
  } catch (error) {
    if (!useParentTransaction) {
      await iconsTransaction.rollback();
      Logger.error("utils", new Error("Icons transaction rolled back."), error as Error);
    }
    throw error;
  }
  
  // Create categories using committed icons
  const categoriesTransaction = useParentTransaction ? parentTransaction : await sequelize.transaction();
  try {
    const categoriesToSeed = Array.from(categoryData.values()).map((cat) => ({
      id: generateId(cat.slug),
      slug: cat.slug,
      title: cat.name,
      iconId: categoryIconIds[cat.slug] || null,
      public: true,
      displayGroup: DisplayGroup.HEATMAP, // Mark all resource categories as HEATMAP
    }));
    
    await GameItemCategory.bulkCreate(categoriesToSeed as any, {
      transaction: categoriesTransaction,
      updateOnDuplicate: [
        "title",
        "iconId",
        "public",
        "displayGroup", // Make sure displayGroup is updated
        "updatedAt",
      ],
    });
    
    Logger.info(
      "utils",
      `Upserted ${categoriesToSeed.length} GameItemCategories for resources.`
    );
    
    seederLogger.recordCounts("Resource Categories", categoriesToSeed.length, 0);
    
    // Commit categories transaction if not using parent
    if (!useParentTransaction) {
      await categoriesTransaction.commit();
      Logger.info("utils", "Categories transaction committed.");
    }
  } catch (error) {
    if (!useParentTransaction) {
      await categoriesTransaction.rollback();
      Logger.error("utils", new Error("Categories transaction rolled back."), error as Error);
    }
    throw error;
  }

  // Get all categories for reference
  const allCategories = await GameItemCategory.findAll({
    transaction: parentTransaction,
  });
  const categoryIdMap = new Map(
    allCategories.map((c) => [c.slug, c.id])
  );

  // ----- STEP 2: Process Resources in Batches -----
  
  // Get all resource entries for the specified map
  const allKeys = Object.keys(rawResourceData);
  const totalKeys = allKeys.length;
  Logger.info("utils", `Processing ${totalKeys} resource entries...`);
  
  // Filter keys that match our map
  const mapKeys = allKeys.filter(key => rawResourceData[key].world === mapTitle);
  Logger.info("utils", `Found ${mapKeys.length} resources for map "${mapTitle}"`);
  
  // Process in batches to avoid memory issues
  let processedCount = 0;
  let totalProcessed = 0;
  let totalResources = 0;
  let totalLinks = 0;
  
  // Create batches of keys
  const keyBatches: string[][] = [];
  for (let i = 0; i < mapKeys.length; i += batchSize) {
    keyBatches.push(mapKeys.slice(i, i + batchSize));
  }
  
  Logger.info("utils", `Split resource processing into ${keyBatches.length} batches`);
  
  // Process each batch
  for (let batchIndex = 0; batchIndex < keyBatches.length; batchIndex++) {
    const keyBatch = keyBatches[batchIndex];
    Logger.info("utils", `Processing batch ${batchIndex + 1}/${keyBatches.length} (${keyBatch.length} resources)`);
    
    // Create a new transaction for this batch if we're not using a parent transaction
    const batchTransaction = useParentTransaction ? parentTransaction : await sequelize.transaction();
    
    try {
      // Temporary storage for this batch
      const resourcesToCreate: any[] = [];
      const itemCategoryLinks: { gameItemId: string; gameItemCategoryId: string }[] = [];
      const processedItemIds = new Set<string>();
      
      // Process each resource in the batch
      for (const key of keyBatch) {
        processedCount++;
        
        const resource = rawResourceData[key];
        // Filter was already done, but check again just in case
        if (resource.world !== mapTitle) {
          continue;
        }

        const searchPattern = resource.search_pattern;
        const mapping = resourceIconMapping[searchPattern];
        if (!mapping || !mapping.icon) {
          continue;
        }

        const iconFilename = mapping.icon;
        const categoryName = mapping.category;
        const categorySlug = generateSlug(categoryName);
        const categoryId = categoryIdMap.get(categorySlug);
        if (!categoryId) {
          continue;
        }

        // --- Find/Create Icon ---
        const iconSlug = generateSlug(path.parse(iconFilename).name);
        const iconId = generateId(iconSlug);
        
        // Icon should have been created above, but check again just in case
        const [icon] = await GameIcon.findOrCreate({
          where: { id: iconId },
          defaults: {
            id: iconId,
            slug: iconSlug,
            title: formatTitle(path.parse(iconFilename).name),
            originalName: iconFilename,
            path: `icons/${iconFilename}`, // Assume icons are uploaded/available at this path
            public: true,
          } as any,
          transaction: batchTransaction,
        });
        
        if (!icon) {
          Logger.warn(
            "utils",
            new Error(`Icon not found or created for ${iconFilename}`)
          );
          continue; // Skip if icon is missing
        }

        // --- Find/Create Item ---
        const itemTitle = formatTitle(searchPattern);
        const itemSlug = generateSlug(itemTitle);
        const itemId = generateId(itemSlug);

        const [item, created] = await GameItem.findOrCreate({
          where: { id: itemId },
          defaults: {
            id: itemId,
            slug: itemSlug,
            title: itemTitle,
            iconId: icon.id, // Use found/created icon ID
            public: true, // Set resource items as public so they appear in the frontend
            description: `${itemTitle} resource item.`,
            dropable: true,
            rarityId: null,
            tier: 0,
            weight: 1.0,
            onUseEffect: null,
            usedForSkillId: null,
            gatheringSpeed: null,
            requiresSkillId: null,
            requiresSkillLevel: 0,
            blueprintId: null,
          } as any,
          transaction: batchTransaction,
        });

        // If item already existed, update the public flag to ensure it's visible
        if (!created) {
          await item.update({
            public: true, // Ensure existing items are also public
            iconId: icon.id, // Update the icon if needed
          }, { transaction: batchTransaction });
        }

        // --- Link Item to Category (if not already processed) ---
        if (!processedItemIds.has(item.id)) {
          itemCategoryLinks.push({
            gameItemId: item.id,
            gameItemCategoryId: categoryId,
          });
          processedItemIds.add(item.id);
        }

        // --- Prepare Resource Node ---
        resourcesToCreate.push({
          id: generateId(`${mapId}-${item.id}-${key}`), // More unique resource ID
          mapId,
          itemId: item.id,
          coordinates: {
            x: resource.position.x,
            y: resource.position.z, // Swap Y and Z from scraped data
            z: resource.position.y,
          },
          public: true,
        });
      }

      // Bulk create item-category links for this batch
      if (itemCategoryLinks.length > 0) {
        await GameItemItemCategoryModel.bulkCreate(itemCategoryLinks as any, {
          transaction: batchTransaction,
          ignoreDuplicates: true,
        });
        totalLinks += itemCategoryLinks.length;
      }

      // Bulk create resource nodes for this batch
      if (resourcesToCreate.length > 0) {
        await GameResource.bulkCreate(resourcesToCreate as any, {
          transaction: batchTransaction,
          updateOnDuplicate: [
            "mapId",
            "itemId",
            "coordinates",
            "public",
            "updatedAt",
          ],
        });
        totalResources += resourcesToCreate.length;
      }
      
      // Commit the batch transaction if we're not using a parent transaction
      if (!useParentTransaction) {
        await batchTransaction.commit();
      }
      
      totalProcessed += keyBatch.length;
      
      // Log progress
      Logger.info(
        "utils",
        `Batch ${batchIndex + 1}/${keyBatches.length} completed (${Math.round((totalProcessed / mapKeys.length) * 100)}% total)`
      );
    } catch (error) {
      // Roll back if there was an error and we're not using a parent transaction
      if (!useParentTransaction) {
        await batchTransaction.rollback();
      }
      Logger.error("utils", new Error(`Error processing resource batch ${batchIndex + 1}`), error as Error);
      throw error;
    }
  }

  Logger.info(
    "utils",
    `Resource seeding complete. Processed ${totalProcessed} resources, created ${totalResources} resource nodes and ${totalLinks} item-category links.`
  );
  
  // Add seederLogger.recordCounts
  seederLogger.recordCounts("Resources Total", totalResources, 0);
  seederLogger.recordCounts("Resource Items", totalLinks, 0);
}