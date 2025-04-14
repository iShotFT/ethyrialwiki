import os
import struct
import re
from PIL import Image, ImageOps
import io
from collections import defaultdict
import sys

def parse_coordinates_from_filename(filename):
    # Use regex to parse coordinates from the base filename (e.g., "0-2-0")
    base_name = os.path.splitext(os.path.basename(filename))[0]
    match = re.match(r'(-?\d+)-(-?\d+)-(-?\d+)', base_name)
    if match:
        x = int(match.group(1))
        y = int(match.group(2))
        z = int(match.group(3))
        return x, y, z
    else:
        # Try parsing without Z if it's just X-Y
        match_xy = re.match(r'(-?\d+)-(-?\d+)', base_name)
        if match_xy:
            x = int(match_xy.group(1))
            y = int(match_xy.group(2))
            print(f"Warning: Z coordinate missing in {filename}, assuming Z=0.")
            return x, y, 0
        raise ValueError(f"Invalid filename format for coordinate parsing: {base_name}")


def get_background_chunk(x, y, background_image):
    """Safely crops the background chunk for given coordinates."""
    tile_width, tile_height = 1000, 1000 # Assume standard size
    bg_x_start = x * tile_width
    # Use max_y=4 for calculation
    bg_y_start = (4 - y) * tile_height 
    bg_x_end = bg_x_start + tile_width
    bg_y_end = bg_y_start + tile_height

    if not (0 <= bg_x_start < background_image.width and \
            0 <= bg_y_start < background_image.height and \
            bg_x_end <= background_image.width and \
            bg_y_end <= background_image.height):
        print(f"\n   -> Error: Calculated background coordinates ({bg_x_start},{bg_y_start} to {bg_x_end},{bg_y_end}) are outside the background image bounds for tile ({x},{y}).")
        return None
    
    try:
        background_chunk = background_image.crop((bg_x_start, bg_y_start, bg_x_end, bg_y_end))
        return background_chunk.convert('RGBA')
    except Exception as e:
        print(f"\n   -> Error cropping background for ({x},{y}): {e}. Skipping.")
        return None

def load_tile_from_minimap(filepath, expected_size):
    """Loads tile image from .minimap file, returns RGBA Image or None."""
    try:
        with open(filepath, 'rb') as f:
            data = f.read()
            png_start = data.find(b'\x89PNG')
            if png_start == -1:
                print(f"\n   -> Error: No PNG data found in {filepath}.")
                return None
            
            png_data = data[png_start:]
            tile_image = Image.open(io.BytesIO(png_data)).convert('RGBA')

            if tile_image.size != expected_size:
                 print(f"\n   -> Warning: Tile {filepath} size {tile_image.size} differs from expected {expected_size}. Resizing.")
                 # Use LANCZOS for better quality downscaling if needed
                 tile_image = tile_image.resize(expected_size, Image.Resampling.LANCZOS) 
            return tile_image
            
    except Exception as e:
        print(f"\n   -> Error loading tile image from {filepath}: {e}.")
        return None

def main():
    script_dir = os.path.dirname(__file__)
    minimap_dir = os.path.join(script_dir, 'minimap_data')
    background_path = os.path.join(script_dir, 'background.png')
    tile_width, tile_height = 1000, 1000 # Standard tile size

    # Load background image
    try:
        background_image = Image.open(background_path)
        expected_width, expected_height = 6000, 5000
        if background_image.size != (expected_width, expected_height):
            print(f"Warning: Background image size is {background_image.size}, expected {expected_width}x{expected_height}.")
    except FileNotFoundError:
        print(f"Error: Background image not found at {background_path}")
        return
    except Exception as e:
        print(f"Error loading background image: {e}")
        return

    # Create output directory
    output_dir = os.path.join(minimap_dir, 'extracted')
    os.makedirs(output_dir, exist_ok=True)

    # --- Scan files, determine ranges, and build lookup --- 
    print("Scanning minimap files...")
    data_lookup = {} # (x, y, z) -> filepath
    global_min_z = sys.maxsize
    global_max_z = -sys.maxsize
    found_coords = set()
    
    all_files = [f for f in os.listdir(minimap_dir) if f.endswith('.minimap')]
    if not all_files:
        print("Error: No .minimap files found in", minimap_dir)
        return
        
    for file in all_files:
        try:
            x, y, z = parse_coordinates_from_filename(file)
            data_lookup[(x, y, z)] = os.path.join(minimap_dir, file)
            found_coords.add((x, y))
            global_min_z = min(global_min_z, z)
            global_max_z = max(global_max_z, z)
        except ValueError as e:
            print(f"Skipping file {file}: {e}")

    if global_min_z == sys.maxsize:
        print("Error: Could not determine Z range. No valid minimap files found?")
        return
        
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
                
            base_image_for_coord = None # Track the image for z-1

            for z in range(global_min_z, global_max_z + 1):
                output_path = os.path.join(output_dir, f"{x}-{y}-{z}.png")
                print(f"Processing target: {output_path} (Z={z})", end='')

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


if __name__ == '__main__':
    main() 