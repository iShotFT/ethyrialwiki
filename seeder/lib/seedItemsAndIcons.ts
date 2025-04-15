import fs from "fs/promises";
import path from "path";
import { glob } from "glob";
import { Transaction } from "sequelize";
import Logger from "@server/logging/Logger";
import {
  GameIcon,
  GameItemCategory,
  GameItem,
  GameItemRarity,
  GameSkill,
  GameItemItemCategory as GameItemItemCategoryModel, // Alias join table model
} from "@server/models";
import { DisplayGroup } from "@server/models/GameItemCategory";
import { sequelize } from "@server/storage/database";
import { uploadFileToS3 } from "./s3Utils";
import {
  generateSlug,
  formatTitle,
  generateId,
  INPUT_DIR,
  NAMESPACE_UUID,
} from "./utils";
import env from "@server/env"; // For S3 bucket name

const CONCURRENCY = 10; // Number of parallel uploads
const TARGET_S3_FOLDER = "icons"; // Target folder within the bucket

interface ProcessedIconData {
  id: string;
  title: string;
  slug: string;
  originalName: string;
  s3Path: string;
  localPath: string;
  type: "Ore" | "Bar" | "Other"; // Identified type
}

// --- Mappings (Copied from seed-game-data.ts) ---
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
  crimsonite: "Rare",
};

// Ore Tier/Level Data
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
// --- End Mappings ---

/**
 * Processes local icon files, uploads them (optional), and seeds GameIcon, GameItemCategory,
 * GameItem, and the item-category relationships.
 * @param skipUpload - If true, skips uploading icons to S3 and assumes they exist.
 * @param skillIdMap - Map of skill slugs to IDs.
 * @param rarityIdMap - Map of rarity names to IDs.
 * @param transaction - The Sequelize transaction.
 */
export async function seedItemsAndIcons(
  skipUpload: boolean,
  skillIdMap: Map<string, string>,
  rarityIdMap: Map<string, string>,
  transaction: Transaction
): Promise<void> {
  Logger.info("utils", "Seeding Items, Icons, and Categories...");

  const s3Bucket = env.AWS_S3_UPLOAD_BUCKET_NAME;
  if (!skipUpload && !s3Bucket) {
    throw new Error(
      "AWS_S3_UPLOAD_BUCKET_NAME must be set if skipUpload is false."
    );
  }

  const sourceIconsDir = path.join(INPUT_DIR, "icons"); // Expect icons in input/icons
  Logger.info("utils", `Icon Source Directory: ${sourceIconsDir}`);

  // 1. Find local icon files
  const pattern = path.join(sourceIconsDir, "*_Icon.png").replace(/\\/g, "/");
  let localIconPaths: string[] = [];
  try {
    localIconPaths = await glob(pattern);
    Logger.info(
      "utils",
      `Found ${localIconPaths.length} potential icon files.`
    );
  } catch (err) {
    Logger.error(
      "utils",
      new Error(`Error searching for icons in ${sourceIconsDir}`),
      err
    );
    throw err;
  }

  if (localIconPaths.length === 0) {
    Logger.warn(
      "utils",
      new Error(
        "No icon files found matching pattern. Skipping icon/item seeding based on icons."
      )
    );
    return;
  }

  // 2. Process and optionally upload icons
  Logger.info(
    "utils",
    `${skipUpload ? "Processing" : "Uploading"} ${
      localIconPaths.length
    } icons...`
  );
  const processedIcons: ProcessedIconData[] = [];
  let successfulUploads = 0;
  let failedUploads = 0;
  const uploadPromises = [];

  for (const localPath of localIconPaths) {
    uploadPromises.push(async () => {
      const originalName = path.basename(localPath);
      const baseName = originalName.replace(/_Icon\.png$/, "");
      const s3Path = `${TARGET_S3_FOLDER}/${originalName}`;
      let success = true;

      if (!skipUpload && s3Bucket) {
        success = await uploadFileToS3(s3Bucket, s3Path, localPath);
      }

      if (success) {
        if (!skipUpload) successfulUploads++;

        let type: ProcessedIconData["type"] = "Other";
        let title = "";
        const prefixedBarMatch = baseName.match(
          /^(Strengthened|Fortified|Mythical)\s+(.*?)Bar$/i
        );
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

        const lowerBaseName = baseName.toLowerCase();
        const excludedPatterns = [/claymore/i, /spore/i, /core/i];
        const isExcluded = excludedPatterns.some((pattern) =>
          lowerBaseName.match(pattern)
        );

        if (isExcluded && isPotentialOreOrBar) {
          type = "Other";
          title = formatTitle(baseName);
          Logger.debug(
            "utils",
            `Excluding item based on name pattern: ${originalName}`
          );
        } else if (type === "Other") {
          title = formatTitle(baseName);
        }

        const slug = generateSlug(title);
        const iconId = generateId(slug); // Use helper for consistent ID

        processedIcons.push({
          id: iconId,
          title,
          slug,
          originalName,
          s3Path,
          localPath,
          type,
        });
      } else {
        if (!skipUpload) failedUploads++;
      }
    });
  }

  // Execute uploads/processing concurrently
  const queue = [...uploadPromises];
  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift();
      if (task) {
        await task();
        if (
          !skipUpload &&
          (successfulUploads + failedUploads) % 50 === 0 &&
          successfulUploads + failedUploads > 0
        ) {
          Logger.info(
            "utils",
            `Icon Upload Progress: ${successfulUploads} uploaded, ${failedUploads} failed...`
          );
        }
      }
    }
  }
  const workers = Array(CONCURRENCY).fill(null).map(worker);
  await Promise.all(workers);

  if (!skipUpload) {
    Logger.info("utils", "--- Icon Upload Summary ---");
    Logger.info("utils", `Successfully uploaded: ${successfulUploads}`);
    Logger.info("utils", `Failed uploads:        ${failedUploads}`);
    Logger.info("utils", "-------------------------");
    if (failedUploads > 0) {
      Logger.warn(
        "utils",
        new Error(
          `${failedUploads} icon uploads failed. Corresponding items might be missing icons.`
        )
      );
    }
  }

  if (processedIcons.length === 0) {
    Logger.error(
      "utils",
      new Error(
        "No icons were processed successfully. Aborting item/category seeding."
      )
    );
    return; // Stop if no icons processed
  }

  // 3. Seed GameIcons - Deduplicate first
  const uniqueIconsMap = new Map<string, ProcessedIconData>();
  processedIcons.forEach((icon) => {
    if (!uniqueIconsMap.has(icon.id)) {
      uniqueIconsMap.set(icon.id, icon);
    } else {
      Logger.warn(
        "utils",
        new Error(
          `Duplicate slug/ID generated for icon: ${icon.slug}. Original: ${
            uniqueIconsMap.get(icon.id)?.originalName
          }, New: ${icon.originalName}`
        )
      );
    }
  });
  const uniqueIconsToSeed = Array.from(uniqueIconsMap.values());
  const iconDataToSeed = uniqueIconsToSeed.map((icon) => ({
    id: icon.id,
    slug: icon.slug,
    title: icon.title,
    originalName: icon.originalName,
    path: icon.s3Path,
    public: true,
  }));
  await GameIcon.bulkCreate(iconDataToSeed as any, {
    transaction,
    updateOnDuplicate: ["title", "originalName", "path", "public", "updatedAt"],
  });
  Logger.info(
    "utils",
    `Seeded/Updated ${iconDataToSeed.length} unique GameIcons.`
  );

  // 4. Prepare and Seed Categories (Ores, Bars)
  const oreIcons = uniqueIconsToSeed.filter((icon) => icon.type === "Ore");
  const barIcons = uniqueIconsToSeed.filter((icon) => icon.type === "Bar");
  const oreCategoryIconId =
    oreIcons.length > 0
      ? oreIcons[Math.floor(Math.random() * oreIcons.length)].id
      : null;
  const barCategoryIconId =
    barIcons.length > 0
      ? barIcons[Math.floor(Math.random() * barIcons.length)].id
      : null;

  const categoriesToSeed = [
    {
      id: generateId("ores"),
      slug: "ores",
      title: "Ores",
      iconId: oreCategoryIconId,
      public: true,
      displayGroup: DisplayGroup.HEATMAP, // Ores are heatmap category
    },
    {
      id: generateId("bars"),
      slug: "bars",
      title: "Bars",
      iconId: barCategoryIconId,
      public: true,
      displayGroup: null,
    },
  ];
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
    `Seeded/Updated ${categoriesToSeed.length} GameItemCategories (Ores, Bars).`
  );
  const categoryIdMap = new Map(categoriesToSeed.map((c) => [c.slug, c.id]));

  // 5. Prepare and Seed GameItems (Ores, Bars)
  const miningSkillId = skillIdMap.get("mining");
  const itemsToSeed = uniqueIconsToSeed // Use unique icons
    .filter((icon) => icon.type === "Ore" || icon.type === "Bar")
    .map((icon) => {
      let baseMaterialName = icon.title.replace(/ (Ore|Bar)$/, "");
      const prefixMatch = baseMaterialName.match(
        /^(Strengthened|Fortified|Mythical) (.+)$/
      );
      if (prefixMatch) baseMaterialName = prefixMatch[2];
      const baseMaterialLower = baseMaterialName.toLowerCase();

      let rarityId: string | null = null;
      const rarityName = materialRarityMap[baseMaterialLower];
      if (rarityName) rarityId = rarityIdMap.get(rarityName) || null;
      else
        Logger.warn(
          "utils",
          new Error(
            `Rarity mapping not found for: ${baseMaterialName} (from item: ${icon.title})`
          )
        );

      let tier = 0;
      let reqSkillId: string | null = null;
      let reqSkillLevel = 0;
      let itemWeight = 1.0;

      if (icon.type === "Ore") {
        tier = oreTiers[baseMaterialLower] ?? 0;
        if (tier > 0) {
          reqSkillId = miningSkillId ?? null;
          reqSkillLevel = tierLevels[tier] ?? 0;
        }
        if (tier === 0 && baseMaterialLower !== "coal") {
          Logger.warn(
            "utils",
            new Error(
              `Ore tier mapping not found for: ${baseMaterialName} (from item: ${icon.title})`
            )
          );
        }
        if (tier >= 6) itemWeight = 2.5;
        else if (tier >= 4) itemWeight = 1.5;
        else itemWeight = 1.0;
      } else if (icon.type === "Bar") {
        itemWeight = 0.8;
      }

      return {
        id: generateId(icon.slug), // Use consistent ID
        slug: icon.slug,
        title: icon.title,
        description: `${icon.title} item.`,
        iconId: icon.id,
        public: true, // Items generally public
        dropable: true,
        rarityId,
        tier,
        weight: itemWeight,
        onUseEffect: null,
        usedForSkillId: null,
        gatheringSpeed: null,
        requiresSkillId: reqSkillId,
        requiresSkillLevel: reqSkillLevel,
        blueprintId: null,
      };
    });

  await GameItem.bulkCreate(itemsToSeed as any, {
    transaction,
    updateOnDuplicate: [
      "title",
      "description",
      "iconId",
      "public",
      "dropable",
      "rarityId",
      "tier",
      "weight",
      "onUseEffect",
      "usedForSkillId",
      "gatheringSpeed",
      "requiresSkillId",
      "requiresSkillLevel",
      "blueprintId",
      "updatedAt",
    ],
  });
  Logger.info("utils", `Seeded/Updated ${itemsToSeed.length} GameItems.`);

  // 6. Seed Join Table: GameItemItemCategory
  const itemCategoryRelations = itemsToSeed
    .map((item) => {
      const originalIcon = uniqueIconsMap.get(item.iconId);
      if (
        !originalIcon ||
        (originalIcon.type !== "Ore" && originalIcon.type !== "Bar")
      )
        return null;
      const categorySlug = originalIcon.type.toLowerCase() + "s";
      return {
        gameItemId: item.id,
        gameItemCategoryId: categoryIdMap.get(categorySlug)!,
      };
    })
    .filter(Boolean);

  await GameItemItemCategoryModel.bulkCreate(itemCategoryRelations as any, {
    transaction,
    ignoreDuplicates: true,
  });
  Logger.info(
    "utils",
    `Seeded/Updated ${itemCategoryRelations.length} GameItem <-> Category relationships.`
  );
}
