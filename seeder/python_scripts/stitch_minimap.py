import os
from PIL import Image
import re
import argparse
import sys

def parse_coordinates(filename):
    # ... function code ...

def stitch_layer(extracted_tiles_dir, z_layer, background_image):
    # Find all PNG files in the extracted tiles directory
    files = [f for f in os.listdir(extracted_tiles_dir) if f.endswith('.png')]
    # ... rest of stitch_layer function ...

def create_composite(extracted_tiles_dir, z_layers, background_image):
    # Find all PNG files in the extracted tiles directory
    all_files = [f for f in os.listdir(extracted_tiles_dir) if f.endswith('.png')]
    # ... rest of create_composite function ...

def main(extracted_tiles_dir, background_input_path, output_dir):
    # Renamed main to accept arguments, removed script_dir calculation
    # Get the directory containing the extracted PNG files
    # directory = os.path.join(script_dir, 'minimap_data', 'extracted')
    
    # Define background image path (assuming it's in the same dir as the script)
    # background_path = os.path.join(script_dir, 'background.png')

    # Load background image using provided path
    try:
        background_image = Image.open(background_input_path)
        expected_width, expected_height = 6000, 5000
        if background_image.size != (expected_width, expected_height):
            print(f"Warning: Background image size is {background_image.size}, expected {expected_width}x{expected_height}")
    except FileNotFoundError:
        print(f"Error: Background image not found at {background_input_path}")
        return 1 # Return error code
    except Exception as e:
        print(f"Error loading background image: {e}")
        return 1

    # Create output directory using provided path
    # output_dir = os.path.join(directory, 'stitched')
    os.makedirs(output_dir, exist_ok=True)
    
    # Find all unique z-layers from the extracted tiles directory
    z_layers = set()
    all_extracted_files = os.listdir(extracted_tiles_dir)
    if not all_extracted_files:
        print(f"Error: No extracted tile files found in {extracted_tiles_dir}")
        return 1 # Return error code
        
    for f in all_extracted_files:
        if f.endswith('.png'):
            try:
                _, _, z = parse_coordinates(f)
                z_layers.add(z)
            except ValueError as e:
                print(f"Warning: Skipping file {f} - {e}")
    
    if not z_layers:
        print(f"Error: Could not determine Z layers from files in {extracted_tiles_dir}")
        return 1 # Return error code
        
    # Create composite of all layers, passing background image
    print("Creating composite of all layers...")
    # Pass extracted_tiles_dir to create_composite
    composite = create_composite(extracted_tiles_dir, z_layers, background_image)
    if composite:
        composite_path = os.path.join(output_dir, 'composite.png')
        try:
            composite.save(composite_path)
            print(f"Saved composite to {composite_path}")
        except Exception as e:
            print(f"Error saving composite image {composite_path}: {e}")
            # Continue to stitch individual layers even if composite fails
    else:
        print("Warning: Failed to create composite image.")
    
    # Stitch each layer, passing background image
    layer_save_errors = 0
    for z in sorted(z_layers):
        print(f'Processing layer {z}...')
        # Pass extracted_tiles_dir to stitch_layer
        stitched, _, _, _ = stitch_layer(extracted_tiles_dir, z, background_image)
        if stitched:
            output_path = os.path.join(output_dir, f'layer_{z}.png')
            try:
                stitched.save(output_path)
                print(f'Saved layer {z} to {output_path}')
            except Exception as e:
                 print(f"Error saving layer image {output_path}: {e}")
                 layer_save_errors += 1
        else:
            print(f"Warning: Failed to stitch layer {z}. Skipping save.")
            
    return layer_save_errors # Return number of layer save errors

if __name__ == '__main__':
    # Setup argparse
    parser = argparse.ArgumentParser(description="Stitch extracted minimap PNG tiles into layers and a composite image.")
    parser.add_argument("--input-dir", required=True, help="Directory containing the extracted PNG tile files (output of extract_minimap.py).")
    parser.add_argument("--background-file", required=True, help="Path to the background image file (e.g., background.png).")
    parser.add_argument("--output-dir", required=True, help="Directory to save the stitched layer images and the composite image.")

    args = parser.parse_args()

    # Call main function with parsed arguments
    errors = main(args.input_dir, args.background_file, args.output_dir)
    
    # Exit with non-zero code if errors occurred
    if errors > 0:
        sys.exit(1)
    else:
        sys.exit(0) 