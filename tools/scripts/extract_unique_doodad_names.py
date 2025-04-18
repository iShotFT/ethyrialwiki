#!/usr/bin/env python3
"""
Extract Unique Doodad Names Script

This script parses the cleaned_doodad.json file in the seeder/input directory,
extracts all unique names, and outputs them sorted alphabetically.

The output can be used to verify resource mapping coverage in resource_icon_map.json.
"""

import json
import os
import sys
from collections import Counter
from typing import Dict, List, Set


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


def parse_doodad_json(file_path: str) -> Dict[str, int]:
    """
    Parse the cleaned_doodad.json file and extract all unique names with counts.
    
    Args:
        file_path: Path to the cleaned_doodad.json file
        
    Returns:
        Dictionary mapping each unique name to its frequency count
    """
    print(f"Parsing file: {file_path}")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Add debug information about the file structure
        print(f"JSON data type: {type(data)}")
        
        # Handle different possible structures
        items = []
        if isinstance(data, list):
            print("File structure: JSON array at root level")
            items = data
        elif isinstance(data, dict):
            print("File structure: JSON object at root level")
            # Try to find an array inside the object
            for key, value in data.items():
                print(f"Root key: {key} (type: {type(value)})")
                if isinstance(value, list):
                    items = value
                    print(f"Using array from key: {key} with {len(items)} items")
                    break
        
        if not items:
            # Display a sample of the data to help diagnose
            print("Could not find an array of doodad items. File structure:")
            print(json.dumps(data, indent=2)[:500] + "...")  # Show first 500 chars
            return {}
        
        print(f"Found {len(items)} total doodad entries")
        
        # Read the first item to understand the structure
        if items:
            print("First item sample:")
            print(json.dumps(items[0], indent=2))
        
        # Count occurrences of each name
        name_counter = Counter()
        info_name_counter = Counter()
        type_counter = Counter()
        tag_counter = Counter()
        
        for item in items:
            # Get the top-level name
            if "name" in item:
                name_counter[item["name"]] += 1
            
            # Get the info.name if it exists and differs
            if "info" in item and "name" in item["info"]:
                info_name_counter[item["info"]["name"]] += 1
            
            # Track types and tags for analysis
            if "info" in item:
                if "type" in item["info"]:
                    type_counter[item["info"]["type"]] += 1
                
                if "tags" in item["info"] and isinstance(item["info"]["tags"], list):
                    for tag in item["info"]["tags"]:
                        tag_counter[tag] += 1
        
        print(f"Found {len(name_counter)} unique top-level names")
        print(f"Found {len(info_name_counter)} unique info names")
        
        # Print type distribution
        print("\nType distribution:")
        for type_name, count in sorted(type_counter.items(), key=lambda x: -x[1]):
            print(f"  {type_name}: {count}")
        
        # Print tag distribution
        print("\nTag distribution:")
        for tag, count in sorted(tag_counter.items(), key=lambda x: -x[1]):
            print(f"  {tag}: {count}")
        
        return name_counter
        
    except FileNotFoundError:
        print(f"Error: File not found: {file_path}")
        return {}
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON format: {e}")
        
        # Try to show where the parsing error occurred
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                error_context = content[max(0, e.pos - 100):min(len(content), e.pos + 100)]
                print(f"Context around error position {e.pos}:")
                print(error_context)
        except Exception as ex:
            print(f"Could not read file for context: {ex}")
            
        return {}
    except Exception as e:
        print(f"Error parsing JSON: {e}")
        return {}


def save_unique_names(names: Dict[str, int], output_path: str) -> None:
    """
    Save the unique names to a file in JSON format.
    
    Args:
        names: Dictionary of unique names with count
        output_path: Path where to save the output
    """
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(
                {
                    "unique_names": sorted(names.keys()),
                    "name_counts": {k: v for k, v in sorted(names.items(), key=lambda x: (-x[1], x[0]))}
                }, 
                f, 
                indent=2
            )
        print(f"Saved unique names to: {output_path}")
    except Exception as e:
        print(f"Error saving output: {e}")


def main():
    seeder_input_dir = find_seeder_input_dir()
    input_file = os.path.join(seeder_input_dir, "cleaned_doodad.json")
    
    if not os.path.exists(input_file):
        print(f"Error: Could not find {input_file}")
        print("Please make sure the cleaned_doodad.json file exists in the seeder/input directory")
        sys.exit(1)
    
    # Parse the JSON file and get unique names
    unique_names = parse_doodad_json(input_file)
    
    if not unique_names:
        print("No unique names found or error parsing file")
        sys.exit(1)
    
    # Determine output path
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_file = os.path.join(script_dir, "unique_doodad_names.json")
    
    # Save the unique names
    save_unique_names(unique_names, output_file)
    
    # Print some of the names as a preview
    print("\nPreview of unique names (top 20):")
    for name, count in sorted(unique_names.items(), key=lambda x: (-x[1], x[0]))[:20]:
        print(f"  {name} ({count} occurrences)")
    
    print(f"\nTotal unique names: {len(unique_names)}")
    print(f"Full results saved to: {output_file}")


if __name__ == "__main__":
    main() 