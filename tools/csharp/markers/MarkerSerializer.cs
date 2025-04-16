using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Formatters.Binary;
using RPGLibrary;

public static class MarkerSerializer
{
    public static bool TrySerializeMarkers(string sourceInputPath, string outputFilePath)
    {
        Console.WriteLine($"Attempting to read markers from: {Path.GetFullPath(sourceInputPath)}");
        Console.WriteLine($"Attempting to write re-serialized markers to: {Path.GetFullPath(outputFilePath)}");

        object? deserializedObject = null;
        BinaryFormatter readerFormatter = new BinaryFormatter();
        readerFormatter.Binder = new CustomSerializationBinder();

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
            return false;
        }

        if (deserializedObject == null)
        {
            Console.Error.WriteLine("Error: Deserialized object from source is null.");
            return false;
        }

        Console.WriteLine($"Source deserialized object type: {deserializedObject.GetType().FullName}");

        object? markerCollectionToSerialize = null;
        if (deserializedObject is List<MinimapMarkerInfo> || deserializedObject is ArrayList)
        {
             markerCollectionToSerialize = deserializedObject;
             Console.WriteLine("Using deserialized List/ArrayList directly for serialization.");
        }
        else if (deserializedObject is IEnumerable enumerable)
        {
             Console.WriteLine($"Deserialized as generic IEnumerable ({deserializedObject.GetType().FullName}). Attempting to cast to List for serialization.");
             try
             {
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
            return false;
        }

        if (markerCollectionToSerialize != null)
        {
            BinaryFormatter writerFormatter = new BinaryFormatter();

            try
            {
                using (FileStream stream = new FileStream(outputFilePath, FileMode.Create, FileAccess.Write))
                {
                    #pragma warning disable SYSLIB0011
                    writerFormatter.Serialize(stream, markerCollectionToSerialize);
                    #pragma warning restore SYSLIB0011
                }
                Console.WriteLine($"Successfully re-serialized marker data to {Path.GetFullPath(outputFilePath)}");
                return true;
            }
            catch (Exception ex)
            {
                 Console.Error.WriteLine($"Error serializing marker data to '{outputFilePath}': {ex.Message}");
                 if (ex.InnerException != null) Console.Error.WriteLine($"  Inner Exception: {ex.InnerException.Message}");
                 return false;
            }
        }
        else
        {
            Console.Error.WriteLine("Error: Could not obtain a valid marker collection object to serialize.");
            return false;
        }
    }
}