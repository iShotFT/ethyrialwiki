using System;
using RPGLibrary.Map;

[Serializable]
public class WorldPartCacheSerializable
{
    public long Revision = -1L;

    public TileDataSerializable[,] DataCache = new TileDataSerializable[0,0];

    public WorldPartCacheSerializable() { }
}