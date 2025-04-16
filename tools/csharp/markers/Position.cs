using System;
using System.Collections.Generic;

namespace UnityEngine
{
    public struct Vector3 { public float x, y, z; }
    public struct Vector2 { public float x, y; }
    public static class Mathf {
        public static float Sqrt(float f) => (float)Math.Sqrt(f);
        public static float Abs(float f) => Math.Abs(f);
        public static float Round(float f) => (float)Math.Round(f);
        public static int FloorToInt(float f) => (int)Math.Floor(f);
        public static float Lerp(float a, float b, float t) => a + (b - a) * t;
        public static float Clamp(float value, float min, float max) => Math.Max(min, Math.Min(value, max));
        public static float Pow(float f, float p) => (float)Math.Pow(f, p);
    }
    public class Transform { public Vector3 position; }
}

namespace RPGLibrary.Map
{
    [Serializable]
    public struct Position16 { public short X; public short Y; public sbyte Z; }
    public static class SharedValues { public const int WorldSlizeSize = 100; public const int WorldMapSlice = 100;}
}

namespace UndeadLibrary.Network
{
    public interface INetworkParameter { object[] GetNetworkParameters { get; } }
}

namespace RPGLibrary
{
    [Serializable]
    public struct Position : UndeadLibrary.Network.INetworkParameter, IEquatable<Position>, IEquatable<Map.Position16>
    {
        [NonSerialized]
        public const int WorldPartSize = 50;
        [NonSerialized]
        public const float FloorHeight = 3f;

        public float X;
        public float Y;
        public float Z;

        public static Position zero = new Position(0f, 0f, 0f);
        public static Position nil = new Position(-1f, -1f, -1f);

        public UnityEngine.Vector3 WorldPosition => new UnityEngine.Vector3 { x = X, y = Y, z = Z };
        public UnityEngine.Vector3 ToVector => new UnityEngine.Vector3 { x = X, y = Y, z = Z };

        public float x => X;
        public float y => Y;
        public float z => Z;

        object[] UndeadLibrary.Network.INetworkParameter.GetNetworkParameters => new object[3] { x, y, z };

        public Position(float worldPosX, float worldPosY, float worldPosZ)
        {
            X = worldPosX;
            Y = worldPosY;
            Z = worldPosZ;
        }

        public bool Equals(Position other)
        {
            return X.Equals(other.X) && Y.Equals(other.Y) && Z.Equals(other.Z);
        }

        public override bool Equals(object? obj)
        {
            return obj is Position position && Equals(position);
        }

        public override int GetHashCode()
        {
            return HashCode.Combine(X, Y, Z);
        }

        public static bool operator ==(Position x, Position y) => x.Equals(y);
        public static bool operator !=(Position x, Position y) => !x.Equals(y);
        public static Position operator +(Position x, Position y) => new Position(x.X + y.X, x.Y + y.Y, x.Z + y.Z);
        public static Position operator -(Position x, Position y) => new Position(x.X - y.X, x.Y - y.Y, x.Z - y.Z);

        public static float Distance(Position fromPos, Position toPos)
        {
            float num = fromPos.x - toPos.x;
            float num2 = fromPos.y - toPos.y;
            float num3 = fromPos.z - toPos.z;
            return UnityEngine.Mathf.Sqrt(num * num + num2 * num2 + num3 * num3);
        }
        public float DistanceTo(Position otherPosition) => Distance(this, otherPosition);

        public override string ToString() => $"{X:F1}:{Y:F1}:{Z:F1}";

        public bool Equals(Map.Position16 other)
        {
            return UnityEngine.Mathf.Round(X) == other.X &&
                   UnityEngine.Mathf.Round(Y) == other.Y &&
                   UnityEngine.Mathf.Round(Z) == other.Z;
        }
    }

    [Serializable]
    public struct Position2D
    {
        public float x; public float y;
        public Position2D(float x, float y) { this.x = x; this.y = y; }
    }
}