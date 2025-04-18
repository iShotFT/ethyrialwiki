#!/usr/bin/env python3
"""
Extract Doodad Resources Grouped by Tags

This script parses the cleaned_doodad.json file, extracts resources,
normalizes their names (especially trees), and groups them by their tags.

The output helps in mapping resources to icons in resource_icon_map.json.

We need to not parse:
Flax Flower Petals

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


def normalize_resource_name(name: str, tags: List[str]) -> str:
    """
    Normalizes resource names using the same logic as in seedDoodadResources.ts.
    
    Args:
        name: Original resource name
        tags: Tags from the resource
        
    Returns:
        Normalized name
    """
    # If it's a tree, try to normalize to base form
    if tags and "Tree" in tags:
        # The prefixes and suffixes we want to strip
        prefixes = ["Ancient ", "Verdant ", "Aging "]
        suffixes = [" Sapling", " Tree"]
        
        # First, strip any known prefix
        base_name = name
        for prefix in prefixes:
            if base_name.startswith(prefix):
                base_name = base_name[len(prefix):]
                break
        
        # Then, strip any known suffix
        for suffix in suffixes:
            if base_name.endswith(suffix):
                base_name = base_name[:len(base_name) - len(suffix)]
                break
        
        # Add "Tree" suffix for consistency
        return f"{base_name} Tree"
    
    # For non-trees, return the original name
    return name


def parse_doodad_json(file_path: str) -> Tuple[Dict[str, Dict[str, int]], Dict[str, Dict[str, Any]]]:
    """
    Parse the cleaned_doodad.json file and extract resources grouped by tags.
    
    Args:
        file_path: Path to the cleaned_doodad.json file
        
    Returns:
        Tuple containing:
        - Dictionary mapping tag combinations to dictionaries of name counts
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
            print("Could not find an array of doodad items. File structure:")
            print(json.dumps(data, indent=2)[:500] + "...")  # Show first 500 chars
            return {}, {}
        
        print(f"Found {len(items)} total doodad entries")
        
        # Read the first item to understand the structure
        if items:
            print("First item sample:")
            print(json.dumps(items[0], indent=2))
        
        # Counters for stats
        name_counter = Counter()
        info_name_counter = Counter()
        type_counter = Counter()
        tag_counter = Counter()
        
        # Dictionary to hold resources grouped by tags
        resources_by_tags = defaultdict(lambda: defaultdict(int))
        
        # Mappings for tag combinations to analyze
        tag_combinations = defaultdict(set)
        resources_without_tags = []
        
        for item in items:
            if "name" not in item or "info" not in item:
                continue
                
            # Get the name to use
            resource_name = item["info"]["name"] if item["info"].get("name") else item["name"]
            if not resource_name:
                continue
                
            # Count original names
            name_counter[item["name"]] += 1
            if item["info"].get("name"):
                info_name_counter[item["info"]["name"]] += 1
            
            # Track types and tags for analysis
            if "type" in item["info"]:
                type_counter[item["info"]["type"]] += 1
            
            # Extract tags
            tags = []
            if "tags" in item["info"] and isinstance(item["info"]["tags"], list):
                tags = item["info"]["tags"]
                for tag in tags:
                    tag_counter[tag] += 1
            
            # Normalize the name based on tags
            normalized_name = normalize_resource_name(resource_name, tags)
            
            # Add to resources by tag combination
            if tags:
                tag_key = "|".join(sorted(tags))
                resources_by_tags[tag_key][normalized_name] += 1
                
                # Track what tags commonly appear together
                for tag in tags:
                    tag_combinations[tag].update(tags)
            else:
                resources_without_tags.append(resource_name)
        
        print(f"Found {len(name_counter)} unique top-level names")
        print(f"Found {len(info_name_counter)} unique info names")
        print(f"Found {len(resources_by_tags)} unique tag combinations")
        
        # Print type distribution
        print("\nType distribution:")
        for type_name, count in sorted(type_counter.items(), key=lambda x: -x[1]):
            print(f"  {type_name}: {count}")
        
        # Print top tag distribution
        print("\nTop tag distribution:")
        for tag, count in sorted(tag_counter.items(), key=lambda x: -x[1])[:20]:
            print(f"  {tag}: {count}")
        
        # Create the metadata dictionary
        metadata = {
            "total_items": len(items),
            "unique_top_level_names": len(name_counter),
            "unique_info_names": len(info_name_counter),
            "unique_tag_combinations": len(resources_by_tags),
            "type_distribution": {k: v for k, v in sorted(type_counter.items(), key=lambda x: -x[1])},
            "tag_distribution": {k: v for k, v in sorted(tag_counter.items(), key=lambda x: -x[1])},
            "tag_combinations": {k: list(v) for k, v in tag_combinations.items()},
            "resources_without_tags": resources_without_tags
        }
        
        return resources_by_tags, metadata
        
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


def save_results(resources_by_tags: Dict[str, Dict[str, int]], metadata: Dict[str, Any], output_path: str) -> None:
    """
    Save the resources grouped by tags to a file in JSON format.
    
    Args:
        resources_by_tags: Dictionary mapping tag combinations to name counts
        metadata: Dictionary with additional stats and metadata
        output_path: Path where to save the output
    """
    try:
        # Convert defaultdict to regular dict for JSON serialization
        result = {
            "metadata": metadata,
            "resources_by_tags": {
                tag_key: dict(resources) for tag_key, resources in resources_by_tags.items()
            }
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)
        print(f"Saved resources by tags to: {output_path}")
    except Exception as e:
        print(f"Error saving output: {e}")


def generate_report(resources_by_tags: Dict[str, Dict[str, int]], metadata: Dict[str, Any], output_path: str) -> None:
    """
    Generate a Markdown report of resources grouped by tags.
    
    Args:
        resources_by_tags: Dictionary mapping tag combinations to name counts
        metadata: Dictionary with additional stats and metadata
        output_path: Path where to save the report
    """
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("# Doodad Resources Analysis\n\n")
            
            # Write summary statistics
            f.write("## Summary\n\n")
            f.write(f"- Total doodad entries: {metadata['total_items']}\n")
            f.write(f"- Unique names: {metadata['unique_top_level_names']}\n")
            f.write(f"- Unique info names: {metadata['unique_info_names']}\n")
            f.write(f"- Unique tag combinations: {metadata['unique_tag_combinations']}\n\n")
            
            # Write type distribution
            f.write("## Type Distribution\n\n")
            for type_name, count in metadata['type_distribution'].items():
                f.write(f"- {type_name}: {count}\n")
            f.write("\n")
            
            # Write tag distribution
            f.write("## Top Tag Distribution\n\n")
            for tag, count in list(metadata['tag_distribution'].items())[:30]:
                f.write(f"- {tag}: {count}\n")
            f.write("\n")
            
            # Sort tag combinations by the number of resources
            sorted_tags = sorted(
                resources_by_tags.items(),
                key=lambda x: sum(x[1].values()),
                reverse=True
            )
            
            # Write resources by tag combination
            f.write("## Resources by Tag Combination\n\n")
            
            # Filter to get key tag combinations
            key_tags = ["Tree", "Vein", "Herbalism"]
            for tag in key_tags:
                f.write(f"### Tag Combinations with '{tag}'\n\n")
                
                for tag_key, resources in sorted_tags:
                    tags = tag_key.split("|")
                    if tag not in tags:
                        continue
                        
                    total_count = sum(resources.values())
                    f.write(f"#### {tag_key} ({total_count} resources)\n\n")
                    
                    # Sort resources by count
                    for name, count in sorted(resources.items(), key=lambda x: (-x[1], x[0])):
                        f.write(f"- {name} ({count})\n")
                    f.write("\n")
            
            # Write suggested resource_icon_map.json entries
            f.write("## Suggested resource_icon_map.json Entries\n\n")
            
            # Group categories
            category_mapping = {
                "Tree": "Trees",
                "Vein": "Ores",
                "Herbalism": "Herbs"
            }
            
            for tag, category in category_mapping.items():
                f.write(f"### {category}\n\n")
                f.write("```json\n{\n")
                
                entries = []
                for tag_key, resources in sorted_tags:
                    tags = tag_key.split("|")
                    if tag not in tags:
                        continue
                        
                    for name in resources.keys():
                        if tag == "Tree":
                            icon = f"{name.replace(' Tree', '')}Logs_Icon.png"
                        elif tag == "Vein":
                            ore_name = name.replace(" Vein", "")
                            icon = f"{ore_name}Ore_Icon.png"
                        else:
                            icon = f"{name.replace(' ', '')}_Icon.png"
                            
                        entries.append(f'    "{name}": {{ "icon": "{icon}", "category": "{category}" }}')
                
                f.write(",\n".join(entries))
                f.write("\n}\n```\n\n")
            
        print(f"Generated report saved to: {output_path}")
    except Exception as e:
        print(f"Error generating report: {e}")


def main():
    seeder_input_dir = find_seeder_input_dir()
    input_file = os.path.join(seeder_input_dir, "cleaned_doodad.json")
    
    if not os.path.exists(input_file):
        print(f"Error: Could not find {input_file}")
        print("Please make sure the cleaned_doodad.json file exists in the seeder/input directory")
        sys.exit(1)
    
    # Parse the JSON file and get resources by tags
    resources_by_tags, metadata = parse_doodad_json(input_file)
    
    if not resources_by_tags:
        print("No resources found or error parsing file")
        sys.exit(1)
    
    # Determine output paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_output = os.path.join(script_dir, "doodad_resources_by_tags.json")
    report_output = os.path.join(script_dir, "doodad_resources_report.md")
    
    # Save the results and generate a report
    save_results(resources_by_tags, metadata, json_output)
    generate_report(resources_by_tags, metadata, report_output)
    
    # Print a summary of the most common tag combinations
    print("\nMost common tag combinations:")
    sorted_tags = sorted(
        resources_by_tags.items(),
        key=lambda x: sum(x[1].values()),
        reverse=True
    )
    
    for tag_key, resources in sorted_tags[:10]:
        total_count = sum(resources.values())
        unique_count = len(resources)
        print(f"  {tag_key}: {total_count} resources ({unique_count} unique)")
    
    print(f"\nFull results saved to: {json_output}")
    print(f"Report saved to: {report_output}")


if __name__ == "__main__":
    main() 