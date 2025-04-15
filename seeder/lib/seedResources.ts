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
 * @param transaction - The Sequelize transaction.
 */
export async function seedResources(
  mapTitle: string,
  transaction: Transaction
): Promise<void> {
  Logger.info("utils", "Seeding game resources...");

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

  // Find the target map ID
  const targetMap = await GameMap.findOne({
    where: { title: mapTitle },
    transaction,
  });
  if (!targetMap) {
    throw new Error(`Target map "${mapTitle}" not found in database.`);
  }
  const mapId = targetMap.id;

  // 1. Prepare & Seed Categories based on mappings
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

  const categoryIconIds: Record<string, string | null> = {};
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
        transaction,
      });
      categoryIconIds[cat.slug] = icon.id;
    }
  }

  const categoriesToSeed = Array.from(categoryData.values()).map((cat) => ({
    id: generateId(cat.slug),
    slug: cat.slug,
    title: cat.name,
    iconId: categoryIconIds[cat.slug] || null,
    public: true,
    displayGroup: DisplayGroup.HEATMAP, // Mark all resource categories as HEATMAP
  }));
  await GameItemCategory.bulkCreate(categoriesToSeed as any, {
    transaction,
    updateOnDuplicate: [
      "title",
      "iconId",
      "public",
      "displayGroup",
      "updatedAt",
    ],
  });
  Logger.info(
    "utils",
    `Upserted ${categoriesToSeed.length} GameItemCategories for resources.`
  );
  const categoryIdMap = new Map(categoriesToSeed.map((c) => [c.slug, c.id]));

  // 2. Process Resources: Find/Create Icons, Items, and Resource Nodes
  const resourcesToCreate: any[] = [];
  const itemCategoryLinks: {
    gameItemId: string;
    gameItemCategoryId: string;
  }[] = [];
  const processedItemIds = new Set<string>();

  for (const key in rawResourceData) {
    const resource = rawResourceData[key];
    // Filter by world if needed (e.g., only Irumesa)
    if (resource.world !== mapTitle) {
      // Assuming world name matches map title
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
      transaction,
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

    const [item] = await GameItem.findOrCreate({
      where: { id: itemId },
      defaults: {
        id: itemId,
        slug: itemSlug,
        title: itemTitle,
        iconId: icon.id, // Use found/created icon ID
        public: false, // Resource items are not public by default
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
      transaction,
    });

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

  // 3. Bulk Create Item-Category Links
  if (itemCategoryLinks.length > 0) {
    await GameItemItemCategoryModel.bulkCreate(itemCategoryLinks as any, {
      transaction,
      ignoreDuplicates: true,
    });
    Logger.info(
      "utils",
      `Upserted ${itemCategoryLinks.length} GameItem <-> Category relationships.`
    );
  }

  // 4. Bulk Create Resource Nodes
  if (resourcesToCreate.length > 0) {
    const CHUNK_SIZE = 500;
    Logger.info(
      "utils",
      `Upserting ${resourcesToCreate.length} GameResources...`
    );
    for (let i = 0; i < resourcesToCreate.length; i += CHUNK_SIZE) {
      const chunk = resourcesToCreate.slice(i, i + CHUNK_SIZE);
      await GameResource.bulkCreate(chunk as any, {
        transaction,
        updateOnDuplicate: [
          "mapId",
          "itemId",
          "coordinates",
          "public",
          "updatedAt",
        ],
      });
      // Optional: Progress logging per chunk
      // Logger.info("utils", `Upserted resource chunk ${i / CHUNK_SIZE + 1} (${chunk.length} resources)`);
    }
    Logger.info(
      "utils",
      `Finished upserting ${resourcesToCreate.length} GameResources.`
    );
  } else {
    Logger.info("utils", "No resource nodes to create.");
  }
}
