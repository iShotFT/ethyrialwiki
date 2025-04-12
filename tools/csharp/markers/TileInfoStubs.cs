using System;

// Minimal stub for TileInfo to satisfy TileData
[Serializable] // If TileInfo itself might be serialized elsewhere
public class TileInfo
{
    // Add properties if TileData actually USES them in ways that affect deserialization
    // For now, we only need the type to exist.
    // public string Name { get; set; } = "Unknown";
}

// Minimal stub for TileManager
public static class TileManager
{
    // Return a default/dummy TileInfo. This won't be called during basic
    // BinaryFormatter deserialization of TileData fields, but might be called
    // if code tries to *use* the TileData properties after deserialization.
    public static TileInfo GetInfo(short tileId)
    {
        // In a real scenario, this might look up tile info, but for deserialization
        // of the TileData struct itself, we just need the method to exist.
        return new TileInfo(); // Return a dummy object
    }
}

// Stub for SharedValues if needed by TileData properties (like Walkable)
public static class SharedValues
{
    // Define constants used by TileData properties if they are accessed post-deserialization
    // Example: Value used in TileData.Walkable
    public const float MaxWalkableTilt = 1.5f; // GUESS - adjust if known
    public const int WorldSlizeSize = 100;
    public const int WorldMapSlice = 100;
    public const int NearbyWorldPartsFloors = 1; // GUESS - from WorldPart.cs
    public const int NearbyPlayerMaxFloorDifferenceAbove = 2; // GUESS - from TileEngine.cs

} 