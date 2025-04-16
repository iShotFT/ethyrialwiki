import os
import struct
import json
import re
from collections import defaultdict
import uuid
import binascii
import bisect

def extract_positions(data, start_pos=0, max_scan=None):
    """Extract Position16 triplets only if they likely follow a GUID string + 0x01 marker."""
    print("Attempting to extract positions by looking after GUIDs...") # DEBUG
    if max_scan is None:
        max_scan = len(data)
    else:
        max_scan = min(max_scan, len(data))

    positions = []
    # Regex for standard GUID format $xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    # Need to account for potential length prefix byte before the '$'
    guid_pattern = re.compile(rb"(.)\$([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})")

    for match in guid_pattern.finditer(data):
        guid_end_offset = match.end(2) # Offset after the 36 chars of the GUID
        potential_marker_offset = guid_end_offset

        # Check if the byte immediately after the GUID is 0x01
        if potential_marker_offset < len(data) and data[potential_marker_offset] == 0x01:
            pos_start_offset = potential_marker_offset + 1
            pos_end_offset = pos_start_offset + 5

            # Check if we have enough bytes for the Position16
            if pos_end_offset <= len(data):
                try:
                    # Unpack the 5 bytes following 0x01
                    x, y, z = struct.unpack("<hhb", data[pos_start_offset:pos_end_offset])

                    # Apply coordinate range filtering (optional but helps reduce noise)
                    if 0 <= x < 8000 and 0 <= y < 8000 and -50 <= z < 50:
                        positions.append({
                            'position_offset': pos_start_offset, # Store offset where Position16 *starts*
                            'guid_offset': match.start(2) -1, # Offset where GUID string starts
                            'guid': match.group(2).decode('ascii'),
                            'x': x,
                            'y': y,
                            'z': z,
                        })
                        # print(f"Found potential Position16 at {pos_start_offset} after GUID at {match.start(2)-1}: ({x},{y},{z})") # DEBUG
                    # else: # DEBUG filtering
                        # print(f"Filtered Position16 at {pos_start_offset} due to range: ({x},{y},{z})")

                except struct.error:
                    # Couldn't unpack as <hhb, ignore
                    pass
                except Exception as e:
                    # Log other errors if needed
                    # print(f"Error processing potential Position16 at {pos_start_offset}: {e}")
                    pass
        # else: # DEBUG: No 0x01 marker found
            # if potential_marker_offset < len(data):
                # print(f"Byte after GUID at {match.end(2)-1} is not 0x01, but {data[potential_marker_offset]:02x}")
            # else:
                # print(f"No data after GUID at {match.end(2)-1}")

    # Sort by the start offset of the Position16 data
    positions.sort(key=lambda p: p['position_offset'])
    
    # Basic deduplication based on coords (in case GUIDs point to same marker?)
    final_positions = []
    seen_coords = set()
    for pos in positions:
        coord_tuple = (pos['x'], pos['y'], pos['z'])
        if coord_tuple not in seen_coords:
             final_positions.append(pos)
             seen_coords.add(coord_tuple)
        # else: # Debug duplicate coords
            # print(f"Skipping duplicate coordinate {coord_tuple} found at offset {pos['position_offset']}")

    return final_positions

def extract_strings(data):
    """Extract potential marker name strings, VERY relaxed filtering for debugging."""
    print("Attempting to extract strings (RELAXED FILTERING)...") # DEBUG
    strings = []
    # Very broad search for printable ASCII sequences
    for match in re.finditer(b'[ -~]{4,}', data): # Minimum length 4
        try:
            s = match.group(0).decode('latin-1') # Use latin-1 for broader compatibility
            start_pos = match.start()

            # Minimal filtering - just remove obvious noise/GUIDs
            if "System." in s or "PublicKeyToken" in s or "Version=" in s or "Culture=" in s:
                continue
            if re.fullmatch(r'[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}', s, re.IGNORECASE):
                continue
            # Maybe filter out things ending in k__BackingField?
            # if s.endswith("k__BackingField"): continue
                
            strings.append({
                'position_offset': start_pos,
                'text': s
            })
        except Exception:
            continue # Ignore decoding errors

    # Deduplicate
    seen_strings = set()
    unique_strings = []
    strings.sort(key=lambda s: s['position_offset'])
    for s in strings:
        key = (s['text'], s['position_offset'])
        if key not in seen_strings:
            unique_strings.append(s)
            seen_strings.add(key)
            
    print(f"Found {len(unique_strings)} strings with relaxed filtering.") # DEBUG
    # for s in unique_strings[:20]: # Print first few found strings
    #     print(f"  String @ {s['position_offset']}: {s['text'][:50]}") 

    return unique_strings

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

def get_type_from_name(name):
    """Infer marker type from its name prefix."""
    name_lower = name.lower()
    if name_lower.startswith("leyline"):
        return "LEYLINE"
    if name_lower.startswith("town:"):
        return "TOWN"
    if name_lower.startswith("bank:"):
        return "BANK"
    if name_lower.startswith("poi:"):
        return "POI"
    if name_lower.startswith("enemies:"):
        return "ENEMIES"
    # Add user-mentioned types
    if name_lower.startswith("ore:"):
        return "ORE"
    if name_lower.startswith("npc:"):
        return "NPC"

    # Add more rules based on observed names
    if "$" in name: # Filter out potential UUID strings mistakenly identified as names
        return "UNKNOWN_ID"
    # Basic check for plausible names vs internal identifiers
    # Adjusted regex to better match user examples like "ORE: Iron"
    if len(name) > 3 and re.match(r"^[\w\s:,!?-]+(?:\s\([\w\s]+\))?$", name):
        return "GENERAL" # Default for plausible names without specific prefix
    return "UNKNOWN"

def find_coord_offsets(data, x, y, z):
    """Find all offsets where the specific coordinate (x,y,z) exists as <hhb via manual scan."""
    target_coords = (x, y, z)
    offsets = []
    # Scan byte by byte, trying to unpack <hhb
    for i in range(len(data) - 5 + 1):
        try:
            unpacked_coords = struct.unpack("<hhb", data[i:i+5])
            if unpacked_coords == target_coords:
                offsets.append(i)
        except struct.error:
            continue # Couldn't unpack, move to next byte
        except Exception:
            continue # Ignore other potential errors during scan
    return offsets

def extract_marker_data(filepath, output_json=None):
    """Extract specific, known markers by finding their <hhb coordinates and looking for nearby strings."""
    print(f"--- Processing (Known <hhb Coords Scan): {os.path.basename(filepath)} ---")
    try:
        with open(filepath, 'rb') as f:
            data = f.read()
    except FileNotFoundError:
        print(f"Error: File not found at {filepath}")
        return None
    except Exception as e:
        print(f"Error reading file {filepath}: {e}")
        return None
    print(f"Read {len(data)} bytes from file.")

    strings = []
    try:
        strings = extract_strings(data)
    except Exception as e:
        print(f"Error during extract_strings: {e}")
        return None
    if not strings:
        print("Warning: No potential name strings found.")
    else:
        print(f"Found {len(strings)} potential name strings after filtering.")

    # Define known markers from debug-markers.txt
    known_markers_coords = {
        # (x, y, z): "Expected Name"
        (1653, 2869, 1) : "DEBUG - M1",
        (1648, 2869, 1) : "DEBUG - M2",
        (1636, 2869, 1) : "DEBUG - M3",
        (1653, 2862, 1) : "DEBUG - M4", # Assuming Z=1 based on others
        # Add others if needed
    }

    # Prepare output
    player_id = find_player_id(data)
    file_signature = binascii.crc32(data)
    # Basic map name assumption - adjust if the debug marker is on a different map
    map_name = "IRUMESA" 
    if "THESOLITARYISLES" in filepath.upper():
        map_name = "THESOLITARYISLES"

    output = {
        'file_info': {
            'filename': os.path.basename(filepath),
            'file_size': len(data),
            'player_id': player_id,
            'file_signature': f"{file_signature:08x}",
            'assumed_map': map_name
        },
        'markers': []
    }

    markers_found = []
    processed_string_indices = set()
    string_lookup = {s['position_offset']: idx for idx, s in enumerate(strings)}
    sorted_string_offsets = sorted(string_lookup.keys())

    # Find known coordinates (and neighbors) and associate names
    print("Scanning for known coordinate byte sequences (<hhb) and neighbors...")
    found_count = 0
    processed_marker_names = set() # Keep track to avoid duplicate entries if neighbors overlap

    for center_coords, expected_name in known_markers_coords.items():
        if expected_name in processed_marker_names:
            continue # Already found and processed this named marker

        cx, cy, cz = center_coords
        coords_to_test = [
            center_coords, 
            (cx-1, cy, cz), (cx+1, cy, cz),
            (cx, cy-1, cz), (cx, cy+1, cz),
            (cx-1, cy-1, cz), (cx+1, cy-1, cz),
            (cx-1, cy+1, cz), (cx+1, cy+1, cz)
        ]

        found_offsets = []
        found_test_coord = None

        for test_coords in coords_to_test:
            tx, ty, tz = test_coords
            offsets = find_coord_offsets(data, tx, ty, tz)
            if offsets:
                found_offsets = offsets
                found_test_coord = test_coords
                print(f"  + Found sequence for {expected_name} (tested {test_coords}) at offset(s): {found_offsets}")
                break # Found a match (center or neighbor), stop testing for this marker
            
        if not found_offsets:
            print(f"  - Sequence for {expected_name} (or neighbors) not found.")
            continue

        # --- String Association (using the first found offset) ---
        coord_offset = found_offsets[0]
        pos_end_offset = coord_offset + 5 # <hhb is 5 bytes
        best_name = ""
        best_name_type = get_type_from_name(expected_name)
        found_string_idx = -1
        start_search_idx = bisect.bisect_left(sorted_string_offsets, pos_end_offset)
        for i in range(start_search_idx, min(start_search_idx + 10, len(sorted_string_offsets))):
            str_offset = sorted_string_offsets[i]
            original_str_idx = string_lookup[str_offset]
            if (str_offset - pos_end_offset) < 50 and original_str_idx not in processed_string_indices:
                s_text = strings[original_str_idx]['text']
                s_type = get_type_from_name(s_text)
                if s_type != "UNKNOWN":
                    best_name = s_text
                    if s_type != "GENERAL" and s_type != "UNKNOWN_ID":
                        best_name_type = s_type
                    found_string_idx = original_str_idx
                    print(f"    Associated string '{best_name}' (type: {s_type}) at offset {str_offset}")
                    break

        if found_string_idx != -1:
            processed_string_indices.add(found_string_idx)
        else:
            print(f"    Could not associate a plausible string nearby.")
            best_name = expected_name # Use expected name if association failed
        
        # --- Create Marker --- 
        marker_map = map_name # Assuming IRUMESA unless file path indicates otherwise
        if "THESOLITARYISLES" in filepath.upper(): 
            marker_map = "THESOLITARYISLES"
            
        marker = {
            'name': best_name,
            'map': marker_map,
            'type': best_name_type,
            # Use the originally intended coordinates, not the neighbor's if found via neighbor
            'x': cx, 
            'y': cy,
            'z': cz 
        }
        markers_found.append(marker)
        found_count += 1
        processed_marker_names.add(expected_name)

    output['markers'] = markers_found
    print(f"Processed {found_count} known markers (including neighbors).")

    # --- Save Output --- 
    if output_json:
        try:
            os.makedirs(os.path.dirname(output_json), exist_ok=True)
            with open(output_json, 'w', encoding='utf-8') as f:
                json.dump(output, f, indent=4, ensure_ascii=False)
            print(f"Saved {len(output['markers'])} found known markers (and file info) to {output_json}")
        except Exception as e:
            print(f"Error writing JSON to {output_json}: {e}")

    return output

if __name__ == "__main__":
    # Define file paths - focusing on the debug file
    debug_markers_file = "tools/scripts/source/markers.minimapdata"
    # your_markers_file = "D:/Documents/Development/ethyrialwiki/ethyrialwiki/tools/scripts/minimap_data/markers.minimapdata"
    # your_entities_file = "D:/Documents/Development/ethyrialwiki/ethyrialwiki/tools/scripts/minimap_data/entities.minimapdata"
    
    # Create output folder
    output_dir = "D:/Documents/Development/ethyrialwiki/ethyrialwiki/tools/scripts/output"
    os.makedirs(output_dir, exist_ok=True)
    
    # Define output JSON for the debug file
    debug_markers_json = os.path.join(output_dir, "debug_markers.json")
    # your_markers_json = os.path.join(output_dir, "your_markers.json")
    # your_entities_json = os.path.join(output_dir, "your_entities.json")
    
    # Extract data ONLY from the debug file
    print(f"\n--- Starting extraction for debug file: {debug_markers_file} ---")
    debug_markers_data = extract_marker_data(debug_markers_file, debug_markers_json)
    # your_markers_data = extract_marker_data(your_markers_file, your_markers_json)
    # your_entities_data = extract_marker_data(your_entities_file, your_entities_json)
    
    # Remove friend's file processing
    
    # Summary for the debug file
    print("\n--- Debug Extraction Summary ---")
    if debug_markers_data:
        print(f"Debug markers: {len(debug_markers_data['markers'])} markers extracted to {debug_markers_json}")
    else:
        print("Debug markers extraction failed or produced no data.")
    
    # Keep summary for others if they were processed (they are commented out now)
    # print("\nExtraction Summary:")
    # if your_markers_data:
    #     print(f"Your markers: {len(your_markers_data['markers'])} markers extracted")
    # if your_entities_data:
    #     print(f"Your entities: {len(your_entities_data['markers'])} entities extracted")
    
    print("\nExtraction attempt complete.") 