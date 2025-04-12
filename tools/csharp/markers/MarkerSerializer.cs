using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Formatters.Binary;
using RPGLibrary; // For Position, MinimapMarkerInfo etc.

public static class MarkerSerializer
{
    // Returns true if processing was successful, false otherwise.
    public static bool TrySerializeMarkers(string sourceInputPath, string outputFilePath)
    {
        Console.WriteLine($"Attempting to read markers from: {Path.GetFullPath(sourceInputPath)}");
        Console.WriteLine($"Attempting to write re-serialized markers to: {Path.GetFullPath(outputFilePath)}");

        object? deserializedObject = null;
        BinaryFormatter readerFormatter = new BinaryFormatter();
        readerFormatter.Binder = new CustomSerializationBinder(); // Use binder for reading

        // --- Deserialization from Source ---
        try
        {
            using (FileStream stream = new FileStream(sourceInputPath, FileMode.Open, FileAccess.Read))
            {
                #pragma warning disable SYSLIB0011
                deserializedObject = readerFormatter.Deserialize(stream);
                #pragma warning restore SYSLIB0011
            }
            Console.WriteLine("Deserialization successful (using BinaryFormatter with Binder).");
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Error deserializing source file '{sourceInputPath}': {ex.Message}");
            if (ex.InnerException != null) Console.Error.WriteLine($"  Inner Exception: {ex.InnerException.Message}");
            return false; // Indicate failure
        }

        if (deserializedObject == null)
        {
            Console.Error.WriteLine("Error: Deserialized object from source is null.");
            return false; // Indicate failure
        }

        Console.WriteLine($"Source deserialized object type: {deserializedObject.GetType().FullName}");

        // --- Type Casting (Re-use logic from MarkerProcessor for robustness) ---
        // We need the actual collection object to re-serialize
        object? markerCollectionToSerialize = null;
        if (deserializedObject is List<MinimapMarkerInfo> || deserializedObject is ArrayList)
        {
             // ArrayList or List<T> can often be serialized directly
             markerCollectionToSerialize = deserializedObject;
             Console.WriteLine("Using deserialized List/ArrayList directly for serialization.");
        }
        else if (deserializedObject is IEnumerable enumerable) // Handle other IEnumerables
        {
             // Attempt to cast to List<MinimapMarkerInfo> for serialization
             // BinaryFormatter often works better with concrete collection types like List<> or arrays
             Console.WriteLine($"Deserialized as generic IEnumerable ({deserializedObject.GetType().FullName}). Attempting to cast to List for serialization.");
             try
             {
                 // Need using System.Linq;
                 markerCollectionToSerialize = enumerable.Cast<MinimapMarkerInfo>().ToList();
                 Console.WriteLine($"Successfully cast IEnumerable elements to List<MinimapMarkerInfo>.");
             }
             catch (Exception ex)
             {
                  Console.Error.WriteLine($"Error casting IEnumerable elements for serialization: {ex.Message}");
                  Console.Error.WriteLine("Cannot re-serialize in a reliable format. Aborting.");
                  return false;
             }
        }
        else
        {
            Console.Error.WriteLine($"Error: Deserialized object is not a recognized collection type suitable for serialization. Actual type: {deserializedObject.GetType().FullName}");
            return false; // Indicate failure
        }


        // --- Re-serialization to Output ---
        if (markerCollectionToSerialize != null)
        {
            BinaryFormatter writerFormatter = new BinaryFormatter();
            // *** DO NOT set a binder for writing ***
            // We want it to use the assembly/type info of THIS tool's environment.

            try
            {
                using (FileStream stream = new FileStream(outputFilePath, FileMode.Create, FileAccess.Write))
                {
                    #pragma warning disable SYSLIB0011
                    writerFormatter.Serialize(stream, markerCollectionToSerialize);
                    #pragma warning restore SYSLIB0011
                }
                Console.WriteLine($"Successfully re-serialized marker data to {Path.GetFullPath(outputFilePath)}");
                return true; // Indicate success
            }
            catch (Exception ex)
            {
                 Console.Error.WriteLine($"Error serializing marker data to '{outputFilePath}': {ex.Message}");
                 if (ex.InnerException != null) Console.Error.WriteLine($"  Inner Exception: {ex.InnerException.Message}");
                 return false; // Indicate failure
            }
        }
        else
        {
            Console.Error.WriteLine("Error: Could not obtain a valid marker collection object to serialize.");
            return false;
        }
    }
} 