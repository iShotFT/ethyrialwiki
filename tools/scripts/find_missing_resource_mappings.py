#!/usr/bin/env python3
"""
Find Missing Resource Mappings

This script compares resource_icon_map.json with doodad_resources_by_tags.json
to identify resource names that are missing from the icon mapping.

It outputs the results back to resource_icon_map.json with missing entries added,
maintaining existing entries and organizing them by category with comments.
"""

import json
import os
import sys
import re
from collections import defaultdict, OrderedDict
from typing import Dict, List, Set, Any, Tuple


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


def load_resource_icon_map(file_path: str) -> Dict[str, Dict[str, str]]:
    """
    Load the resource icon mapping from JSON file.
    
    Args:
        file_path: Path to the resource_icon_map.json file
        
    Returns:
        Dictionary mapping resource names to their icon information
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"Loaded {len(data)} resource mappings from {file_path}")
        return data
    except FileNotFoundError:
        print(f"Error: File not found: {file_path}")
        return {}
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON format in {file_path}: {e}")
        return {}
    except Exception as e:
        print(f"Error loading {file_path}: {e}")
        return {}


def load_doodad_resources(file_path: str) -> Dict[str, Dict[str, Any]]:
    """
    Load the doodad resources from JSON file.
    
    Args:
        file_path: Path to the doodad_resources_by_tags.json file
        
    Returns:
        Dictionary containing the doodad resources data
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"Loaded doodad resources data from {file_path}")
        return data
    except FileNotFoundError:
        print(f"Error: File not found: {file_path}")
        return {}
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON format in {file_path}: {e}")
        return {}
    except Exception as e:
        print(f"Error loading {file_path}: {e}")
        return {}


def normalize_resource_name(name: str, is_tree: bool = False) -> str:
    """
    Normalizes resource names, especially tree names.
    
    Args:
        name: Original resource name
        is_tree: Whether the resource is a tree or not
        
    Returns:
        Normalized name
    """
    # If it's a tree, normalize to "... Tree" format
    if is_tree:
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


def normalize_existing_mappings(resource_map: Dict[str, Dict[str, str]]) -> Dict[str, Dict[str, str]]:
    """
    Normalize existing resource names in the mapping, particularly tree names.
    
    Args:
        resource_map: The resource icon mapping
        
    Returns:
        Updated resource mapping with normalized names
    """
    normalized_map = {}
    
    for resource_name, info in resource_map.items():
        category = info.get("category", "")
        # Check if it's a tree and needs normalization
        if category == "Trees":
            normalized_name = normalize_resource_name(resource_name, True)
            normalized_map[normalized_name] = info
        else:
            normalized_map[resource_name] = info
    
    return normalized_map


def extract_unique_resources(doodad_data: Dict[str, Dict[str, Any]]) -> Dict[str, List[str]]:
    """
    Extract all unique resource names from the doodad data and categorize them.
    
    Args:
        doodad_data: The loaded doodad resources data
        
    Returns:
        Dictionary mapping resource categories to lists of resource names
    """
    # Define category mappings based on tags
    category_mapping = {
        "Tree": "Trees",
        "Vein": "Ores",
        "Herbalism": "Herbs",
        "Mushroom": "Plants",
        "Cooking": "Plants"
    }
    
    # Resources by category
    resources_by_category = defaultdict(set)
    
    # Process resources by tag combinations
    if "resources_by_tags" in doodad_data:
        for tag_key, resources in doodad_data["resources_by_tags"].items():
            tags = tag_key.split("|")
            
            # Determine the category based on tags
            category = None
            for tag in tags:
                if tag in category_mapping:
                    category = category_mapping[tag]
                    break
            
            # If no category was found, use "Misc"
            if not category:
                category = "Misc"
            
            # Skip Misc and Plants categories as requested
            if category in ["Misc", "Plants"]:
                continue
            
            # Add all resources in this tag combination to the category
            for resource_name in resources:
                # Normalize the resource name if it's a tree
                is_tree = category == "Trees"
                normalized_name = normalize_resource_name(resource_name, is_tree)
                resources_by_category[category].add(normalized_name)
    
    # Convert sets to sorted lists for better output
    return {
        category: sorted(list(resources))
        for category, resources in resources_by_category.items()
    }


def find_missing_mappings(
    resource_map: Dict[str, Dict[str, str]],
    resources_by_category: Dict[str, List[str]]
) -> Dict[str, List[str]]:
    """
    Find resources that are missing from the resource icon map.
    
    Args:
        resource_map: The resource icon mapping
        resources_by_category: Dictionary of resources by category
        
    Returns:
        Dictionary of missing resources by category
    """
    missing_by_category = defaultdict(list)
    
    for category, resources in resources_by_category.items():
        for resource in resources:
            if resource not in resource_map:
                missing_by_category[category].append(resource)
    
    # Sort the missing resources alphabetically
    return {
        category: sorted(resources)
        for category, resources in missing_by_category.items()
    }


def group_resources_by_category(resource_map: Dict[str, Dict[str, str]]) -> Dict[str, Dict[str, Dict[str, str]]]:
    """
    Group resources by their category for better organization.
    
    Args:
        resource_map: The resource icon mapping
        
    Returns:
        Dictionary mapping categories to resources
    """
    by_category = defaultdict(dict)
    
    for resource_name, info in resource_map.items():
        category = info.get("category", "Misc")
        by_category[category][resource_name] = info
    
    return by_category


def write_updated_map_with_comments(
    file_path: str,
    resource_map: Dict[str, Dict[str, str]],
    missing_by_category: Dict[str, List[str]]
) -> None:
    """
    Write the updated resource map back to the original JSON file with category comments.
    
    Args:
        file_path: Path to write the updated resource map
        resource_map: The existing resource icon mapping
        missing_by_category: Dictionary of missing resources by category
    """
    # Group existing resources by category
    by_category = group_resources_by_category(resource_map)
    
    # Add missing resources to their respective categories
    for category, resources in missing_by_category.items():
        for resource in resources:
            # Skip if resource already exists
            if resource in by_category[category]:
                continue
                
            # Add new resource with empty icon value
            by_category[category][resource] = {
                "icon": "",
                "category": category
            }
    
    # Process categories in a specific order
    preferred_order = ["Trees", "Ores", "Herbs", "Fibers", "Plants", "Misc"]
    
    # Create the JSON string with category comments
    json_content = "{\n"
    
    # First add categories in the preferred order
    for category in preferred_order:
        if category in by_category and by_category[category]:
            # Add category comment
            json_content += f"  /* {category} */\n"
            
            # Sort resources within each category
            sorted_resources = sorted(by_category[category].items())
            
            # Add each resource entry
            for i, (resource, info) in enumerate(sorted_resources):
                comma = "," if i < len(sorted_resources) - 1 else ""
                icon = info.get("icon", "")
                json_content += f'  "{resource}": {{ "icon": "{icon}", "category": "{category}" }}{comma}\n'
            
            # Add a blank line between categories if this isn't the last one
            if category != preferred_order[-1]:
                json_content += "\n"
    
    # Add any remaining categories
    remaining_categories = sorted([c for c in by_category.keys() if c not in preferred_order])
    for category in remaining_categories:
        if by_category[category]:
            # Add category comment
            json_content += f"  /* {category} */\n"
            
            # Sort resources within each category
            sorted_resources = sorted(by_category[category].items())
            
            # Add each resource entry
            for i, (resource, info) in enumerate(sorted_resources):
                comma = "," if i < len(sorted_resources) - 1 or category != remaining_categories[-1] else ""
                icon = info.get("icon", "")
                json_content += f'  "{resource}": {{ "icon": "{icon}", "category": "{category}" }}{comma}\n'
            
            # Add a blank line between categories if this isn't the last one
            if category != remaining_categories[-1]:
                json_content += "\n"
    
    # Close the JSON object
    json_content += "}"
    
    # Write the updated map to file
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(json_content)
        print(f"Successfully wrote updated resource map to {file_path}")
    except Exception as e:
        print(f"Error writing updated resource map: {e}")


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    seeder_input_dir = find_seeder_input_dir()
    
    # File paths
    icon_map_path = os.path.join(seeder_input_dir, "resource_icon_map.json")
    doodad_data_path = os.path.join(script_dir, "doodad_resources_by_tags.json")
    
    # Check if files exist
    if not os.path.exists(icon_map_path):
        print(f"Error: Could not find {icon_map_path}")
        sys.exit(1)
    
    if not os.path.exists(doodad_data_path):
        print(f"Error: Could not find {doodad_data_path}")
        print("Please run extract_doodad_by_tags.py first to generate doodad_resources_by_tags.json")
        sys.exit(1)
    
    # Load data
    resource_map = load_resource_icon_map(icon_map_path)
    doodad_data = load_doodad_resources(doodad_data_path)
    
    if not resource_map or not doodad_data:
        print("Error loading required data files")
        sys.exit(1)
    
    # Normalize existing tree names in the resource map
    resource_map = normalize_existing_mappings(resource_map)
    print("Normalized existing tree names in resource map")
    
    # Extract unique resources by category
    resources_by_category = extract_unique_resources(doodad_data)
    
    # Find missing mappings
    missing_by_category = find_missing_mappings(resource_map, resources_by_category)
    
    # Skip Misc and Plants categories
    if "Misc" in missing_by_category:
        del missing_by_category["Misc"]
    if "Plants" in missing_by_category:
        del missing_by_category["Plants"]
    
    # Print missing mappings summary
    total_missing = sum(len(resources) for resources in missing_by_category.values())
    print(f"\nFound {total_missing} resources missing from resource_icon_map.json")
    
    for category, resources in missing_by_category.items():
        print(f"\n{category} ({len(resources)} missing):")
        for resource in resources:
            print(f"  - {resource}")
    
    # Make a backup of the original file
    backup_path = f"{icon_map_path}.bak"
    try:
        with open(icon_map_path, 'r', encoding='utf-8') as src:
            with open(backup_path, 'w', encoding='utf-8') as dst:
                dst.write(src.read())
        print(f"Created backup of original file at {backup_path}")
    except Exception as e:
        print(f"Warning: Failed to create backup: {e}")
    
    # Write the updated map back to the original file with category comments
    write_updated_map_with_comments(icon_map_path, resource_map, missing_by_category)
    
    print(f"\nResource icon map updated! Missing entries added to {icon_map_path}")
    print(f"Original file backed up to {backup_path}")
    
    # Print JSON snippet of missing mappings for reference
    print("\nJSON snippet with missing mappings (for reference):")
    print("{")
    
    # Group and sort by category for better organization
    for category in sorted(missing_by_category.keys()):
        resources = missing_by_category[category]
        print(f"  /* {category} */")
        
        for i, resource in enumerate(resources):
            comma = "," if i < len(resources) - 1 or category != list(sorted(missing_by_category.keys()))[-1] else ""
            print(f'  "{resource}": {{ "icon": "", "category": "{category}" }}{comma}')
        
        if category != list(sorted(missing_by_category.keys()))[-1]:
            print()
    
    print("}")


if __name__ == "__main__":
    main() 