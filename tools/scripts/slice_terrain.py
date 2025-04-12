import os
from PIL import Image
import sys
import math
import argparse

def slice_terrain_image(terrain_path, output_dir, crop_origin_x, crop_origin_y, 
                        output_width, output_height, tile_width, tile_height):
    """Crops the terrain image based on origin and dimensions, then slices it into tiles.
    Handles cases where the requested output dimensions exceed terrain boundaries after cropping.
    Tiles are named X-Y-terrain.png with (0,0) being the bottom-left tile.
    """
    
    # --- Load Terrain Image --- 
    try:
        print(f"Loading terrain image: {terrain_path}")
        terrain_img = Image.open(terrain_path).convert('RGBA')
        terrain_w, terrain_h = terrain_img.size
        print(f"Terrain dimensions: {terrain_w}x{terrain_h}")
    except FileNotFoundError:
        print(f"Error: Terrain image not found at {terrain_path}")
        return False
    except Exception as e:
        print(f"Error loading terrain image: {e}")
        return False

    # --- Calculate Actual Crop Box --- 
    # Define the desired crop box relative to the original terrain image
    crop_box_left = crop_origin_x
    crop_box_top = crop_origin_y
    # Calculate the maximum possible right/bottom based on requested output size
    crop_box_right_ideal = crop_origin_x + output_width
    crop_box_bottom_ideal = crop_origin_y + output_height
    
    # Intersect the ideal crop box with the actual terrain boundaries
    actual_crop_left = max(0, crop_box_left)
    actual_crop_top = max(0, crop_box_top)
    actual_crop_right = min(terrain_w, crop_box_right_ideal)
    actual_crop_bottom = min(terrain_h, crop_box_bottom_ideal)

    # Calculate the dimensions of the actual cropped area
    actual_cropped_width = actual_crop_right - actual_crop_left
    actual_cropped_height = actual_crop_bottom - actual_crop_top

    if actual_cropped_width <= 0 or actual_cropped_height <= 0:
        print("Error: Calculated crop area has zero width or height. Check origin and dimensions.")
        print(f"  Crop Origin (X,Y): ({crop_origin_x}, {crop_origin_y})")
        print(f"  Requested Output Size (W,H): ({output_width}, {output_height})")
        print(f"  Terrain Size (W,H): ({terrain_w}, {terrain_h})")
        print(f"  Actual Crop Box (L,T,R,B): ({actual_crop_left}, {actual_crop_top}, {actual_crop_right}, {actual_crop_bottom})")
        return False
        
    print(f"Requested crop output size: {output_width}x{output_height}")
    print(f"Actual cropped area size due to terrain boundaries: {actual_cropped_width}x{actual_cropped_height}")
    
    # --- Crop the Terrain --- 
    actual_crop_box = (actual_crop_left, actual_crop_top, actual_crop_right, actual_crop_bottom)
    try:
        print(f"Cropping terrain using box: {actual_crop_box}")
        cropped_terrain = terrain_img.crop(actual_crop_box)
    except Exception as e:
        print(f"Error cropping terrain image: {e}")
        return False
        
    # --- Prepare Output Directory --- 
    os.makedirs(output_dir, exist_ok=True)
    print(f"Ensured output directory exists: {output_dir}")

    # --- Calculate Tiling Grid --- 
    num_x_tiles = math.ceil(actual_cropped_width / tile_width)
    num_y_tiles = math.ceil(actual_cropped_height / tile_height)
    print(f"Creating tile grid: {num_x_tiles} columns x {num_y_tiles} rows")

    generated_count = 0
    # --- Iterate and Slice Tiles (Origin Bottom-Left) --- 
    for tile_y_idx in range(num_y_tiles): # tile_y_idx 0 is bottom row
        for tile_x_idx in range(num_x_tiles): # tile_x_idx 0 is left column
            
            # Calculate the top-left pixel coordinate (px, py) for slicing from cropped_terrain
            px = tile_x_idx * tile_width
            
            # Calculate py (top coordinate) based on bottom-up indexing (tile_y_idx=0 is bottom)
            # The top edge of the slice for the bottom row (idx=0) is total_height - tile_height
            # The top edge for the row above (idx=1) is total_height - 2*tile_height, etc.
            py = actual_cropped_height - (tile_y_idx + 1) * tile_height
            # Ensure py doesn't go below 0 for the top row if height isn't multiple of tile_height
            py = max(0, py) 
            
            # Calculate the actual height of this slice (handles partial top row)
            slice_height = min(tile_height, actual_cropped_height - py)
            # Calculate the actual width of this slice (handles partial right column)
            slice_width = min(tile_width, actual_cropped_width - px)
            
            # Define the box to slice from the cropped_terrain image
            slice_box = (px, py, px + slice_width, py + slice_height)
            
            if slice_width <= 0 or slice_height <= 0:
                print(f"Warning: Skipping tile ({tile_x_idx},{tile_y_idx}) due to zero slice dimension.")
                continue # Should not happen with ceil logic, but safety check

            # Create the actual tile image (using requested tile size, may have empty areas)
            # Fill with transparency first
            tile_image = Image.new('RGBA', (tile_width, tile_height), (0, 0, 0, 0))

            try:
                # Slice the part from the cropped terrain
                tile_content = cropped_terrain.crop(slice_box)
                
                # Paste the sliced content onto the top-left of the transparent tile_image
                # (The content size might be smaller than tile_width/tile_height for edge tiles)
                tile_image.paste(tile_content, (0, 0)) 
                
            except Exception as e:
                print(f"\nError slicing or pasting for tile ({tile_x_idx},{tile_y_idx}) with box {slice_box}: {e}")
                continue # Skip saving this tile
                
            # --- Save Tile --- 
            output_filename = f"{tile_x_idx}-{tile_y_idx}-terrain.png"
            output_path = os.path.join(output_dir, output_filename)
            try:
                tile_image.save(output_path)
                generated_count += 1
                if generated_count % 50 == 0:
                     print(f"  Saved {generated_count} tiles...", end='\r')
            except Exception as e:
                print(f"\nError saving tile {output_path}: {e}")

    print(f"\nFinished. Saved {generated_count} terrain tiles to '{output_dir}'.")
    return True

# --- Main Execution Block --- 
if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    workspace_root = os.path.abspath(os.path.join(script_dir, '..', '..')) 
    
    # --- Default Values --- 
    # Default terrain path relative to workspace root
    default_terrain_path = os.path.join(workspace_root, 'terrain.png')
    # Default output directory relative to script location
    default_output_dir = os.path.join(script_dir, 'minimap_data', 'extracted_terrain') # New subdir
    default_crop_x = 400
    default_crop_y = 350
    default_output_w = 6000
    default_output_h = 5000 # Requested, but will be limited by terrain height
    default_tile_w = 1000
    default_tile_h = 1000

    # --- Argument Parsing --- 
    parser = argparse.ArgumentParser(description='Crop a terrain image and slice it into named tiles.')
    parser.add_argument(
        '-t', '--terrain', 
        default=default_terrain_path,
        help='Path to the input terrain image. Default: %(default)s'
    )
    parser.add_argument(
        '-o', '--output-dir', 
        default=default_output_dir,
        help='Directory to save the output tiles. Default: %(default)s'
    )
    parser.add_argument(
        '--crop-x', 
        type=int, default=default_crop_x,
        help='Left coordinate (X) for the top-left corner of the crop area on the terrain image. Default: %(default)s'
    )
    parser.add_argument(
        '--crop-y', 
        type=int, default=default_crop_y,
        help='Top coordinate (Y) for the top-left corner of the crop area on the terrain image. Default: %(default)s'
    )
    parser.add_argument(
        '--out-w', 
        type=int, default=default_output_w,
        help='Desired width of the cropped area before slicing (actual width may be smaller if terrain is too narrow). Default: %(default)s'
    )
    parser.add_argument(
        '--out-h', 
        type=int, default=default_output_h,
        help='Desired height of the cropped area before slicing (actual height may be smaller if terrain is too short). Default: %(default)s'
    )
    parser.add_argument(
        '--tile-w', 
        type=int, default=default_tile_w,
        help='Width of each output tile. Default: %(default)s'
    )
    parser.add_argument(
        '--tile-h', 
        type=int, default=default_tile_h,
        help='Height of each output tile. Default: %(default)s'
    )

    args = parser.parse_args()

    print("--- Settings --- ")
    print(f"Terrain Image:    {args.terrain}")
    print(f"Output Directory: {args.output_dir}")
    print(f"Crop Origin (X,Y): ({args.crop_x}, {args.crop_y})")
    print(f"Desired Crop Size (W,H): ({args.out_w}, {args.out_h})")
    print(f"Tile Size (W,H):  ({args.tile_w}, {args.tile_h})")
    print("----------------")

    # --- Validate Paths --- 
    abs_terrain_path = os.path.abspath(args.terrain)
    abs_output_dir = os.path.abspath(args.output_dir)
    
    print(f"DEBUG: Absolute terrain path: {abs_terrain_path}")
    print(f"DEBUG: Absolute output directory: {abs_output_dir}")
    
    if not os.path.exists(abs_terrain_path):
        print(f"Error: Terrain image not found: {abs_terrain_path}")
        sys.exit(1)
    if not os.path.isfile(abs_terrain_path):
         print(f"Error: Terrain path is not a file: {abs_terrain_path}")
         sys.exit(1)
         
    # Output dir validation is handled by os.makedirs inside the function

    # --- Run Slicing --- 
    success = slice_terrain_image(
        terrain_path=abs_terrain_path, 
        output_dir=abs_output_dir, 
        crop_origin_x=args.crop_x, 
        crop_origin_y=args.crop_y, 
        output_width=args.out_w, 
        output_height=args.out_h, 
        tile_width=args.tile_w, 
        tile_height=args.tile_h
    )

    if not success:
        print("\nTile slicing process failed.")
        sys.exit(1)
    else:
        print("\nTile slicing process completed successfully.") 