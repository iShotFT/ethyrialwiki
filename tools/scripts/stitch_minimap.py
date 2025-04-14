import os
from PIL import Image
import re

def parse_coordinates(filename):
    # Remove .png extension
    name = filename[:-4]
    
    # Use regex to parse coordinates, handling negative numbers
    match = re.match(r'(-?\d+)-(-?\d+)-(-?\d+)', name)
    if match:
        x = int(match.group(1))
        y = int(match.group(2))
        z = int(match.group(3))
        return x, y, z
    else:
        raise ValueError(f"Invalid filename format: {filename}")

def stitch_layer(directory, z_layer, background_image):
    # Find all PNG files for this layer
    files = [f for f in os.listdir(directory) if f.endswith('.png')]
    
    # Filter files for this layer
    layer_files = []
    for f in files:
        try:
            x, y, z = parse_coordinates(f)
            if z == z_layer:
                layer_files.append((x, y, f))
        except ValueError:
            continue
    
    if not layer_files:
        return None, None, None, None
    
    # Extract coordinates and find min/max
    coords = [(x, y) for x, y, _ in layer_files]
    min_x = min(x for x, y in coords)
    max_x = max(x for x, y in coords)
    min_y = min(y for x, y in coords)
    max_y = max(y for x, y in coords)
    
    # Read first image to get dimensions
    try:
        first_image_path = os.path.join(directory, layer_files[0][2])
        # Check if the file exists and is not empty
        if os.path.exists(first_image_path) and os.path.getsize(first_image_path) > 0:
            with Image.open(first_image_path) as first_image:
                 tile_width, tile_height = first_image.size
        else:
             print(f"Warning: Skipping empty or non-existent image {first_image_path}")
             return None, None, None, None # Handle case where first image is invalid
    except IndexError: # Handle case where layer_files is empty after filtering
         print(f"Warning: No valid files found for layer {z_layer} in {directory}")
         return None, None, None, None
    except Exception as e:
         print(f"Error opening first image {first_image_path}: {e}")
         return None, None, None, None # Handle image opening errors

    # Create output image (transparent)
    output_width = (max_x - min_x + 1) * tile_width
    output_height = (max_y - min_y + 1) * tile_height
    # Ensure output_image starts transparent to allow proper layering in composite
    output_image = Image.new('RGBA', (output_width, output_height), (0,0,0,0)) 

    # Place each tile
    for x, y, filename in layer_files:
        filepath = os.path.join(directory, filename)
        
        try:
             # Check if the file exists and is not empty
             if not os.path.exists(filepath) or os.path.getsize(filepath) == 0:
                 print(f"Warning: Skipping empty or non-existent tile {filepath}")
                 continue # Skip this tile

             tile = Image.open(filepath).convert('RGBA') # Ensure tile is RGBA

             # Calculate background coordinates
             # Assuming background is 6000x5000, max X=5, max Y=4
             # Background Y=0 is top, map Y=0 is bottom
             bg_x_start = x * tile_width
             bg_y_start = (4 - y) * tile_height # Invert Y for background
             bg_x_end = bg_x_start + tile_width
             bg_y_end = bg_y_start + tile_height

             # Crop the background chunk
             background_chunk = background_image.crop((bg_x_start, bg_y_start, bg_x_end, bg_y_end))
             background_chunk = background_chunk.convert('RGBA') # Ensure background is RGBA

             # Grayscale background if Z < 1
             if z_layer < 1:
                 background_chunk = background_chunk.convert('L').convert('RGBA')

             # Paste tile onto the background chunk using tile's alpha
             background_chunk.paste(tile, (0, 0), tile)

             # Calculate position on the output layer image
             pos_x = (x - min_x) * tile_width
             pos_y = (max_y - y) * tile_height # Inverted Y for image placement

             # Paste the combined chunk onto the output image
             # Don't use alpha mask here, background_chunk is the full base now
             output_image.paste(background_chunk, (pos_x, pos_y))

        except Exception as e:
             print(f"Error processing tile {filepath}: {e}")
             continue # Skip this tile if there's an error

    return output_image, min_x, min_y, max_y

def create_composite(directory, z_layers, background_image):
    # First, find the overall bounds of all layers
    all_files = [f for f in os.listdir(directory) if f.endswith('.png')]
    all_coords = []
    for f in all_files:
        try:
            x, y, _ = parse_coordinates(f)
            all_coords.append((x, y))
        except ValueError:
            continue
    
    if not all_coords:
        return None
    
    global_min_x = min(x for x, y in all_coords)
    global_max_x = max(x for x, y in all_coords)
    global_min_y = min(y for x, y in all_coords)
    global_max_y = max(y for x, y in all_coords)
    
    # Get tile dimensions from first image
    try:
        first_image_path = os.path.join(directory, all_files[0])
        if os.path.exists(first_image_path) and os.path.getsize(first_image_path) > 0:
             with Image.open(first_image_path) as first_image:
                 tile_width, tile_height = first_image.size
        else:
             print(f"Warning: First image for dimension check is invalid: {first_image_path}")
             return None # Cannot determine dimensions
    except IndexError: # Handle case where all_files is empty
        print(f"Warning: No PNG files found in {directory} to determine dimensions.")
        return None
    except Exception as e:
        print(f"Error opening image {first_image_path} for dimensions: {e}")
        return None

    # Create composite image with dimensions to fit all layers (transparent)
    composite_width = (global_max_x - global_min_x + 1) * tile_width
    composite_height = (global_max_y - global_min_y + 1) * tile_height
    # Start composite as transparent
    composite = Image.new('RGBA', (composite_width, composite_height), (0,0,0,0)) 

    # Stack layers from bottom to top
    for z in sorted(z_layers):
        # Pass background_image to stitch_layer
        layer_image, min_x, min_y, max_y = stitch_layer(directory, z, background_image) 
        if layer_image:
            # Calculate offset to align with global coordinates
            x_offset = (min_x - global_min_x) * tile_width
            y_offset = (global_max_y - max_y) * tile_height
            
            # Paste this layer onto composite using the layer's alpha channel as a mask
            # This allows transparent parts of upper layers to show lower layers
            composite.paste(layer_image, (x_offset, y_offset), layer_image)

    # Final step: Apply the full background to the composite 
    # Crop the relevant section of the main background
    bg_comp_x_start = global_min_x * tile_width
    bg_comp_y_start = (4 - global_max_y) * tile_height
    bg_comp_x_end = (global_max_x + 1) * tile_width
    bg_comp_y_end = (4 - global_min_y + 1) * tile_height
    
    composite_background_section = background_image.crop((bg_comp_x_start, bg_comp_y_start, bg_comp_x_end, bg_comp_y_end))
    composite_background_section = composite_background_section.resize(composite.size)
    composite_background_section = composite_background_section.convert('RGBA')

    # Paste the generated composite map content over the appropriate background section
    final_composite = Image.new('RGBA', composite.size)
    final_composite.paste(composite_background_section, (0,0))
    final_composite.paste(composite, (0,0), composite) # Use composite alpha as mask

    return final_composite # Return the composite with the base background applied

def main():
    script_dir = os.path.dirname(__file__)
    # Get the directory containing the extracted PNG files
    directory = os.path.join(script_dir, 'minimap_data', 'extracted')
    
    # Define background image path (assuming it's in the same dir as the script)
    background_path = os.path.join(script_dir, 'background.png')

    # Load background image
    try:
        background_image = Image.open(background_path)
        # Optional: Check dimensions if needed
        expected_width, expected_height = 6000, 5000
        if background_image.size != (expected_width, expected_height):
            print(f"Warning: Background image size is {background_image.size}, expected {expected_width}x{expected_height}")
    except FileNotFoundError:
        print(f"Error: Background image not found at {background_path}")
        return
    except Exception as e:
        print(f"Error loading background image: {e}")
        return

    # Create output directory
    output_dir = os.path.join(directory, 'stitched')
    os.makedirs(output_dir, exist_ok=True)
    
    # Find all unique z-layers
    z_layers = set()
    for f in os.listdir(directory):
        if f.endswith('.png'):
            try:
                _, _, z = parse_coordinates(f)
                z_layers.add(z)
            except ValueError as e:
                print(f"Warning: Skipping file {f} - {e}")
    
    # Create composite of all layers, passing background image
    print("Creating composite of all layers...")
    composite = create_composite(directory, z_layers, background_image) # Pass background
    if composite:
        composite_path = os.path.join(output_dir, 'composite.png')
        composite.save(composite_path)
        print(f"Saved composite to {composite_path}")
    
    # Stitch each layer, passing background image
    for z in sorted(z_layers):
        print(f'Processing layer {z}...')
        # Pass background_image to stitch_layer
        stitched, _, _, _ = stitch_layer(directory, z, background_image) # Pass background
        if stitched:
            output_path = os.path.join(output_dir, f'layer_{z}.png')
            stitched.save(output_path)
            print(f'Saved layer {z} to {output_path}')

if __name__ == '__main__':
    main() 