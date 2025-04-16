using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Formatters.Binary;
using System.Text.Json;
using System.Text.Json.Serialization;
using RPGLibrary;

public class Program
{
    public static void Main(string[] args)
    {
        bool nonInteractive = false;
        
        if (args.Contains("--non-interactive"))
        {
            nonInteractive = true;
            args = args.Where(arg => arg != "--non-interactive").ToArray();
            Console.WriteLine("Running in non-interactive mode (will not prompt for input)");
        }

        if (args.Length == 3 && args[0].Equals("--reserialize", StringComparison.OrdinalIgnoreCase))
        {
            string sourcePath = args[1];
            string outputPath = args[2];

            Console.WriteLine("Detected --reserialize mode.");

            if (!File.Exists(sourcePath))
            {
                Console.Error.WriteLine($"Error: Source input file not found: '{sourcePath}'");
                ExitApp(nonInteractive);
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
            ExitApp(nonInteractive);
            return;
        }

        string? inputFilePath = null;

        if (args.Length == 1)
        {
            inputFilePath = args[0];
            Console.WriteLine($"Received file path from arguments (single file mode): {inputFilePath}");
        }
        else if (args.Length > 1 && !args[0].StartsWith("--"))
        {
             inputFilePath = string.Join(" ", args);
             Console.WriteLine($"Received file path possibly containing spaces: {inputFilePath}");
        }
        else
        {
            Console.WriteLine("No file path provided for single file processing.");
            PrintUsage();
            ExitApp(nonInteractive);
            return;
        }

        if (string.IsNullOrEmpty(inputFilePath) || !File.Exists(inputFilePath))
        {
            Console.Error.WriteLine($"Error: Input file not found or path is invalid: '{inputFilePath ?? "NULL"}'");
            PrintUsage();
            ExitApp(nonInteractive);
            return;
        }

        Console.WriteLine($"Processing file: {Path.GetFullPath(inputFilePath)}");

        string fileExtension = Path.GetExtension(inputFilePath).ToLowerInvariant();
        string baseOutputPath = Path.Combine(Path.GetDirectoryName(inputFilePath) ?? ".", Path.GetFileNameWithoutExtension(inputFilePath));
        string mapName = "UNKNOWN_MAP";
        try
        {
            string? directoryPath = Path.GetDirectoryName(inputFilePath);
            if (!string.IsNullOrEmpty(directoryPath))
            {
                mapName = Path.GetFileName(directoryPath);
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

        ExitApp(nonInteractive);
    }

    private static void PrintUsage()
    {
        Console.WriteLine();
        Console.WriteLine("Usage:");
        Console.WriteLine("  1. Drag and drop a single file (.minimapdata, .partcache, .worldslice) onto the executable.");
        Console.WriteLine("  2. Run from command line for single file processing:");
        Console.WriteLine("     markers.exe \"<path_to_file>\"");
        Console.WriteLine("  3. Run from command line to re-serialize markers:");
        Console.WriteLine("     markers.exe --reserialize \"<source_minimapdata>\" \"<output_minimapdata>\"");
        Console.WriteLine("  4. Add --non-interactive flag to skip 'Press Enter to exit' prompt (useful for automation)");
        Console.WriteLine("     markers.exe --non-interactive \"<path_to_file>\"");
        Console.WriteLine();
    }

    private static void ExitApp(bool nonInteractive = false)
    {
        if (Environment.UserInteractive && !nonInteractive)
        {
            Console.WriteLine("Processing complete. Press Enter to exit.");
            Console.ReadLine();
        }
        else if (!nonInteractive)
        {
            Console.WriteLine("Processing complete.");
        }
    }
}

public sealed class CustomSerializationBinder : SerializationBinder
{
    public override Type? BindToType(string assemblyName, string typeName)
    {
        if (typeName.Contains("MinimapMarkerInfo")) return typeof(MinimapMarkerInfo);
        if (typeName.Contains("MinimapCustomMarkerInfo")) return typeof(MinimapCustomMarkerInfo);
        if (typeName.Contains("RPGLibrary.Position")) return typeof(RPGLibrary.Position);
        if (typeName.Contains("CustomMarkerTypes")) return typeof(CustomMarkerTypes);
        if (typeName.StartsWith("System.Collections.Generic.List`1[[MinimapMarkerInfo")) return typeof(List<MinimapMarkerInfo>);
        if (typeName.StartsWith("System.Collections.Generic.List`1[[MinimapCustomMarkerInfo")) return typeof(List<MinimapCustomMarkerInfo>);

        if (typeName.Contains("WorldPartCache")) return typeof(WorldPartCacheSerializable);
        if (typeName.Contains("TileData")) return typeof(RPGLibrary.Map.TileDataSerializable);
        if (typeName.Contains("Directions")) return typeof(Directions);

        if (typeName.Contains("SerializedWorldSliceInfo")) return typeof(SerializedWorldSliceInfoSerializable);

        Console.WriteLine($"Binder Warning: Explicit mapping failed for Type '{typeName}' (Assembly: '{assemblyName}'). Attempting fallback resolution...");

        Type? typeToDeserialize = null;
        string currentAssembly = System.Reflection.Assembly.GetExecutingAssembly().FullName ?? "";
        string qualifiedTypeNameCurrentAssembly = typeName + ", " + currentAssembly;

        try
        {
            typeToDeserialize = Type.GetType(qualifiedTypeNameCurrentAssembly, throwOnError: false);

            if (typeToDeserialize == null)
            {
                 typeToDeserialize = Type.GetType(typeName + ", " + assemblyName, throwOnError: false);
            }

            if (typeToDeserialize == null)
            {
                typeToDeserialize = Type.GetType(typeName, throwOnError: false);
            }

             if (typeToDeserialize == null)
             {
                string rpgLibTypeName = $"RPGLibrary.{typeName}, {currentAssembly}";
                typeToDeserialize = Type.GetType(rpgLibTypeName, throwOnError: false);
                if (typeToDeserialize == null) {
                     rpgLibTypeName = $"RPGLibrary.Map.{typeName}, {currentAssembly}";
                     typeToDeserialize = Type.GetType(rpgLibTypeName, throwOnError: false);
                }
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