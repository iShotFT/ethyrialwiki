import fs from "fs/promises";
import path from "path";
import { Transaction } from "sequelize";
import Logger from "@server/logging/Logger";
import { GameMap, MapIcon, MarkerCategory, Marker } from "@server/models";
import { generateId, INPUT_DIR } from "./utils";

// Type for the raw marker data from JSON
interface RawMarkerData {
  Guid: string;
  Position?: { x?: number; y?: number; z?: number };
  GetTitle?: string;
  GetDescription?: string;
  // Add other potential fields if necessary
}

interface RawMarkerJson {
  $values: RawMarkerData[];
}

/**
 * Seeds MapIcon, MarkerCategory, GameMap, and Marker data.
 * Reads markers from a JSON file specified in INPUT_DIR.
 * @param transaction - The Sequelize transaction.
 */
export async function seedMapData(transaction: Transaction): Promise<void> {
  Logger.info(
    "utils",
    "Seeding map data (Icons, Categories, Maps, Markers)... "
  );

  // === 1. Upsert Map Icons ===
  Logger.info("utils", "Upserting map icons...");
  const icons = [
    { id: generateId("icon_ore"), path: "icons/ore.png", public: true },
    { id: generateId("icon_herb"), path: "icons/herb.png", public: true },
    { id: generateId("icon_skin"), path: "icons/skin.png", public: true },
    { id: generateId("icon_tree"), path: "icons/tree.png", public: true },
    { id: generateId("icon_cloth"), path: "icons/cloth.png", public: true },
    { id: generateId("icon_enemy"), path: "icons/enemy.png", public: true },
    { id: generateId("icon_poi"), path: "icons/poi.png", public: true },
    { id: generateId("icon_npc"), path: "icons/npc.png", public: true },
    { id: generateId("icon_town"), path: "icons/town.png", public: true },
    { id: generateId("icon_other"), path: "icons/other.png", public: true },
    { id: generateId("icon_dungeon"), path: "icons/dungeon.png", public: true },
    { id: generateId("icon_bank"), path: "icons/bank.png", public: true },
    {
      id: generateId("icon_teleport"),
      path: "icons/teleport.png",
      public: true,
    },
    {
      id: generateId("icon_daily_quest"),
      path: "icons/daily_quest.png",
      public: true,
    },
    { id: generateId("icon_raid"), path: "icons/raid.png", public: true },
    {
      id: generateId("icon_world_boss"),
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
      id: generateId("RESOURCES"),
      iconId: generateId("icon_other"),
      title: "RESOURCES",
      public: true,
      parentId: null,
    },
    // Children Categories
    {
      id: generateId("ORE"),
      iconId: generateId("icon_ore"),
      title: "ORE",
      public: true,
      parentId: generateId("RESOURCES"),
    },
    {
      id: generateId("HERB"),
      iconId: generateId("icon_herb"),
      title: "HERB",
      public: true,
      parentId: generateId("RESOURCES"),
    },
    {
      id: generateId("SKIN"),
      iconId: generateId("icon_skin"),
      title: "SKIN",
      public: true,
      parentId: generateId("RESOURCES"),
    },
    {
      id: generateId("TREE"),
      iconId: generateId("icon_tree"),
      title: "TREE",
      public: true,
      parentId: generateId("RESOURCES"),
    },
    {
      id: generateId("CLOTH"),
      iconId: generateId("icon_cloth"),
      title: "CLOTH",
      public: true,
      parentId: generateId("RESOURCES"),
    },
    // Other Top-Level Categories
    {
      id: generateId("ENEMY"),
      iconId: generateId("icon_enemy"),
      title: "ENEMY",
      public: true,
      isLabel: false,
      parentId: null,
    },
    {
      id: generateId("POI"),
      iconId: generateId("icon_poi"),
      title: "POI",
      public: true,
      isLabel: false,
      parentId: null,
    },
    {
      id: generateId("NPC"),
      iconId: generateId("icon_npc"),
      title: "NPC",
      public: true,
      isLabel: false,
      parentId: null,
    },
    {
      id: generateId("TOWN"),
      iconId: generateId("icon_town"),
      title: "TOWN",
      public: true,
      isLabel: true,
      parentId: null,
    }, // isLabel = true
    {
      id: generateId("OTHER"),
      iconId: generateId("icon_other"),
      title: "OTHER",
      public: true,
      isLabel: false,
      parentId: null,
    },
    {
      id: generateId("DUNGEON"),
      iconId: generateId("icon_dungeon"),
      title: "DUNGEON",
      public: true,
      isLabel: false,
      parentId: null,
    },
    {
      id: generateId("BANK"),
      iconId: generateId("icon_bank"),
      title: "BANK",
      public: true,
      isLabel: false,
      parentId: null,
    },
    {
      id: generateId("TELEPORT"),
      iconId: generateId("icon_teleport"),
      title: "TELEPORT",
      public: true,
      isLabel: false,
      parentId: null,
    },
    {
      id: generateId("DAILY_QUEST"),
      iconId: generateId("icon_daily_quest"),
      title: "DAILY_QUEST",
      public: true,
      isLabel: false,
      parentId: null,
    },
    {
      id: generateId("RAID"),
      iconId: generateId("icon_raid"),
      title: "RAID",
      public: true,
      isLabel: false,
      parentId: null,
    },
    {
      id: generateId("WORLD_BOSS"),
      iconId: generateId("icon_world_boss"),
      title: "WORLD_BOSS",
      public: true,
      isLabel: false,
      parentId: null,
    },
  ];

  let createdCats = 0,
    updatedCats = 0;
  for (const catData of categories) {
    const defaults = { ...catData, isLabel: catData.isLabel ?? false };
    const { 0: instance, 1: created } = await MarkerCategory.findOrCreate({
      where: { id: catData.id },
      defaults: defaults as any,
      transaction,
    });
    if (!created) {
      await instance.update(defaults as any, { transaction });
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

  // === 3. Upsert Maps ===
  Logger.info("utils", "Upserting maps...");
  const maps = [
    {
      id: generateId("Irumesa"),
      title: "Irumesa",
      description: "Main Continent",
      path: "maps/irumesa/tiles",
      public: true,
    },
    {
      id: generateId("Isle of Solitude"),
      title: "Isle of Solitude",
      description: "Tutorial Island",
      path: "maps/solitude/tiles",
      public: true,
    },
  ];
  await GameMap.bulkCreate(maps as any, {
    transaction,
    updateOnDuplicate: ["title", "description", "path", "public", "updatedAt"],
  });
  Logger.info("utils", `Upserted ${maps.length} maps.`);
  const irumesaMapId = generateId("Irumesa");

  // === 4. Process and Upsert Markers ===
  Logger.info("utils", "Processing markers from JSON...");
  const markersJsonPath = path.join(
    INPUT_DIR,
    "markers_markers_full_dump.json"
  ); // Expect in input dir
  Logger.info("utils", `Reading markers from: ${markersJsonPath}`);
  let markersData: RawMarkerJson;
  try {
    const fileContent = await fs.readFile(markersJsonPath, "utf-8");
    markersData = JSON.parse(fileContent) as RawMarkerJson;
  } catch (readError) {
    Logger.error(
      `FAILED to read or parse JSON from ${markersJsonPath}`,
      readError as Error
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
  let skippedMarkers = 0;
  for (const marker of markersData.$values) {
    if (
      !marker.Guid ||
      marker.Position?.x === undefined ||
      marker.Position?.y === undefined ||
      marker.Position?.z === undefined ||
      !marker.GetTitle
    ) {
      skippedMarkers++;
      continue;
    }

    let categoryPrefix = "OTHER";
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

    let categoryId = categoryMap.get(categoryPrefix);
    if (!categoryId) {
      Logger.warn(
        "utils",
        new Error(
          `Could not find category ID for marker title prefix '${categoryPrefix}'. Using OTHER for marker ${marker.Guid}`
        )
      );
      categoryId = categoryMap.get("OTHER");
      if (!categoryId) {
        skippedMarkers++;
        continue;
      }
    }

    const iconId =
      categories.find((c) => c.id === categoryId)?.iconId ??
      generateId("icon_other");

    markersToUpsert.push({
      id: marker.Guid,
      iconId,
      title: marker.GetTitle,
      description: marker.GetDescription || null,
      categoryId,
      ownerId: null,
      mapId: irumesaMapId,
      coordinate: {
        x: marker.Position.x,
        y: marker.Position.y,
        z: marker.Position.z,
      },
      public: true,
    });
  }

  if (skippedMarkers > 0) {
    Logger.warn(
      "utils",
      new Error(
        `Skipped ${skippedMarkers} markers due to missing essential data or category issues.`
      )
    );
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
}
