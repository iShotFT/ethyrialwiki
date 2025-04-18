#!/usr/bin/env python3
"""
Extract NPCs Grouped by Title

This script parses the npcs.json file, extracts NPCs,
and groups them by their title for analysis.

The output helps in understanding NPC roles and distribution across the game.
"""

import json
import os
import sys
from collections import Counter, defaultdict
from typing import Dict, List, Set, Optional, Tuple, Any


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


def parse_npcs_json(file_path: str) -> Tuple[Dict[str, Dict[str, int]], Dict[str, Dict[str, Any]]]:
    """
    Parse the npcs.json file and extract NPCs grouped by title.
    
    Args:
        file_path: Path to the npcs.json file
        
    Returns:
        Tuple containing:
        - Dictionary mapping titles to dictionaries of NPC counts
        - Dictionary with additional stats and metadata
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
            print("Could not find an array of NPC items. File structure:")
            print(json.dumps(data, indent=2)[:500] + "...")  # Show first 500 chars
            return {}, {}
        
        print(f"Found {len(items)} total NPC entries")
        
        # Read the first item to understand the structure
        if items:
            print("First item sample:")
            print(json.dumps(items[0], indent=2))
        
        # Counters for stats
        name_counter = Counter()
        title_counter = Counter()
        tag_counter = Counter()
        
        # Dictionary to hold NPCs grouped by titles
        npcs_by_title = defaultdict(lambda: defaultdict(int))
        
        # Maps for location-based analysis
        npc_locations = defaultdict(list)
        npcs_without_title = []
        
        for item in items:
            if "name" not in item or "info" not in item or "map" not in item:
                continue
                
            # Get the name to use
            npc_name = item["info"].get("name") or item["name"]
            if not npc_name:
                continue
                
            # Count original names
            name_counter[npc_name] += 1
            
            # Get title
            title = item["info"].get("title", "")
            if title:
                title_counter[title] += 1
            
            # Extract tags for additional analysis
            if "tags" in item["info"] and isinstance(item["info"]["tags"], list):
                tags = item["info"]["tags"]
                for tag in tags:
                    tag_counter[tag] += 1
            
            # Add to NPCs by title
            if title:
                npcs_by_title[title][npc_name] += 1
                
                # Track locations
                map_info = item["map"]
                if map_info and "map" in map_info:
                    npc_locations[npc_name].append({
                        "map": map_info["map"],
                        "x": map_info.get("x", 0),
                        "y": map_info.get("y", 0),
                        "z": map_info.get("z", 0)
                    })
            else:
                npcs_without_title.append(npc_name)
        
        print(f"Found {len(name_counter)} unique NPC names")
        print(f"Found {len(title_counter)} unique NPC titles")
        
        # Print top title distribution
        print("\nTop title distribution (top 20):")
        for title, count in sorted(title_counter.items(), key=lambda x: -x[1])[:20]:
            print(f"  {title}: {count}")
        
        # Print top tag distribution
        print("\nTop tag distribution:")
        for tag, count in sorted(tag_counter.items(), key=lambda x: -x[1])[:20]:
            print(f"  {tag}: {count}")
        
        # Create the metadata dictionary
        metadata = {
            "total_items": len(items),
            "unique_npc_names": len(name_counter),
            "unique_titles": len(title_counter),
            "title_distribution": {k: v for k, v in sorted(title_counter.items(), key=lambda x: -x[1])},
            "tag_distribution": {k: v for k, v in sorted(tag_counter.items(), key=lambda x: -x[1])},
            "npcs_without_title": npcs_without_title
        }
        
        return npcs_by_title, metadata
        
    except FileNotFoundError:
        print(f"Error: File not found: {file_path}")
        return {}, {}
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
            
        return {}, {}
    except Exception as e:
        print(f"Error parsing JSON: {e}")
        return {}, {}


def save_results(npcs_by_title: Dict[str, Dict[str, int]], metadata: Dict[str, Any], output_path: str) -> None:
    """
    Save the NPCs grouped by title to a file in JSON format.
    
    Args:
        npcs_by_title: Dictionary mapping titles to NPC counts
        metadata: Dictionary with additional stats and metadata
        output_path: Path where to save the output
    """
    try:
        # Convert defaultdict to regular dict for JSON serialization
        result = {
            "metadata": metadata,
            "npcs_by_title": {
                title: dict(npcs) for title, npcs in npcs_by_title.items()
            }
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)
        print(f"Saved NPCs by title to: {output_path}")
    except Exception as e:
        print(f"Error saving output: {e}")


def generate_report(npcs_by_title: Dict[str, Dict[str, int]], metadata: Dict[str, Any], output_path: str) -> None:
    """
    Generate a Markdown report of NPCs grouped by title.
    
    Args:
        npcs_by_title: Dictionary mapping titles to NPC counts
        metadata: Dictionary with additional stats and metadata
        output_path: Path where to save the report
    """
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("# NPC Analysis Report\n\n")
            
            # Write summary statistics
            f.write("## Summary\n\n")
            f.write(f"- Total NPC entries: {metadata['total_items']}\n")
            f.write(f"- Unique NPC names: {metadata['unique_npc_names']}\n")
            f.write(f"- Unique NPC titles: {metadata['unique_titles']}\n\n")
            
            # Write top title distribution
            f.write("## Title Distribution\n\n")
            for title, count in list(metadata['title_distribution'].items())[:30]:
                f.write(f"- {title}: {count}\n")
            
            if len(metadata['title_distribution']) > 30:
                f.write(f"\n... and {len(metadata['title_distribution']) - 30} more titles\n")
            
            # Write top tag distribution
            f.write("\n## Top Tag Distribution\n\n")
            for tag, count in list(metadata['tag_distribution'].items())[:30]:
                f.write(f"- {tag}: {count}\n")
            f.write("\n")
            
            # Sort titles by the number of NPCs
            sorted_titles = sorted(
                npcs_by_title.items(),
                key=lambda x: sum(x[1].values()),
                reverse=True
            )
            
            # Write NPCs by title
            f.write("## NPCs by Title\n\n")
            
            # Get top 20 titles by NPC count
            for i, (title, npcs) in enumerate(sorted_titles[:20]):
                total_count = sum(npcs.values())
                if total_count > 1:
                    f.write(f"### {title} ({total_count} NPCs)\n\n")
                else:
                    f.write(f"### {title} (1 NPC)\n\n")
                
                # Sort NPCs by count
                for name, count in sorted(npcs.items(), key=lambda x: (-x[1], x[0])):
                    if count > 1:
                        f.write(f"- {name} ({count} instances)\n")
                    else:
                        f.write(f"- {name}\n")
                f.write("\n")
            
            # Write summary of remaining titles
            if len(sorted_titles) > 20:
                f.write("### Other Titles\n\n")
                for title, npcs in sorted_titles[20:40]:  # Show next 20
                    total_count = sum(npcs.values())
                    unique_count = len(npcs)
                    f.write(f"- {title}: {total_count} NPCs ({unique_count} unique)\n")
                
                if len(sorted_titles) > 40:
                    remaining = len(sorted_titles) - 40
                    f.write(f"\n... and {remaining} more titles\n")
            
            # Write NPCs without titles if any
            if metadata["npcs_without_title"]:
                f.write("\n## NPCs Without Title\n\n")
                for name in sorted(metadata["npcs_without_title"]):
                    f.write(f"- {name}\n")
            
        print(f"Generated report saved to: {output_path}")
    except Exception as e:
        print(f"Error generating report: {e}")


def main():
    seeder_input_dir = find_seeder_input_dir()
    input_file = os.path.join(seeder_input_dir, "npcs.json")
    
    if not os.path.exists(input_file):
        print(f"Error: Could not find {input_file}")
        print("Please make sure the npcs.json file exists in the seeder/input directory")
        sys.exit(1)
    
    # Parse the JSON file and get NPCs by title
    npcs_by_title, metadata = parse_npcs_json(input_file)
    
    if not npcs_by_title:
        print("No NPCs found or error parsing file")
        sys.exit(1)
    
    # Determine output paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_output = os.path.join(script_dir, "npcs_by_title.json")
    report_output = os.path.join(script_dir, "npcs_report.md")
    
    # Save the results and generate a report
    save_results(npcs_by_title, metadata, json_output)
    generate_report(npcs_by_title, metadata, report_output)
    
    # Print a summary of the most common titles
    print("\nMost common NPC titles:")
    sorted_titles = sorted(
        npcs_by_title.items(),
        key=lambda x: sum(x[1].values()),
        reverse=True
    )
    
    for title, npcs in sorted_titles[:10]:
        total_count = sum(npcs.values())
        unique_count = len(npcs)
        print(f"  {title}: {total_count} NPCs ({unique_count} unique)")
    
    print(f"\nFull results saved to: {json_output}")
    print(f"Report saved to: {report_output}")


if __name__ == "__main__":
    main() 