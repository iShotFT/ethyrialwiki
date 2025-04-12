using System;
using System.Collections.Generic;

// Minimal stubs for dependencies to allow compilation
// We only care about the structure for deserialization
namespace UnityEngine
{
    public struct Vector3 { public float x, y, z; }
    public struct Vector2 { public float x, y; }
    public static class Mathf {
        public static float Sqrt(float f) => (float)Math.Sqrt(f);
        public static float Abs(float f) => Math.Abs(f);
        public static float Round(float f) => (float)Math.Round(f);
        public static int FloorToInt(float f) => (int)Math.Floor(f);
        public static float Lerp(float a, float b, float t) => a + (b - a) * t; // Basic Lerp
        public static float Clamp(float value, float min, float max) => Math.Max(min, Math.Min(value, max));
         public static float Pow(float f, float p) => (float)Math.Pow(f, p);
    }
    public class Transform { public Vector3 position; } // Stub only
}

namespace RPGLibrary.Map
{
    // Stub - we don't need its full implementation, just the type name if referenced
    [Serializable]
    public struct Position16 { public short X; public short Y; public sbyte Z; }
    public static class SharedValues { public const int WorldSlizeSize = 100; public const int WorldMapSlice = 100;} // Constants likely not serialized
}

namespace UndeadLibrary.Network
{
    // Stub interface
    public interface INetworkParameter { object[] GetNetworkParameters { get; } }
}
// --- End Stubs ---

namespace RPGLibrary
{
    [Serializable] // Crucial for BinaryFormatter
    public struct Position : UndeadLibrary.Network.INetworkParameter, IEquatable<Position>, IEquatable<Map.Position16>
    {
        // NonSerialized fields are ignored by BinaryFormatter, which is correct
        [NonSerialized]
        public const int WorldPartSize = 50;
        [NonSerialized]
        public const float FloorHeight = 3f;

        // These are the fields BinaryFormatter will serialize/deserialize
        public float X;
        public float Y;
        public float Z;

        // Static fields are not serialized
        public static Position zero = new Position(0f, 0f, 0f);
        public static Position nil = new Position(-1f, -1f, -1f);

        // Properties are generally not directly serialized by BinaryFormatter (it serializes fields)
        // Keep them for structural compatibility if needed, but they rely on stubbed types
        public UnityEngine.Vector3 WorldPosition => new UnityEngine.Vector3 { x = X, y = Y, z = Z };
        public UnityEngine.Vector3 ToVector => new UnityEngine.Vector3 { x = X, y = Y, z = Z };
        // Other properties omitted for brevity as they aren't serialized fields

        // Make property accessors public for simplicity
        public float x => X;
        public float y => Y;
        public float z => Z;

        // Interface implementation - not relevant for deserialization itself
        object[] UndeadLibrary.Network.INetworkParameter.GetNetworkParameters => new object[3] { x, y, z };

        // Constructor
        public Position(float worldPosX, float worldPosY, float worldPosZ)
        {
            X = worldPosX;
            Y = worldPosY;
            Z = worldPosZ;
        }

        // --- Equality and Operator Overloads ---
        // These are important if the collection classes use them internally,
        // but not directly for field deserialization.
        public bool Equals(Position other)
        {
            return X.Equals(other.X) && Y.Equals(other.Y) && Z.Equals(other.Z);
        }

        // Change object to object? to match base signature and resolve warning
        public override bool Equals(object? obj)
        {
            return obj is Position position && Equals(position);
        }

        public override int GetHashCode()
        {
            // Simple hash code implementation
            return HashCode.Combine(X, Y, Z);
        }

        public static bool operator ==(Position x, Position y) => x.Equals(y);
        public static bool operator !=(Position x, Position y) => !x.Equals(y);
        public static Position operator +(Position x, Position y) => new Position(x.X + y.X, x.Y + y.Y, x.Z + y.Z);
        public static Position operator -(Position x, Position y) => new Position(x.X - y.X, x.Y - y.Y, x.Z - y.Z);
        // Other operators omitted for brevity

        // --- Methods ---
        // Methods are not serialized. Included for completeness if needed by other classes.
        public static float Distance(Position fromPos, Position toPos)
        {
            float num = fromPos.x - toPos.x;
            float num2 = fromPos.y - toPos.y;
            float num3 = fromPos.z - toPos.z;
            return UnityEngine.Mathf.Sqrt(num * num + num2 * num2 + num3 * num3);
        }
         public float DistanceTo(Position otherPosition) => Distance(this, otherPosition);

        public override string ToString() => $"{X:F1}:{Y:F1}:{Z:F1}"; // Simple formatting

        // --- IEquatable<Position16> ---
        public bool Equals(Map.Position16 other)
        {
            // Compare float to the integer types appropriately
            return UnityEngine.Mathf.Round(X) == other.X &&
                   UnityEngine.Mathf.Round(Y) == other.Y &&
                   UnityEngine.Mathf.Round(Z) == other.Z; // Z is sbyte, needs care
        }
    }

     // Stub for Position2D if needed by other classes during deserialization (unlikely for MinimapMarkerInfo)
    [Serializable]
    public struct Position2D
    {
        public float x; public float y;
        public Position2D(float x, float y) { this.x = x; this.y = y; }
    }
}