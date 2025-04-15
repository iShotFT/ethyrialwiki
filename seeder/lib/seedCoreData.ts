import Logger from "@server/logging/Logger";
import { GameSkill, GameItemRarity } from "@server/models";
import { GameSkillType } from "@server/models/GameSkill";
import { generateId } from "./utils";
import { Transaction } from "sequelize";

// --- Skill Data --- (Copied from seed-game-data.ts)
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
  {
    name: "Alchemy",
    slug: "alchemy",
    type: GameSkillType.PROFESSION,
    crafting: true,
  },
  {
    name: "Blacksmithing",
    slug: "blacksmithing",
    type: GameSkillType.PROFESSION,
    crafting: true,
  },
  {
    name: "Cooking",
    slug: "cooking",
    type: GameSkillType.PROFESSION,
    crafting: true,
  },
  {
    name: "Enchanting",
    slug: "enchanting",
    type: GameSkillType.PROFESSION,
    crafting: true,
  },
  { name: "Fishing", slug: "fishing", type: GameSkillType.PROFESSION },
  { name: "Herbalism", slug: "herbalism", type: GameSkillType.PROFESSION },
  {
    name: "Jewelcrafting",
    slug: "jewelcrafting",
    type: GameSkillType.PROFESSION,
    crafting: true,
  },
  {
    name: "Leatherworking",
    slug: "leatherworking",
    type: GameSkillType.PROFESSION,
    crafting: true,
  },
  { name: "Mining", slug: "mining", type: GameSkillType.PROFESSION },
  {
    name: "Monster Hunting",
    slug: "monster-hunting",
    type: GameSkillType.PROFESSION,
  },
  { name: "Research", slug: "research", type: GameSkillType.PROFESSION },
  { name: "Skinning", slug: "skinning", type: GameSkillType.PROFESSION },
  { name: "Trading", slug: "trading", type: GameSkillType.PROFESSION },
  { name: "Woodcutting", slug: "woodcutting", type: GameSkillType.PROFESSION },
  {
    name: "Woodworking",
    slug: "woodworking",
    type: GameSkillType.PROFESSION,
    crafting: true,
  },
];

// --- Rarity Data --- (Copied from seed-game-data.ts)
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

/**
 * Seeds core static data like Skills and Rarities.
 * @param transaction - The Sequelize transaction.
 * @returns A map of skill slugs to their IDs and rarity names to their IDs.
 */
export async function seedCoreData(transaction: Transaction): Promise<{
  skillIdMap: Map<string, string>;
  rarityIdMap: Map<string, string>;
}> {
  Logger.info("utils", "Seeding core data (Skills, Rarities)... ");

  // --- Seed GameSkills ---
  const skillDataToSeed = skills.map((s) => ({
    id: generateId(s.slug), // Use consistent ID generation
    slug: s.slug,
    title: s.name,
    description: `${s.name} skill.`,
    type: s.type,
    crafting: s.crafting ?? false,
    iconId: null,
  }));
  await GameSkill.bulkCreate(skillDataToSeed as any, {
    transaction,
    updateOnDuplicate: [
      "title",
      "description",
      "type",
      "crafting",
      "iconId",
      "updatedAt",
    ],
  });
  Logger.info("utils", `Seeded ${skillDataToSeed.length} GameSkills.`);
  const skillIdMap = new Map(skillDataToSeed.map((s) => [s.slug, s.id]));

  // --- Seed GameItemRarity ---
  const rarityDataToSeed = rarities.map((r) => ({
    id: generateId(r.slug), // Use consistent ID generation
    slug: r.slug,
    title: r.name,
    colorHex: r.colorHex,
  }));
  await GameItemRarity.bulkCreate(rarityDataToSeed as any, {
    transaction,
    updateOnDuplicate: ["title", "colorHex", "updatedAt"],
  });
  Logger.info("utils", `Seeded ${rarityDataToSeed.length} GameItemRarities.`);
  const rarityIdMap = new Map(rarityDataToSeed.map((r) => [r.title, r.id]));

  return { skillIdMap, rarityIdMap };
}
