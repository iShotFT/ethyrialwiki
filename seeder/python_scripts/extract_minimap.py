import os
import struct
import re
from PIL import Image, ImageOps
import io
from collections import defaultdict
import sys
import argparse
import time
import logging
from datetime import datetime

# Setup logging
def setup_logging(output_dir):
    log_dir = os.path.join(output_dir, 'logs')
    os.makedirs(log_dir, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    log_file = os.path.join(log_dir, f'minimap_extract_{timestamp}.log')
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler(sys.stdout)
        ]
    )
    return log_file

def parse_coordinates_from_filename(filename):
    # Extract coordinates using regex pattern
    # Handle both formats: X-Y-Z.minimap and X-Y--Z.minimap (for negative Z)
    pattern = r'(\d+)-(\d+)-(-?\d+)\.minimap$'
    match = re.search(pattern, filename)
    if not match:
        # Try alternate pattern for X-Y--Z.minimap format (double hyphen for negative Z)
        pattern = r'(\d+)-(\d+)--(\d+)\.minimap$'
        match = re.search(pattern, filename)
        if match:
            x, y, z = int(match.group(1)), int(match.group(2)), -int(match.group(3))
            return x, y, z
        else:
            raise ValueError(f"Could not parse coordinates from filename: {filename}")
    else:
        x, y, z = map(int, match.groups())
        return x, y, z

def get_background_chunk(x, y, background_image):
    """
    Extract a chunk from the background image based on (x, y) coordinates.
    NOTE: The background image has its origin (0,0) at the top-left, but the game map
    has its origin at the bottom-left. Therefore, we invert the Y coordinate.
    
    Args:
        x (int): X coordinate (0-5) - increases rightward
        y (int): Y coordinate (0-4) - increases upward in game map but downward in image
        background_image (PIL.Image): The loaded background image
        
    Returns:
        PIL.Image: The extracted chunk for this coordinate, or None if coordinates are invalid
    """
    # Standard tile size
    tile_width, tile_height = 1000, 1000
    
    # Background is a 6x5 grid of 1000x1000 tiles
    if x < 0 or x > 5 or y < 0 or y > 4:
        print(f"Error: Coordinates ({x},{y}) out of range [0-5, 0-4]")
        return None
        
    try:
        # Calculate the crop box
        left = x * tile_width
        upper = (4 - y) * tile_height  # Y is inverted from map coordinates
        right = left + tile_width
        lower = upper + tile_height
        
        # Make sure we don't exceed the background dimensions
        bg_width, bg_height = background_image.size
        if right > bg_width or lower > bg_height:
            print(f"Warning: Crop box {(left, upper, right, lower)} exceeds background dimensions {background_image.size}")
            # Adjust if needed to prevent errors
            right = min(right, bg_width)
            lower = min(lower, bg_height)
            
        # Crop and return a copy (important!)
        chunk = background_image.crop((left, upper, right, lower))
        return chunk.copy()  # Return a copy to avoid reference issues
    except Exception as e:
        print(f"Error extracting background chunk for ({x},{y}): {e}")
        return None

def load_tile_from_minimap(filepath, expected_size):
    try:
        with open(filepath, 'rb') as f:
            # Read the file data
            data = f.read()
            
            # Parse the image data - minimap files contain PNG data
            # Find the start of PNG signature (89 50 4E 47)
            png_signature = b'\x89PNG'
            png_start = data.find(png_signature)
            
            if png_start == -1:
                print(f"Error: No PNG data found in {filepath}")
                return None
                
            # Extract the PNG data and create an image
            image_data = data[png_start:]
            image = Image.open(io.BytesIO(image_data))
            
            # Check if the size matches expectations
            if image.size != expected_size:
                print(f"Warning: Image size from {filepath} is {image.size}, expected {expected_size}. Resizing.")
                image = image.resize(expected_size)
                
            return image
    except FileNotFoundError:
        print(f"Error: File not found: {filepath}")
        return None
    except Exception as e:
        print(f"Error loading minimap file {filepath}: {e}")
        return None

def main(minimap_input_dir, background_input_path, output_dir):
    # Start timing
    start_time = time.time()
    
    # Setup logging
    log_file = setup_logging(output_dir)
    logging.info(f"Starting minimap extraction process")
    logging.info(f"Input directory: {minimap_input_dir}")
    logging.info(f"Background file: {background_input_path}")
    logging.info(f"Output directory: {output_dir}")
    
    # Renamed main to accept arguments, removed script_dir calculation
    # minimap_dir = os.path.join(script_dir, 'minimap_data')
    # background_path = os.path.join(script_dir, 'background.png')
    tile_width, tile_height = 1000, 1000 # Standard tile size

    # Load background image using provided path
    bg_load_start = time.time()
    try:
        background_image = Image.open(background_input_path)
        expected_width, expected_height = 6000, 5000
        if background_image.size != (expected_width, expected_height):
            warning_msg = f"Background image size is {background_image.size}, expected {expected_width}x{expected_height}."
            print(f"Warning: {warning_msg}")
            logging.warning(warning_msg)
    except FileNotFoundError:
        error_msg = f"Background image not found at {background_input_path}"
        print(f"Error: {error_msg}")
        logging.error(error_msg)
        sys.exit(1) # Exit if background not found
    except Exception as e:
        error_msg = f"Error loading background image: {e}"
        print(f"Error: {error_msg}")
        logging.error(error_msg)
        sys.exit(1)
    bg_load_time = time.time() - bg_load_start
    logging.info(f"Background image loaded in {bg_load_time:.2f} seconds")

    # Create output directory using provided path
    # output_dir = os.path.join(minimap_dir, 'extracted') # Use argument directly
    os.makedirs(output_dir, exist_ok=True)

    # --- Scan files, determine ranges, and build lookup --- 
    scan_start = time.time()
    print(f"Scanning minimap files in {minimap_input_dir}...")
    logging.info(f"Scanning minimap files in {minimap_input_dir}")
    data_lookup = {} # (x, y, z) -> filepath
    global_min_z = sys.maxsize
    global_max_z = -sys.maxsize
    found_coords = set()
    
    # Use provided minimap_input_dir
    all_files = [f for f in os.listdir(minimap_input_dir) if f.endswith('.minimap')]
    if not all_files:
        error_msg = f"No .minimap files found in {minimap_input_dir}"
        print(f"Error: {error_msg}")
        logging.error(error_msg)
        sys.exit(1)
        
    skipped_files = 0
    for file in all_files:
        try:
            x, y, z = parse_coordinates_from_filename(file)
            # Use provided minimap_input_dir
            data_lookup[(x, y, z)] = os.path.join(minimap_input_dir, file)
            found_coords.add((x, y))
            global_min_z = min(global_min_z, z)
            global_max_z = max(global_max_z, z)
        except ValueError as e:
            skipped_files += 1
            print(f"Skipping file {file}: {e}")
            logging.warning(f"Skipping file {file}: {e}")

    if global_min_z == sys.maxsize:
        error_msg = "Could not determine Z range. No valid minimap files found?"
        print(f"Error: {error_msg}")
        logging.error(error_msg)
        sys.exit(1)
    
    scan_time = time.time() - scan_start
    logging.info(f"File scanning completed in {scan_time:.2f} seconds")
    logging.info(f"Found {len(data_lookup)} valid files, skipped {skipped_files} invalid files")
    logging.info(f"Z range: [{global_min_z}, {global_max_z}]")
    print(f"Found {len(data_lookup)} data files. Z range: [{global_min_z}, {global_max_z}].")

    # --- Define full grid --- 
    min_x, max_x = 0, 5
    min_y, max_y = 0, 4 # This max_y is inclusive for the loop below
    logging.info(f"Processing grid: X=[{min_x},{max_x}], Y=[{min_y},{max_y}], Z=[{global_min_z},{global_max_z}]")
    print(f"Processing grid: X=[{min_x},{max_x}], Y=[{min_y},{max_y}], Z=[{global_min_z},{global_max_z}]")

    # --- Process full grid cumulatively --- 
    process_start = time.time()
    processed_layer_cache = {} # (x, y, z) -> PIL Image object
    processed_count = 0
    skipped_base_coords = set()
    error_count = 0
    error_types = defaultdict(int)
    
    total_tiles = (max_x - min_x + 1) * (max_y - min_y + 1) * (global_max_z - global_min_z + 1)
    logging.info(f"Total tiles to process: {total_tiles}")

    for x in range(min_x, max_x + 1):
        for y in range(min_y, max_y + 1):
            coord_start = time.time()
            print(f"\n--- Processing Coordinate ({x}, {y}) ---")
            logging.info(f"Processing coordinate ({x}, {y})")
            if (x,y) in skipped_base_coords:
                msg = f"Skipping coordinate ({x}, {y}) due to previous base image failure"
                print(f"   -> {msg}")
                logging.warning(msg)
                continue
                
            # Removed unused: base_image_for_coord = None
            coord_processed = 0
            coord_errors = 0

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
                        error_msg = f"Critical Error: Failed to get base background for ({x},{y}). Skipping this coordinate entirely."
                        print(f"\n   -> {error_msg}")
                        logging.error(error_msg)
                        skipped_base_coords.add((x,y))
                        error_count += (global_max_z - global_min_z + 1) # Count all Zs for this coord as errors
                        error_types["missing_base_image"] += 1
                        break # Stop processing Z levels for this (X,Y)
                    print(" [Base: BG Color]", end='')
                else:
                    # Subsequent layers: base is the result from z-1
                    base_image = processed_layer_cache.get((x, y, z - 1))
                    if base_image is None:
                        error_msg = f"Error: Cannot process Z={z} because previous layer Z={z-1} is missing or failed for ({x},{y}). Skipping."
                        print(f"\n   -> {error_msg}")
                        logging.error(error_msg)
                        error_count += 1
                        coord_errors += 1
                        error_types["missing_previous_layer"] += 1
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
                            error_msg = f"Error pasting tile {filepath} onto base: {e}. Using base image."
                            print(f"\n   -> {error_msg}")
                            logging.error(error_msg)
                            result_image = base_image.copy() # Fallback to base
                            error_count += 1
                            coord_errors += 1
                            error_types["paste_failure"] += 1
                    else:
                        # Tile loading failed, use base image
                        error_msg = f"Tile load failed for {filepath}"
                        print(" [Tile Load Fail]", end='')
                        logging.error(error_msg)
                        result_image = base_image.copy()
                        error_count += 1
                        coord_errors += 1
                        error_types["tile_load_failure"] += 1
                else:
                    # No .minimap file for this specific X,Y,Z
                    print(" [Data Missing]", end='')
                    logging.info(f"No data file for coordinate ({x}, {y}, {z}), using base image")
                    result_image = base_image.copy() # Use the base image directly

                # 4. Save & Cache Result
                if result_image:
                    try:
                        result_image.save(output_path, 'PNG')
                        processed_layer_cache[(x, y, z)] = result_image # Cache successful result
                        processed_count += 1
                        coord_processed += 1
                        print(f" [Saved]") 
                    except Exception as e:
                        error_msg = f"Error saving final image {output_path}: {e}"
                        print(f"\n   -> {error_msg}")
                        logging.error(error_msg)
                        error_count += 1
                        coord_errors += 1
                        error_types["save_failure"] += 1
                else:
                     # Should not happen if base_image logic is correct, but safety check
                     error_msg = f"No result image generated for {output_path}"
                     print(f"\n   -> Error: {error_msg}")
                     logging.error(error_msg)
                     error_count += 1
                     coord_errors += 1
                     error_types["missing_result_image"] += 1

            # End Z loop
            coord_time = time.time() - coord_start
            if coord_processed > 0 or coord_errors > 0:
                logging.info(f"Coordinate ({x}, {y}) processed in {coord_time:.2f}s - {coord_processed} tiles saved, {coord_errors} errors")
        # End Y loop
    # End X loop
    
    process_time = time.time() - process_start
    total_time = time.time() - start_time
    
    # Log summary
    summary = f"\nProcessing complete. {processed_count}/{total_tiles} tiles generated successfully. {error_count} errors encountered."
    print(summary)
    logging.info(summary)
    
    # Log error breakdown
    if error_count > 0:
        logging.info(f"Error breakdown:")
        for error_type, count in error_types.items():
            logging.info(f"  - {error_type}: {count}")
    
    # Log timing information
    logging.info(f"Processing time: {process_time:.2f} seconds")
    logging.info(f"Total execution time: {total_time:.2f} seconds")
    logging.info(f"Average time per successful tile: {process_time/processed_count:.4f} seconds" if processed_count > 0 else "No successful tiles")
    logging.info(f"Log file created: {log_file}")
    
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