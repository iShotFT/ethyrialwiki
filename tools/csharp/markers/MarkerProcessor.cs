using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Formatters.Binary;
using System.Text.Json;
using System.Text.Json.Serialization;
using RPGLibrary; // For Position

// Define the structure for JSON output
public class OutputMarker
{
    [JsonPropertyName("name")] // Matches the key in locations.json
    public string Name { get; set; } = "N/A";

    [JsonPropertyName("map")]
    public string Map { get; set; } = "UNKNOWN"; // Placeholder

    [JsonPropertyName("type")]
    public string Type { get; set; } = "UNKNOWN"; // Store enum name as string

    [JsonPropertyName("x")]
    public float X { get; set; }

    [JsonPropertyName("y")]
    public float Y { get; set; }

    [JsonPropertyName("z")]
    public float Z { get; set; }

     // Optional: Add GUID if needed
    // [JsonPropertyName("guid")]
    // public string Guid { get; set; } = "";
}

public static class MarkerProcessor
{
    // Returns true if processing was successful, false otherwise.
    public static bool TryProcessFile(string inputFilePath, string outputJsonPath, string outputFullDumpPath)
    {
        object? deserializedObject = null;
        BinaryFormatter formatter = new BinaryFormatter();

        // Use the binder defined in Program.cs (or move it here if preferred)
        formatter.Binder = new CustomSerializationBinder();

        // --- Deserialization ---
        try
        {
            using (FileStream stream = new FileStream(inputFilePath, FileMode.Open, FileAccess.Read))
            {
                #pragma warning disable SYSLIB0011
                deserializedObject = formatter.Deserialize(stream);
                #pragma warning restore SYSLIB0011
            }
            Console.WriteLine("Deserialization successful (using BinaryFormatter).");
        }
        catch (SerializationException ex)
        {
            Console.Error.WriteLine($"Serialization Error: {ex.Message}");
            // Optionally check inner exceptions
            if (ex.InnerException != null) {
                 Console.Error.WriteLine($"Inner Exception: {ex.InnerException.Message}");
            }
            Console.Error.WriteLine("Check class definitions (MinimapMarkerInfo, Position, etc.) and binder implementation.");
            Console.Error.WriteLine($"Stack Trace: {ex.StackTrace}");
            return false; // Indicate failure
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"An unexpected error occurred during deserialization: {ex.Message}");
            Console.Error.WriteLine($"Stack Trace: {ex.StackTrace}");
            return false; // Indicate failure
        }

        if (deserializedObject == null)
        {
            Console.Error.WriteLine("Error: Deserialized object is null.");
            return false; // Indicate failure
        }

         Console.WriteLine($"Deserialized object type: {deserializedObject.GetType().FullName}");

        // --- Type Casting ---
        IEnumerable<MinimapMarkerInfo>? markers = null;
        if (deserializedObject is List<MinimapMarkerInfo> markerList)
        {
            Console.WriteLine($"Successfully cast to List<MinimapMarkerInfo>. Count: {markerList.Count}");
            markers = markerList;
        }
        else if (deserializedObject is ArrayList arrayList) // Handle legacy ArrayList
        {
             Console.WriteLine($"Deserialized as ArrayList. Count: {arrayList.Count}. Attempting to cast elements.");
             try
             {
                 // Need using System.Linq; for Cast<T>()
                 markers = arrayList.Cast<MinimapMarkerInfo>().ToList();
                 Console.WriteLine($"Successfully cast ArrayList elements to List<MinimapMarkerInfo>. Count: {markers.Count()}");
             }
             catch (InvalidCastException ex)
             {
                 Console.Error.WriteLine($"Error casting ArrayList elements to MinimapMarkerInfo: {ex.Message}");
                 Console.Error.WriteLine("Ensure all elements in the saved list were actually MinimapMarkerInfo or derived types.");
                 // Consider dumping the raw deserialized object for inspection here
                 // DumpFullObject(deserializedObject, outputFullDumpPath + ".cast_error"); // Example
                 return false;
             }
              catch (Exception ex)
             {
                 Console.Error.WriteLine($"Unexpected error during ArrayList casting: {ex.Message}");
                 return false;
             }
        }
        else if (deserializedObject is IEnumerable enumerable) // Handle other IEnumerable types
        {
             Console.WriteLine($"Deserialized as generic IEnumerable ({deserializedObject.GetType().FullName}). Attempting to cast elements.");
             try
             {
                 // Need using System.Linq; for Cast<T>()
                 markers = enumerable.Cast<MinimapMarkerInfo>().ToList();
                 Console.WriteLine($"Successfully cast IEnumerable elements to List<MinimapMarkerInfo>. Count: {markers.Count()}");
             }
             catch (InvalidCastException ex)
             {
                 Console.Error.WriteLine($"Error casting IEnumerable elements to MinimapMarkerInfo: {ex.Message}");
                 Console.Error.WriteLine("Ensure all elements in the saved collection were actually MinimapMarkerInfo or derived types.");
                 // DumpFullObject(deserializedObject, outputFullDumpPath + ".cast_error"); // Example
                 return false;
             }
             catch (Exception ex)
             {
                 Console.Error.WriteLine($"Unexpected error during IEnumerable casting: {ex.Message}");
                 return false;
             }
        }
        else
        {
            Console.Error.WriteLine($"Error: Deserialized object is not a recognized marker collection type. Actual type: {deserializedObject.GetType().FullName}");
            // Optionally dump the object to see what it actually is
            DumpFullObject(deserializedObject, outputFullDumpPath + ".unrecognized_type");
            return false; // Indicate failure
        }


        // --- Process and Output JSON ---
        if (markers != null)
        {
             Console.WriteLine($"Processing {markers.Count()} markers...");
             var outputList = new List<OutputMarker>();
             int count = 0;

             foreach (var marker in markers)
             {
                 if (marker == null)
                 {
                     Console.WriteLine($"Warning: Encountered a null marker in the collection at index {count}. Skipping.");
                     count++;
                     continue;
                 }

                 var outputMarker = new OutputMarker();
                 outputMarker.Map = marker.MapName ?? "UNKNOWN"; // Use MapName property if available

                 try
                 {
                      // Extract common data
                     outputMarker.X = marker.Position.X;
                     outputMarker.Y = marker.Position.Y;
                     outputMarker.Z = marker.Position.Z;
                     // outputMarker.Guid = marker.Guid; // Uncomment if GUID added to OutputMarker

                     // Extract type-specific data using pattern matching
                     switch (marker)
                     {
                         case MinimapCustomMarkerInfo customMarker:
                             outputMarker.Name = customMarker.name ?? "N/A";
                             outputMarker.Type = customMarker.type.ToString(); // Enum to string
                             // Add other customMarker specific fields to OutputMarker if needed
                             break;
                         // Add cases for other known derived types like MinimapSystemMarkerInfo if they exist
                         // case MinimapSystemMarkerInfo systemMarker:
                         //    outputMarker.Name = systemMarker.SomeProperty;
                         //    outputMarker.Type = "System";
                         //    break;
                         default:
                              // Fallback for base type or unknown derived types
                             outputMarker.Name = marker.GetTitle ?? "N/A";
                             outputMarker.Type = marker.GetType().Name; // Use actual type name
                             break;
                     }
                 }
                 catch (NullReferenceException nre) // Specific handling for null references
                 {
                      Console.WriteLine($"Warning: Null reference encountered processing marker GUID {marker.Guid ?? "N/A"}. Details: {nre.Message}");
                      outputMarker.Name = "[Error: Null Reference]";
                      outputMarker.Type = "[Error]";
                 }
                 catch (Exception ex)
                 {
                     Console.WriteLine($"Warning: Could not fully process marker GUID {marker.Guid ?? "N/A"}: {ex.Message}");
                     outputMarker.Name = "[Error Processing]";
                     outputMarker.Type = "[Error]";
                 }

                 outputList.Add(outputMarker);

                 // Optional: Keep detailed console output for debugging
                 // Console.WriteLine($" - GUID: {marker.Guid}, Name: {outputMarker.Name}, Type: {outputMarker.Type}, Pos: ({outputMarker.X:F2}, {outputMarker.Y:F2}, {outputMarker.Z:F2})");
                 count++;
             }

             // Serialize the simplified list to JSON
             if (!WriteJsonFile(outputList, outputJsonPath, "marker data"))
             {
                 return false; // Indicate failure if JSON writing fails
             }

             // Serialize the FULL deserialized object graph for debugging/inspection
             // Pass the original 'markers' collection (or 'deserializedObject' if casting failed but it was IEnumerable)
             object? objectToDump = markers ?? (deserializedObject as IEnumerable);
             if (objectToDump != null)
             {
                 DumpFullObject(objectToDump, outputFullDumpPath);
             } else {
                 Console.WriteLine("Could not determine a valid object to dump for the full JSON output.");
             }

             Console.WriteLine($"Successfully processed {count} markers.");
             return true; // Indicate success
        }
        else
        {
             Console.WriteLine("Marker collection is null after casting attempts.");
             return false; // Indicate failure
        }
    }


    // Helper method to write an object to a JSON file
    private static bool WriteJsonFile(object data, string filePath, string description)
    {
        try
        {
            var options = new JsonSerializerOptions
            {
                WriteIndented = true, // Pretty print
                 Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping // Often needed for game data
            };
            string jsonOutput = JsonSerializer.Serialize(data, options);
            File.WriteAllText(filePath, jsonOutput);
            // Console.WriteLine($"Successfully wrote {description} to {Path.GetFullPath(filePath)}"); // Keep console less verbose
            return true;
        }
        catch(Exception ex)
        {
            Console.Error.WriteLine($"Error writing {description} JSON file ({filePath}): {ex.Message}");
            Console.Error.WriteLine($"Stack Trace: {ex.StackTrace}");
            return false;
        }
    }

     // Helper method to dump the full deserialized object graph
    private static void DumpFullObject(object? objToDump, string filePath)
    {
        if (objToDump == null) {
            Console.WriteLine($"Skipping full dump to {filePath} because object was null.");
            return;
        }

        Console.WriteLine($"Attempting to write full object dump to {Path.GetFullPath(filePath)}...");
        try
        {
            var fullDumpOptions = new JsonSerializerOptions
            {
                WriteIndented = true,
                ReferenceHandler = ReferenceHandler.Preserve, // Handle cycles
                IncludeFields = true, // Crucial as BinaryFormatter uses fields
                // Add converters if needed for specific types that System.Text.Json struggles with
                // Converters = { ... }
            };

            string fullJsonOutput = JsonSerializer.Serialize(objToDump, fullDumpOptions);
            File.WriteAllText(filePath, fullJsonOutput);
            // Console.WriteLine($"Successfully wrote full dump to {Path.GetFullPath(filePath)}"); // Keep console less verbose
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Error writing full JSON dump to {filePath}: {ex.Message}");
            Console.Error.WriteLine("This can happen with complex object graphs, cycles, or unsupported types for System.Text.Json.");
            // Optionally log stack trace for debugging
            // Console.Error.WriteLine($"Stack Trace: {ex.StackTrace}");
        }
    }
} 