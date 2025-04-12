using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Formatters.Binary;
using System.Text.RegularExpressions;
using System.Text.Json;
using RPGLibrary.Map; // For TileDataSerializable

public static class WorldPartProcessor
{
    // Returns true if processing was successful, false otherwise.
    public static bool TryProcessFile(string inputFilePath, string outputJsonPath, string outputFullDumpPath, string mapName)
    {
        // --- Extract World Part Coordinates from Filename ---
        int partX = 0, partY = 0, partZ = 0;
        string filenameWithoutExt = Path.GetFileNameWithoutExtension(inputFilePath);
        // Match filenames like "X-Y-Z" or "X_Y_Z" (e.g., 91-80-7 or 91_80_7)
        Match coordMatch = Regex.Match(filenameWithoutExt, @"^(-?\d+)[-_](-?\d+)[-_](-?\d+)$");
        if (coordMatch.Success)
        {
            int.TryParse(coordMatch.Groups[1].Value, out partX);
            int.TryParse(coordMatch.Groups[2].Value, out partY);
            int.TryParse(coordMatch.Groups[3].Value, out partZ);
            Console.WriteLine($"Parsed coordinates from filename: X={partX}, Y={partY}, Z={partZ}");
        }
        else
        {
            Console.WriteLine($"Warning: Could not parse world part coordinates (X-Y-Z) from filename: {filenameWithoutExt}");
            // Decide how to handle - maybe skip? Or default to 0,0,0?
            // For now, we'll proceed with 0,0,0, but world coordinates in JSON will be wrong.
        }

        WorldPartCacheSerializable? worldPartCache = null;
        BinaryFormatter formatter = new BinaryFormatter();
        formatter.Binder = new CustomSerializationBinder(); // Use the same binder

        // --- Deserialization ---
        try
        {
            using (FileStream stream = new FileStream(inputFilePath, FileMode.Open, FileAccess.Read))
            {
                #pragma warning disable SYSLIB0011
                object? deserializedObject = formatter.Deserialize(stream);
                #pragma warning restore SYSLIB0011

                if (deserializedObject is WorldPartCacheSerializable cache)
                {
                    worldPartCache = cache;
                    Console.WriteLine("Deserialization successful (BinaryFormatter -> WorldPartCacheSerializable).");
                }
                else
                {
                     Console.Error.WriteLine($"Error: Deserialized object is not of type WorldPartCacheSerializable. Actual type: {deserializedObject?.GetType().FullName ?? "null"}");
                     // Optionally dump the raw object if it's not the expected type but deserialized anyway
                     if(deserializedObject != null) {
                        DumpFullObject(deserializedObject, outputFullDumpPath + ".unexpected_type");
                     }
                     return false;
                }
            }
        }
        catch (SerializationException ex)
        {
            Console.Error.WriteLine($"Serialization Error processing WorldPartCache: {ex.Message}");
            if (ex.InnerException != null) Console.Error.WriteLine($"Inner Exception: {ex.InnerException.Message}");
            Console.Error.WriteLine("Check WorldPartCacheSerializable and TileDataSerializable definitions.");
            // Console.Error.WriteLine($"Stack Trace: {ex.StackTrace}"); // Can be verbose
            return false;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"An unexpected error occurred during WorldPartCache deserialization: {ex.Message}");
            // Console.Error.WriteLine($"Stack Trace: {ex.StackTrace}");
            return false;
        }

        if (worldPartCache == null)
        {
            Console.Error.WriteLine("Error: Deserialized WorldPartCache is null.");
            return false;
        }

        // --- Process and Output JSON ---
        try
        {
            Console.WriteLine($"Processing WorldPartCache (Revision: {worldPartCache.Revision}, Map: {mapName})...");
            List<JsonTileData> tileListJson = new List<JsonTileData>();

            int width = worldPartCache.DataCache?.GetLength(0) ?? 0;
            int height = worldPartCache.DataCache?.GetLength(1) ?? 0;
             Console.WriteLine($"DataCache dimensions: {width}x{height}");

            if (worldPartCache.DataCache != null)
            {
                for (int y = 0; y < height; y++) // Typically Y is rows (outer loop)
                {
                    for (int x = 0; x < width; x++) // Typically X is columns (inner loop)
                    {
                        TileDataSerializable tileData = worldPartCache.DataCache[x, y];
                        // Pass parsed coordinates to JsonTileData constructor
                        tileListJson.Add(new JsonTileData(x, y, partX, partY, partZ, tileData));
                    }
                }
            }

            // Create an encompassing object for better JSON structure
             var jsonOutputObject = new {
                 MapName = mapName,
                 PartX = partX,
                 PartY = partY,
                 PartZ = partZ,
                 Revision = worldPartCache.Revision,
                 Width = width,
                 Height = height,
                 Tiles = tileListJson
             };

            if (!WriteJsonFile(jsonOutputObject, outputJsonPath, "world part tile data"))
            {
                return false; // Indicate failure if JSON writing fails
            }

            // Dump the raw deserialized WorldPartCache object
            DumpFullObject(worldPartCache, outputFullDumpPath);

            Console.WriteLine($"Successfully processed WorldPartCache with {tileListJson.Count} tiles.");
            return true; // Indicate success
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Error processing WorldPartCache data or writing JSON: {ex.Message}");
            Console.Error.WriteLine($"Stack Trace: {ex.StackTrace}");
            return false;
        }
    }

    // --- JSON Helper Methods (Duplicated from MarkerProcessor - consider moving to a shared utility class) ---
    private static bool WriteJsonFile(object data, string filePath, string description)
    {
        try
        {
            var options = new JsonSerializerOptions
            {
                WriteIndented = true,
                Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
            };
            string jsonOutput = JsonSerializer.Serialize(data, options);
            File.WriteAllText(filePath, jsonOutput);
            return true;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Error writing {description} JSON file ({filePath}): {ex.Message}");
            return false;
        }
    }

    private static void DumpFullObject(object? objToDump, string filePath)
    {
        if (objToDump == null) return;
        Console.WriteLine($"Attempting to write full object dump to {Path.GetFullPath(filePath)}...");
        try
        {
            var fullDumpOptions = new JsonSerializerOptions
            {
                WriteIndented = true,
                ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.Preserve,
                IncludeFields = true
            };
            string fullJsonOutput = JsonSerializer.Serialize(objToDump, fullDumpOptions);
            File.WriteAllText(filePath, fullJsonOutput);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Error writing full JSON dump to {filePath}: {ex.Message}");
        }
    }
} 