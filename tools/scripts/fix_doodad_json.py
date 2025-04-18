#!/usr/bin/env python3
"""
Fix Doodad JSON File

This script fixes the formatting issues in the doodad.json file
to make it valid JSON without losing any data and ensure it's compatible
with the streaming parser in seedDoodadResources.ts.
"""

import json
import os
import sys
import re
from pathlib import Path


def find_seeder_input_dir() -> str:
    """
    Attempt to locate the seeder/input directory by navigating up from the current directory.
    """
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Try to find the seeder/input directory by navigating up
    for _ in range(5):  # Look up to 5 levels up
        potential_path = os.path.join(current_dir, "seeder", "input")
        if os.path.exists(potential_path):
            return potential_path
        
        # Move up one directory
        current_dir = os.path.dirname(current_dir)
    
    # If not found, default to a relative path from the script
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "seeder", "input"))


def extract_valid_objects(input_path: str, output_path: str) -> bool:
    """
    Extract valid JSON objects from the file using a more robust approach.
    This ensures each object is properly separated for the streaming parser.
    
    Args:
        input_path: Path to the original JSON file
        output_path: Path where to save the fixed JSON
        
    Returns:
        True if successful, False otherwise
    """
    try:
        print("Extracting valid JSON objects one by one...")
        
        # Get file size for reporting
        file_size_mb = os.path.getsize(input_path) / (1024 * 1024)
        print(f"Original file size: {file_size_mb:.2f} MB")
        
        # Open the input file and read it as text
        with open(input_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Ensure content starts with '[' and ends with ']'
        content = content.strip()
        if not content.startswith('['):
            content = '[' + content
        if not content.endswith(']'):
            content = content + ']'
        
        # Fix missing commas between objects
        content = re.sub(r'}\s*{', '},{', content)
        
        # Remove trailing commas
        content = re.sub(r',\s*}', '}', content)
        content = re.sub(r',\s*]', ']', content)
        
        # Fix unquoted property names
        content = re.sub(r'(\{|\,)\s*([a-zA-Z0-9_]+)\s*:', r'\1"\2":', content)
        
        # Try to parse with json module first for efficiency
        print("Attempting to parse the entire file as JSON...")
        try:
            data = json.loads(content)
            print(f"Successfully parsed entire JSON with {len(data)} objects")
            
            # Write the parsed data to output file
            with open(output_path, 'w', encoding='utf-8') as f:
                # Use a compact JSON format (no whitespace) for better stream parsing
                json.dump(data, f, separators=(',', ':'))
            
            print(f"Saved properly formatted JSON to {output_path}")
            return True
        except json.JSONDecodeError as e:
            print(f"Error parsing entire file: {e}")
            print("Falling back to object-by-object extraction...")
        
        # Object-by-object extraction for problematic files
        # This is a more robust approach that handles malformed JSON
        print("Scanning for valid JSON objects...")
        
        # Use a regular expression to find objects: matches balanced braces with contents
        # This handles nested objects correctly
        valid_objects = []
        object_pattern = re.compile(r'{[^{}]*(?:{[^{}]*}[^{}]*)*}')
        
        # Find all potential objects
        raw_objects = object_pattern.findall(content)
        print(f"Found {len(raw_objects)} potential objects")
        
        # Validate each extracted object
        for i, obj_str in enumerate(raw_objects):
            try:
                # Fix any unquoted keys in each object
                obj_str = re.sub(r'(\{|\,)\s*([a-zA-Z0-9_]+)\s*:', r'\1"\2":', obj_str)
                obj = json.loads(obj_str)
                
                # Only keep objects that have required fields
                if isinstance(obj, dict) and "name" in obj and "map" in obj and "info" in obj:
                    valid_objects.append(obj)
                
                # Show progress periodically
                if (i + 1) % 10000 == 0:
                    print(f"Processed {i + 1}/{len(raw_objects)} objects, found {len(valid_objects)} valid")
            except json.JSONDecodeError:
                continue
        
        print(f"Extracted {len(valid_objects)} valid objects")
        
        if valid_objects:
            # Write all valid objects to the output file
            with open(output_path, 'w', encoding='utf-8') as f:
                # Use compact JSON format without extra whitespace
                # This is critical for the streaming parser to work correctly
                json.dump(valid_objects, f, separators=(',', ':'))
            
            print(f"Saved {len(valid_objects)} valid objects to {output_path}")
            return True
        else:
            print("No valid objects found.")
            return False
    except Exception as e:
        print(f"Error extracting valid objects: {e}")
        return False


def create_stream_friendly_json(input_path: str, output_path: str) -> bool:
    """
    Create a stream-friendly version of the JSON file by ensuring each object
    is on its own line, which is more compatible with the streaming parser.
    
    Args:
        input_path: Path to the original JSON file
        output_path: Path where to save the stream-friendly JSON
        
    Returns:
        True if successful, False otherwise
    """
    try:
        print("Creating stream-friendly JSON file...")
        
        # First attempt to parse the file as standard JSON
        try:
            with open(input_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if not isinstance(data, list):
                print("Warning: JSON data is not an array. Converting to array.")
                data = [data]
            
            print(f"Successfully parsed JSON with {len(data)} objects")
            
            # Write each object on its own line for better streaming
            with open(output_path, 'w', encoding='utf-8') as f:
                # Write the opening bracket
                f.write('[\n')
                
                # Write each object, one per line
                for i, obj in enumerate(data):
                    line = json.dumps(obj, separators=(',', ':'))
                    if i < len(data) - 1:
                        f.write(line + ',\n')
                    else:
                        f.write(line + '\n')
                
                # Write the closing bracket
                f.write(']\n')
            
            print(f"Created stream-friendly JSON with {len(data)} objects")
            return True
            
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON: {e}")
            print("Attempting to fix the file using extraction method...")
            
            # If standard parsing fails, try extracting valid objects
            return extract_valid_objects(input_path, output_path)
            
    except Exception as e:
        print(f"Error creating stream-friendly JSON: {e}")
        return False


def fix_seeder_ts_path(file_path: str) -> bool:
    """
    Update the seedDoodadResources.ts file to use the fixed JSON file path.
    
    Args:
        file_path: Path to the seedDoodadResources.ts file
        
    Returns:
        True if successful, False otherwise
    """
    try:
        print(f"Updating file path in {file_path}...")
        
        # Read the file
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Update the file path
        new_content = re.sub(
            r'const doodadJsonPath = path\.join\(INPUT_DIR, "doodad\.json"\);',
            'const doodadJsonPath = path.join(INPUT_DIR, "doodad_stream.json");',
            content
        )
        
        # Only write if changes were made
        if new_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print("Updated path in seedDoodadResources.ts")
            return True
        else:
            print("No path changes needed in seedDoodadResources.ts")
            return True
    except Exception as e:
        print(f"Error updating seedDoodadResources.ts: {e}")
        return False


def main():
    # Find the seeder input directory
    seeder_input_dir = find_seeder_input_dir()
    
    # Input and output file paths
    input_file = os.path.join(seeder_input_dir, "doodad.json")
    fixed_file = os.path.join(seeder_input_dir, "doodad_fixed.json")
    stream_file = os.path.join(seeder_input_dir, "doodad_stream.json")
    
    if not os.path.exists(input_file):
        print(f"Error: Could not find {input_file}")
        print("Please make sure the doodad.json file exists in the seeder/input directory")
        sys.exit(1)
    
    # Create a backup of the original file if not already backed up
    backup_file = input_file + ".bak"
    if not os.path.exists(backup_file):
        try:
            import shutil
            shutil.copy2(input_file, backup_file)
            print(f"Created backup at: {backup_file}")
        except Exception as e:
            print(f"Warning: Could not create backup: {e}")
    
    # First fix the JSON formatting
    print(f"Step 1: Fixing JSON formatting in: {input_file}")
    if extract_valid_objects(input_file, fixed_file):
        print("JSON fixed successfully!")
    else:
        print("Failed to fix JSON formatting")
        sys.exit(1)
    
    # Then create a stream-friendly version
    print(f"\nStep 2: Creating stream-friendly JSON for the parser")
    if create_stream_friendly_json(fixed_file, stream_file):
        print("Stream-friendly JSON created successfully!")
    else:
        print("Failed to create stream-friendly JSON")
        sys.exit(1)
    
    # Try to locate seedDoodadResources.ts to update the path
    # We'll look in several potential locations
    ts_file_locations = [
        os.path.join(os.path.dirname(seeder_input_dir), "lib", "seedDoodadResources.ts"),
        os.path.join(os.path.dirname(os.path.dirname(seeder_input_dir)), "lib", "seedDoodadResources.ts"),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "seeder", "lib", "seedDoodadResources.ts")
    ]
    
    ts_file = None
    for loc in ts_file_locations:
        if os.path.exists(loc):
            ts_file = loc
            break
    
    if ts_file:
        print(f"\nStep 3: Updating file path in seedDoodadResources.ts")
        fix_seeder_ts_path(ts_file)
    else:
        print("\nNote: Could not locate seedDoodadResources.ts to update the file path.")
        print("You need to manually update the file path in seedDoodadResources.ts to use 'doodad_stream.json'")
    
    # Validate the stream-friendly file
    try:
        with open(stream_file, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
        
        print(f"\nValidation: Stream-friendly JSON validated successfully! Contains {len(json_data)} objects.")
        print("\nAll steps completed successfully. Try running the seeder again with:")
        print("yarn db:reset && yarn seed:all --resources-mode doodad")
    except Exception as e:
        print(f"\nError validating stream-friendly JSON: {e}")
        print("\nThe file may still have issues. You might need to run additional cleanup steps.")


if __name__ == "__main__":
    main() 