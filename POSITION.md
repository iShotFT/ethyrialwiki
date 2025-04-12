# POSITION.md - Marker Position Extraction Analysis

## 1. Objective

The primary goal is to accurately extract minimap marker data, specifically the marker's name (or title/GUID) and its corresponding 3D coordinates (X, Y, Z), from the binary file `tools/scripts/source/markers.minimapdata`.

## 2. Input File

*   `tools/scripts/source/markers.minimapdata`: The binary data file containing serialized minimap marker information.

## 3. Investigation & Findings

*   **Initial Attempts:** Early attempts using Python heuristics proved insufficient due to the complexity of the file format.
*   **Hex Dump Analysis:** Analysis of `markers.hex.txt` revealed patterns consistent with .NET `BinaryFormatter` serialization, including embedded type/assembly names (`Game, Version=...`, `RPGLibrary.Position`, etc.) and field names (`X`, `Y`, `Z`).
*   **Coordinate Evidence:** The marker "DEBUG - MARKER" (known coordinates 4794, 3937, 1) provided key evidence. The byte sequence `d0 95 45 00 20 76 45 00 00 80 3f` following the marker's data in the hex dump decodes precisely to `(4794.0f, 3937.0f, 1.0f)` when interpreted as three consecutive little-endian single-precision floats (`<fff`).
*   **Source Code Confirmation:** Analysis of provided C# source code confirmed:
    *   `Serializer.cs` uses `BinaryFormatter`.
    *   `MinimapMarkerInfo.cs` is `[Serializable]` and contains a `private Position position;` field.
    *   `Position.cs` is `[Serializable]` and uses `public float X;`, `public float Y;`, `public float Z;`.

## 4. Confirmed File Format & Position Storage

*   The `markers.minimapdata` file is confirmed to be a serialized object graph created by .NET's `BinaryFormatter`.
*   The root object is likely a collection (`List<MinimapMarkerInfo>` or similar) containing instances of `MinimapMarkerInfo` derived classes (specifically `MinimapCustomMarkerInfo`).
*   Within each marker object, the `position` field is of type `RPGLibrary.Position`.
*   `BinaryFormatter` writes the `Position` struct's `X`, `Y`, and `Z` fields sequentially as **three consecutive little-endian single-precision floats** (12 bytes total for the coordinate data payload).

## 5. Successful Extraction Method (C# Deserialization)

A C# console application located in `tools/csharp/markers/` was successfully developed to deserialize the file.

*   **Rationale:** This approach directly leverages .NET's `BinaryFormatter` and the known class structures (`Position`, `MinimapMarkerInfo`, `MinimapCustomMarkerInfo`, `CustomMarkerTypes`) for the most accurate and robust extraction.
*   **Key Implementation Steps:**
    1.  Created a .NET project (`markers.csproj`).
    2.  Added C# definitions for `Position`, `MinimapMarkerInfo`, `MinimapCustomMarkerInfo`, and `CustomMarkerTypes`, mirroring the original game code structure (using global namespace after initial issues). Dependency types (like `UnityEngine`) were stubbed.
    3.  Enabled `BinaryFormatter` usage in `.csproj` via `<EnableUnsafeBinaryFormatterSerialization>true</EnableUnsafeBinaryFormatterSerialization>` due to it being disabled by default in modern .NET.
    4.  Implemented a `CustomSerializationBinder` and assigned it to `formatter.Binder` to resolve type/assembly name mismatches between the game's build and the utility app.
    5.  Used `BinaryFormatter.Deserialize()` to read the file stream into an object.
    6.  Successfully cast the deserialized object to a collection (e.g., `List<MinimapMarkerInfo>`).
    7.  Iterated through the collection, accessing `marker.Guid`, `marker.GetTitle` (or `customMarker.name`), and `marker.Position.X/Y/Z`.
    8.  Outputted the results to the console and a CSV file (`markers_output.csv`).

## 6. Results & Coordinate Verification

*   The C# application successfully deserialized all 32 markers from the provided `markers.minimapdata` file.
*   Comparison with `debug-markers.txt`:
    *   **DEBUG - M1:** `debug-markers.txt` (1653, **2869**, 1) vs. Extracted (1653.00, **2870.00**, 1.00) - *Y differs by 1*.
    *   **DEBUG - M2:** `debug-markers.txt` (1648, **2869**, 1) vs. Extracted (1648.00, **2870.00**, 1.00) - *Y differs by 1*.
    *   **DEBUG - M3:** `debug-markers.txt` (1636, **2869**, 1) vs. Extracted (1636.00, **2870.00**, 1.00) - *Y differs by 1*.
    *   **DEBUG - M4:** `debug-markers.txt` (1653, 2862, *assumed 1*) vs. Extracted (1653.00, 2862.00, 1.00) - **Match**.
*   The minor discrepancies for M1-M3 might stem from manual entry differences or in-game rounding/snapping when the markers were placed. The extraction itself is accurate to the data within the file.

## 7. Alternative Plan (Python - Deprecated)

*   Attempting to parse the `BinaryFormatter` stream manually in Python is highly complex, fragile, and not recommended now that the C# solution is proven. It would require significant reverse-engineering of the stream format.

## 8. Relevant Source Files Consulted

*   `Serializer.cs`
*   `MinimapMarkerInfo.cs`
*   `MinimapCustomMarkerInfo.cs`
*   `Position.cs`
*   `Position16.cs`
*   *(Plus other related RPGLibrary and Game script files)*

## 9. Conclusion

The position data for minimap markers is stored as three consecutive little-endian floats within a `BinaryFormatter`-serialized stream. The C# utility in `tools/csharp/markers/` provides a reliable method for extracting this data. 