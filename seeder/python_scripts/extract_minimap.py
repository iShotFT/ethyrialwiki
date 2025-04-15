import os
import struct
import re
from PIL import Image, ImageOps
import io
from collections import defaultdict
import sys
import argparse

def parse_coordinates_from_filename(filename):
    # ... function code ...

def get_background_chunk(x, y, background_image):
    # ... function code ...

def load_tile_from_minimap(filepath, expected_size):
    # ... function code ...

def main(minimap_input_dir, background_input_path, output_dir):
    # Renamed main to accept arguments, removed script_dir calculation
    # minimap_dir = os.path.join(script_dir, 'minimap_data')
    # background_path = os.path.join(script_dir, 'background.png')
    tile_width, tile_height = 1000, 1000 # Standard tile size

    # Load background image using provided path
    try:
        background_image = Image.open(background_input_path)
        expected_width, expected_height = 6000, 5000
        if background_image.size != (expected_width, expected_height):
            print(f"Warning: Background image size is {background_image.size}, expected {expected_width}x{expected_height}.")
    except FileNotFoundError:
        print(f"Error: Background image not found at {background_input_path}")
        sys.exit(1) # Exit if background not found
    except Exception as e:
        print(f"Error loading background image: {e}")
        sys.exit(1)

    # Create output directory using provided path
    # output_dir = os.path.join(minimap_dir, 'extracted') # Use argument directly
    os.makedirs(output_dir, exist_ok=True)

    # --- Scan files, determine ranges, and build lookup --- 
    print(f"Scanning minimap files in {minimap_input_dir}...")
    data_lookup = {} # (x, y, z) -> filepath
    global_min_z = sys.maxsize
    global_max_z = -sys.maxsize
    found_coords = set()
    
    # Use provided minimap_input_dir
    all_files = [f for f in os.listdir(minimap_input_dir) if f.endswith('.minimap')]
    if not all_files:
        print(f"Error: No .minimap files found in {minimap_input_dir}")
        sys.exit(1)
        
    for file in all_files:
        try:
            x, y, z = parse_coordinates_from_filename(file)
            # Use provided minimap_input_dir
            data_lookup[(x, y, z)] = os.path.join(minimap_input_dir, file)
            found_coords.add((x, y))
            global_min_z = min(global_min_z, z)
            global_max_z = max(global_max_z, z)
        except ValueError as e:
            print(f"Skipping file {file}: {e}")

    if global_min_z == sys.maxsize:
        print("Error: Could not determine Z range. No valid minimap files found?")
        sys.exit(1)
        
    print(f"Found {len(data_lookup)} data files. Z range: [{global_min_z}, {global_max_z}].")

    # --- Define full grid --- 
    min_x, max_x = 0, 5
    min_y, max_y = 0, 4 # This max_y is inclusive for the loop below
    print(f"Processing grid: X=[{min_x},{max_x}], Y=[{min_y},{max_y}], Z=[{global_min_z},{global_max_z}]")

    # --- Process full grid cumulatively --- 
    processed_layer_cache = {} # (x, y, z) -> PIL Image object
    processed_count = 0
    skipped_base_coords = set()
    error_count = 0

    for x in range(min_x, max_x + 1):
        for y in range(min_y, max_y + 1):
            print(f"\n--- Processing Coordinate ({x}, {y}) ---")
            if (x,y) in skipped_base_coords:
                print("   -> Skipping coordinate due to previous base image failure.")
                continue
                
            # Removed unused: base_image_for_coord = None

            for z in range(global_min_z, global_max_z + 1):
                # Use provided output_dir
                output_path = os.path.join(output_dir, f"{x}-{y}-{z}.png")
                print(f"Processing target: {output_path} (Z={z})", end='')

                # ... (rest of the Z loop logic remains the same) ...
                # 1. Determine Base Image for this Z
                if z == global_min_z:
                    # First layer: base is the background chunk
                    base_image = get_background_chunk(x, y, background_image)
                    if base_image is None:
                        print(f"\n   -> Critical Error: Failed to get base background for ({x},{y}). Skipping this coordinate entirely.")
                        skipped_base_coords.add((x,y))
                        error_count += (global_max_z - global_min_z + 1) # Count all Zs for this coord as errors
                        break # Stop processing Z levels for this (X,Y)
                    print(" [Base: BG Color]", end='')
                else:
                    # Subsequent layers: base is the result from z-1
                    base_image = processed_layer_cache.get((x, y, z - 1))
                    if base_image is None:
                        print(f"\n   -> Error: Cannot process Z={z} because previous layer Z={z-1} is missing or failed for ({x},{y}). Skipping.")
                        error_count += 1
                        continue # Skip this Z, try the next one (might recover if data exists)
                    print(" [Base: Prev Layer]", end='')
                
                current_tile_image = None
                result_image = None
                filepath = data_lookup.get((x, y, z))

                # 2. Check for & load current tile data
                if filepath:
                    print(" [Data Found]", end='')
                    current_tile_image = load_tile_from_minimap(filepath, (tile_width, tile_height))
                    if current_tile_image:
                        # 3. Combine if tile loaded successfully
                         try:
                            # IMPORTANT: Paste onto a COPY of the base
                            result_image = base_image.copy() 
                            result_image.paste(current_tile_image, (0, 0), current_tile_image)
                            print(" [Combined]", end='')
                         except Exception as e:
                            print(f"\n   -> Error pasting tile {filepath} onto base: {e}. Using base image.")
                            result_image = base_image.copy() # Fallback to base
                            error_count +=1
                    else:
                        # Tile loading failed, use base image
                        print(" [Tile Load Fail]", end='')
                        result_image = base_image.copy()
                        error_count += 1
                else:
                    # No .minimap file for this specific X,Y,Z
                    print(" [Data Missing]", end='')
                    result_image = base_image.copy() # Use the base image directly

                # 4. Save & Cache Result
                if result_image:
                    try:
                        result_image.save(output_path, 'PNG')
                        processed_layer_cache[(x, y, z)] = result_image # Cache successful result
                        processed_count += 1
                        print(f" [Saved]") 
                    except Exception as e:
                        print(f"\n   -> Error saving final image {output_path}: {e}")
                        error_count += 1
                else:
                     # Should not happen if base_image logic is correct, but safety check
                     print(f"\n   -> Error: No result image generated for {output_path}.")
                     error_count += 1

            # End Z loop
        # End Y loop
    # End X loop
    
    print(f"\nProcessing complete. {processed_count} tiles generated successfully. {error_count} errors encountered or tiles skipped.")
    # Return error count for main script to check
    return error_count

if __name__ == '__main__':
    # Setup argparse
    parser = argparse.ArgumentParser(description="Extract minimap tiles from .minimap files and combine with background.")
    parser.add_argument("--input-dir", required=True, help="Directory containing the .minimap files.")
    parser.add_argument("--background-file", required=True, help="Path to the background image file (e.g., background.png).")
    parser.add_argument("--output-dir", required=True, help="Directory to save the extracted and combined PNG tiles.")

    args = parser.parse_args()

    # Call main function with parsed arguments
    errors = main(args.input_dir, args.background_file, args.output_dir)
    
    # Exit with non-zero code if errors occurred
    if errors > 0:
        sys.exit(1)
    else:
        sys.exit(0) 