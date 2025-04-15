import "./bootstrap"; // Initialize environment, db connection etc.
import fs from "fs/promises";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { glob } from "glob";
import mime from "mime-types";
import { v5 as uuidv5 } from "uuid";
import env from "@server/env";
import Logger from "@server/logging/Logger";
import { sequelize } from "@server/storage/database";
import {
  GameIcon,
  GameItemCategory,
  GameItem,
  GameItemRarity, // Needed for default items
  GameSkill,      // Needed for default items
} from "@server/models";
import { GameSkillType } from "@server/models/GameSkill"; // Import enum
import { DisplayGroup } from "@server/models/GameItemCategory"; // Import DisplayGroup enum

// --- Skill Data ---
const skills = [
  // Combat
  { name: "Heavy Armor", slug: "heavy-armor", type: GameSkillType.COMBAT },
  { name: "Light Armor", slug: "light-armor", type: GameSkillType.COMBAT },
  { name: "Medium Armor", slug: "medium-armor", type: GameSkillType.COMBAT },
  { name: "Magic", slug: "magic", type: GameSkillType.COMBAT },
  { name: "Ranged", slug: "ranged", type: GameSkillType.COMBAT },
  { name: "Melee", slug: "melee", type: GameSkillType.COMBAT },
  // Disciplines
  { name: "Demonism", slug: "demonism", type: GameSkillType.DISCIPLINES },
  { name: "Empyrean", slug: "empyrean", type: GameSkillType.DISCIPLINES },
  // Profession
  { name: "Alchemy", slug: "alchemy", type: GameSkillType.PROFESSION, crafting: true },
  { name: "Blacksmithing", slug: "blacksmithing", type: GameSkillType.PROFESSION, crafting: true },
  { name: "Cooking", slug: "cooking", type: GameSkillType.PROFESSION, crafting: true },
  { name: "Enchanting", slug: "enchanting", type: GameSkillType.PROFESSION, crafting: true },
  { name: "Fishing", slug: "fishing", type: GameSkillType.PROFESSION },
  { name: "Herbalism", slug: "herbalism", type: GameSkillType.PROFESSION },
  { name: "Jewelcrafting", slug: "jewelcrafting", type: GameSkillType.PROFESSION, crafting: true },
  { name: "Leatherworking", slug: "leatherworking", type: GameSkillType.PROFESSION, crafting: true },
  { name: "Mining", slug: "mining", type: GameSkillType.PROFESSION },
  { name: "Monster Hunting", slug: "monster-hunting", type: GameSkillType.PROFESSION },
  { name: "Research", slug: "research", type: GameSkillType.PROFESSION },
  { name: "Skinning", slug: "skinning", type: GameSkillType.PROFESSION },
  { name: "Trading", slug: "trading", type: GameSkillType.PROFESSION },
  { name: "Woodcutting", slug: "woodcutting", type: GameSkillType.PROFESSION },
  { name: "Woodworking", slug: "woodworking", type: GameSkillType.PROFESSION, crafting: true },
];

// --- Rarity Data ---
const rarities = [
  { name: "None", slug: "none", colorHex: "#ffffff" }, // White
  { name: "Common", slug: "common", colorHex: "#9A9A9A" }, // Gray
  { name: "Uncommon", slug: "uncommon", colorHex: "#15ff00" }, // Green
  { name: "Rare", slug: "rare", colorHex: "#2396ff" }, // Blue
  { name: "Epic", slug: "epic", colorHex: "#a335ee" }, // Purple
  { name: "Legendary", slug: "legendary", colorHex: "#ff8100" }, // Orange
  { name: "Relic", slug: "relic", colorHex: "#F44336" }, // Redish
  { name: "Quest Item", slug: "quest-item", colorHex: "#fff400" }, // Yellow
];

// Mapping from Ore/Bar base name (lowercase) to Rarity Name
const materialRarityMap: Record<string, string> = {
  copper: "Common",
  iron: "Common",
  coal: "Common",
  silver: "Uncommon",
  gold: "Uncommon",
  ethyrite: "Uncommon",
  platinum: "Rare",
  mystril: "Rare",
  palladium: "Rare",
  azurium: "Uncommon",
  crimsonite: "Rare", // Updated rarity
  // Note: We need a way to handle prefixed bars like "Strengthened Drakonium"
  // For now, they might default to null or we need more complex logic
};

// --- Ore Tier/Level Data ---
const oreTiers: Record<string, number> = {
  copper: 1,
  silver: 2,
  iron: 2,
  gold: 3,
  coal: 3,
  platinum: 4,
  ethyrite: 4,
  azurium: 5,
  palladium: 5,
  mystril: 6,
  crimsonite: 7,
};

const tierLevels: Record<number, number> = {
  1: 0,
  2: 5,
  3: 10,
  4: 15,
  5: 20,
  6: 25,
  7: 25, // T7 also requires 25
};

// --- Configuration ---
const SOURCE_ICONS_DIR = path.resolve(
  process.cwd(),
  "tools/scripts/icons"
);
const TARGET_S3_FOLDER = "icons"; // Target folder within the bucket
const CONCURRENCY = 10; // Number of parallel uploads (can adjust)
const NAMESPACE_UUID = "e7a7b7f6-2a2b-4c4c-8d8d-9e9e9e9e9e9e"; // NEW unique namespace for game data
const SKIP_UPLOAD = false; // <-- SET TO true TO SKIP UPLOAD, false TO UPLOAD
// ---------------------

const s3Client = new S3Client({
  region: env.AWS_REGION,
  endpoint: env.AWS_S3_UPLOAD_BUCKET_URL,
  forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
  },
});

interface ProcessedIconData {
  id: string;
  title: string;
  slug: string;
  originalName: string;
  s3Path: string;
  localPath: string;
  type: "Ore" | "Bar" | "Other"; // Identified type
}

// Helper to generate slug (lowercase, hyphenated)
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '') // Remove invalid chars
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Trim hyphens from start/end
}

// Helper to format title (Capitalize Words, Space separators)
function formatTitle(text: string): string {
  // Add space before capital letters (for CamelCase splitting) then handle spaces/underscores
  return text
    .replace(/([A-Z])/g, ' $1') // Add space before capitals
    .replace(/[_\s]+/g, ' ')     // Replace underscores/multiple spaces with single space
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase()); // Capitalize first letter of each word
}

// Helper to upload a single icon file
async function uploadIcon(
  s3Bucket: string,
  s3KeyPrefix: string,
  localFilePath: string
): Promise<{ success: boolean; s3Path: string | null }> {
  const fileName = path.basename(localFilePath);
  const s3Key = `${s3KeyPrefix}/${fileName}`;
  const contentType = mime.lookup(localFilePath) || "application/octet-stream";

  try {
    const fileBuffer = await fs.readFile(localFilePath);
    const command = new PutObjectCommand({
      Bucket: s3Bucket,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: env.AWS_S3_ACL === "public-read" ? "public-read" : "private",
    });

    await s3Client.send(command);
    return { success: true, s3Path: s3Key };
  } catch (error) {
    Logger.error(`Failed to upload ${fileName} to ${s3Bucket}/${s3Key}`, error);
    return { success: false, s3Path: null };
  }
}

// --- Main Seeding Function ---
async function seedGameData() {
  Logger.info("utils", "Starting game data seeding script...");

  const s3Bucket = env.AWS_S3_UPLOAD_BUCKET_NAME;
  if (!s3Bucket) {
    throw new Error(
      "AWS_S3_UPLOAD_BUCKET_NAME environment variable is not set."
    );
  }
  Logger.info("utils", `Source Icon Directory: ${SOURCE_ICONS_DIR}`);
  Logger.info("utils", `Target S3 Bucket/Folder: ${s3Bucket}/${TARGET_S3_FOLDER}/`);

  // 1. Find local icon files
  const pattern = path.join(SOURCE_ICONS_DIR, "*_Icon.png").replace(/\\/g, "/");
  Logger.info("utils", `Searching for icons using pattern: ${pattern}`);
  const localIconPaths = await glob(pattern);
  Logger.info("utils", `Found ${localIconPaths.length} potential icon files.`);

  if (localIconPaths.length === 0) {
    Logger.warn("utils", new Error("No icon files found matching pattern. Exiting."));
    return;
  }

  // 2. Upload icons and process data
  Logger.info("utils", `Uploading ${localIconPaths.length} icons to S3...`);
  const processedIcons: ProcessedIconData[] = [];
  let successfulUploads = 0;
  let failedUploads = 0;

  // Using Promise.all for concurrency (adjust CONCURRENCY as needed)
  const uploadPromises = [];
  for (const localPath of localIconPaths) {
      uploadPromises.push(async () => {
          // Assume success and construct path if skipping, otherwise call upload
          let s3Path: string | null = SKIP_UPLOAD ? `${TARGET_S3_FOLDER}/${path.basename(localPath)}` : null;
          let success = SKIP_UPLOAD;

          if (!SKIP_UPLOAD) {
              const uploadResult = await uploadIcon(s3Bucket, TARGET_S3_FOLDER, localPath);
              success = uploadResult.success;
              s3Path = uploadResult.s3Path;
          }

          if (success && s3Path) { // Ensure s3Path is not null
              if (!SKIP_UPLOAD) successfulUploads++; // Only count if actually uploaded
              const originalName = path.basename(localPath);

              // Attempt to parse title and type
              let baseName = originalName.replace(/_Icon\.png$/, ""); // Remove suffix
              let type: ProcessedIconData["type"] = "Other";
              let title = "";

              // Use stricter regex requiring space or end-of-string after Ore/Bar
              // Prioritize prefixed bars first
              const prefixedBarMatch = baseName.match(/^(Strengthened|Fortified|Mythical)\s+(.*?)Bar$/i);
              // Updated Ore/Bar regex to avoid matching mid-word like "Claymore"
              const barMatch = baseName.match(/^(.*?)(_Bar|\sBar)$/i);
              const oreMatch = baseName.match(/^(.*?)(_Ore|\sOre)$/i);

              let potentialBaseName = "";
              let isPotentialOreOrBar = false;

              if (prefixedBarMatch) {
                  type = "Bar";
                  potentialBaseName = `${prefixedBarMatch[1]} ${prefixedBarMatch[2]}`;
                  title = formatTitle(potentialBaseName + " Bar");
                  isPotentialOreOrBar = true;
              } else if (barMatch) {
                  type = "Bar";
                  potentialBaseName = barMatch[1];
                  title = formatTitle(potentialBaseName + " Bar");
                  isPotentialOreOrBar = true;
              } else if (oreMatch) {
                  type = "Ore";
                  potentialBaseName = oreMatch[1];
                  title = formatTitle(potentialBaseName + " Ore");
                  isPotentialOreOrBar = true;
              }

              // Exclusions - Check baseName *before* removing Ore/Bar suffix
              // Also check potentialBaseName if it was detected as Ore/Bar
              const lowerBaseName = baseName.toLowerCase();
              const excludedPatterns = [/claymore/i, /spore/i, /core/i];
              const isExcluded = excludedPatterns.some(pattern => lowerBaseName.match(pattern));

              if (isExcluded && isPotentialOreOrBar) {
                  // It matched Ore/Bar suffix but is in exclusion list
                  type = "Other";
                  title = formatTitle(baseName); // Use original formatted base name
                  Logger.info("utils", `Excluding item based on name pattern: ${originalName}`);
              } else if (type === "Other") {
                  // Fallback title formatting if no specific type matched AND not excluded
                  title = formatTitle(baseName);
              }

              const slug = generateSlug(title);
              const iconId = uuidv5(slug, NAMESPACE_UUID); // Use slug for deterministic ID

              processedIcons.push({
                  id: iconId,
                  title: title, // Use formatted title for GameIcon title as well
                  slug: slug,
                  originalName: originalName,
                  s3Path: s3Path,
                  localPath: localPath,
                  type: type,
              });
          } else {
              if (!SKIP_UPLOAD) failedUploads++; // Only count if upload was attempted
          }
      });
  }

    // Execute uploads concurrently
    const queue = [...uploadPromises];
    async function worker() {
        while (queue.length > 0) {
            const task = queue.shift();
            if (task) {
                await task();
                 // Log progress periodically
                if ((successfulUploads + failedUploads) % 50 === 0 && successfulUploads + failedUploads > 0) {
                    Logger.info(
                    "utils",
                    `Upload Progress: ${successfulUploads} uploaded, ${failedUploads} failed...`
                    );
                }
            }
        }
    }
    const workers = Array(CONCURRENCY).fill(null).map(worker);
    await Promise.all(workers);


  Logger.info("utils", "--- Upload Summary ---");
  Logger.info("utils", `Successfully uploaded: ${successfulUploads}`);
  Logger.info("utils", `Failed uploads:        ${failedUploads}`);
  Logger.info("utils", `Skipped uploads:       ${SKIP_UPLOAD ? localIconPaths.length : 0}`);
  Logger.info("utils", "----------------------");

  if (processedIcons.length === 0) {
      Logger.error("utils", new Error("No icons were processed (check file patterns and names). Aborting seed."));
      return;
  }


  // 3. Seed Database
  Logger.info("utils", "Starting database seeding...");
  const transaction = await sequelize.transaction();
  try {
    // --- Seed GameSkills ---
    const skillDataToSeed = skills.map(s => ({
      id: uuidv5(s.slug, NAMESPACE_UUID),
      slug: s.slug,
      title: s.name,
      description: `${s.name} skill.`, // Basic description
      type: s.type,
      crafting: s.crafting ?? false,
      iconId: null, // TODO: Add logic to find/assign icons later if needed
    }));
    await GameSkill.bulkCreate(skillDataToSeed as any, {
      transaction,
      updateOnDuplicate: ["title", "description", "type", "crafting", "iconId", "updatedAt"],
    });
    Logger.info("utils", `Seeded ${skillDataToSeed.length} GameSkills.`);
    const skillIdMap = new Map(skillDataToSeed.map(s => [s.slug, s.id]));
    const miningSkillId = skillIdMap.get("mining"); // Get Mining skill ID
    // --- End Seed GameSkills ---

    // --- Seed GameItemRarity ---
    const rarityDataToSeed = rarities.map(r => ({
      id: uuidv5(r.slug, NAMESPACE_UUID), // Use slug for deterministic ID
      slug: r.slug,
      title: r.name,
      colorHex: r.colorHex,
    }));
    await GameItemRarity.bulkCreate(rarityDataToSeed as any, {
      transaction,
      updateOnDuplicate: ["title", "colorHex", "updatedAt"],
    });
    Logger.info("utils", `Seeded ${rarityDataToSeed.length} GameItemRarities.`);
    const rarityIdMap = new Map(rarityDataToSeed.map(r => [r.title, r.id]));
    // --- End Seed GameItemRarity ---

    // Seed GameIcons - Deduplicate first
    const uniqueIconsMap = new Map<string, ProcessedIconData>();
    processedIcons.forEach(icon => {
        if (!uniqueIconsMap.has(icon.id)) {
            uniqueIconsMap.set(icon.id, icon);
        } else {
            Logger.warn("utils", new Error(`Duplicate slug/ID generated for icon: ${icon.slug} (Original names: ${uniqueIconsMap.get(icon.id)?.originalName}, ${icon.originalName}) - Skipping duplicate.`))
        }
    });
    const uniqueIconsToSeed = Array.from(uniqueIconsMap.values());

    const iconDataToSeed = uniqueIconsToSeed.map(icon => ({
        id: icon.id,
        slug: icon.slug,
        title: icon.title, // Seed with formatted title
        originalName: icon.originalName,
        path: icon.s3Path, // Use the S3 path
        public: true,
    }));
    await GameIcon.bulkCreate(iconDataToSeed as any, {
      transaction,
      updateOnDuplicate: ["title", "originalName", "path", "public", "updatedAt"],
    });
    Logger.info("utils", `Seeded ${iconDataToSeed.length} unique GameIcons.`);

    // Prepare and Seed Categories (Ores, Bars)
    const oreIcons = processedIcons.filter(icon => icon.type === "Ore");
    const barIcons = processedIcons.filter(icon => icon.type === "Bar");

    if (oreIcons.length === 0) {
        Logger.warn("utils", new Error("No Ore icons found to select a category icon from."));
    }
    if (barIcons.length === 0) {
        Logger.warn("utils", new Error("No Bar icons found to select a category icon from."));
    }

    const oreCategoryIconId = oreIcons.length > 0 ? oreIcons[Math.floor(Math.random() * oreIcons.length)].id : null;
    const barCategoryIconId = barIcons.length > 0 ? barIcons[Math.floor(Math.random() * barIcons.length)].id : null;

    const categoriesToSeed = [
      {
        id: uuidv5("ores", NAMESPACE_UUID),
        slug: "ores",
        title: "Ores",
        iconId: oreCategoryIconId,
        public: true,
        displayGroup: DisplayGroup.HEATMAP, // Set display group for Ores
      },
      {
        id: uuidv5("bars", NAMESPACE_UUID),
        slug: "bars",
        title: "Bars",
        iconId: barCategoryIconId,
        public: true,
        displayGroup: null, // Bars are not in heatmap group (or set if needed)
      },
    ];
    await GameItemCategory.bulkCreate(categoriesToSeed as any, {
        transaction,
        updateOnDuplicate: ["title", "iconId", "public", "displayGroup", "updatedAt"], // Add displayGroup to update
    });
    Logger.info("utils", `Seeded ${categoriesToSeed.length} GameItemCategories.`);
    const categoryIdMap = new Map(categoriesToSeed.map(c => [c.slug, c.id]));

    // Prepare and Seed GameItems (Ores, Bars) - ADD RARITY, TIER, SKILL REQS
    const itemsToSeed = processedIcons
        .filter(icon => icon.type === "Ore" || icon.type === "Bar")
        .map(icon => {
            // Determine Base Name
            let baseMaterialName = icon.title.replace(/ (Ore|Bar)$/, '');
            const prefixMatch = baseMaterialName.match(/^(Strengthened|Fortified|Mythical) (.+)$/);
            if (prefixMatch) {
                baseMaterialName = prefixMatch[2];
            }
            const baseMaterialLower = baseMaterialName.toLowerCase();

            // Determine Rarity
            let rarityId: string | null = null;
            const rarityName = materialRarityMap[baseMaterialLower];
            if (rarityName) {
                rarityId = rarityIdMap.get(rarityName) || null;
            } else {
                Logger.warn("utils", new Error(`Rarity mapping not found for base material: ${baseMaterialName} (from item: ${icon.title})`));
            }

            // Determine Tier, Skill Requirements (Only for Ores for now)
            let tier = 0;
            let reqSkillId: string | null = null;
            let reqSkillLevel = 0;
            let itemWeight = 1.0; // Default weight

            if (icon.type === "Ore") {
                tier = oreTiers[baseMaterialLower] ?? 0;
                if (tier > 0) {
                    reqSkillId = miningSkillId ?? null;
                    reqSkillLevel = tierLevels[tier] ?? 0;
                }
                if (tier === 0 && baseMaterialLower !== 'coal') { // Coal has tier 3 but no specific mining req level in example
                     Logger.warn("utils", new Error(`Ore tier mapping not found for base material: ${baseMaterialName} (from item: ${icon.title})`));
                }
                // Assign weights (example: higher tiers are heavier)
                if (tier >= 6) itemWeight = 2.5;
                else if (tier >= 4) itemWeight = 1.5;
                else itemWeight = 1.0;
            } else if (icon.type === "Bar") {
                // Assign weight to bars (example)
                itemWeight = 0.8;
            }

            return {
                id: uuidv5(icon.slug, NAMESPACE_UUID),
                slug: icon.slug,
                title: icon.title,
                description: `${icon.title} item.`, // Simple description
                iconId: icon.id,
                public: true,
                dropable: true,
                rarityId: rarityId,
                tier: tier, // Assign tier
                weight: itemWeight, // Assign weight
                onUseEffect: null,
                usedForSkillId: null,
                gatheringSpeed: null,
                requiresSkillId: reqSkillId, // Assign req skill ID
                requiresSkillLevel: reqSkillLevel, // Assign req skill level
                blueprintId: null,
            };
     });

    // Deduplicate items before seeding
    const uniqueItemsMap = new Map<string, typeof itemsToSeed[0]>();
    itemsToSeed.forEach(item => {
        if (!uniqueItemsMap.has(item.id)) {
            uniqueItemsMap.set(item.id, item);
        } else {
             // Log potential item duplicates if needed, though they stem from icon duplicates
        }
    });
    const uniqueItemsToSeed = Array.from(uniqueItemsMap.values());

    await GameItem.bulkCreate(uniqueItemsToSeed as any, {
        transaction,
        updateOnDuplicate: [
            "title", "description", "iconId", "public", "dropable", "rarityId",
            "tier", "weight", // Add tier and weight
            "onUseEffect", "usedForSkillId", "gatheringSpeed", "requiresSkillId",
            "requiresSkillLevel", "blueprintId", "updatedAt"
        ],
    });
    Logger.info("utils", `Seeded ${uniqueItemsToSeed.length} unique GameItems.`);

    // Seed Join Table: GameItemItemCategory - Use unique items for relations
    const itemCategoryRelations = uniqueItemsToSeed
        .map(item => {
            // Find original processed icon to determine type
            const originalIcon = uniqueIconsMap.get(item.iconId);
            if (!originalIcon || (originalIcon.type !== "Ore" && originalIcon.type !== "Bar")) {
                return null; // Should not happen if items came from processedIcons
            }
            const categorySlug = originalIcon.type.toLowerCase() + "s";
            return {
                gameItemId: item.id,
                gameItemCategoryId: categoryIdMap.get(categorySlug)!,
            };
        })
        .filter(Boolean); // Filter out any nulls

    // Need to import the join table model if not already done
    const GameItemItemCategory = sequelize.model("GameItemItemCategory");
    await GameItemItemCategory.bulkCreate(itemCategoryRelations as any, {
        transaction,
        ignoreDuplicates: true, // Ignore if relation already exists
    });
    Logger.info("utils", `Seeded ${itemCategoryRelations.length} GameItem <-> Category relationships.`);

    // Commit transaction
    await transaction.commit();
    Logger.info("utils", "Database seeding completed successfully.");

  } catch (error) {
    await transaction.rollback();
    Logger.error("utils", error as Error);
    throw error;
  }
}

// --- Run Script ---
void seedGameData()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
