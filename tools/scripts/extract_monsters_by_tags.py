#!/usr/bin/env python3
"""
Extract Monsters Grouped by Tags

This script parses the monsters.json file, extracts monsters,
and groups them by their tags for analysis.

The output helps in understanding monster types and distribution across the game.
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


def parse_monsters_json(file_path: str) -> Tuple[Dict[str, Dict[str, int]], Dict[str, Dict[str, Any]]]:
    """
    Parse the monsters.json file and extract monsters grouped by tags.
    
    Args:
        file_path: Path to the monsters.json file
        
    Returns:
        Tuple containing:
        - Dictionary mapping tag combinations to dictionaries of monster counts
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
            print("Could not find an array of monster items. File structure:")
            print(json.dumps(data, indent=2)[:500] + "...")  # Show first 500 chars
            return {}, {}
        
        print(f"Found {len(items)} total monster entries")
        
        # Read the first item to understand the structure
        if items:
            print("First item sample:")
            print(json.dumps(items[0], indent=2))
        
        # Counters for stats
        name_counter = Counter()
        level_counter = Counter()
        tag_counter = Counter()
        
        # Dictionary to hold monsters grouped by tags
        monsters_by_tags = defaultdict(lambda: defaultdict(int))
        
        # Track levels by monster type
        levels_by_monster = defaultdict(list)
        
        # Maps for location-based analysis
        monster_locations = defaultdict(list)
        monsters_without_tags = []
        
        for item in items:
            if "name" not in item or "info" not in item or "map" not in item:
                continue
                
            # Get the name to use
            monster_name = item["info"].get("name") or item["name"]
            if not monster_name:
                continue
                
            # Count original names
            name_counter[monster_name] += 1
            
            # Track levels for analysis
            level = item["info"].get("level")
            if level is not None:
                level_counter[level] += 1
                levels_by_monster[monster_name].append(level)
            
            # Extract tags
            tags = []
            if "tags" in item["info"] and isinstance(item["info"]["tags"], list):
                tags = item["info"]["tags"]
                for tag in tags:
                    tag_counter[tag] += 1
            
            # Add to monsters by tag combination
            if tags:
                tag_key = "|".join(sorted(tags))
                monsters_by_tags[tag_key][monster_name] += 1
                
                # Track locations
                map_info = item["map"]
                if map_info and "map" in map_info:
                    monster_locations[monster_name].append({
                        "map": map_info["map"],
                        "x": map_info.get("x", 0),
                        "y": map_info.get("y", 0),
                        "z": map_info.get("z", 0)
                    })
            else:
                monsters_without_tags.append(monster_name)
        
        print(f"Found {len(name_counter)} unique monster names")
        print(f"Found {len(monsters_by_tags)} unique tag combinations")
        
        # Print level distribution
        print("\nLevel distribution:")
        for level, count in sorted(level_counter.items(), key=lambda x: (x[0] if isinstance(x[0], int) else -1)):
            print(f"  Level {level}: {count}")
        
        # Print top tag distribution
        print("\nTop tag distribution:")
        for tag, count in sorted(tag_counter.items(), key=lambda x: -x[1])[:20]:
            print(f"  {tag}: {count}")
        
        # Create the metadata dictionary
        metadata = {
            "total_items": len(items),
            "unique_monster_names": len(name_counter),
            "unique_tag_combinations": len(monsters_by_tags),
            "level_distribution": {k: v for k, v in sorted(level_counter.items(), key=lambda x: (x[0] if isinstance(x[0], int) else -1))},
            "tag_distribution": {k: v for k, v in sorted(tag_counter.items(), key=lambda x: -x[1])},
            "levels_by_monster": levels_by_monster,
            "monsters_without_tags": monsters_without_tags,
            "monster_locations": monster_locations
        }
        
        return monsters_by_tags, metadata
        
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


def save_results(monsters_by_tags: Dict[str, Dict[str, int]], metadata: Dict[str, Any], output_path: str) -> None:
    """
    Save the monsters grouped by tags to a file in JSON format.
    
    Args:
        monsters_by_tags: Dictionary mapping tag combinations to monster counts
        metadata: Dictionary with additional stats and metadata
        output_path: Path where to save the output
    """
    try:
        # Convert defaultdict to regular dict for JSON serialization
        result = {
            "metadata": metadata,
            "monsters_by_tags": {
                tag_key: dict(monsters) for tag_key, monsters in monsters_by_tags.items()
            }
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)
        print(f"Saved monsters by tags to: {output_path}")
    except Exception as e:
        print(f"Error saving output: {e}")


def generate_report(monsters_by_tags: Dict[str, Dict[str, int]], metadata: Dict[str, Any], output_path: str) -> None:
    """
    Generate a Markdown report of monsters grouped by tags.
    
    Args:
        monsters_by_tags: Dictionary mapping tag combinations to monster counts
        metadata: Dictionary with additional stats and metadata
        output_path: Path where to save the report
    """
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("# Monster Analysis Report\n\n")
            
            # Write summary statistics
            f.write("## Summary\n\n")
            f.write(f"- Total monster entries: {metadata['total_items']}\n")
            f.write(f"- Unique monster names: {metadata['unique_monster_names']}\n")
            f.write(f"- Unique tag combinations: {metadata['unique_tag_combinations']}\n\n")
            
            # Write level distribution
            f.write("## Level Distribution\n\n")
            for level, count in sorted(
                metadata['level_distribution'].items(), 
                key=lambda x: (x[0] if isinstance(x[0], int) else -1)
            ):
                f.write(f"- Level {level}: {count}\n")
            f.write("\n")
            
            # Write tag distribution
            f.write("## Top Tag Distribution\n\n")
            for tag, count in list(metadata['tag_distribution'].items())[:30]:
                f.write(f"- {tag}: {count}\n")
            f.write("\n")
            
            # Sort tag combinations by the number of monsters
            sorted_tags = sorted(
                monsters_by_tags.items(),
                key=lambda x: sum(x[1].values()),
                reverse=True
            )
            
            # Write monsters by tag combination
            f.write("## Monsters by Tag Combination\n\n")
            
            for i, (tag_key, monsters) in enumerate(sorted_tags[:20]):
                total_count = sum(monsters.values())
                if total_count > 1:
                    f.write(f"### {tag_key} ({total_count} monsters)\n\n")
                else:
                    f.write(f"### {tag_key} (1 monster)\n\n")
                
                # Sort monsters by count
                for name, count in sorted(monsters.items(), key=lambda x: (-x[1], x[0])):
                    if count > 1:
                        f.write(f"- {name} ({count} instances)\n")
                    else:
                        f.write(f"- {name}\n")
                        
                    # Add level information if available
                    if name in metadata['levels_by_monster']:
                        levels = metadata['levels_by_monster'][name]
                        level_str = ", ".join(str(lvl) for lvl in sorted(levels))
                        f.write(f"  - Level(s): {level_str}\n")
                        
                    # Add location information if available
                    if name in metadata['monster_locations']:
                        locations = metadata['monster_locations'][name]
                        maps = set(loc['map'] for loc in locations)
                        map_str = ", ".join(sorted(maps))
                        f.write(f"  - Found in: {map_str}\n")
                
                f.write("\n")
            
            # Write summary of remaining tags
            if len(sorted_tags) > 20:
                f.write("### Other Tag Combinations\n\n")
                for tag_key, monsters in sorted_tags[20:40]:  # Show next 20
                    total_count = sum(monsters.values())
                    unique_count = len(monsters)
                    f.write(f"- {tag_key}: {total_count} monsters ({unique_count} unique)\n")
                
                if len(sorted_tags) > 40:
                    remaining = len(sorted_tags) - 40
                    f.write(f"\n... and {remaining} more tag combinations\n")
            
            # Write monsters without tags if any
            if metadata["monsters_without_tags"]:
                f.write("\n## Monsters Without Tags\n\n")
                for name in sorted(metadata["monsters_without_tags"]):
                    f.write(f"- {name}\n")
            
        print(f"Generated report saved to: {output_path}")
    except Exception as e:
        print(f"Error generating report: {e}")


def main():
    seeder_input_dir = find_seeder_input_dir()
    input_file = os.path.join(seeder_input_dir, "monsters.json")
    
    if not os.path.exists(input_file):
        print(f"Error: Could not find {input_file}")
        print("Please make sure the monsters.json file exists in the seeder/input directory")
        sys.exit(1)
    
    # Parse the JSON file and get monsters by tags
    monsters_by_tags, metadata = parse_monsters_json(input_file)
    
    if not monsters_by_tags:
        print("No monsters found or error parsing file")
        sys.exit(1)
    
    # Determine output paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_output = os.path.join(script_dir, "monsters_by_tags.json")
    report_output = os.path.join(script_dir, "monsters_report.md")
    
    # Save the results and generate a report
    save_results(monsters_by_tags, metadata, json_output)
    generate_report(monsters_by_tags, metadata, report_output)
    
    # Print a summary of the most common tag combinations
    print("\nMost common tag combinations:")
    sorted_tags = sorted(
        monsters_by_tags.items(),
        key=lambda x: sum(x[1].values()),
        reverse=True
    )
    
    for tag_key, monsters in sorted_tags[:10]:
        total_count = sum(monsters.values())
        unique_count = len(monsters)
        print(f"  {tag_key}: {total_count} monsters ({unique_count} unique)")
    
    print(f"\nFull results saved to: {json_output}")
    print(f"Report saved to: {report_output}")


if __name__ == "__main__":
    main() 