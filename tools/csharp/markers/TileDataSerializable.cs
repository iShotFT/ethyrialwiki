using System;
using System.Text.Json.Serialization;
using UnityEngine;

namespace RPGLibrary.Map
{
    #pragma warning disable CS0649
    [Serializable]
    public struct TileDataSerializable
    {
        private int tileData;
        private byte direction;

        [JsonIgnore]
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
        public bool Walkable => Tilt <= global::SharedValues.MaxWalkableTilt && (PathHeight > 0f || _walkable);

        [JsonIgnore]
        public short TileID => (short)(-1 + (int)((double)(tileData + 1) / Math.Pow(10.0, 7.0) % 100.0 * 10.0));

        [JsonIgnore]
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

        [JsonIgnore]
        public bool NotEmpty => TileID != -1 || PathHeight > 0f || _walkable;
        [JsonIgnore]
        public bool IsEmpty => !NotEmpty;
        [JsonIgnore]
        public bool IsInvisible => TileID <= 0;
        [JsonIgnore]
        public bool AIUnWalkable => TileID == 0 && PathHeight == 0f;
    }
    #pragma warning restore CS0649
}

public class JsonTileData
{
    public int X { get; set; }
    public int Y { get; set; }

    public int WorldX { get; set; }
    public int WorldY { get; set; }
    public int WorldZ { get; set; }

    public short TileID { get; set; }
    public float Height { get; set; }
    public float Tilt { get; set; }
    public float PathHeight { get; set; }
    public float TotalHeight { get; set; }
    public bool Walkable { get; set; }
    public string Direction { get; set; } = "Up";
    public int RawTileData { get; set; }
    public byte RawDirection { get; set; }

    public JsonTileData(int x, int y, int partOriginX, int partOriginY, int partOriginZ, RPGLibrary.Map.TileDataSerializable data)
    {
        X = x;
        Y = y;
        WorldX = partOriginX * 50 + x;
        WorldY = partOriginY * 50 + y;
        WorldZ = partOriginZ;

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