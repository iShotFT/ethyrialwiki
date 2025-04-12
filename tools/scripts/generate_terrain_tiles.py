import os
import re
from PIL import Image
import sys
import math
import argparse # Import argparse

# Function to parse coordinates from filenames (similar to stitch_minimap.py)
def parse_coordinates(filename):
    """Parses coordinates from X-Y-Z.png or X-Y-terrain.png filenames."""
    name = os.path.splitext(filename)[0]
    # Match X-Y-Z format (handles negatives)
    match = re.match(r'(-?\d+)-(-?\d+)-(-?\d+)', name)
    if match:
        x = int(match.group(1))
        y = int(match.group(2))
        z = int(match.group(3))
        return x, y, z
    else:
        # Try parsing terrain tile format X-Y-terrain
        match_terrain = re.match(r'(-?\d+)-(-?\d+)-terrain', name)
        if match_terrain:
            x = int(match_terrain.group(1))
            y = int(match_terrain.group(2))
            # Assign a special Z level or handle differently if needed, here using None
            return x, y, None 
        else:
            # Raise error only if it doesn't match either known format
            raise ValueError(f"Invalid filename format: {filename}")

def generate_terrain_tiles(input_dir, terrain_path, offset_tx, offset_ty):
    """Generates background terrain tiles corresponding to existing minimap tiles."""
    print(f"Scanning directory: {input_dir} for minimap tiles...")
    
    try:
        all_files = [f for f in os.listdir(input_dir) if f.endswith('.png')]
    except FileNotFoundError:
        print(f"Error: Input directory not found: {input_dir}")
        return
    except Exception as e:
        print(f"Error listing files in directory {input_dir}: {e}")
        return

    # Filter out already existing terrain tiles to avoid using them as coordinate sources
    map_files = [f for f in all_files if not f.endswith('-terrain.png')]
    
    if not map_files:
        print(f"Error: No standard minimap tile files (e.g., X-Y-Z.png) found in '{input_dir}'. Cannot determine bounds.")
        return

    coords = []
    tile_width, tile_height = -1, -1
    unique_xy_coords = set()

    # --- Discover Tile Coordinates and Dimensions --- 
    print("Discovering tile coordinates and dimensions...")
    for i, f in enumerate(map_files):
        try:
            x, y, z = parse_coordinates(f)
            # Ensure we parsed a standard tile with a Z level
            if z is not None: 
                coords.append((x, y, z))
                unique_xy_coords.add((x, y))
                # Get tile dimensions from the first valid file found
                if tile_width == -1:
                    try:
                        img_path = os.path.join(input_dir, f)
                        with Image.open(img_path) as img:
                            tile_width, tile_height = img.size
                        if tile_width <= 0 or tile_height <= 0:
                             raise ValueError("Invalid tile dimensions detected.")
                        print(f"Detected tile size: {tile_width}x{tile_height} from {f}")
                    except Exception as e:
                        print(f"Error reading tile '{f}' to get dimensions: {e}")
                        return # Cannot proceed without tile dimensions
        except ValueError as e:
            # This catches filenames that don't match expected patterns
            print(f"Warning: Skipping file with potentially invalid name '{f}' - {e}")
            continue
        except Exception as e:
             print(f"Warning: Unexpected error processing file '{f}': {e}")
             continue


    if tile_width == -1:
        print("Error: Could not determine tile dimensions from any valid minimap file.")
        return
        
    if not unique_xy_coords:
         print("Error: No valid (X, Y) coordinates found from standard minimap tiles.")
         return

    # Find overall bounds based on X, Y coords of the map tiles
    min_x = min(x for x, y in unique_xy_coords)
    max_x = max(x for x, y in unique_xy_coords)
    min_y = min(y for x, y in unique_xy_coords)
    max_y = max(y for x, y in unique_xy_coords)
    print(f"Map Tile Bounds: X=[{min_x}, {max_x}], Y=[{min_y}, {max_y}]")

    # --- Load Terrain Image --- 
    try:
        print(f"Loading terrain background: {terrain_path}")
        terrain_img = Image.open(terrain_path).convert('RGBA')
        terrain_w, terrain_h = terrain_img.size
        print(f"Terrain dimensions: {terrain_w}x{terrain_h}")
    except FileNotFoundError:
        print(f"Error: Terrain image not found at {terrain_path}")
        return
    except Exception as e:
        print(f"Error loading terrain image: {e}")
        return

    # --- Generate Tiles --- 
    print(f"Generating terrain tiles for {len(unique_xy_coords)} unique (X,Y) locations...")
    output_dir = input_dir # Save tiles in the same directory
    debug_log_path = os.path.join(output_dir, "tile_mapping_debug.txt") # Debug log file path
    generated_count = 0
    skipped_count = 0

    # Use sorted list for deterministic output order (optional)
    sorted_unique_xy = sorted(list(unique_xy_coords))
    
    # Open debug log file
    try:
        with open(debug_log_path, 'w') as debug_f:
            debug_f.write(f"Tile Generation Debug Log\n")
            debug_f.write(f"Input Dir: {input_dir}\n")
            debug_f.write(f"Terrain Path: {terrain_path}\n")
            debug_f.write(f"Offset (tx, ty): ({offset_tx}, {offset_ty})\n")
            debug_f.write(f"Tile Bounds: X=[{min_x}, {max_x}], Y=[{min_y}, {max_y}]\n")
            debug_f.write(f"Tile Size: {tile_width}x{tile_height}\n")
            debug_f.write("-"*20 + "\n")
            debug_f.write("Tile (X, Y) | Composite Pos (px, py) | Terrain Crop Box (L, T, R, B)\n")
            debug_f.write("-"*20 + "\n")

            for x, y in sorted_unique_xy:
                # Calculate composite position
                pos_x_in_composite = (x - min_x) * tile_width
                pos_y_in_composite = (max_y - y) * tile_height 
                
                # Calculate terrain position
                pos_x_on_terrain = pos_x_in_composite + offset_tx
                pos_y_on_terrain = pos_y_in_composite + offset_ty
                
                # Desired crop box
                desired_crop_box_on_terrain = (
                    pos_x_on_terrain, pos_y_on_terrain, 
                    pos_x_on_terrain + tile_width, pos_y_on_terrain + tile_height
                )
                
                # Create new tile
                new_tile = Image.new('RGBA', (tile_width, tile_height), (0, 0, 0, 0))
                
                # Calculate intersection
                crop_left = max(0, desired_crop_box_on_terrain[0])
                crop_top = max(0, desired_crop_box_on_terrain[1])
                crop_right = min(terrain_w, desired_crop_box_on_terrain[2])
                crop_bottom = min(terrain_h, desired_crop_box_on_terrain[3])
                
                actual_crop_box_on_terrain_str = "None (No Overlap)"
                if crop_right > crop_left and crop_bottom > crop_top:
                    actual_crop_box_on_terrain = (int(crop_left), int(crop_top), int(crop_right), int(crop_bottom))
                    actual_crop_box_on_terrain_str = f"({actual_crop_box_on_terrain[0]}, {actual_crop_box_on_terrain[1]}, {actual_crop_box_on_terrain[2]}, {actual_crop_box_on_terrain[3]})"
                    try:
                        terrain_part = terrain_img.crop(actual_crop_box_on_terrain)
                        paste_x = int(max(0, 0 - (desired_crop_box_on_terrain[0]))) 
                        paste_y = int(max(0, 0 - (desired_crop_box_on_terrain[1])))
                        new_tile.paste(terrain_part, (paste_x, paste_y))
                    except Exception as e:
                        print(f"\nError cropping/pasting terrain for tile ({x},{y}): {e}")
                        skipped_count += 1
                        # Write error to log too
                        debug_f.write(f"({x:>4}, {y:>4}) | ({pos_x_in_composite:>5}, {pos_y_in_composite:>5}) | ERROR Cropping/Pasting: {e}\n")
                        continue 
                
                # Write info to debug log
                debug_f.write(f"({x:>4}, {y:>4}) | ({pos_x_in_composite:>5}, {pos_y_in_composite:>5}) | {actual_crop_box_on_terrain_str}\n")

                # Save the tile
                output_filename = f"{x}-{y}-terrain.png"
                output_path = os.path.join(output_dir, output_filename)
                try:
                    new_tile.save(output_path)
                    generated_count += 1
                    if generated_count % 100 == 0 or generated_count == len(unique_xy_coords):
                        print(f"  Generated {generated_count}/{len(unique_xy_coords)} terrain tiles...", end='\r')
                except Exception as e:
                    print(f"\nError saving tile {output_path}: {e}")
                    skipped_count += 1
            
    except IOError as e:
        print(f"\nError opening debug log file '{debug_log_path}': {e}")
        # Optionally, continue without logging?
        # For now, let's stop if we can't log
        return 
    except Exception as e:
        print(f"\nAn unexpected error occurred during tile generation: {e}")
        return
            
    print(f"\nFinished. Generated {generated_count} terrain tiles, skipped {skipped_count} due to errors, in '{output_dir}'.")
    print(f"Debug log written to: {debug_log_path}")


# --- Main Execution Block --- 
if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    workspace_root = os.path.abspath(os.path.join(script_dir, '..', '..')) 
    
    # --- Default Paths and Values --- 
    default_input_dir = os.path.join(script_dir, 'minimap_data', 'extracted')
    default_terrain_path = os.path.join(workspace_root, 'terrain.png')
    default_offset_tx = 200
    default_offset_ty = 350

    # --- Argument Parsing --- 
    parser = argparse.ArgumentParser(description='Generate terrain background tiles corresponding to existing minimap tiles.')
    parser.add_argument(
        '-i', '--input-dir',
        default=default_input_dir,
        help=f'Directory containing extracted minimap tiles (X-Y-Z.png) and where terrain tiles will be saved. Default: %(default)s'
    )
    parser.add_argument(
        '-t', '--terrain',
        default=default_terrain_path,
        help=f'Path to the background terrain image. Default: %(default)s'
    )
    parser.add_argument(
        '--offset-tx',
        type=int, default=default_offset_tx,
        help=f'Horizontal offset (tx) of the composite map on the terrain. Default: %(default)s'
    )
    parser.add_argument(
        '--offset-ty',
        type=int, default=default_offset_ty,
        help=f'Vertical offset (ty) of the composite map on the terrain. Default: %(default)s'
    )
    
    args = parser.parse_args()

    print("--- Settings --- ")
    print(f"Input/Output Directory: {args.input_dir}")
    print(f"Terrain Image Path:   {args.terrain}")
    print(f"Composite Offset (tx, ty): ({args.offset_tx}, {args.offset_ty})")
    print("----------------")
    
    # --- Debug Print Paths --- 
    # Resolve paths to absolute paths for clearer debugging
    abs_input_dir = os.path.abspath(args.input_dir)
    abs_terrain_path = os.path.abspath(args.terrain)
    print(f"DEBUG: Script directory: {script_dir}")
    print(f"DEBUG: Workspace root calculated as: {workspace_root}")
    # Show resolved absolute paths being used
    print(f"DEBUG: Absolute input directory: {abs_input_dir}")
    print(f"DEBUG: Absolute terrain path: {abs_terrain_path}")
    # --- End Debug Print --- 

    # --- Validate Paths --- 
    if not os.path.isdir(abs_input_dir):
        print(f"Error: Input directory not found or is not a directory: {abs_input_dir}")
        sys.exit(1)

    print(f"DEBUG: Checking existence of terrain path: {abs_terrain_path}") # Debug print before check
    if not os.path.exists(abs_terrain_path):
        print(f"Error: Terrain image not found at the specified path: {abs_terrain_path}")
        # Add suggestions based on common errors
        if args.terrain == default_terrain_path:
            print(f"       (Checked default path relative to workspace: {workspace_root})")
            print(f"       Ensure 'terrain.png' exists in the workspace root.")
        else:
             print(f"       (Checked path provided as argument.)")
        sys.exit(1)
        
    if not os.path.isfile(abs_terrain_path):
         print(f"Error: Specified terrain path is not a file: {abs_terrain_path}")
         sys.exit(1)

    # --- Run Generation --- 
    # Use the resolved absolute paths for clarity in function call
    generate_terrain_tiles(abs_input_dir, abs_terrain_path, args.offset_tx, args.offset_ty) 