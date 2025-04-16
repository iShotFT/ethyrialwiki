using System;

[Serializable]
public class TileInfo
{
}

public static class TileManager
{
    public static TileInfo GetInfo(short tileId)
    {
        return new TileInfo();
    }
}

public static class SharedValues
{
    public const float MaxWalkableTilt = 1.5f;
    public const int WorldSlizeSize = 100;
    public const int WorldMapSlice = 100;
    public const int NearbyWorldPartsFloors = 1;
    public const int NearbyPlayerMaxFloorDifferenceAbove = 2;
}