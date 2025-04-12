using System;
using RPGLibrary; // Need this for the Position struct
// Stub for UnityEngine dependencies
namespace UnityEngine {
    public struct Color { public float r, g, b, a; public static Color white = new Color(); }
    public class Sprite { } // Stub - properties like 'texture' aren't needed now
}
// Stub for RPGLibrary.Map dependencies if needed by methods we might call later
namespace RPGLibrary.Map {
     public class MapMarkerScript { } // Stub
     public abstract class Map { } // Stub
}

[Serializable] // Enums used in serialization often need this attribute
public enum CustomMarkerTypes
{
    // We don't know the exact values from the original game,
    // but defining the enum type itself is crucial for deserialization.
    // BinaryFormatter usually stores the underlying integer value.
    // We can add values if needed, but start with a basic definition.
    Unknown = 0, // Default guess
    Ore_Silver = 1, // Example based on hex dump text "ORE: Silver"
    Wood = 2,       // Example based on hex dump text "3_Wood"
    NPC = 3,
    POI = 4,
    Enemy = 5,
    Ore_Platinum = 6,
    Ore_T4 = 7,
    Ore_Bronze = 8,
    Bear = 9,
    Ore_Coal = 10,
    Ore_Iron = 11,
    Ore_Copper = 12,
    Entrance = 13,
    Tree = 14,
    Mob = 15,
    Herb = 16,
    Death = 17 // Mentioned in original MinimapCustomMarkerInfo.cs Update() method
    // Add other potential types based on analysis or leave as is
}

[Serializable] // Crucial for BinaryFormatter
public abstract class MinimapMarkerInfo // Make abstract if it was, or concrete if needed.
{
    // --- Serialized Fields ---
    // These fields will be read by BinaryFormatter
    // Match casing and names exactly from the original C# code if possible.
    // We infer based on hex dump and common patterns.
    // BinaryFormatter usually serializes private fields too if the class is Serializable.
    private string guid = System.Guid.NewGuid().ToString(); // Default value likely overwritten by deserialization
    private Position position; // The field we primarily care about!

    // --- NonSerialized Fields ---
    // These are ignored by BinaryFormatter
    [NonSerialized]
    private string mapName = "?"; // Default value

    // --- Properties ---
    // Properties are not directly serialized by BinaryFormatter (fields are).
    // We include them for completeness and potential use after deserialization.
    public string MapName
    {
        get { return mapName; }
        set { mapName = value; } // Setter might not be needed if only reading
    }

    public Position Position
    {
        get { return position; }
        // Setter might not be needed if only reading, but good practice
        // Setter might be needed by BinaryFormatter depending on exact implementation details
            set { position = value; }
    }

    public string Guid
    {
        get { return guid; }
        set { guid = value; } // Setter might be needed by BinaryFormatter
    }

    // --- Abstract/Virtual Members ---
    // We need implementations or stubs if we deserialize into this directly,
    // or handle the derived type (like MinimapCustomMarkerInfo).
    // For now, provide basic implementations or leave abstract if we handle derived types.
    public abstract string GetTitle { get; }
    public abstract string GetDescription { get; }
    public abstract bool IsPersistant { get; }
    public virtual UnityEngine.Sprite? GetIcon => null; // Stub implementation
    public virtual UnityEngine.Color GetBackgroundColor => UnityEngine.Color.white; // Stub

    // Method stubs - not called during basic deserialization
    public virtual void Update(RPGLibrary.Map.MapMarkerScript mapMarkerScript, RPGLibrary.Map.Map worldMapCurrentMap) { }

    // Default constructor is often needed for deserialization
    protected MinimapMarkerInfo() { }
}

// --- Derived Class (Likely Needed) ---
// We likely need the definition for MinimapCustomMarkerInfo as well,
// as the List probably contains instances of this derived type.
// We need to infer its structure or find its definition.
// Stubbing it for now:
[Serializable]
public class MinimapCustomMarkerInfo : MinimapMarkerInfo
{
    // Inferring fields based on hex dump strings like "name", "_description", "icon" etc.
    // These MUST match the original definition for BinaryFormatter to work.
    public string name = "";
    private string _description = ""; // Assuming private based on leading underscore
    public string icon = ""; // Or could be a Sprite type? Check original if possible.
    // ... other fields (name, _description, icon, etc.) ...
    public bool isPersistant = false;
    public float aliveTime = 0f;
    // Change this line from 'int' to 'CustomMarkerTypes'
    public CustomMarkerTypes type = CustomMarkerTypes.Unknown; // Use the enum type


    // Need properties to access private fields if needed after deserialization
    public string Description => _description;

    // Implement abstract members from base class
    public override string GetTitle => name ?? "No Title";
    public override string GetDescription => _description ?? "";
    public override bool IsPersistant => isPersistant;

    // Override virtual members if necessary (example using 'icon' string)
    // public override UnityEngine.Sprite GetIcon => SomeSpriteLoadingLogic(icon); // Requires real Sprite logic

    // Default constructor
    public MinimapCustomMarkerInfo() : base() { }
}