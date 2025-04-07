import os
import struct
import json
import re
from collections import defaultdict
import uuid
import binascii

def extract_coordinates(data, start_pos=0, max_scan=None):
    """Extract coordinate pairs (x,y) from binary data"""
    if max_scan is None:
        max_scan = len(data)
    else:
        max_scan = min(max_scan, len(data))
    
    coordinates = []
    
    # Scan for float pairs that could be coordinates
    for i in range(start_pos, max_scan - 8, 4):
        try:
            # Look for pairs of floats with reasonable values
            x = struct.unpack("<f", data[i:i+4])[0]
            y = struct.unpack("<f", data[i+4:i+8])[0]
            
            # Filter for reasonable coordinate ranges
            if -10000 < x < 10000 and -10000 < y < 10000 and (abs(x) > 1 or abs(y) > 1):
                # Look for a potential marker type - often an integer near the coordinates
                marker_type = 0
                if i >= 4:  # If we can look 4 bytes back
                    try:
                        marker_type = struct.unpack("<I", data[i-4:i])[0]
                    except:
                        pass
                
                # Check for potential marker name/text that might follow coordinates
                name = ""
                # Look for potential string length marker (common in .NET serialization)
                if i + 8 < len(data) and data[i+8] < 128:  # Possible string length byte
                    potential_length = data[i+8]
                    if i + 9 + potential_length < len(data):
                        try:
                            # Try to decode as ASCII/Latin-1
                            text_bytes = data[i+9:i+9+potential_length]
                            if all(32 <= b <= 126 for b in text_bytes):  # Printable ASCII
                                name = text_bytes.decode('latin-1')
                        except:
                            pass
                
                coordinates.append({
                    'position': i,
                    'x': x,
                    'y': y,
                    'type': marker_type,
                    'name': name
                })
        except:
            pass
    
    return coordinates

def extract_strings(data):
    """Extract potential text strings from binary data"""
    strings = []
    
    # Find all sequences of printable ASCII characters
    for match in re.finditer(b'[ -~]{5,}', data):
        s = match.group(0).decode('latin-1')
        # Skip common .NET serialization strings
        if (len(s) >= 5 and 
            "Game" not in s and 
            "Version" not in s and
            "Culture" not in s and
            "PublicKeyToken" not in s and
            "MinimapMarkerInfo" not in s):
            strings.append({
                'position': match.start(),
                'text': s
            })
    
    return strings

def find_player_id(data):
    """Try to identify player ID in the data"""
    # Look for UUID patterns
    text_data = data.decode('latin-1', errors='ignore')
    uuid_pattern = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
    uuids = re.findall(uuid_pattern, text_data, re.IGNORECASE)
    
    if uuids:
        return uuids[0]  # Return the first UUID found
    
    # If no standard UUID found, look for potential non-hyphenated UUIDs
    uuid_no_hyphens = r'[0-9a-f]{32}'
    uuids_nh = re.findall(uuid_no_hyphens, text_data, re.IGNORECASE)
    if uuids_nh:
        # Format as standard UUID
        for potential_uuid in uuids_nh:
            try:
                # Try to parse and format as UUID
                formatted_uuid = str(uuid.UUID(potential_uuid))
                return formatted_uuid
            except:
                continue
    
    return None

def extract_marker_data(filepath, output_json=None):
    """Extract minimap marker data from binary file to JSON structure"""
    print(f"Extracting marker data from: {os.path.basename(filepath)}")
    
    with open(filepath, 'rb') as f:
        data = f.read()
    
    # Find the start of actual marker data
    # Often this is after the "MinimapMarkerInfo" string in the file
    marker_info_pos = data.find(b'MinimapMarkerInfo')
    start_pos = 0 if marker_info_pos == -1 else marker_info_pos
    
    # Extract coordinates (likely markers)
    coordinates = extract_coordinates(data, start_pos)
    
    # Extract potential marker names/texts
    strings = extract_strings(data)
    
    # Try to identify player ID
    player_id = find_player_id(data)
    
    # Calculate a file signature (checksum)
    file_signature = binascii.crc32(data)
    
    # Create output structure
    output = {
        'file_info': {
            'filename': os.path.basename(filepath),
            'file_size': len(data),
            'player_id': player_id,
            'file_signature': f"{file_signature:08x}"
        },
        'markers': [],
        'potential_text_strings': [s['text'] for s in strings]
    }
    
    # Process coordinates into proper marker data
    existing_coords = set()
    for coord in coordinates:
        # Simple deduplication: don't add the exact same coordinates twice
        coord_key = f"{coord['x']:.2f},{coord['y']:.2f}"
        if coord_key not in existing_coords:
            existing_coords.add(coord_key)
            
            # Try to find a nearby string that might be a marker name
            nearest_string = ""
            min_distance = float('inf')
            
            for s in strings:
                distance = abs(s['position'] - coord['position'])
                if distance < 100 and distance < min_distance:  # Within 100 bytes
                    min_distance = distance
                    nearest_string = s['text']
            
            marker = {
                'x': coord['x'],
                'y': coord['y'],
                'type': coord['type'],
                'name': coord['name'] if coord['name'] else nearest_string
            }
            
            output['markers'].append(marker)
    
    # Write to JSON file if requested
    if output_json:
        with open(output_json, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2)
        print(f"Extracted {len(output['markers'])} markers to {output_json}")
    
    return output

if __name__ == "__main__":
    # Define file paths
    your_markers_file = "D:/Documents/Development/ethyrialwiki/ethyrialwiki/tools/scripts/minimap_data/markers.minimapdata"
    your_entities_file = "D:/Documents/Development/ethyrialwiki/ethyrialwiki/tools/scripts/minimap_data/entities.minimapdata"
    
    friend_markers_file = "D:/Downloads/Entities/markers.minimapdata"
    friend_entities_file = "D:/Downloads/Entities/entities.minimapdata"
    
    # Create output folder
    output_dir = "D:/Documents/Development/ethyrialwiki/ethyrialwiki/tools/scripts/output"
    os.makedirs(output_dir, exist_ok=True)
    
    # Extract data from your files
    your_markers_json = os.path.join(output_dir, "your_markers.json")
    your_entities_json = os.path.join(output_dir, "your_entities.json")
    
    your_markers_data = extract_marker_data(your_markers_file, your_markers_json)
    your_entities_data = extract_marker_data(your_entities_file, your_entities_json)
    
    # Extract data from friend's files
    friend_markers_json = os.path.join(output_dir, "friend_markers.json")
    friend_entities_json = os.path.join(output_dir, "friend_entities.json")
    
    friend_markers_data = extract_marker_data(friend_markers_file, friend_markers_json)
    friend_entities_data = extract_marker_data(friend_entities_file, friend_entities_json)
    
    # Summary
    print("\nExtraction Summary:")
    print(f"Your markers: {len(your_markers_data['markers'])} markers extracted")
    print(f"Your entities: {len(your_entities_data['markers'])} entities extracted")
    print(f"Friend's markers: {len(friend_markers_data['markers'])} markers extracted")
    print(f"Friend's entities: {len(friend_entities_data['markers'])} entities extracted")
    
    print("\nExtraction complete. Run the fix_markers.py script next to create fixed files.") 