import env from "@server/env";
import { Map, MapIcon, MarkerCategory } from "@server/models";

// Basic presenter stub for Map
export function presentMap(map: Map) {
  return {
    id: map.getDataValue("id"),
    title: map.getDataValue("title"),
    description: map.getDataValue("description"),
    path: map.getDataValue("path"), // Include path if needed by frontend
    public: map.getDataValue("public"),
    // Add other relevant fields later
  };
}

// Define the return type for the presenter, including children
interface PresentedCategory {
  id: string;
  title: string;
  description: string | null;
  iconId: string;
  iconUrl: string | null;
  public: boolean;
  parentId: string | null;
  children: PresentedCategory[];
}

// Basic presenter stub for MarkerCategory
export function presentMarkerCategory(
  category: MarkerCategory
): PresentedCategory {
  const iconPath = category.icon?.getDataValue("path");
  // Explicitly use getDataValue for children
  const childrenData = category.getDataValue("children");

  return {
    id: category.getDataValue("id"),
    title: category.getDataValue("title"),
    description: category.getDataValue("description"),
    iconId: category.getDataValue("iconId"),
    iconUrl: iconPath ? `${env.CDN_URL || ""}/${iconPath}` : null,
    public: category.getDataValue("public"),
    parentId: category.getDataValue("parentId"),
    children: childrenData
      ? childrenData.map(presentMarkerCategory) // Map over the retrieved children data
      : [],
  };
}
