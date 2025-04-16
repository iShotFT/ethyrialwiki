using System;

[Serializable]
public class SerializedWorldSliceInfoSerializable
{
    public int Revision;

    public int[][] Floors = Array.Empty<int[]>();

    public SerializedWorldSliceInfoSerializable() { }
}