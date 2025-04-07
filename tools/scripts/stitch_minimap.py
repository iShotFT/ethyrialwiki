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

def stitch_layer(directory, z_layer):
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
    first_image = Image.open(os.path.join(directory, layer_files[0][2]))
    tile_width, tile_height = first_image.size
    
    # Create output image
    output_width = (max_x - min_x + 1) * tile_width
    output_height = (max_y - min_y + 1) * tile_height
    output_image = Image.new('RGBA', (output_width, output_height))
    
    # Place each tile
    for x, y, filename in layer_files:
        filepath = os.path.join(directory, filename)
        tile = Image.open(filepath)
        pos_x = (x - min_x) * tile_width
        # Invert Y coordinate for image placement
        pos_y = (max_y - y) * tile_height  # Changed from (y - min_y) to (max_y - y)
        output_image.paste(tile, (pos_x, pos_y))
    
    return output_image, min_x, min_y, max_y

def create_composite(directory, z_layers):
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
    first_image = Image.open(os.path.join(directory, all_files[0]))
    tile_width, tile_height = first_image.size
    
    # Create composite image with dimensions to fit all layers
    composite_width = (global_max_x - global_min_x + 1) * tile_width
    composite_height = (global_max_y - global_min_y + 1) * tile_height
    composite = Image.new('RGBA', (composite_width, composite_height))
    
    # Stack layers from bottom to top
    for z in sorted(z_layers):
        layer_image, min_x, min_y, max_y = stitch_layer(directory, z)
        if layer_image:
            # Calculate offset to align with global coordinates
            x_offset = (min_x - global_min_x) * tile_width
            y_offset = (global_max_y - max_y) * tile_height
            
            # Paste this layer onto composite
            composite.paste(layer_image, (x_offset, y_offset), layer_image)
    
    return composite

def main():
    # Get the directory containing the extracted PNG files
    directory = os.path.join(os.path.dirname(__file__), 'minimap_data', 'extracted')
    
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
    
    # Create composite of all layers
    print("Creating composite of all layers...")
    composite = create_composite(directory, z_layers)
    if composite:
        composite_path = os.path.join(output_dir, 'composite.png')
        composite.save(composite_path)
        print(f"Saved composite to {composite_path}")
    
    # Stitch each layer
    for z in sorted(z_layers):
        print(f'Processing layer {z}...')
        stitched, _, _, _ = stitch_layer(directory, z)
        if stitched:
            output_path = os.path.join(output_dir, f'layer_{z}.png')
            stitched.save(output_path)
            print(f'Saved layer {z} to {output_path}')

if __name__ == '__main__':
    main() 