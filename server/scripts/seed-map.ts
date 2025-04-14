// Pre-requisite: Ensure migrations have been run (yarn db:migrate)
import "./bootstrap"; // Initialize environment, db connection etc.
import fs from "fs/promises";
import path from "path";
import { v5 as uuidv5 } from "uuid";
// Rename imported Map model to avoid conflict with built-in Map
import Logger from "@server/logging/Logger";
import {
  Map as MapModel,
  MapIcon,
  MarkerCategory,
  Marker,
} from "@server/models";
import { sequelize } from "@server/storage/database";

// Define a namespace for generating consistent UUIDs based on names
const NAMESPACE_UUID = "f5d7a4e8-6a3b-4e6f-8a4c-7f3d7a1b9e0f"; // Example namespace

async function seedMapData() {
  Logger.info("utils", "Starting map data seeding...");
  const transaction = await sequelize.transaction();

  try {
    // === 1. Upsert Map Icons ===
    Logger.info("utils", "Upserting map icons...");
    const icons = [
      {
        id: uuidv5("icon_ore", NAMESPACE_UUID),
        path: "icons/ore.png",
        public: true,
      },
      {
        id: uuidv5("icon_herb", NAMESPACE_UUID),
        path: "icons/herb.png",
        public: true,
      },
      {
        id: uuidv5("icon_skin", NAMESPACE_UUID),
        path: "icons/skin.png",
        public: true,
      },
      {
        id: uuidv5("icon_tree", NAMESPACE_UUID),
        path: "icons/tree.png",
        public: true,
      },
      {
        id: uuidv5("icon_cloth", NAMESPACE_UUID),
        path: "icons/cloth.png",
        public: true,
      },
      {
        id: uuidv5("icon_enemy", NAMESPACE_UUID),
        path: "icons/enemy.png",
        public: true,
      },
      {
        id: uuidv5("icon_poi", NAMESPACE_UUID),
        path: "icons/poi.png",
        public: true,
      },
      {
        id: uuidv5("icon_npc", NAMESPACE_UUID),
        path: "icons/npc.png",
        public: true,
      },
      {
        id: uuidv5("icon_town", NAMESPACE_UUID),
        path: "icons/town.png",
        public: true,
      },
      {
        id: uuidv5("icon_other", NAMESPACE_UUID),
        path: "icons/other.png",
        public: true,
      },
      {
        id: uuidv5("icon_dungeon", NAMESPACE_UUID),
        path: "icons/dungeon.png",
        public: true,
      },
      {
        id: uuidv5("icon_bank", NAMESPACE_UUID),
        path: "icons/bank.png",
        public: true,
      },
      {
        id: uuidv5("icon_teleport", NAMESPACE_UUID),
        path: "icons/teleport.png",
        public: true,
      },
      {
        id: uuidv5("icon_daily_quest", NAMESPACE_UUID),
        path: "icons/daily_quest.png",
        public: true,
      },
      {
        id: uuidv5("icon_raid", NAMESPACE_UUID),
        path: "icons/raid.png",
        public: true,
      },
      {
        id: uuidv5("icon_world_boss", NAMESPACE_UUID),
        path: "icons/world_boss.png",
        public: true,
      },
    ];
    await MapIcon.bulkCreate(icons as any, {
      transaction,
      updateOnDuplicate: ["path", "public", "updatedAt"],
    });
    Logger.info("utils", `Upserted ${icons.length} map icons.`);

    // === 2. Upsert Marker Categories ===
    Logger.info("utils", "Upserting marker categories...");
    const categories = [
      // Parent Category
      {
        id: uuidv5("RESOURCES", NAMESPACE_UUID),
        iconId: uuidv5("icon_other", NAMESPACE_UUID),
        title: "RESOURCES",
        public: true,
        parentId: null,
      },
      // Children Categories
      {
        id: uuidv5("ORE", NAMESPACE_UUID),
        iconId: uuidv5("icon_ore", NAMESPACE_UUID),
        title: "ORE",
        public: true,
        parentId: uuidv5("RESOURCES", NAMESPACE_UUID),
      },
      {
        id: uuidv5("HERB", NAMESPACE_UUID),
        iconId: uuidv5("icon_herb", NAMESPACE_UUID),
        title: "HERB",
        public: true,
        parentId: uuidv5("RESOURCES", NAMESPACE_UUID),
      },
      {
        id: uuidv5("SKIN", NAMESPACE_UUID),
        iconId: uuidv5("icon_skin", NAMESPACE_UUID),
        title: "SKIN",
        public: true,
        parentId: uuidv5("RESOURCES", NAMESPACE_UUID),
      }, // Ensure icon ID matches updated icon map
      {
        id: uuidv5("TREE", NAMESPACE_UUID),
        iconId: uuidv5("icon_tree", NAMESPACE_UUID),
        title: "TREE",
        public: true,
        parentId: uuidv5("RESOURCES", NAMESPACE_UUID),
      },
      {
        id: uuidv5("CLOTH", NAMESPACE_UUID),
        iconId: uuidv5("icon_cloth", NAMESPACE_UUID),
        title: "CLOTH",
        public: true,
        parentId: uuidv5("RESOURCES", NAMESPACE_UUID),
      }, // Ensure icon ID matches updated icon map
      // Other Top-Level Categories
      {
        id: uuidv5("ENEMY", NAMESPACE_UUID),
        iconId: uuidv5("icon_enemy", NAMESPACE_UUID),
        title: "ENEMY",
        public: true,
        parentId: null,
      },
      {
        id: uuidv5("POI", NAMESPACE_UUID),
        iconId: uuidv5("icon_poi", NAMESPACE_UUID),
        title: "POI",
        public: true,
        parentId: null,
      },
      {
        id: uuidv5("NPC", NAMESPACE_UUID),
        iconId: uuidv5("icon_npc", NAMESPACE_UUID),
        title: "NPC",
        public: true,
        parentId: null,
      },
      {
        id: uuidv5("TOWN", NAMESPACE_UUID),
        iconId: uuidv5("icon_town", NAMESPACE_UUID),
        title: "TOWN",
        public: true,
        parentId: null,
      },
      {
        id: uuidv5("OTHER", NAMESPACE_UUID),
        iconId: uuidv5("icon_other", NAMESPACE_UUID),
        title: "OTHER",
        public: true,
        parentId: null,
      },
      {
        id: uuidv5("DUNGEON", NAMESPACE_UUID),
        iconId: uuidv5("icon_dungeon", NAMESPACE_UUID),
        title: "DUNGEON",
        public: true,
        parentId: null,
      },
      {
        id: uuidv5("BANK", NAMESPACE_UUID),
        iconId: uuidv5("icon_bank", NAMESPACE_UUID),
        title: "BANK",
        public: true,
        parentId: null,
      },
      {
        id: uuidv5("TELEPORT", NAMESPACE_UUID),
        iconId: uuidv5("icon_teleport", NAMESPACE_UUID),
        title: "TELEPORT",
        public: true,
        parentId: null,
      },
      {
        id: uuidv5("DAILY_QUEST", NAMESPACE_UUID),
        iconId: uuidv5("icon_daily_quest", NAMESPACE_UUID),
        title: "DAILY_QUEST",
        public: true,
        parentId: null,
      },
      {
        id: uuidv5("RAID", NAMESPACE_UUID),
        iconId: uuidv5("icon_raid", NAMESPACE_UUID),
        title: "RAID",
        public: true,
        parentId: null,
      },
      {
        id: uuidv5("WORLD_BOSS", NAMESPACE_UUID),
        iconId: uuidv5("icon_world_boss", NAMESPACE_UUID),
        title: "WORLD_BOSS",
        public: true,
        parentId: null,
      },
    ];
    let createdCats = 0,
      updatedCats = 0;
    for (const catData of categories) {
      // Update fields to include parentId
      const [, created] = await MarkerCategory.findOrCreate({
        where: { id: catData.id },
        defaults: catData as any,
        transaction,
      });
      if (!created) {
        await MarkerCategory.update(catData as any, {
          where: { id: catData.id },
          transaction,
        });
        updatedCats++;
      } else {
        createdCats++;
      }
    }
    Logger.info(
      "utils",
      `Upserted ${categories.length} marker categories (${createdCats} created, ${updatedCats} updated).`
    );
    const categoryMap = new Map(categories.map((c) => [c.title, c.id]));
    // Log the created map and its keys
    console.log("[Seeder Debug] categoryMap contents:", categoryMap);
    console.log(
      "[Seeder Debug] categoryMap keys:",
      Array.from(categoryMap.keys())
    );

    // === 3. Upsert Maps ===
    Logger.info("utils", "Upserting maps...");
    const maps = [
      {
        id: uuidv5("Irumesa", NAMESPACE_UUID),
        title: "Irumesa",
        description: "Main Continent",
        path: "maps/irumesa/tiles",
        public: true,
      },
      {
        id: uuidv5("Isle of Solitude", NAMESPACE_UUID),
        title: "Isle of Solitude",
        description: "Tutorial Island",
        path: "maps/solitude/tiles",
        public: true,
      },
    ];
    await MapModel.bulkCreate(maps as any, {
      transaction,
      updateOnDuplicate: [
        "title",
        "description",
        "path",
        "public",
        "updatedAt",
      ],
    });
    Logger.info("utils", `Upserted ${maps.length} maps.`);
    const irumesaMapId = uuidv5("Irumesa", NAMESPACE_UUID);

    // === 4. Process and Upsert Markers ===
    Logger.info("utils", "Processing markers from JSON...");
    const markersJsonPath = path.resolve(
      process.cwd(),
      "tools/scripts/minimap_data/extracted/markers_markers_full_dump.json"
    );
    Logger.info("utils", `Reading markers from: ${markersJsonPath}`);
    let markersData;
    try {
      markersData = JSON.parse(await fs.readFile(markersJsonPath, "utf-8"));
    } catch (readError) {
      Logger.error(
        `FAILED to read or parse JSON from ${markersJsonPath}`,
        readError
      );
      throw readError;
    }

    if (!markersData || !markersData.$values) {
      throw new Error(
        "Invalid marker JSON data format or missing '$values' key."
      );
    }

    Logger.info(
      "utils",
      `Read ${markersData.$values.length} raw marker objects from JSON.`
    );

    const markersToUpsert = [];
    for (const marker of markersData.$values) {
      if (
        !marker.Guid ||
        marker.Position?.x === undefined ||
        marker.Position?.y === undefined ||
        marker.Position?.z === undefined ||
        !marker.GetTitle
      ) {
        Logger.warn(
          "utils",
          new Error(
            `Skipping marker due to missing essential data: ${JSON.stringify(
              marker
            ).substring(0, 100)}...`
          )
        );
        continue;
      }

      let categoryPrefix = "OTHER";
      let iconId = uuidv5("icon_other", NAMESPACE_UUID);

      const titleLower = marker.GetTitle.toLowerCase();
      if (titleLower.startsWith("poi:")) {
        categoryPrefix = "POI";
      } else if (titleLower.startsWith("town:")) {
        categoryPrefix = "TOWN";
      } else if (titleLower.startsWith("bank:")) {
        categoryPrefix = "BANK";
      } else if (titleLower.startsWith("dungeon:")) {
        categoryPrefix = "DUNGEON";
      } else if (titleLower.startsWith("raid:")) {
        categoryPrefix = "RAID";
      } else if (titleLower.startsWith("teleport:")) {
        categoryPrefix = "TELEPORT";
      } else if (titleLower.startsWith("daily quest:")) {
        categoryPrefix = "DAILY_QUEST";
      } else if (titleLower.startsWith("world boss:")) {
        categoryPrefix = "WORLD_BOSS";
      }

      const iconKey = `icon_${categoryPrefix.toLowerCase()}`;
      const matchingIcon = icons.find(
        (i) => i.id === uuidv5(iconKey, NAMESPACE_UUID)
      );
      iconId = matchingIcon
        ? matchingIcon.id
        : uuidv5("icon_other", NAMESPACE_UUID);

      const categoryId = categoryMap.get(categoryPrefix);
      if (!categoryId) {
        Logger.warn(
          "utils",
          new Error(
            `Could not find category ID for prefix '${categoryPrefix}'. Skipping marker ${marker.Guid}`
          )
        );
        continue;
      }

      markersToUpsert.push({
        id: marker.Guid,
        iconId,
        title: marker.GetTitle,
        description: marker.GetDescription || null,
        categoryId,
        ownerId: null,
        mapId: irumesaMapId,
        coordinate: {
          // Store as JSON object directly
          x: marker.Position.x,
          y: marker.Position.y,
          z: marker.Position.z,
        },
        public: true,
      });
    }

    if (markersToUpsert.length > 0) {
      Logger.info("utils", `Upserting ${markersToUpsert.length} markers...`);
      await Marker.bulkCreate(markersToUpsert as any, {
        transaction,
        updateOnDuplicate: [
          "iconId",
          "title",
          "description",
          "categoryId",
          "ownerId",
          "mapId",
          "coordinate",
          "public",
          "updatedAt",
        ],
      });
      Logger.info(
        "utils",
        `Successfully upserted ${markersToUpsert.length} markers.`
      );
    } else {
      Logger.info("utils", "No valid markers found to upsert.");
    }

    await transaction.commit();
    Logger.info("utils", "Map data seeding completed successfully.");
  } catch (error) {
    await transaction.rollback();
    Logger.error("Map data seeding failed", error);
    throw error;
  }
}

void seedMapData()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
