using System;
using RPGLibrary.Map; // Need this for TileDataSerializable

// Recreate the WorldPartCache class for deserialization
[Serializable] // Crucial for BinaryFormatter
public class WorldPartCacheSerializable
{
    // Fields must match the original for BinaryFormatter
    public long Revision = -1L;

    // Use the serializable version of TileData we created
    public TileDataSerializable[,] DataCache = new TileDataSerializable[0,0]; // Initialize to prevent null ref

     // Parameterless constructor might be needed by some serializers/frameworks
     public WorldPartCacheSerializable() { }
} 