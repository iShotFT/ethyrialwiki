import os
import json
import re
import struct
import binascii
import shutil
from datetime import datetime

# Your player ID
YOUR_PLAYER_ID = "5242d45d-ef6d-49fd-a266-d1ec50fa5151"

def load_json_data(json_file):
    """Load marker data from JSON file"""
    with open(json_file, 'r', encoding='utf-8') as f:
        return json.load(f)

def replace_player_id(data, old_id, new_id):
    """Replace player ID in binary data"""
    if old_id is None or new_id is None:
        print("Warning: Missing player ID, replacement might not work")
        return data
    
    # Replace standard UUID format (with hyphens)
    old_id_bytes = old_id.encode('latin-1')
    new_id_bytes = new_id.encode('latin-1')
    
    # Only proceed if the IDs are the same length
    if len(old_id_bytes) != len(new_id_bytes):
        print(f"Warning: ID length mismatch: {len(old_id_bytes)} vs {len(new_id_bytes)}")
    
    # Replace all occurrences
    modified_data = data.replace(old_id_bytes, new_id_bytes)
    
    # Also try replacing without hyphens
    old_id_no_hyphens = old_id.replace('-', '').encode('latin-1')
    new_id_no_hyphens = new_id.replace('-', '').encode('latin-1')
    
    if len(old_id_no_hyphens) == len(new_id_no_hyphens):
        modified_data = modified_data.replace(old_id_no_hyphens, new_id_no_hyphens)
    
    # Check if any replacements were made
    if modified_data == data:
        print("Warning: No player ID replacements were made. Trying alternative approaches...")
        
        # Try with varying case since UUIDs might be case-insensitive
        data_str = data.decode('latin-1', errors='ignore')
        old_id_pattern = re.escape(old_id).replace('\\-', '[-]?')  # Make hyphens optional
        
        # Create a case-insensitive pattern
        pattern = re.compile(old_id_pattern, re.IGNORECASE)
        
        # Find all matches
        matches = list(pattern.finditer(data_str))
        if matches:
            print(f"Found {len(matches)} potential ID matches with case-insensitive search")
            
            # Replace matches
            result_str = data_str
            offset = 0
            for match in matches:
                start = match.start() + offset
                end = match.end() + offset
                result_str = result_str[:start] + new_id + result_str[end:]
                offset += len(new_id) - (end - start)
            
            # Convert back to bytes
            modified_data = result_str.encode('latin-1', errors='ignore')
    
    return modified_data

def replace_file_header(source_file, target_file, friend_data, output_file):
    """Replace the file header from source_file with the one from target_file"""
    print(f"Creating hybrid file from {os.path.basename(source_file)} and {os.path.basename(target_file)}")
    
    with open(source_file, 'rb') as f:
        friend_file_data = f.read()
    
    with open(target_file, 'rb') as f:
        your_file_data = f.read()
    
    # Determine how much of the header to keep
    # This is a bit tricky - we'll assume the MinimapMarkerInfo position is a good dividing point
    marker_info_pos_friend = friend_file_data.find(b'MinimapMarkerInfo')
    marker_info_pos_your = your_file_data.find(b'MinimapMarkerInfo')
    
    if marker_info_pos_friend == -1 or marker_info_pos_your == -1:
        print("Warning: Could not find MinimapMarkerInfo in one or both files")
        header_length = min(100, len(your_file_data))  # Fallback to first 100 bytes
    else:
        # Take your header up to MinimapMarkerInfo + a few bytes before it
        # This should preserve your player ID in the header
        header_length = marker_info_pos_your
    
    # Create hybrid file:
    # Your header + Friend's data after the marker info position
    if marker_info_pos_friend != -1 and header_length < len(your_file_data):
        hybrid_data = your_file_data[:header_length] + friend_file_data[marker_info_pos_friend:]
    else:
        # Fallback: use a simple header replacement
        # Take your header (first X bytes) and the friend's file content after those bytes
        header_length = min(100, len(your_file_data))
        hybrid_data = your_file_data[:header_length] + friend_file_data[header_length:]
    
    # Write the hybrid file
    with open(output_file, 'wb') as f:
        f.write(hybrid_data)
    
    print(f"Created hybrid file: {os.path.basename(output_file)}")
    print(f"  - Header from: {os.path.basename(target_file)} ({header_length} bytes)")
    print(f"  - Content from: {os.path.basename(source_file)}")
    
    return hybrid_data

def fix_marker_file(friend_file, your_file, json_data, output_file):
    """Create a fixed marker file by combining methods"""
    # Read the files
    with open(friend_file, 'rb') as f:
        friend_data = f.read()
    
    with open(your_file, 'rb') as f:
        your_data = f.read()
    
    # Step 1: Extract Player IDs
    friend_id = json_data.get('file_info', {}).get('player_id')
    
    # Step 2: Try direct player ID replacement if friend ID was found
    if friend_id:
        print(f"Attempting to replace player ID: {friend_id} with {YOUR_PLAYER_ID}")
        modified_data = replace_player_id(friend_data, friend_id, YOUR_PLAYER_ID)
        
        # Write the ID-replaced file
        id_replaced_file = f"{os.path.splitext(output_file)[0]}_id_replaced.minimapdata"
        with open(id_replaced_file, 'wb') as f:
            f.write(modified_data)
        print(f"Created ID-replaced file: {os.path.basename(id_replaced_file)}")
    else:
        print("Warning: Could not find friend's player ID in the data")
        modified_data = friend_data  # Just use the original data
    
    # Step 3: Create a hybrid file with your header and friend's content
    hybrid_data = replace_file_header(friend_file, your_file, json_data, 
                                     f"{os.path.splitext(output_file)[0]}_hybrid.minimapdata")
    
    # Step 4: Create a final "best effort" file
    # This is either the ID-replaced file or the hybrid file, depending on which seems more promising
    # For simplicity, we'll use the hybrid approach as it's often more reliable
    shutil.copy(f"{os.path.splitext(output_file)[0]}_hybrid.minimapdata", output_file)
    print(f"Created final fixed file: {os.path.basename(output_file)}")
    
    return output_file

def create_export_file(friend_file, your_file, markers_data, output_dir):
    """Create an export file with just the marker data"""
    # This version simply creates a text file with coordinates and names
    # Could be enhanced to create a more structured format like CSV
    
    output_file = os.path.join(output_dir, "exported_markers.txt")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(f"# Ethyrial Marker Export\n")
        f.write(f"# Created: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"# Source: {os.path.basename(friend_file)}\n")
        f.write(f"# Total Markers: {len(markers_data['markers'])}\n\n")
        
        f.write("Coordinates (X, Y), Type, Name\n")
        f.write("-" * 50 + "\n")
        
        for marker in markers_data['markers']:
            f.write(f"{marker['x']:.2f}, {marker['y']:.2f}, {marker['type']}, {marker['name']}\n")
    
    print(f"Created export file with {len(markers_data['markers'])} markers: {os.path.basename(output_file)}")
    return output_file

if __name__ == "__main__":
    # Define paths
    your_markers_file = "D:/Documents/Development/ethyrialwiki/ethyrialwiki/tools/scripts/minimap_data/markers.minimapdata"
    your_entities_file = "D:/Documents/Development/ethyrialwiki/ethyrialwiki/tools/scripts/minimap_data/entities.minimapdata"
    
    friend_markers_file = "D:/Downloads/Entities/markers.minimapdata"
    friend_entities_file = "D:/Downloads/Entities/entities.minimapdata"
    
    # JSON data files from extract_markers.py
    json_dir = "D:/Documents/Development/ethyrialwiki/ethyrialwiki/tools/scripts/output"
    your_markers_json = os.path.join(json_dir, "your_markers.json")
    your_entities_json = os.path.join(json_dir, "your_entities.json")
    friend_markers_json = os.path.join(json_dir, "friend_markers.json")
    friend_entities_json = os.path.join(json_dir, "friend_entities.json")
    
    # Output directory
    output_dir = "D:/Documents/Development/ethyrialwiki/ethyrialwiki/tools/scripts/output/fixed"
    os.makedirs(output_dir, exist_ok=True)
    
    # Load JSON data
    try:
        friend_markers_data = load_json_data(friend_markers_json)
        friend_entities_data = load_json_data(friend_entities_json)
        your_markers_data = load_json_data(your_markers_json)
        your_entities_data = load_json_data(your_entities_json)
    except Exception as e:
        print(f"Error loading JSON data: {e}")
        print("Have you run extract_markers.py first?")
        exit(1)
    
    # Fix marker files
    fixed_markers_file = os.path.join(output_dir, "fixed_markers.minimapdata")
    fixed_entities_file = os.path.join(output_dir, "fixed_entities.minimapdata")
    
    fix_marker_file(friend_markers_file, your_markers_file, friend_markers_data, fixed_markers_file)
    fix_marker_file(friend_entities_file, your_entities_file, friend_entities_data, fixed_entities_file)
    
    # Create export files
    create_export_file(friend_markers_file, your_markers_file, friend_markers_data, output_dir)
    create_export_file(friend_entities_file, your_entities_file, friend_entities_data, output_dir)
    
    print("\nFile fixing complete! You now have several options:")
    print("1. Try the 'fixed_markers.minimapdata' and 'fixed_entities.minimapdata' files")
    print("   These should be the most likely to work in-game.")
    print()
    print("2. If those don't work, try the '_id_replaced' versions")
    print("   These focus on replacing just the player ID.")
    print()
    print("3. If those don't work, try the '_hybrid' versions")
    print("   These replace the file header with your own header.")
    print()
    print("Installation:")
    print("1. Make a backup of your original files!")
    print(f"2. Copy the fixed files from {output_dir}")
    print("3. Place them in your game directory, replacing your current files")
    print("4. Start the game and check if the markers appear")
    print()
    print("If none of these methods work, you can use the exported markers text file")
    print("as a reference to manually place markers in-game.") 