import env from "@server/env";
import { GameItem } from "@server/models";

// Presenter for GameItem
export function presentGameItem(item: GameItem) {
  // Use iconId directly to build URL
  const iconId = item.getDataValue("iconId");

  return {
    id: item.getDataValue("id"),
    slug: item.getDataValue("slug"),
    title: item.getDataValue("title"),
    description: item.getDataValue("description"),
    iconId: iconId,
    iconUrl: iconId ? `/api/game-data/icons/${iconId}` : null, // Use new endpoint
    public: item.getDataValue("public"),
    rarityId: item.getDataValue("rarityId"),
    tier: item.getDataValue("tier"),
    weight: item.getDataValue("weight"),
    rarityColorHex: item.rarity?.getDataValue("colorHex") || null,
    requiresSkillId: item.getDataValue("requiresSkillId"),
    requiresSkillLevel: item.getDataValue("requiresSkillLevel"),
    // Add other fields as needed by the frontend
  };
} 