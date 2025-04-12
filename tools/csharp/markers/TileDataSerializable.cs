using System;
using System.Text.Json.Serialization;
using UnityEngine; // Use stubbed UnityEngine
// using RPGLibrary.Map; // Don't use original namespace if types are global now or stubbed

// Recreate the TileData struct for deserialization, including necessary dependencies
namespace RPGLibrary.Map // Keep the original namespace for BinaryFormatter
{
    #pragma warning disable CS0649 // Disable warning about fields never being assigned to (BinaryFormatter does this)
    [Serializable] // Crucial for BinaryFormatter
    public struct TileDataSerializable
    {
        // --- Serialized Fields ---
        // These MUST match the original definition for BinaryFormatter
        // BinaryFormatter serializes fields, including private ones if marked [Serializable]
        private int tileData; // Use the exact same name and type
        private byte direction; // Use the exact same name and type

        // --- Properties for Accessing Data (Post-Deserialization) ---
        // These properties decode the packed tileData integer.
        // They need access to stubbed dependencies like Mathf and SharedValues.

        [JsonIgnore] // Exclude from JSON helpers if they cause issues
        public Directions Direction => (Directions)direction;

        [JsonIgnore]
        public int GetTileDataValue => tileData;

        [JsonIgnore]
        public int PathHeightPercentage => (int)Math.Round((double)tileData / Math.Pow(10.0, 1.0) % 10.0 * 10.0);

        [JsonIgnore]
        public int TiltPercentage => (int)((double)(tileData + 1) / Math.Pow(10.0, 3.0) % 10.0 * 10.0);

        [JsonIgnore]
        public int HeightPercentage => (int)((double)(tileData + 1) / Math.Pow(10.0, 5.0) % 10.0 * 10.0);

        [JsonIgnore]
        public float Height => Mathf.Clamp(3f * ((float)HeightPercentage / 99f), 0.01f, 3f);

        [JsonIgnore]
        public float Tilt => Mathf.Clamp(3f * ((float)TiltPercentage / 99f), 0f, 3f - GetHeight);

        [JsonIgnore]
        public float PathHeight => 3f * ((float)PathHeightPercentage / 99f);

        [JsonIgnore]
        private bool _walkable => (int)((double)tileData / Math.Pow(10.0, 10.0) % 10.0 * 10.0) > 0;

        [JsonIgnore]
        // Use global::SharedValues to ensure we get the stub class from the global namespace
        public bool Walkable => Tilt <= global::SharedValues.MaxWalkableTilt && (PathHeight > 0f || _walkable);

        [JsonIgnore]
        public short TileID => (short)(-1 + (int)((double)(tileData + 1) / Math.Pow(10.0, 7.0) % 100.0 * 10.0));

        [JsonIgnore]
        // Use global::TileManager to ensure we get the stub class from the global namespace
        public TileInfo TileInfo => global::TileManager.GetInfo(TileID);

        [JsonIgnore]
        public float TotalHeight => Mathf.Clamp(GetHeight + Tilt * 0.5f, 0f, 3f);

        [JsonIgnore]
        public float GetHeight
        {
            get
            {
                int pathHeightPercentage = PathHeightPercentage;
                return (pathHeightPercentage > 0) ? (3f * ((float)pathHeightPercentage / 99f)) : Height;
            }
        }

        // Properties needed for conditions like checking for resource nodes later
        [JsonIgnore]
        public bool NotEmpty => TileID != -1 || PathHeight > 0f || _walkable;
        [JsonIgnore]
        public bool IsEmpty => !NotEmpty;
        [JsonIgnore]
        public bool IsInvisible => TileID <= 0;
        [JsonIgnore]
        public bool AIUnWalkable => TileID == 0 && PathHeight == 0f;

        // --- Constructor (Needed for BinaryFormatter?) ---
        // While BinaryFormatter primarily uses fields, having a constructor matching
        // the original *might* sometimes be necessary depending on internal details.
        // However, it often works without one if fields are public or the class is Serializable.
        // Let's omit constructors initially unless deserialization fails.

         // Parameterless constructor might be needed by some serializers/frameworks
        // public TileDataSerializable() {
        //     tileData = 0;
        //     direction = (byte)Directions.Up;
        // }
    }
     #pragma warning restore CS0649
}

// Helper class for cleaner JSON output from WorldPartCacheProcessor
public class JsonTileData
{
    // Local coordinates within the 50x50 grid
    public int X { get; set; }
    public int Y { get; set; }

    // Calculated World Coordinates
    public int WorldX { get; set; } // Calculated based on part filename and X
    public int WorldY { get; set; } // Calculated based on part filename and Y
    public int WorldZ { get; set; } // From part filename (floor level)

    // Decoded Tile Properties
    public short TileID { get; set; }
    public float Height { get; set; }
    public float Tilt { get; set; }
    public float PathHeight { get; set; }
    public float TotalHeight { get; set; }
    public bool Walkable { get; set; }
    public string Direction { get; set; } = "Up";
    public int RawTileData { get; set; }
    public byte RawDirection { get; set; }
    // Add other decoded properties if needed

    // Updated constructor to accept world part origin coordinates
    public JsonTileData(int x, int y, int partOriginX, int partOriginY, int partOriginZ, RPGLibrary.Map.TileDataSerializable data)
    {
        X = x;
        Y = y;
        WorldX = partOriginX * 50 + x; // Calculate World X
        WorldY = partOriginY * 50 + y; // Calculate World Y
        WorldZ = partOriginZ;           // Assign World Z (floor level)

        // Wrap property access in try-catch in case stubs are incomplete
        try { TileID = data.TileID; } catch { TileID = -999; }
        try { Height = data.Height; } catch { Height = -999f; }
        try { Tilt = data.Tilt; } catch { Tilt = -999f; }
        try { PathHeight = data.PathHeight; } catch { PathHeight = -999f; }
        try { TotalHeight = data.TotalHeight; } catch { TotalHeight = -999f; }
        try { Walkable = data.Walkable; } catch { Walkable = false; }
        try { Direction = data.Direction.ToString(); } catch { Direction = "Error"; }
        RawTileData = data.GetTileDataValue;
        RawDirection = (byte)data.Direction;
    }
} 