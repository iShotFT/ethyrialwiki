using System;

// Recreate the SerializedWorldSliceInfo class for deserialization
[Serializable] // Crucial for BinaryFormatter
public class SerializedWorldSliceInfoSerializable // Changed name slightly to avoid potential conflicts if original was internal
{
    // Fields must match the original for BinaryFormatter
    public int Revision;

    // Jagged array of integers
    public int[][] Floors = Array.Empty<int[]>(); // Initialize to prevent null ref

    // Parameterless constructor might be needed by some serializers/frameworks
    public SerializedWorldSliceInfoSerializable() { }
} 