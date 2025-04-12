using System;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Formatters.Binary;
using System.Text.Json;
using System.Text.RegularExpressions;

public static class WorldSliceProcessor
{
    // Update signature to accept mapName
    public static bool TryProcessFile(string inputFilePath, string outputJsonPath, string outputFullDumpPath, string mapName)
    {
        // --- Extract Slice Coordinates from Filename (Optional but good practice) ---
        int sliceX = 0, sliceY = 0;
        string filenameWithoutExt = Path.GetFileNameWithoutExtension(inputFilePath);
        // Match filenames like "X-Y" or "X_Y"
        Match coordMatch = Regex.Match(filenameWithoutExt, @"^(-?\d+)[-_](-?\d+)$");
        if (coordMatch.Success)
        {
            int.TryParse(coordMatch.Groups[1].Value, out sliceX);
            int.TryParse(coordMatch.Groups[2].Value, out sliceY);
            Console.WriteLine($"Parsed slice coordinates from filename: X={sliceX}, Y={sliceY}");
        }
        else
        {
             Console.WriteLine($"Warning: Could not parse world slice coordinates (X-Y) from filename: {filenameWithoutExt}");
        }

        SerializedWorldSliceInfoSerializable? worldSliceInfo = null;
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

                if (deserializedObject is SerializedWorldSliceInfoSerializable sliceInfo)
                {
                    worldSliceInfo = sliceInfo;
                    Console.WriteLine("Deserialization successful (BinaryFormatter -> SerializedWorldSliceInfoSerializable).");
                }
                else
                {
                    Console.Error.WriteLine($"Error: Deserialized object is not of type SerializedWorldSliceInfoSerializable. Actual type: {deserializedObject?.GetType().FullName ?? "null"}");
                    if(deserializedObject != null) {
                       DumpFullObject(deserializedObject, outputFullDumpPath + ".unexpected_type");
                    }
                    return false;
                }
            }
        }
        catch (SerializationException ex)
        {
            Console.Error.WriteLine($"Serialization Error processing WorldSliceInfo: {ex.Message}");
            if (ex.InnerException != null) Console.Error.WriteLine($"Inner Exception: {ex.InnerException.Message}");
            Console.Error.WriteLine("Check SerializedWorldSliceInfoSerializable definition.");
            // Console.Error.WriteLine($"Stack Trace: {ex.StackTrace}");
            return false;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"An unexpected error occurred during WorldSliceInfo deserialization: {ex.Message}");
            // Console.Error.WriteLine($"Stack Trace: {ex.StackTrace}");
            return false;
        }

        if (worldSliceInfo == null)
        {
            Console.Error.WriteLine("Error: Deserialized WorldSliceInfo is null.");
            return false;
        }

        // --- Process and Output JSON ---
        try
        {
            Console.WriteLine($"Processing WorldSliceInfo (Revision: {worldSliceInfo.Revision}, Map: {mapName})...");

            // Create a new object to add the map name
            var jsonOutputObject = new {
                MapName = mapName,
                SliceX = sliceX, // Optionally include slice coordinates
                SliceY = sliceY,
                Revision = worldSliceInfo.Revision,
                Floors = worldSliceInfo.Floors // Keep the original Floors array
            };

            if (!WriteJsonFile(jsonOutputObject, outputJsonPath, "world slice info"))
            {
                return false; // Indicate failure if JSON writing fails
            }

            // Dump the raw deserialized object (still useful for comparison)
            DumpFullObject(worldSliceInfo, outputFullDumpPath);

            Console.WriteLine($"Successfully processed WorldSliceInfo with {worldSliceInfo.Floors?.Length ?? 0} floor entries.");
            return true; // Indicate success
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Error processing WorldSliceInfo data or writing JSON: {ex.Message}");
            Console.Error.WriteLine($"Stack Trace: {ex.StackTrace}");
            return false;
        }
    }

    // --- JSON Helper Methods (Duplicated - consider moving to a shared utility class) ---
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