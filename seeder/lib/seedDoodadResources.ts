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

// Define Extra type locally to avoid import issues
type Extra = Record<string, any>;

// Interface for the resource entry from the doodad.json file
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
  // Handle special case for Corrupted Birch - normalize to Birch Tree
  if (name === "Corrupted Birch" || name.includes("Corrupted Birch")) {
    return "Birch Tree";
  }
  
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

// Add a function to check if a resource should be skipped
function shouldSkipResource(resourceName: string, tags: string[]): boolean {
  // List of resource names to skip
  const skippedResources = [
    "Flax Flower Petals"
  ];
  
  // Check if the resource name is in the skip list
  return skippedResources.includes(resourceName);
}

/**
 * Identifies the resource type based on tags
 */
function identifyResourceType(tags: string[] | null | undefined): string | null {
  // Handle null or undefined tags
  if (!tags || !Array.isArray(tags)) {
    return null; // Return null for unknown/invalid type
  }
  
  if (tags.includes("Vein")) return "Vein";
  if (tags.includes("Herbalism")) return "Herbalism";
  if (tags.includes("Tree")) return "Tree";
  return null; // Unknown type
}

/**
 * Load the doodad.json file entirely and parse it
 * @param filePath Path to the doodad.json file
 * @returns Array of parsed DoodadResourceEntry objects
 */
function loadDoodadJson(filePath: string): DoodadResourceEntry[] {
  try {
    // Read the file synchronously - this loads the entire file into memory
    Logger.info("utils", `Loading entire JSON file: ${filePath}`);
    const fileContent = fs.readFileSync(filePath, "utf-8");
    Logger.info("utils", `File loaded, parsing JSON...`);
    
    // Parse the JSON content
    const data = JSON.parse(fileContent);
    
    // Handle different possible structures
    if (Array.isArray(data)) {
      Logger.info("utils", `Successfully parsed JSON array with ${data.length} items`);
      return data;
    } else if (typeof data === "object") {
      // Try to find an array inside the object
      for (const key in data) {
        if (Array.isArray(data[key])) {
          Logger.info("utils", `Found array in key "${key}" with ${data[key].length} items`);
          return data[key];
        }
      }
    }
    
    // If we got here, the structure isn't what we expected
    Logger.warn("utils", new Error("JSON structure is not an array as expected"));
    return [];
  } catch (error) {
    const errorMessage = `Failed to load or parse doodad.json: ${(error as Error).message}`;
    Logger.error(
      "utils", 
      new Error(errorMessage),
      error as any
    );
    return [];
  }
}

/**
 * Seeds game resources from the doodad.json format
 * @param mapTitle - The title of the map to seed resources for (e.g., "Irumesa")
 * @param parentTransaction - Optional parent transaction
 * @param batchSize - Batch size for processing (default: 100)
 */
export async function seedDoodadResources(
  mapTitle: string,
  parentTransaction: Transaction | null = null,
  batchSize: number = 100
): Promise<void> {
  const startTime = Date.now();
  Logger.info("utils", `Seeding doodad resources for map: ${mapTitle}...`);
  Logger.info("utils", `Using batch size of ${batchSize}`);
  
  // If we weren't provided a transaction, we'll create our own for each step
  const useParentTransaction = parentTransaction !== null;
  
  // Load resource icon mapping from JSON
  const mappingJsonPath = path.join(INPUT_DIR, "resource_icon_map.json");
  let resourceIconMapping: ResourceIconMap;
  try {
    const mappingFileContent = fs.readFileSync(mappingJsonPath, "utf-8");
    // Remove comments and parse - this handles JSON with comments
    const cleanedContent = mappingFileContent
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .replace(/\/\/.*/g, '');          // Remove single-line comments
    
    resourceIconMapping = JSON.parse(cleanedContent) as ResourceIconMap;
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
  Logger.info("utils", "Step 1: Preparing resource categories...");
  
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
  
  Logger.info("utils", `Found ${categoryData.size} unique resource categories`);
  
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
  Logger.info("utils", "Step 2: Processing doodad resources...");
  
  // Source file path - use doodad.json file
  const doodadJsonPath = path.join(INPUT_DIR, "doodad_fixed.json");
  
  // Check if file exists
  if (!fs.existsSync(doodadJsonPath)) {
    throw new Error(`Doodad resource file not found: ${doodadJsonPath}`);
  }
  
  Logger.info("utils", `Reading doodad resource file: ${doodadJsonPath}`);

  // Get file size for reporting
  const fileStats = fs.statSync(doodadJsonPath);
  Logger.info("utils", `Doodad file size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);

  // Load the entire doodad.json file at once
  const allResources = loadDoodadJson(doodadJsonPath);
  const totalEntries = allResources.length;
  Logger.info("utils", `Loaded ${totalEntries} total resources from file`);
  
  // Process resources in batches
  let totalProcessed = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalLinks = 0;
  let batchIndex = 0;
  
  // Process resources in batches of batchSize
  for (let i = 0; i < allResources.length; i += batchSize) {
    const batchResources = allResources.slice(i, i + batchSize);
    
    // Filter resources for the target map
    const mapFilteredBatch = batchResources.filter(resource => 
      resource.map && resource.map.map === mapTitle
    );
    
    if (mapFilteredBatch.length === 0) {
      totalProcessed += batchResources.length;
      continue; // Skip empty batches
    }
    
    // Process the current batch
    const batchResult = await processBatch(
      mapFilteredBatch,
      mapId,
      mapTitle,
      categoryIdMap,
      resourceIconMapping,
      parentTransaction,
      useParentTransaction,
      batchIndex
    );
    
    // Update counters
    totalProcessed += batchResources.length;
    totalCreated += batchResult.created;
    totalUpdated += batchResult.updated;
    totalLinks += batchResult.links;
    batchIndex++;
    
    // Log progress with percentage
    const progressPercentage = Math.round((totalProcessed / totalEntries) * 100);
    
    Logger.info(
      "utils",
      `Processed batch ${batchIndex}: ${batchResult.created} resources created, ` +
      `${batchResult.updated} updated, ${batchResult.links} item-category links. ` +
      `Total: ${totalProcessed}/${totalEntries} resources (${progressPercentage}%)`
    );
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  Logger.info(
    "utils",
    `Doodad resource seeding complete. Processed ${totalProcessed} resources in ${duration}s.`
  );
  
  // Add seederLogger.recordCounts
  seederLogger.recordCounts("Doodad Resources Total", totalCreated, totalUpdated);
  seederLogger.recordCounts("Doodad Resource Items", totalLinks, 0);
}

/**
 * Process a batch of resource entries
 * @returns {Object} Stats about created/updated resources and links
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
): Promise<{ created: number; updated: number; links: number }> {
  // Determine which transaction to use
  let batchTransaction: Transaction | null = null;
  
  try {
    // Create a new transaction if we're not using the parent one
    if (!useParentTransaction) {
      batchTransaction = await sequelize.transaction();
    } else {
      batchTransaction = parentTransaction;
    }
    
    if (!batchTransaction) {
      throw new Error('No valid transaction available. This should not happen.');
    }
    
    // Temporary storage for this batch
    const resourcesToCreate: any[] = [];
    const itemCategoryLinks: { gameItemId: string; gameItemCategoryId: string }[] = [];
    const processedItemIds = new Set<string>();
    let resourcesCreated = 0;
    let resourcesUpdated = 0;
    
    // Track resource IDs to prevent duplicates in the same batch
    const processedResourceIds = new Set<string>();
    
    // Process each resource in the batch
    for (const resource of batch) {
      try {
        // Validate resource data
        if (!resource.map || !resource.info) {
          continue;
        }
        
        // Check if this resource should be skipped based on its name
        const resourceName = resource.info.name || resource.name;
        if (shouldSkipResource(resourceName, resource.info.tags || [])) {
          Logger.debug(
            "utils",
            `Skipping unwanted resource: ${resourceName}`
          );
          continue;
        }

        // Normalize resource name
        const normalizedName = normalizeResourceName(
          resourceName,
          resource.info.tags || []
        );
        
        // Identify resource type - safely handle null tags
        const resourceType = identifyResourceType(resource.info.tags);
        if (!resourceType) {
          continue;
        }
        
        // Find mapping for this resource with flexible matching
        let mapping = resourceIconMapping[normalizedName];
        
        // If no direct match, try different matching strategies based on resource type
        if (!mapping && resourceType) {
          if (resourceType === 'Tree') {
            // For trees, try to find the base name match
            const treeBase = normalizedName.replace(' Tree', '');
            
            // Check if any tree in the mapping contains this base name
            for (const key of Object.keys(resourceIconMapping)) {
              const keyMapping = resourceIconMapping[key];
              if (keyMapping.category === 'Trees' && 
                  (key.includes(treeBase) || treeBase.includes(key.replace(' Tree', '')))) {
                mapping = keyMapping;
                break;
              }
            }
          } else if (resourceType === 'Vein') {
            // For ore veins, try to match by category
            for (const key of Object.keys(resourceIconMapping)) {
              const keyMapping = resourceIconMapping[key];
              if (key.includes('Vein') && keyMapping.category === 'Ores') {
                // Try to match the ore name
                const oreName = normalizedName.replace(' Vein', '');
                const keyOreName = key.replace(' Vein', '');
                
                if (oreName === keyOreName || key.includes(oreName) || oreName.includes(keyOreName)) {
                  mapping = keyMapping;
                  break;
                }
              }
            }
          } else if (resourceType === 'Herbalism') {
            // For herbs and plants, try category-based matching
            const relevantCategories = ['Herbs', 'Plants', 'Fibers'];
            
            for (const key of Object.keys(resourceIconMapping)) {
              const keyMapping = resourceIconMapping[key];
              if (relevantCategories.includes(keyMapping.category)) {
                // Check for name similarity
                if (key.includes(normalizedName) || normalizedName.includes(key)) {
                  mapping = keyMapping;
                  break;
                }
              }
            }
          }
          
          // As a last resort, try a partial match on any resource
          if (!mapping) {
            for (const key of Object.keys(resourceIconMapping)) {
              if (key.toLowerCase().includes(normalizedName.toLowerCase()) || 
                  normalizedName.toLowerCase().includes(key.toLowerCase())) {
                mapping = resourceIconMapping[key];
                break;
              }
            }
          }
        }
        
        // Skip if no mapping found
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
        
        // Skip if we've already processed this resource ID in the current batch
        if (processedResourceIds.has(nodeId)) {
          Logger.debug(
            "utils",
            `Skipping duplicate resource ID ${nodeId} in batch ${batchIndex}`
          );
          continue;
        }
        
        // Add this ID to our tracking set
        processedResourceIds.add(nodeId);
        
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
      } catch (resourceError) {
        // Continue with next resource instead of failing the whole batch
        continue;
      }
    }
    
    // Bulk create item-category links for this batch
    if (itemCategoryLinks.length > 0) {
      await GameItemItemCategoryModel.bulkCreate(itemCategoryLinks as any, {
        transaction: batchTransaction,
        ignoreDuplicates: true,
      });
    }
    
    // Log duplicate detection results
    if (batch.length !== resourcesToCreate.length) {
      Logger.info(
        "utils",
        `Batch ${batchIndex}: Filtered out ${batch.length - resourcesToCreate.length} duplicate resource entries`
      );
    }
    
    // Bulk create resource nodes for this batch
    if (resourcesToCreate.length > 0) {
      const createResult = await GameResource.bulkCreate(resourcesToCreate as any, {
        transaction: batchTransaction,
        updateOnDuplicate: [
          "mapId",
          "itemId",
          "coordinates",
          "public",
          "updatedAt",
        ],
        returning: true
      });
      
      // Count created vs updated nodes
      resourcesCreated = createResult.filter(r => {
        return r.dataValues && (r as any)._options?.isNewRecord;
      }).length;
      resourcesUpdated = createResult.length - resourcesCreated;
    }
    
    // Commit the transaction if we created it and everything succeeded
    if (!useParentTransaction && batchTransaction) {
      await batchTransaction.commit();
    }
    
    return {
      created: resourcesCreated, 
      updated: resourcesUpdated,
      links: itemCategoryLinks.length
    };
  } catch (error) {
    // Only rollback if we created the transaction and it still exists
    if (!useParentTransaction && batchTransaction) {
      try {
        await batchTransaction.rollback();
      } catch (rollbackError) {
        Logger.error(
          "utils",
          new Error(`Error during transaction rollback: ${rollbackError.message}`),
          error
        );
      }
    }
    
    // Add more detailed error logging
    Logger.error(
      "utils",
      new Error(`Error processing doodad resource batch ${batchIndex + 1}`),
      error
    );
    
    throw error;
  }
} 