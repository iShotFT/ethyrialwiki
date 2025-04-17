import fs from "fs";
import { createReadStream } from "fs";
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
import * as readline from "readline";
import { Transform } from "stream";

// Interface for the resource entry from the cleaned_doodad.json file
interface DoodadResourceEntry {
  name: string;
  map: {
    x: number;
    y: number;
    z: number;
    map: string;
  };
  info: {
    name: string;
    tags: string[];
    type: string;
  };
}

// Type alias for the resource icon mapping structure
type ResourceIconMap = Record<string, { icon: string; category: string }>;

/**
 * Normalizes resource names, particularly for trees
 * @param name Original resource name
 * @param tags Tags from the resource
 */
function normalizeResourceName(name: string, tags: string[]): string {
  // If it's a tree, try to normalize to base form
  if (tags.includes("Tree")) {
    // The prefixes and suffixes we want to strip
    const prefixes = ["Ancient ", "Verdant ", "Aging "];
    const suffixes = [" Sapling", " Tree"];
    
    // First, strip any known prefix
    let baseName = name;
    for (const prefix of prefixes) {
      if (baseName.startsWith(prefix)) {
        baseName = baseName.substring(prefix.length);
        break;
      }
    }
    
    // Then, strip any known suffix
    for (const suffix of suffixes) {
      if (baseName.endsWith(suffix)) {
        baseName = baseName.substring(0, baseName.length - suffix.length);
        break;
      }
    }
    
    // Add "Tree" suffix for consistency
    return `${baseName} Tree`;
  }
  
  // For non-trees, return the original name
  return name;
}

/**
 * Identifies the resource type based on tags
 */
function identifyResourceType(tags: string[]): string | null {
  if (tags.includes("Vein")) return "Vein";
  if (tags.includes("Herbalism")) return "Herbalism";
  if (tags.includes("Tree")) return "Tree";
  return null; // Unknown type
}

/**
 * Creates a JSON parser transform stream that handles the large JSON array
 */
function createJsonParserStream() {
  let buffer = "";
  let depth = 0;
  let inArray = false;
  let objectStart = -1;
  
  return new Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
      const str = buffer + chunk.toString();
      buffer = "";
      
      let i = 0;
      
      // Find the start of the array if we haven't found it yet
      if (!inArray) {
        i = str.indexOf('[');
        if (i !== -1) {
          inArray = true;
          i++; // Move past the '['
        } else {
          buffer = str;
          return callback();
        }
      }
      
      // Process the characters
      for (; i < str.length; i++) {
        const char = str[i];
        
        if (char === '{' && depth === 0) {
          objectStart = i;
          depth++;
        } else if (char === '{') {
          depth++;
        } else if (char === '}') {
          depth--;
          
          if (depth === 0 && objectStart !== -1) {
            // We have a complete object
            const objectStr = str.substring(objectStart, i + 1);
            try {
              const object = JSON.parse(objectStr);
              this.push(object);
            } catch (error) {
              Logger.error("utils", new Error(`Failed to parse JSON object: ${objectStr}`), error as Error);
            }
            objectStart = -1;
          }
        }
      }
      
      // Store any incomplete object in the buffer
      if (objectStart !== -1) {
        buffer = str.substring(objectStart);
      }
      
      callback();
    }
  });
}

/**
 * Seeds game resources from the cleaned_doodad.json format
 * @param mapTitle - The title of the map to seed resources for (e.g., "Irumesa")
 * @param parentTransaction - Optional parent transaction
 * @param batchSize - Batch size for processing (default: 100)
 */
export async function seedDoodadResources(
  mapTitle: string,
  parentTransaction: Transaction | null = null,
  batchSize: number = 100
): Promise<void> {
  Logger.info("utils", `Seeding doodad resources for map: ${mapTitle}...`);
  Logger.info("utils", `Using batch size of ${batchSize}`);
  
  // If we weren't provided a transaction, we'll create our own for each step
  const useParentTransaction = parentTransaction !== null;
  
  // Load resource icon mapping from JSON
  const mappingJsonPath = path.join(INPUT_DIR, "resource_icon_map.json");
  let resourceIconMapping: ResourceIconMap;
  try {
    const mappingFileContent = fs.readFileSync(mappingJsonPath, "utf-8");
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
  
  // Find the target map ID - use parent transaction if provided
  const targetMap = await GameMap.findOne({
    where: { title: mapTitle },
    transaction: parentTransaction,
  });
  if (!targetMap) {
    throw new Error(`Target map "${mapTitle}" not found in database.`);
  }
  const mapId = targetMap.dataValues.id;
  
  // ----- STEP 1: Prepare & Seed Categories -----
  
  // Collect category data
  const categoryData = new Map<
    string,
    { name: string; slug: string; iconFilename: string | null }
  >();
  
  // Add categories from the resource mapping file
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
  
  // Source file path
  const doodadJsonPath = path.join(INPUT_DIR, "cleaned_doodad.json");
  
  // Check if file exists
  if (!fs.existsSync(doodadJsonPath)) {
    throw new Error(`Doodad resource file not found: ${doodadJsonPath}`);
  }
  
  // Process the JSON file in a streaming manner
  const jsonStream = createReadStream(doodadJsonPath, { encoding: 'utf8' })
    .pipe(createJsonParserStream());
  
  let batch: DoodadResourceEntry[] = [];
  let processedCount = 0;
  let totalProcessed = 0;
  let totalResources = 0;
  let totalLinks = 0;
  let batchIndex = 0;
  
  // Process each resource object
  for await (const resource of jsonStream as any) {
    const resourceEntry = resource as DoodadResourceEntry;
    
    // Filter resources for target map (we only want resources from this map)
    if (resourceEntry.map.map !== mapTitle) {
      continue;
    }
    
    // Add to current batch
    batch.push(resourceEntry);
    processedCount++;
    
    // Process the batch if it's full
    if (batch.length >= batchSize) {
      await processBatch(
        batch,
        mapId,
        mapTitle,
        categoryIdMap,
        resourceIconMapping,
        parentTransaction,
        useParentTransaction,
        batchIndex
      );
      
      // Update counters
      totalProcessed += batch.length;
      batchIndex++;
      batch = [];
      
      // Log progress
      Logger.info(
        "utils",
        `Processed batch ${batchIndex} (${processedCount} resources so far)`
      );
    }
  }
  
  // Process any remaining resources
  if (batch.length > 0) {
    await processBatch(
      batch,
      mapId,
      mapTitle,
      categoryIdMap,
      resourceIconMapping,
      parentTransaction,
      useParentTransaction,
      batchIndex
    );
    totalProcessed += batch.length;
    Logger.info(
      "utils",
      `Processed final batch ${batchIndex + 1} (${processedCount} resources total)`
    );
  }
  
  Logger.info(
    "utils",
    `Doodad resource seeding complete. Processed ${totalProcessed} resources.`
  );
  
  // Add seederLogger.recordCounts
  seederLogger.recordCounts("Doodad Resources Total", totalProcessed, 0);
}

/**
 * Process a batch of resource entries
 */
async function processBatch(
  batch: DoodadResourceEntry[],
  mapId: string,
  mapTitle: string,
  categoryIdMap: Map<string, string>,
  resourceIconMapping: ResourceIconMap,
  parentTransaction: Transaction | null,
  useParentTransaction: boolean,
  batchIndex: number
): Promise<void> {
  // Create a new transaction for this batch if we're not using a parent transaction
  const batchTransaction = useParentTransaction ? parentTransaction : await sequelize.transaction();
  
  // Since we just created the transaction if needed, we can be sure it's not null
  // If useParentTransaction is true, we use parentTransaction which is allowed to be null
  if (!batchTransaction) {
    throw new Error('Transaction is null - this should not happen');
  }
  
  try {
    // Temporary storage for this batch
    const resourcesToCreate: any[] = [];
    const itemCategoryLinks: { gameItemId: string; gameItemCategoryId: string }[] = [];
    const processedItemIds = new Set<string>();
    
    // Process each resource in the batch
    for (const resource of batch) {
      // We need to find the appropriate mapping from resource_icon_map.json
      // First, determine the type of resource based on its tags
      const resourceType = identifyResourceType(resource.info.tags);
      if (!resourceType) {
        continue;
      }
      
      // Normalize the resource name
      const normalizedName = normalizeResourceName(resource.name, resource.info.tags);
      
      // Look up the resource in our mapping
      // For trees, we need to match against the normalized name or check various tree patterns
      let mapping;
      
      if (resourceType === 'Tree') {
        // First try to look up the exact name
        mapping = resourceIconMapping[normalizedName];
        
        if (!mapping) {
          // Try to find a match among the tree variants
          const treeBase = normalizedName.replace(' Tree', '');
          
          // Check for tree variants (Ancient, Verdant, Aging, Sapling)
          for (const key of Object.keys(resourceIconMapping)) {
            if (key.includes(treeBase) && resourceIconMapping[key].category === 'Trees') {
              mapping = resourceIconMapping[key];
              break;
            }
          }
        }
      } else if (resourceType === 'Vein') {
        // Try to find a matching ore vein
        for (const key of Object.keys(resourceIconMapping)) {
          if (key === resource.name && resourceIconMapping[key].category === 'Ores') {
            mapping = resourceIconMapping[key];
            break;
          }
        }
      } else if (resourceType === 'Herbalism') {
        // Try to find a matching herb or plant
        for (const key of Object.keys(resourceIconMapping)) {
          if (key === resource.name && 
             (resourceIconMapping[key].category === 'Herbs' || 
              resourceIconMapping[key].category === 'Plants' || 
              resourceIconMapping[key].category === 'Fibers')) {
            mapping = resourceIconMapping[key];
            break;
          }
        }
      }
      
      // Skip if no mapping found
      if (!mapping) {
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
      const itemTitle = formatTitle(normalizedName);
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
          description: `${itemTitle} Resource Node`,
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
      
      // Create a unique identifier for this resource node
      const nodeId = generateId(`${mapId}-${item.id}-${resource.map.x}-${resource.map.y}-${resource.map.z}`);
      
      // --- Prepare Resource Node ---
      resourcesToCreate.push({
        id: nodeId,
        mapId,
        itemId: item.id,
        coordinates: {
          x: resource.map.x,
          y: resource.map.y,
          z: resource.map.z,
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
      Logger.info("utils", `Created ${itemCategoryLinks.length} item-category links in batch ${batchIndex + 1}`);
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
      Logger.info("utils", `Created ${resourcesToCreate.length} resource nodes in batch ${batchIndex + 1}`);
    }
    
    // Commit the batch transaction if we're not using a parent transaction
    if (!useParentTransaction) {
      await batchTransaction.commit();
    }
  } catch (error) {
    // Roll back if there was an error and we're not using a parent transaction
    if (!useParentTransaction && batchTransaction) {
      await batchTransaction.rollback();
    }
    Logger.error("utils", new Error(`Error processing doodad resource batch ${batchIndex + 1}`), error as Error);
    throw error;
  }
} 