using System;
using RPGLibrary;
namespace UnityEngine {
    public struct Color { public float r, g, b, a; public static Color white = new Color(); }
    public class Sprite { }
}
namespace RPGLibrary.Map {
     public class MapMarkerScript { }
     public abstract class Map { }
}

[Serializable]
public enum CustomMarkerTypes
{
    Unknown = 0,
    Ore_Silver = 1,
    Wood = 2,
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
    Death = 17
}

[Serializable]
public abstract class MinimapMarkerInfo
{
    private string guid = System.Guid.NewGuid().ToString();
    private Position position;

    [NonSerialized]
    private string mapName = "?";

    public string MapName
    {
        get { return mapName; }
        set { mapName = value; }
    }

    public Position Position
    {
        get { return position; }
        set { position = value; }
    }

    public string Guid
    {
        get { return guid; }
        set { guid = value; }
    }

    public abstract string GetTitle { get; }
    public abstract string GetDescription { get; }
    public abstract bool IsPersistant { get; }
    public virtual UnityEngine.Sprite? GetIcon => null;
    public virtual UnityEngine.Color GetBackgroundColor => UnityEngine.Color.white;

    public virtual void Update(RPGLibrary.Map.MapMarkerScript mapMarkerScript, RPGLibrary.Map.Map worldMapCurrentMap) { }

    protected MinimapMarkerInfo() { }
}

[Serializable]
public class MinimapCustomMarkerInfo : MinimapMarkerInfo
{
    public string name = "";
    private string _description = "";
    public string icon = "";
    public bool isPersistant = false;
    public float aliveTime = 0f;
    public CustomMarkerTypes type = CustomMarkerTypes.Unknown;

    public string Description => _description;

    public override string GetTitle => name ?? "No Title";
    public override string GetDescription => _description ?? "";
    public override bool IsPersistant => isPersistant;

    public MinimapCustomMarkerInfo() : base() { }
}