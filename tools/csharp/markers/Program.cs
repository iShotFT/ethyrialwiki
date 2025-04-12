using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Formatters.Binary;
using System.Text.Json; // Added for JSON serialization
using System.Text.Json.Serialization; // Added for attributes like [JsonPropertyName]
using RPGLibrary; // For Position
// Removed 'using Game;' since types are now global

// Main program class
public class Program
{
    // Default paths removed, we'll use command-line args now
    // const string InputFilePath = "../../../tools/scripts/source/markers.minimapdata";
    // const string OutputJsonPath = "markers_output.json";

    public static void Main(string[] args)
    {
        // --- New Argument Parsing for Re-serialization ---
        if (args.Length == 3 && args[0].Equals("--reserialize", StringComparison.OrdinalIgnoreCase))
        {
            string sourcePath = args[1];
            string outputPath = args[2];

            Console.WriteLine("Detected --reserialize mode.");

            if (!File.Exists(sourcePath))
            {
                Console.Error.WriteLine($"Error: Source input file not found: '{sourcePath}'");
                ExitApp();
            return;
        }

            bool reserializeSuccess = MarkerSerializer.TrySerializeMarkers(sourcePath, outputPath);

            if (reserializeSuccess)
            {
                Console.WriteLine("Re-serialization process completed successfully.");
            }
            else
        {
                Console.Error.WriteLine("Re-serialization process failed.");
        }
            ExitApp(); // Exit after attempting re-serialization
            return;
        }

        // --- Existing Drag-and-Drop / Single File Processing Logic ---
        string? inputFilePath = null;

        // Check for command-line arguments (drag-and-drop passes the file path)
        if (args.Length == 1) // Expecting only one argument for drag-and-drop
        {
            inputFilePath = args[0];
            Console.WriteLine($"Received file path from arguments (single file mode): {inputFilePath}");
        }
        else if (args.Length > 1 && !args[0].StartsWith("--"))
        {
             // If more than one arg and the first doesn't look like a switch, assume it's drag-and-drop with spaces?
             inputFilePath = string.Join(" ", args);
             Console.WriteLine($"Received file path possibly containing spaces: {inputFilePath}");
        }
        else
        {
            Console.WriteLine("No file path provided for single file processing.");
            PrintUsage();
            ExitApp();
            return;
        }

        // --- File Existence Check ---
        if (string.IsNullOrEmpty(inputFilePath) || !File.Exists(inputFilePath))
        {
            Console.Error.WriteLine($"Error: Input file not found or path is invalid: '{inputFilePath ?? "NULL"}'");
            PrintUsage();
            ExitApp();
            return;
        }

        Console.WriteLine($"Processing file: {Path.GetFullPath(inputFilePath)}");

        // --- Determine File Type and Process ---
        string fileExtension = Path.GetExtension(inputFilePath).ToLowerInvariant();
        string baseOutputPath = Path.Combine(Path.GetDirectoryName(inputFilePath) ?? ".", Path.GetFileNameWithoutExtension(inputFilePath));
        // --- Extract Map Name from Directory ---
        string mapName = "UNKNOWN_MAP";
        try
        {
            string? directoryPath = Path.GetDirectoryName(inputFilePath);
            if (!string.IsNullOrEmpty(directoryPath))
            {
                mapName = Path.GetFileName(directoryPath); // Gets the last part of the directory path
                Console.WriteLine($"Extracted map name from path: {mapName}");
                     }
                 }
                 catch (Exception ex)
                 {
            Console.WriteLine($"Warning: Could not extract map name from directory path: {ex.Message}");
        }

        bool success = false;

        switch (fileExtension)
        {
            case ".minimapdata":
                Console.WriteLine("Detected .minimapdata extension, attempting Marker processing...");
                string markerOutputPath = baseOutputPath + "_markers.json";
                string markerDumpPath = baseOutputPath + "_markers_full_dump.json";
                success = MarkerProcessor.TryProcessFile(inputFilePath, markerOutputPath, markerDumpPath);
                if (success)
                {
                    Console.WriteLine($"Successfully processed marker data to {Path.GetFullPath(markerOutputPath)}");
                     if (File.Exists(markerDumpPath)) Console.WriteLine($"Full object dump written to {Path.GetFullPath(markerDumpPath)}");
                }
                else
                {
                    Console.WriteLine("Failed to process as Minimap Marker data.");
                }
                break;

            case ".partcache":
                 Console.WriteLine("Detected .partcache extension, attempting World Part Cache processing...");
                 string partCacheOutputPath = baseOutputPath + "_partcache.json";
                 string partCacheDumpPath = baseOutputPath + "_partcache_full_dump.json";
                 success = WorldPartProcessor.TryProcessFile(inputFilePath, partCacheOutputPath, partCacheDumpPath, mapName);
                 if (success)
                 {
                     Console.WriteLine($"Successfully processed world part cache data to {Path.GetFullPath(partCacheOutputPath)}");
                     if (File.Exists(partCacheDumpPath)) Console.WriteLine($"Full object dump written to {Path.GetFullPath(partCacheDumpPath)}");
                 }
                 else
                 {
                      Console.WriteLine("Failed to process as World Part Cache data.");
                 }
                 break;

             case ".worldslice":
                 Console.WriteLine("Detected .worldslice extension, attempting World Slice Info processing...");
                 string worldSliceOutputPath = baseOutputPath + "_worldslice.json";
                 string worldSliceDumpPath = baseOutputPath + "_worldslice_full_dump.json";
                 success = WorldSliceProcessor.TryProcessFile(inputFilePath, worldSliceOutputPath, worldSliceDumpPath, mapName);
                 if (success)
                 {
                     Console.WriteLine($"Successfully processed world slice info data to {Path.GetFullPath(worldSliceOutputPath)}");
                     if (File.Exists(worldSliceDumpPath)) Console.WriteLine($"Full object dump written to {Path.GetFullPath(worldSliceDumpPath)}");
                 }
                 else
                 {
                     Console.WriteLine("Failed to process as World Slice Info data.");
                 }
                 break;

            default:
                Console.WriteLine($"Unknown file extension '{fileExtension}'. No processor available for this file type.");
                Console.WriteLine("Supported extensions: .minimapdata, .partcache, .worldslice");
                break;
        }

        // Keep console open until user presses Enter, especially if run directly
        ExitApp();

        // --- REMOVED old deserialization and processing logic - MOVED TO MarkerProcessor.cs ---
    }

    // Helper function to print usage instructions
    private static void PrintUsage()
    {
        Console.WriteLine();
        Console.WriteLine("Usage:");
        Console.WriteLine("  1. Drag and drop a single file (.minimapdata, .partcache, .worldslice) onto the executable.");
        Console.WriteLine("  2. Run from command line for single file processing:");
        Console.WriteLine("     markers.exe \"<path_to_file>\"");
        Console.WriteLine("  3. Run from command line to re-serialize markers:");
        Console.WriteLine("     markers.exe --reserialize \"<source_minimapdata>\" \"<output_minimapdata>\"");
        Console.WriteLine();
    }

    // Helper function to wait for user input and exit
    private static void ExitApp()
    {
        if (Environment.UserInteractive)
        {
            Console.WriteLine("Processing complete. Press Enter to exit.");
            Console.ReadLine();
        }
    }
}

// --- Custom Binder (Keep this class definition as MarkerProcessor might need it) ---
// Although moved logic, the binder might be generally useful or specifically needed by the MarkerProcessor
public sealed class CustomSerializationBinder : SerializationBinder
{
    public override Type? BindToType(string assemblyName, string typeName)
    {
        // First, handle the known types explicitly, mapping them to our local definitions
        // This ignores the assemblyName from the file and uses our tool's types.

        // Marker types
        if (typeName.Contains("MinimapMarkerInfo")) return typeof(MinimapMarkerInfo);
        if (typeName.Contains("MinimapCustomMarkerInfo")) return typeof(MinimapCustomMarkerInfo);
        if (typeName.Contains("RPGLibrary.Position")) return typeof(RPGLibrary.Position);
        if (typeName.Contains("CustomMarkerTypes")) return typeof(CustomMarkerTypes);
        // Handle generic lists specifically for markers
        if (typeName.StartsWith("System.Collections.Generic.List`1[[MinimapMarkerInfo")) return typeof(List<MinimapMarkerInfo>);
        if (typeName.StartsWith("System.Collections.Generic.List`1[[MinimapCustomMarkerInfo")) return typeof(List<MinimapCustomMarkerInfo>); // Less likely but possible

        // WorldPartCache types
        if (typeName.Contains("WorldPartCache")) return typeof(WorldPartCacheSerializable);
        // Explicitly map TileData when looking for it within the context of WorldPartCache
        // The Contains check handles potential namespace variations in the serialized data
        if (typeName.Contains("TileData")) return typeof(RPGLibrary.Map.TileDataSerializable);
        // Also handle Directions enum if it was serialized directly (less likely for TileData field)
        if (typeName.Contains("Directions")) return typeof(Directions);

        // WorldSliceInfo types
        if (typeName.Contains("SerializedWorldSliceInfo")) return typeof(SerializedWorldSliceInfoSerializable);
        // It uses int[][], which doesn't need special binding.


        // --- Fallback Logic (Keep for potential unknown types or complex generics) ---
        Console.WriteLine($"Binder Warning: Explicit mapping failed for Type '{typeName}' (Assembly: '{assemblyName}'). Attempting fallback resolution...");

        Type? typeToDeserialize = null;
        string currentAssembly = System.Reflection.Assembly.GetExecutingAssembly().FullName ?? "";
        string qualifiedTypeNameCurrentAssembly = typeName + ", " + currentAssembly;

        try
        {
            // 1. Try the fully qualified name in the *current* executing assembly
            typeToDeserialize = Type.GetType(qualifiedTypeNameCurrentAssembly, throwOnError: false);

            // 2. Try the type name as provided (might resolve if assembly name matches or is findable)
            if (typeToDeserialize == null)
            {
                 typeToDeserialize = Type.GetType(typeName + ", " + assemblyName, throwOnError: false);
            }

            // 3. Try just the type name (global namespace or implicitly loaded assembly)
            if (typeToDeserialize == null)
            {
                typeToDeserialize = Type.GetType(typeName, throwOnError: false);
            }

             // 4. Explicit namespace checks (as added before, useful for RPGLibrary types)
             if (typeToDeserialize == null)
             {
                string rpgLibTypeName = $"RPGLibrary.{typeName}, {currentAssembly}";
                typeToDeserialize = Type.GetType(rpgLibTypeName, throwOnError: false);
                if (typeToDeserialize == null) {
                     rpgLibTypeName = $"RPGLibrary.Map.{typeName}, {currentAssembly}"; // Check specific sub-namespace
                     typeToDeserialize = Type.GetType(rpgLibTypeName, throwOnError: false);
                }
                 // Add other known namespaces if necessary (e.g., UnityEngine stubs)
                 if (typeToDeserialize == null)
                 {
                     string unityEngineStubTypeName = $"UnityEngine.{typeName}, {currentAssembly}";
                     typeToDeserialize = Type.GetType(unityEngineStubTypeName, throwOnError: false);
                 }
             }

             if (typeToDeserialize == null)
             {
                 Console.WriteLine($"Binder Fallback Failed: Type '{typeName}' (assembly: '{assemblyName}') could not be resolved.");
             }
             else {
                 Console.WriteLine($"Binder Fallback Succeeded: Resolved '{typeName}' to '{typeToDeserialize.FullName}'.");
             }
        }
        catch (Exception ex) { Console.WriteLine($"Binder Fallback Error resolving '{typeName}': {ex.Message}"); }

        return typeToDeserialize;
    }
}