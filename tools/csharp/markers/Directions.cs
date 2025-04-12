using System;

// Enum definition based on usage in TileData.cs
[Serializable] // Good practice for enums used in serialization
public enum Directions : byte // Explicitly byte as TileData uses a byte field
{
    Up = 0,    // Assuming default/common values
    Down = 1,
    Left = 2,
    Right = 3
    // Add other values if discovered later
} 