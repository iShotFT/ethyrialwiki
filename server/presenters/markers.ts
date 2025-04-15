import env from "@server/env";
import { Marker, MapIcon } from "@server/models";
import { Coordinate } from "@server/models/Marker"; // Import Coordinate type

// Basic presenter stub for Marker
export function presentMarker(marker: Marker) {
  let coordinate: Coordinate | null;
  try {
    const rawCoordinate = marker.getDataValue("coordinate");
    coordinate =
      typeof rawCoordinate === "string"
        ? JSON.parse(rawCoordinate)
        : rawCoordinate;
  } catch (e) {
    coordinate = null;
  }

  const iconPath = marker.icon?.getDataValue("path");
  const iconId = marker.icon?.getDataValue("id");

  return {
    id: marker.getDataValue("id"),
    title: marker.getDataValue("title"),
    description: marker.getDataValue("description"),
    coordinate,
    categoryId: marker.getDataValue("categoryId"),
    iconId: marker.getDataValue("iconId"),
    iconUrl: iconPath ? `/api/game-data/icons/${iconId}` : null,
    ownerId: marker.getDataValue("ownerId"),
    public: marker.getDataValue("public"),
  };
}
