# Interpreting .partcache JSON Output

This document explains the structure of the JSON file generated from a `.partcache` file.

## File Structure

The JSON represents a 50x50 grid of tiles from a specific section (world part) of the game map.

```json
{
  "Revision": 1709209043532, // Cache version number
  "Width": 50,               // Grid width (always 50)
  "Height": 50,              // Grid height (always 50)
  "Tiles": [                 // Array of tile data objects
    // ... (see Tile Object Structure below)
  ]
}
```

## Tile Object Structure

Each object in the `"Tiles"` array describes one tile in the grid.

```json
{
  "X": 25,          // Tile's X-coordinate within this 50x50 grid (0-49)
  "Y": 20,          // Tile's Y-coordinate within this 50x50 grid (0-49)
  "WorldX": 4575,   // Calculated absolute world X-coordinate
  "WorldY": 4020,   // Calculated absolute world Y-coordinate
  "WorldZ": 7,      // World Z-coordinate (floor level) of this part cache
  "TileID": 564,    // ID representing the tile type (ground, object, resource node)
  "Height": 0.03,   // Base height geometry
  "Tilt": 0,        // Tile tilt geometry
  "PathHeight": 0,  // Pathfinding height
  "TotalHeight": 0.03, // Calculated max height of tile surface
  "Walkable": true, // Whether the tile is traversable
  "Direction": "Up",// Tile orientation
  "RawTileData": 565010000, // Original encoded integer data
  "RawDirection": 0 // Original direction byte
}
```

## Key Fields Explained

*   **`X`, `Y`**: Local grid position (0-49).
*   **`WorldX`, `WorldY`, `WorldZ`**: The tile's absolute position in the game world. `WorldZ` is the floor level of the entire 50x50 part.
*   **`TileID`**: **Crucial for identifying resources/objects.** `-1` is typically empty ground. Positive values indicate specific ground types, objects, or **resource nodes**. You need to map these IDs (e.g., by checking in-game) to know what they represent.
*   **`Height`, `Tilt`, `TotalHeight`**: Describe the tile's ground geometry.
*   **`Walkable`**: Whether players/AI can walk here.
*   **`Direction`**: Orientation (Up, Down, Left, Right).
*   **`RawTileData`, `RawDirection`**: Original encoded values from the game file.

## Finding Resource Nodes

1.  **Identify Resource `TileID`s:** Find known resources in-game, locate the corresponding `.partcache` file, and check the `TileID` of the tile(s) the resource occupies.
2.  **Filter JSON Data:** Process the JSON output and select only the `Tile` objects whose `TileID` matches the resource IDs you've identified.
3.  **Use World Coordinates:** The `WorldX`, `WorldY`, and `WorldZ` values of the filtered tiles give you the locations of the resource nodes. 