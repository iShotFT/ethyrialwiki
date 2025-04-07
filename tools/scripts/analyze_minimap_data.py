import os
import sys
import struct
import re
from binascii import hexlify

def analyze_binary_file(filepath):
    """Analyze a binary file to identify player IDs and data structure"""
    print(f"\nAnalyzing file: {os.path.basename(filepath)}")
    print("=" * 60)
    
    with open(filepath, 'rb') as f:
        data = f.read()
    
    # Basic file information
    print(f"File size: {len(data)} bytes")
    
    # Look for .NET serialization markers
    print("\nSerialization Analysis:")
    if b'\x00\x01\x00\x00\x00\xff\xff\xff\xff\x01\x00\x00\x00' in data[:20]:
        print("✓ Found .NET binary serialization header")
    
    # Look for string pattern indicating MinimapMarkerInfo
    marker_info_pos = data.find(b'MinimapMarkerInfo')
    if marker_info_pos != -1:
        print(f"✓ Found 'MinimapMarkerInfo' at position {marker_info_pos}")
        
        # Check the 4 bytes before MinimapMarkerInfo (might be length or type info)
        if marker_info_pos >= 4:
            length_bytes = data[marker_info_pos-4:marker_info_pos]
            possible_length = struct.unpack("<I", length_bytes)[0]
            print(f"  Preceding 4 bytes: {hexlify(length_bytes).decode()} (as uint32: {possible_length})")
    
    # Look for UUID patterns using regex
    print("\nUUID Search:")
    # Convert binary to text with Latin-1 encoding to preserve byte values
    text_data = data.decode('latin-1')
    uuid_pattern = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
    uuids = re.findall(uuid_pattern, text_data, re.IGNORECASE)
    
    if uuids:
        print(f"Found {len(uuids)} potential UUIDs:")
        for i, uuid in enumerate(uuids):
            uuid_pos = text_data.find(uuid)
            print(f"  {i+1}. {uuid} at position {uuid_pos}")
            
            # Show surrounding bytes for context
            start_pos = max(0, uuid_pos - 10)
            end_pos = min(len(data), uuid_pos + len(uuid) + 10)
            context = data[start_pos:end_pos]
            print(f"     Context: {hexlify(context).decode()}")
    else:
        print("No UUIDs found in standard format")
        
        # Try looking for non-hyphenated UUIDs
        uuid_no_hyphens = r'[0-9a-f]{32}'
        uuids_nh = re.findall(uuid_no_hyphens, text_data, re.IGNORECASE)
        if uuids_nh:
            print(f"Found {len(uuids_nh)} potential non-hyphenated UUIDs:")
            for i, uuid in enumerate(uuids_nh[:5]):  # Show only first 5 to avoid spam
                uuid_pos = text_data.find(uuid)
                print(f"  {i+1}. {uuid} at position {uuid_pos}")
    
    # Look for potential coordinates - scan for float pairs that could be coordinates
    print("\nPotential Coordinates (x,y pairs):")
    coord_count = 0
    found_coords = []
    
    # Only scan a portion of the file to avoid too many false positives
    scan_size = min(len(data), 10000)
    for i in range(0, scan_size - 8, 4):
        try:
            # Look for pairs of floats with reasonable values
            x = struct.unpack("<f", data[i:i+4])[0]
            y = struct.unpack("<f", data[i+4:i+8])[0]
            
            # Filter for reasonable coordinate ranges
            if -10000 < x < 10000 and -10000 < y < 10000 and (abs(x) > 1 or abs(y) > 1):
                found_coords.append((i, x, y))
                coord_count += 1
                
                # Only show first 10 coordinates
                if coord_count <= 10:
                    print(f"  Position {i}: ({x:.2f}, {y:.2f})")
        except:
            pass
    
    if coord_count > 10:
        print(f"  ... and {coord_count - 10} more coordinate pairs")
    
    # Look for text strings that might be marker names or descriptions
    print("\nPotential Marker Text:")
    strings = re.findall(b'[ -~]{5,}', data)  # Find printable ASCII strings of 5+ chars
    unique_strings = set()
    
    for s in strings:
        s_str = s.decode('latin-1')
        # Skip common .NET serialization strings and empty/short strings
        if (len(s_str) >= 5 and 
            "Game" not in s_str and 
            "Version" not in s_str and
            "Culture" not in s_str and
            "PublicKeyToken" not in s_str and
            "MinimapMarkerInfo" not in s_str):
            unique_strings.add(s_str)
    
    # Print up to 15 unique strings
    for i, s in enumerate(list(unique_strings)[:15]):
        print(f"  {i+1}. \"{s}\"")
        
    if len(unique_strings) > 15:
        print(f"  ... and {len(unique_strings) - 15} more strings")
    
    return {
        'file_size': len(data),
        'uuids': uuids,
        'coordinates': found_coords,
        'strings': list(unique_strings)
    }

def compare_files(file1, file2):
    """Compare two files to identify differences"""
    print("\nComparing Files:")
    print("=" * 60)
    
    with open(file1, 'rb') as f1, open(file2, 'rb') as f2:
        data1 = f1.read()
        data2 = f2.read()
    
    print(f"File 1: {os.path.basename(file1)} - {len(data1)} bytes")
    print(f"File 2: {os.path.basename(file2)} - {len(data2)} bytes")
    
    # Find length of common prefix
    common_len = 0
    min_len = min(len(data1), len(data2))
    
    for i in range(min_len):
        if data1[i] != data2[i]:
            common_len = i
            break
    
    print(f"\nCommon prefix length: {common_len} bytes")
    
    if common_len > 0:
        print(f"Common header: {hexlify(data1[:min(common_len, 50)]).decode()}")
        
    if common_len < min_len:
        print(f"\nFirst difference at position {common_len}:")
        print(f"File 1: {hexlify(data1[common_len:common_len+20]).decode()}")
        print(f"File 2: {hexlify(data2[common_len:common_len+20]).decode()}")

if __name__ == "__main__":
    # Define file paths
    your_markers_file = "D:/Documents/Development/ethyrialwiki/ethyrialwiki/tools/scripts/minimap_data/markers.minimapdata"
    your_entities_file = "D:/Documents/Development/ethyrialwiki/ethyrialwiki/tools/scripts/minimap_data/entities.minimapdata"
    
    friend_markers_file = "D:/Downloads/Entities/markers.minimapdata"
    friend_entities_file = "D:/Downloads/Entities/entities.minimapdata"
    
    # Check if files exist and adjust paths if needed
    for filepath in [your_markers_file, your_entities_file, friend_markers_file, friend_entities_file]:
        if not os.path.exists(filepath):
            print(f"Warning: File not found: {filepath}")
    
    # Analyze your files
    print("\n*** YOUR FILES ***")
    your_markers_data = analyze_binary_file(your_markers_file)
    your_entities_data = analyze_binary_file(your_entities_file)
    
    # Analyze friend's files
    print("\n*** FRIEND'S FILES ***")
    friend_markers_data = analyze_binary_file(friend_markers_file)
    friend_entities_data = analyze_binary_file(friend_entities_file)
    
    # Compare your file with friend's file
    print("\n*** COMPARING YOUR MARKERS WITH FRIEND'S MARKERS ***")
    compare_files(your_markers_file, friend_markers_file)
    
    print("\n*** COMPARING YOUR ENTITIES WITH FRIEND'S ENTITIES ***")
    compare_files(your_entities_file, friend_entities_file)
    
    print("\nAnalysis complete. Run the extract_markers.py script next to extract marker data to JSON.") 