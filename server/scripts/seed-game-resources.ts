import "./bootstrap"; // Initialize environment, db connection etc.
import fs from "fs/promises";
import path from "path";
import { v5 as uuidv5 } from "uuid";
import env from "@server/env";
import Logger from "@server/logging/Logger";
import { sequelize } from "@server/storage/database";
import {
  GameIcon,
  GameItem,
  GameResource,
  GameMap,
  GameItemCategory,
  GameItemItemCategory
} from "@server/models";
import { DisplayGroup } from "@server/models/GameItemCategory";

// --- Configuration ---
const RESOURCE_JSON_PATH = path.resolve(
  process.cwd(),
  "tools/scripts/scraped_objects.json"
);
// Use the same namespace as seed-game-data for consistency if items/icons might overlap
const NAMESPACE_UUID = "e7a7b7f6-2a2b-4c4c-8d8d-9e9e9e9e9e9e";
const TARGET_MAP_TITLE = "Irumesa"; // Target map for these resources
// ---------------------

// Define expected structure from scraped_objects.json
interface ScrapedResourceData {
    search_pattern: string;
    position: { x: number; y: number; z: number };
    parent_name: string;
    world: string;
    zone: string;
}

// Mapping from resource name (search_pattern) to Icon Filename AND Category Name
const resourceIconMapping: Record<string, { icon: string; category: string }> = {
    "Iron Vein": { icon: "Iron_Ore_Icon.png", category: "Ores" },
    "Coal Vein": { icon: "Coal_Ore_Icon.png", category: "Ores" },
    "Copper Vein": { icon: "Copper_Ore_Icon.png", category: "Ores" },
    "Leysilver Vein": { icon: "LeysilverOre_Icon.png", category: "Ores" },
    "Gold Vein": { icon: "Gold_Ore_Icon.png", category: "Ores" },
    "Silver Vein": { icon: "SilverOre_Icon.png", category: "Ores" },
    "Flax Flower": { icon: "FlaxStraw_Icon.png", category: "Fibers" },
    "Mystril Vein": { icon: "MystrilOre_Icon.png", category: "Ores" },
    "Ancient Acacia": { icon: "AcaciaLogs_Icon.png", category: "Trees" },
    "Aging Acacia": { icon: "AcaciaLogs_Icon.png", category: "Trees" },
    "Verdant Acacia": { icon: "AcaciaLogs_Icon.png", category: "Trees" },
    "Acacia Sapling": { icon: "AcaciaLogs_Icon.png", category: "Trees" },
    "Ancient Oak": { icon: "OakLogs_Icon.png", category: "Trees" },
    "Aging Oak": { icon: "OakLogs_Icon.png", category: "Trees" },
    "Verdant Oak": { icon: "OakLogs_Icon.png", category: "Trees" },
    "Oak Sapling": { icon: "OakLogs_Icon.png", category: "Trees" },
    "Hemp Bush": { icon: "HempFibre_Icon.png", category: "Fibers" },
    "Nepbloom": { icon: "NepbloomFruit_Icon.png", category: "Plants" },
    "Redban Flower": { icon: "RedbanPetals_Icon.png", category: "Herbs" },
    "Ancient Elystram": { icon: "ElystramLogs_Icon.png", category: "Trees" },
    "Aging Elystram": { icon: "ElystramLogs_Icon.png", category: "Trees" },
    "Verdant Elystram": { icon: "ElystramLogs_Icon.png", category: "Trees" },
    "Elystram Sapling": { icon: "ElystramLogs_Icon.png", category: "Trees" },
    "Cotton Plant": { icon: "Cotton_Icon.png", category: "Fibers" },
    "Ancient Spiritwood": { icon: "SpiritwoodLogs_Icon.png", category: "Trees" },
    "Aging Spiritwood": { icon: "SpiritwoodLogs_Icon.png", category: "Trees" },
    "Verdant Spiritwood": { icon: "SpiritwoodLogs_Icon.png", category: "Trees" },
    "Spiritwood Sapling": { icon: "SpiritwoodLogs_Icon.png", category: "Trees" },
    "Frost Flower": { icon: "FrostFlowerPetals_Icon.png", category: "Herbs" },
    "Ancient Moonwillow": { icon: "MoonwillowLogs_Icon.png", category: "Trees" },
    "Aging Moonwillow": { icon: "MoonwillowLogs_Icon.png", category: "Trees" },
    "Verdant Moonwillow": { icon: "MoonwillowLogs_Icon.png", category: "Trees" },
    "Moonwillow Sapling": { icon: "MoonwillowLogs_Icon.png", category: "Trees" },
    "Ethyrite Vein": { icon: "EthyriteOre_Icon.png", category: "Ores" },
    "Palladium Vein": { icon: "PalladiumOre_Icon.png", category: "Ores" },
    "Azurium Vein": { icon: "AzuriumOre_Icon.png", category: "Ores" },
    "Feygold Vein": { icon: "FeygoldOre_Icon.png", category: "Ores" },
    "Crimsonite Vein": { icon: "CrimsoniteOre_Icon.png", category: "Ores" },
    "Celestium Vein": { icon: "CelestiumOre_Icon.png", category: "Ores" },
    "Drakonium Vein": { icon: "DrakoniumOre_Icon.png", category: "Ores" },
    "Ancient Wispwood": { icon: "WispwoodLogs_Icon.png", category: "Trees" },
    "Aging Wispwood": { icon: "WispwoodLogs_Icon.png", category: "Trees" },
    "Verdant Wispwood": { icon: "WispwoodLogs_Icon.png", category: "Trees" },
    "Wispwood Sapling": { icon: "WispwoodLogs_Icon.png", category: "Trees" },
    "Staroak Sapling": { icon: "StaroakLogs_Icon.png", category: "Trees" },
    "Ancient Staroak": { icon: "StaroakLogs_Icon.png", category: "Trees" },
    "Aging Staroak": { icon: "StaroakLogs_Icon.png", category: "Trees" },
    "Verdant Staroak": { icon: "StaroakLogs_Icon.png", category: "Trees" },
    "Aetherbark Sapling": { icon: "AetherbarkLogs_Icon.png", category: "Trees" },
    "Ancient Aetherbark": { icon: "AetherbarkLogs_Icon.png", category: "Trees" },
    "Aging Aetherbark": { icon: "AetherbarkLogs_Icon.png", category: "Trees" },
    "Verdant Aetherbark": { icon: "AetherbarkLogs_Icon.png", category: "Trees" },
    "Mana Ash Sapling": { icon: "ManaAshLogs_Icon.png", category: "Trees" },
    "Ancient Mana Ash": { icon: "ManaAshLogs_Icon.png", category: "Trees" },
    "Aging Mana Ash": { icon: "ManaAshLogs_Icon.png", category: "Trees" },
    "Verdant Mana Ash": { icon: "ManaAshLogs_Icon.png", category: "Trees" },
    "Shadewood Sapling": { icon: "ShadewoodLogs_Icon.png", category: "Trees" },
    "Ancient Shadewood": { icon: "ShadewoodLogs_Icon.png", category: "Trees" },
    "Aging Shadewood": { icon: "ShadewoodLogs_Icon.png", category: "Trees" },
    "Verdant Shadewood": { icon: "ShadewoodLogs_Icon.png", category: "Trees" },
    "Duskroot Sapling": { icon: "DuskrootLogs_Icon.png", category: "Trees" },
    "Ancient Duskroot": { icon: "DuskrootLogs_Icon.png", category: "Trees" },
    "Aging Duskroot": { icon: "DuskrootLogs_Icon.png", category: "Trees" },
    "Verdant Duskroot": { icon: "DuskrootLogs_Icon.png", category: "Trees" },
    "Primordial Sapling": { icon: "PrimordialLogs_Icon.png", category: "Trees" },
    "Ancient Primordial": { icon: "PrimordialLogs_Icon.png", category: "Trees" },
    "Aging Primordial": { icon: "PrimordialLogs_Icon.png", category: "Trees" },
    "Verdant Primordial": { icon: "PrimordialLogs_Icon.png", category: "Trees" },
    "Wispbloom": { icon: "Wispbloom_Icon.png", category: "Herbs" },
    "Elvenbloom": { icon: "Elvenbloom_Icon.png", category: "Herbs" },
    "Minweed": { icon: "Minweed_Icon.png", category: "Herbs" },
    "Ginshade": { icon: "GinshadePetals_Icon.png", category: "Herbs" },
    "Starstem": { icon: "Starstem_Icon.png", category: "Herbs" },
    "Arcanebloom": { icon: "Arcanebloom_Icon.png", category: "Herbs" },
    "Spirit Wreath": { icon: "SpiritWreath_Icon.png", category: "Herbs" },
    "Cleansing Wisteria": { icon: "WisteriaFlowerPetals_Icon.png", category: "Herbs" },
    "Wildberry Bush": { icon: "Wildberry_Icon.png", category: "Plants" },
    "Healing Flower": { icon: "Healing_Salve_Icon.png", category: "Herbs" },
    "Apple Tree": { icon: "Apple_Icon.png", category: "Plants" },
    "Grapevine": { icon: "Grapes_Icon.png", category: "Plants" },
    "Forest Canna": { icon: "ForestCannaPetals_Icon.png", category: "Herbs" },
    "Garlic Plant": { icon: "Garlic_Icon.png", category: "Plants" },
    "Slitherstrand": { icon: "Slitherstrands_Icon.png", category: "Herbs" },
    "Duskroot Plant": { icon: "Duskroot_Icon.png", category: "Plants" },
    "Magic Mushroom": { icon: "MagicMushroomPaste_Icon.png", category: "Plants" },
    "Faeplant": { icon: "Faeplant_Icon.png", category: "Plants" },
    "Glimmerwings": { icon: "Glimmerwing_Icon.png", category: "Plants" },
    "Glowshroom": { icon: "Glowshroom_Icon.png", category: "Plants" },
    "Dragonflower": { icon: "Dark_Dragon_Leaves_Icon.png", category: "Herbs" },
    "Aetherbark Tree": { icon: "AetherbarkLogs_Icon.png", category: "Trees" },
    "Blightstem": { icon: "BlightspunCloth_Icon.png", category: "Fibers" },
    "Mysticbloom": { icon: "MysticbloomFibre_Icon.png", category: "Fibers" },
    "Duskthorn": { icon: "DuskthornFibre_Icon.png", category: "Fibers" },
    "Aetherthistle": { icon: "Aetherthistle_Icon.png", category: "Herbs" },
    "Champignon": { icon: "Champignon_Icon.png", category: "Plants" },
};

// Helper to generate slug
function generateSlug(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// Helper to format title
function formatTitle(text: string): string {
  // Remove terms like " Vein", " Flower", " Bush", " Plant", " Tree"
  const baseName = text.replace(/\s+(Vein|Flower|Bush|Plant|Tree|Sapling|Ancient|Aging|Verdant)$/i, '').trim();
  // Add Ore/Logs/etc. based on original pattern if needed, or just format base
  let finalTitle = baseName;
  if (text.match(/vein/i)) finalTitle += " Ore";
  else if (text.match(/(Acacia|Oak|Elystram|Spiritwood|Moonwillow|Wispwood|Staroak|Aetherbark|Mana Ash|Shadewood|Duskroot|Primordial)/i)) finalTitle += " Logs";
  // Add more rules if necessary for fibers, petals etc.

  return finalTitle.replace(/([A-Z])/g, ' $1').replace(/[\s_]+/g, ' ').trim().toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

// Split into multiple isolated functions to avoid variable scope issues
async function loadResourceData() {
  try {
    const fileContent = await fs.readFile(RESOURCE_JSON_PATH, "utf-8");
    const data = JSON.parse(fileContent);
    Logger.info("utils", `Loaded ${Object.keys(data).length} raw resource entries from JSON.`);
    return data;
  } catch (error) {
    Logger.error("utils", new Error(`Failed to load or parse resource JSON from ${RESOURCE_JSON_PATH}`), error);
    throw error;
  }
}

async function findMapId() {
  try {
    Logger.info("utils", `Looking up map with title: ${TARGET_MAP_TITLE}`);
    const targetMap = await GameMap.findOne({ where: { title: TARGET_MAP_TITLE } });
    
    if (!targetMap) {
      throw new Error(`Target map "${TARGET_MAP_TITLE}" not found in database.`);
    }
    
    // Get map ID and force it to a primitive string
    const mapId = String(targetMap.dataValues.id);
    
    Logger.info("utils", `Found map: ${targetMap.title} with ID: ${mapId}`);
    
    // Print the map object for debugging
    Logger.info("utils", `Map object: ${JSON.stringify(targetMap)}`);
    Logger.info("utils", `Map ID type: ${typeof mapId}`);
    
    if (!mapId) {
      throw new Error(`Retrieved map ID is empty or undefined for map: ${TARGET_MAP_TITLE}`);
    }
    
    return mapId;
  } catch (error) {
    Logger.error("utils", new Error(`Failed to find map ID: ${error.message}`), error);
    throw error;
  }
}

async function seedGameResources() {
  Logger.info("utils", "Starting game resource seeding script...");

  const rawResourceData = await loadResourceData();
  const mapId = await findMapId();

  const transaction = await sequelize.transaction();
  try {
    // 1. Prepare & Seed Categories
    const categoryData = new Map<string, { name: string; slug: string; iconFilename: string | null; }>();
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
            let icon = await GameIcon.findOne({ where: { slug: iconSlug }, transaction });
            if (!icon) {
                const iconTitle = formatTitle(path.parse(cat.iconFilename).name);
                icon = await GameIcon.create({
                    id: uuidv5(iconSlug, NAMESPACE_UUID),
                    slug: iconSlug,
                    title: iconTitle,
                    originalName: cat.iconFilename,
                    path: `icons/${cat.iconFilename}`,
                    public: true,
                } as any, { transaction });
                Logger.info("utils", `Created missing category icon: ${iconTitle}`);
            }
            categoryIconIds[cat.slug] = icon.id;
        }
    }

    const categoriesToSeed = Array.from(categoryData.values()).map(cat => ({
        id: uuidv5(cat.slug, NAMESPACE_UUID),
        slug: cat.slug,
        title: cat.name,
        iconId: categoryIconIds[cat.slug] || null,
        public: true,
        displayGroup: DisplayGroup.HEATMAP, // Mark all as HEATMAP
    }));
    await GameItemCategory.bulkCreate(categoriesToSeed as any, {
        transaction,
        updateOnDuplicate: ["title", "iconId", "public", "displayGroup", "updatedAt"],
    });
    Logger.info("utils", `Upserted ${categoriesToSeed.length} GameItemCategories for resources.`);
    const categoryIdMap = new Map(categoriesToSeed.map(c => [c.slug, c.id]));

    // 2. Process Resources: Find/Create Icons, Items, and Resource Nodes
    const resourcesToCreate: any[] = [];
    const itemCategoryLinks: { gameItemId: string; gameItemCategoryId: string }[] = [];
    const processedItemIds = new Set<string>(); // Track linked items

    for (const key in rawResourceData) {
      const resource = rawResourceData[key];
      if (resource.world !== "Irumesa") continue;

      const searchPattern = resource.search_pattern;
      const mapping = resourceIconMapping[searchPattern];
      if (!mapping || !mapping.icon) continue; // Skip if no icon/mapping

      const iconFilename = mapping.icon;
      const categoryName = mapping.category;
      const categoryId = categoryIdMap.get(generateSlug(categoryName));

      if (!categoryId) {
        Logger.warn("utils", new Error(`Could not find category ID for ${categoryName}`));
        continue;
      }

      // --- Find/Create Icon ---
      const iconSlug = generateSlug(path.parse(iconFilename).name);
      let icon = await GameIcon.findOne({ where: { slug: iconSlug }, transaction });
      if (!icon) {
        const iconTitle = formatTitle(path.parse(iconFilename).name);
        icon = await GameIcon.create({
            id: uuidv5(iconSlug, NAMESPACE_UUID),
            slug: iconSlug,
            title: iconTitle,
            originalName: iconFilename,
            path: `icons/${iconFilename}`,
            public: true,
        } as any, { transaction });
        Logger.info("utils", `Created missing icon during resource loop: ${iconTitle}`);
      }
      const iconId = icon.id;

      // --- Find/Create Item ---
      const itemTitle = formatTitle(searchPattern);
      const itemSlug = generateSlug(itemTitle);
      const itemIdToFindOrCreate = uuidv5(itemSlug, NAMESPACE_UUID);

      // Find item by ID (derived from slug) first
      let item = await GameItem.findByPk(itemIdToFindOrCreate, { transaction });

      if (!item) {
        // If not found by ID, create it
        item = await GameItem.create({ // Cast to any
            id: itemIdToFindOrCreate,
            slug: itemSlug,
            title: itemTitle,
            iconId: iconId,
            public: false, // Resource items are not public by default
            // Set other defaults
            description: `${itemTitle} resource item.`,
            dropable: true, rarityId: null, tier: 0, weight: 1.0, onUseEffect: null,
            usedForSkillId: null, gatheringSpeed: null, requiresSkillId: null,
            requiresSkillLevel: 0, blueprintId: null,
        } as any, { transaction });
        Logger.info("utils", `Created missing item: ${itemTitle} (ID: ${item.id})`);
      }
      // We now have a valid 'item' instance, either found or created
      const itemId = item.id;

      // --- Link Item to Category (if not already processed) ---
      if (!processedItemIds.has(itemId)) {
        itemCategoryLinks.push({ gameItemId: itemId, gameItemCategoryId: categoryId });
        processedItemIds.add(itemId);
      }

      // --- Prepare Resource Node ---
      resourcesToCreate.push({
        id: uuidv5(key, NAMESPACE_UUID),
        mapId: mapId,
        itemId: itemId,
        coordinates: {
          x: resource.position.x,
          y: resource.position.z, // Swap Y and Z
          z: resource.position.y,
        },
        public: true,
      });
    }

    // 3. Bulk Create Item-Category Links
    await GameItemItemCategory.bulkCreate(itemCategoryLinks as any, {
        transaction,
        ignoreDuplicates: true,
    });
    Logger.info("utils", `Upserted ${itemCategoryLinks.length} GameItem <-> Category relationships.`);

    // 4. Bulk Create Resource Nodes
    const CHUNK_SIZE = 500;
    for (let i = 0; i < resourcesToCreate.length; i += CHUNK_SIZE) {
      const chunk = resourcesToCreate.slice(i, i + CHUNK_SIZE);
      Logger.info("utils", `Creating resource chunk ${i/CHUNK_SIZE + 1} (${chunk.length} resources)`);
      await GameResource.bulkCreate(chunk as any, {
        transaction,
        ignoreDuplicates: true,
      });
      Logger.info("utils", `Completed chunk ${i/CHUNK_SIZE + 1}`);
    }
    Logger.info("utils", `Seeded ${resourcesToCreate.length} GameResources.`);

    await transaction.commit();
    Logger.info("utils", "Game resource seeding completed successfully.");

  } catch (error) {
    await transaction.rollback();
    Logger.error("utils", new Error("Game resource seeding failed"), error);
    throw error;
  }
}

// --- Run Script ---
void seedGameResources()
  .then(() => {
    Logger.info("utils", "Script completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });