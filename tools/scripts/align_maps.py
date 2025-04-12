import os
from PIL import Image
import sys
import time
# Make sure matplotlib is installed: pip install matplotlib
try:
    import matplotlib.pyplot as plt
    import matplotlib.patches as patches
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False

def find_non_transparent_bounding_box(img):
    """Finds the bounding box of non-transparent pixels."""
    width, height = img.size
    min_x, min_y = width, height
    max_x, max_y = -1, -1

    # Check if image has alpha channel
    has_alpha = img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info)
    
    if not has_alpha:
        # If no alpha, the whole image is considered non-transparent
        print("Warning: Composite image has no alpha channel. Assuming full image is content.")
        return (0, 0, width, height)

    try:
        # Try getting alpha band directly for faster access if possible
        alpha = img.getchannel('A')
        pixels = list(alpha.getdata())
        found_non_transparent = False
        for y in range(height):
            for x in range(width):
                # Consider pixel non-transparent if alpha > 0
                if pixels[y * width + x] > 0: 
                    min_x = min(min_x, x)
                    min_y = min(min_y, y)
                    max_x = max(max_x, x)
                    max_y = max(max_y, y)
                    found_non_transparent = True
        
        if not found_non_transparent:
            return None # Fully transparent

    except ValueError:
        # Fallback to iterating pixels if getchannel('A') fails (e.g., for Palette mode)
        print("Warning: Could not get alpha channel directly, using slower pixel access.")
        pixels = img.load()
        found_non_transparent = False
        for y in range(height):
            for x in range(width):
                pixel_data = pixels[x, y]
                alpha_value = 255 # Default opaque
                if isinstance(pixel_data, tuple):
                    if len(pixel_data) == 4: # RGBA
                        alpha_value = pixel_data[3]
                    elif len(pixel_data) == 2: # LA
                        alpha_value = pixel_data[1]
                # Palette mode ('P') transparency needs checking info dict, but let's assume non-transparent if value exists
                
                # A simple threshold check
                if alpha_value > 0: 
                    min_x = min(min_x, x)
                    min_y = min(min_y, y)
                    max_x = max(max_x, x)
                    max_y = max(max_y, y)
                    found_non_transparent = True
        
        if not found_non_transparent:
            return None # Fully transparent

    if max_x < min_x or max_y < min_y:
        return None # Should not happen if found_non_transparent is True

    # Return x, y, width, height
    return (min_x, min_y, max_x - min_x + 1, max_y - min_y + 1)

def generate_expanding_search_coords(center_x, center_y, max_x, max_y):
    """
    Generates coordinates in an expanding square pattern around a center point,
    staying within the bounds [0, max_x) and [0, max_y).
    """
    yield (center_x, center_y) # Start with the exact center

    radius = 1
    while True:
        x_min = center_x - radius
        x_max = center_x + radius
        y_min = center_y - radius
        y_max = center_y + radius
        
        has_new_coords = False

        # Check coordinates on the perimeter of the square defined by radius
        
        # Top edge (left to right)
        if y_min >= 0:
            for x in range(max(0, x_min), min(max_x, x_max + 1)):
                yield (x, y_min)
                has_new_coords = True
                
        # Right edge (top+1 to bottom)
        if x_max < max_x:
            for y in range(max(0, y_min + 1), min(max_y, y_max + 1)):
                yield (x_max, y)
                has_new_coords = True
                
        # Bottom edge (right-1 to left)
        if y_max < max_y and x_max >= x_min: # Need x_max >= x_min check for radius 1 corner case
             for x in range(min(max_x -1, x_max -1), max(-1, x_min -1), -1): # Go right to left, excluding right corner if already yielded
                 # Ensure x is within bounds [0, max_x)
                 if 0 <= x < max_x:
                    yield (x, y_max)
                    has_new_coords = True
                    
        # Left edge (bottom-1 to top+1)
        if x_min >= 0 and y_max > y_min : # Need y_max > y_min check for radius 1 corner case
             for y in range(min(max_y - 1, y_max - 1), max(-1, y_min), -1): # Go bottom to top, excluding corners
                 # Ensure y is within bounds [0, max_y)
                 if 0 <= y < max_y:
                    yield (x_min, y)
                    has_new_coords = True

        # Stop condition: if the square completely envelops the search area
        if x_min < 0 and x_max >= max_x and y_min < 0 and y_max >= max_y:
             if not has_new_coords: # Ensure we yielded everything before breaking
                break 
            
        # If in a large radius we generate no valid coordinates (e.g., thin search area)
        if not has_new_coords and radius > max(max_x, max_y):
            print(f"Warning: Stopping search generator, radius {radius} yielded no new valid coordinates.")
            break # Avoid infinite loop if bounds are weird

        radius += 1

def find_best_match(terrain_img_path, composite_img_path, patch_size=(100, 100)):
    """Finds the best offset for composite_img on terrain_img using template matching with visualization."""
    global MATPLOTLIB_AVAILABLE # Use the global flag
    
    if not MATPLOTLIB_AVAILABLE:
        print("Error: Matplotlib is required for visualization.")
        print("Please install it: pip install matplotlib")
        # Optionally, could fall back to non-visual version here
        return None
        
    try:
        print(f"Loading terrain image: {terrain_img_path}")
        terrain_img = Image.open(terrain_img_path).convert('RGBA')
        print(f"Loading composite image: {composite_img_path}")
        composite_img = Image.open(composite_img_path).convert('RGBA')
    except FileNotFoundError as e:
        print(f"Error loading image: {e}")
        return None
    except Exception as e:
        print(f"An error occurred opening images or during setup: {e}")
        return None

    terrain_w, terrain_h = terrain_img.size
    composite_w, composite_h = composite_img.size
    print(f"Terrain dimensions: {terrain_w}x{terrain_h}")
    print(f"Composite dimensions: {composite_w}x{composite_h}")

    print("Finding non-transparent bounding box in composite image...")
    bbox = find_non_transparent_bounding_box(composite_img)
    if bbox is None:
        print("Error: Composite image is fully transparent or bounding box could not be determined.")
        return None
    bb_x, bb_y, bb_w, bb_h = bbox
    print(f"Non-transparent BBox: x={bb_x}, y={bb_y}, w={bb_w}, h={bb_h}")

    if bb_w < patch_size[0] or bb_h < patch_size[1]:
        print(f"Warning: Non-transparent area ({bb_w}x{bb_h}) is smaller than patch size ({patch_size[0]}x{patch_size[1]}). Adjusting patch size.")
        patch_size = (min(patch_size[0], bb_w), min(patch_size[1], bb_h))
        if patch_size[0] <= 0 or patch_size[1] <= 0:
             print("Error: Non-transparent area is too small for matching.")
             return None
        print(f"Adjusted patch size to: {patch_size}")

    # Select patch from the center of the non-transparent bounding box
    patch_x_in_composite = bb_x + (bb_w - patch_size[0]) // 2
    patch_y_in_composite = bb_y + (bb_h - patch_size[1]) // 2
    patch = composite_img.crop((
        patch_x_in_composite, patch_y_in_composite,
        patch_x_in_composite + patch_size[0], patch_y_in_composite + patch_size[1]
    ))
    patch_w, patch_h = patch.size
    print(f"Selected patch of size {patch_w}x{patch_h} from composite at ({patch_x_in_composite}, {patch_y_in_composite})")

    # Efficiently load pixel data
    try:
        patch_pixels = patch.load()
        terrain_pixels = terrain_img.load()
    except Exception as e:
        print(f"Error accessing pixel data: {e}")
        return None


    # Create a mask of non-transparent pixels within the patch (relative coordinates)
    patch_mask = []
    for py in range(patch_h):
        for px in range(patch_w):
            try:
                if patch_pixels[px, py][3] > 0:  # Check alpha channel > 0
                    patch_mask.append((px, py))
            except IndexError:
                 print(f"Warning: Index error accessing patch pixel at ({px},{py}). Skipping.")
                 continue


    if not patch_mask:
        print("Error: Selected patch is fully transparent (or failed to read pixels).")
        return None
    print(f"Using {len(patch_mask)} non-transparent pixels from patch for matching.")


    min_ssd = float('inf')
    best_terrain_offset = None # Top-left corner of the patch match in terrain
    new_best_found_since_last_plot = False # Flag to track if we need to update plot
    
    # --- Visualization Setup --- 
    fig, ax = plt.subplots(1, 1, figsize=(10, 8)) # Adjust figsize as needed
    ax.imshow(terrain_img)
    ax.set_title("Searching for patch in terrain...")
    current_best_rect = None # Store the rectangle object

    # Show the patch in a separate window
    fig_patch, ax_patch = plt.subplots(1, 1, figsize=(3, 3)) # Adjust figsize
    ax_patch.imshow(patch)
    ax_patch.set_title("Patch")
    ax_patch.set_xticks([])
    ax_patch.set_yticks([])
    fig_patch.tight_layout() # Adjust layout
    plt.show(block=False) # Show patch window without blocking
    
    # Bring the main figure to the front if possible (behavior might vary by backend)
    try:
        plt.ion() # Turn on interactive mode *after* creating plots
        fig.canvas.manager.window.raise_()
    except AttributeError:
        print("Warning: Could not raise plot window.")
        pass # Ignore if backend doesn't support this
        
    plt.pause(0.5) # Allow windows to draw initially
    # --- End Visualization Setup ---

    search_start_time = time.time()
    print(f"Starting expanding square search across terrain...")

    # Define the bounds for the top-left corner of the patch in the terrain
    search_area_w = terrain_w - patch_w + 1
    search_area_h = terrain_h - patch_h + 1
    
    # Start search roughly in the middle of the possible placement area
    center_x = search_area_w // 2
    center_y = search_area_h // 2
    print(f"Search center: ({center_x}, {center_y}) within search area [0..{search_area_w-1}, 0..{search_area_h-1}]")
    
    total_positions_possible = search_area_w * search_area_h
    processed_positions = 0
    last_print_time = search_start_time
    last_plot_update_time = search_start_time
    plot_update_interval = 10.0 # seconds - Update plot much less frequently
    
    search_coords_generator = generate_expanding_search_coords(center_x, center_y, search_area_w, search_area_h)

    for tx, ty in search_coords_generator:
        # Ensure generated coordinates are valid top-left positions for the patch
        if not (0 <= tx < search_area_w and 0 <= ty < search_area_h):
            continue
            
        current_ssd = 0
        try:
            # Compare only non-transparent pixels from the patch mask
            for px, py in patch_mask:
                # Access terrain pixels using the calculated absolute coordinates
                terr_pixel = terrain_pixels[tx + px, ty + py]
                pat_pixel = patch_pixels[px, py] # Access patch pixels with relative coords

                # Calculate squared difference for RGB channels
                dr = terr_pixel[0] - pat_pixel[0]
                dg = terr_pixel[1] - pat_pixel[1]
                db = terr_pixel[2] - pat_pixel[2]
                current_ssd += dr*dr + dg*dg + db*db
                
                # Optimization: if current_ssd already exceeds min_ssd, stop calculating for this position
                if current_ssd >= min_ssd: 
                     break # Stop calculating SSD for this (tx, ty)
                     
        except IndexError:
            current_ssd = float('inf') # Penalize this position heavily
            continue # Skip to next (tx, ty)

        
        # Check if this is a new best match
        if current_ssd < min_ssd:
            min_ssd = current_ssd
            best_terrain_offset = (tx, ty)
            new_best_found_since_last_plot = True # Flag that we have a new best
            # Log discovery, but don't plot immediately
            # print(f"  New best found at terrain offset ({tx}, {ty}) with SSD: {min_ssd:.2f}") 

            # If perfect match found (SSD=0), we can stop searching entirely
            if min_ssd == 0:
                print(f"  Perfect match (SSD=0) found at ({tx},{ty})!")
                break # Stop searching

        processed_positions += 1
        current_time = time.time()

        # --- Periodic Updates (Console and Plot) ---
        time_since_last_plot = current_time - last_plot_update_time
        
        # Update Plot ONLY if interval passed AND a new best was found (or it's the first update)
        if MATPLOTLIB_AVAILABLE and time_since_last_plot > plot_update_interval: 
            if new_best_found_since_last_plot or current_best_rect is None:
                print(f"  Updating plot. Best match so far: SSD={min_ssd:.2f} at {best_terrain_offset}")
                if current_best_rect:
                    current_best_rect.remove() # Remove previous best rectangle
                
                if best_terrain_offset: # Ensure we have a best offset before drawing
                    current_best_rect = patches.Rectangle(
                        best_terrain_offset, patch_w, patch_h, # Use the current best offset
                        linewidth=1, edgecolor='r', facecolor='none' 
                    )
                    ax.add_patch(current_best_rect)
                    ax.set_title(f"Best Match SSD: {min_ssd:.2f} at {best_terrain_offset}")
                else:
                    ax.set_title(f"Searching... (no match yet)")

                try:
                    fig.canvas.draw_idle() # Request redraw
                    plt.pause(0.01) # Tiny pause to allow plot update processing
                    last_plot_update_time = current_time
                    new_best_found_since_last_plot = False # Reset flag after plotting
                except Exception as e:
                     print(f"Warning: Error updating plot - {e}") # Catch errors if window closed etc.
                     MATPLOTLIB_AVAILABLE = False # Stop trying to plot
            else:
                # Interval passed but no better match found, just yield CPU briefly if needed
                 try:
                     plt.pause(0.001)
                 except Exception: # Handle window closed during pause
                     MATPLOTLIB_AVAILABLE = False

        # Print console progress periodically anyway
        if current_time - last_print_time > 5.0: # Print progress every 5 seconds
             elapsed = current_time - search_start_time
             percentage = (processed_positions / total_positions_possible) * 100 
             print(f"  Searched {processed_positions}/{total_positions_possible} positions (~{percentage:.2f}%) in {elapsed:.1f}s. Current best SSD: {min_ssd:.2f} at {best_terrain_offset}")
             last_print_time = current_time
             # Also yield CPU here to prevent GUI becoming totally unresponsive
             if MATPLOTLIB_AVAILABLE and time_since_last_plot <= plot_update_interval:
                 try:
                    plt.pause(0.001)
                 except Exception:
                    MATPLOTLIB_AVAILABLE = False

    # --- Search End --- 
    search_end_time = time.time()
    print(f"Search finished in {search_end_time - search_start_time:.2f} seconds after checking {processed_positions} positions.")
    
    if MATPLOTLIB_AVAILABLE:
        plt.ioff() # Turn off interactive mode
        # Ensure the final best match is plotted before showing block=True
        if best_terrain_offset and (new_best_found_since_last_plot or current_best_rect is None):
            print("Drawing final best match...")
            if current_best_rect:
                 current_best_rect.remove()
            current_best_rect = patches.Rectangle(
                    best_terrain_offset, patch_w, patch_h, 
                    linewidth=1, edgecolor='lime', facecolor='none' # Use lime green for final
                )
            ax.add_patch(current_best_rect)
            try:
                 fig.canvas.draw_idle()
            except Exception as e:
                 print(f"Warning: Could not draw final rectangle - {e}")
                 MATPLOTLIB_AVAILABLE = False

    if best_terrain_offset is None:
        print("Error: Could not find a match.")
        if MATPLOTLIB_AVAILABLE:
            ax.set_title("Search complete. No match found.")
            try:
                plt.show(block=True) # Keep window open to show final state
            except Exception as e:
                print(f"Warning: Could not display final plot - {e}")
        return None

    # Calculate the offset for the *full* composite image relative to the terrain image
    final_offset_x = best_terrain_offset[0] - patch_x_in_composite
    final_offset_y = best_terrain_offset[1] - patch_y_in_composite

    print("-" * 30)
    print(f"Best match found for patch at terrain coordinates: {best_terrain_offset}")
    print(f"Patch location within composite image: ({patch_x_in_composite}, {patch_y_in_composite})")
    print(f"Minimum Sum of Squared Differences (SSD): {min_ssd:.2f}")
    print(f"==> Calculated offset for composite.png on terrain.png: ({final_offset_x}, {final_offset_y}) <==")
    print("-" * 30)
    
    # Update final title and keep plot open
    if MATPLOTLIB_AVAILABLE:
        final_title = (f"""Final Best Match SSD: {min_ssd:.2f} at patch offset {best_terrain_offset}
Calculated Overall Offset: ({final_offset_x}, {final_offset_y})""")
        ax.set_title(final_title)
        try:
            fig.canvas.draw_idle() # Ensure title update is drawn
            print("Close the plot windows to exit.")
            plt.show(block=True) 
        except Exception as e:
             print(f"Warning: Could not display final plot - {e}")


    return (final_offset_x, final_offset_y)

if __name__ == '__main__':
    # --- Configuration ---
    script_dir = os.path.dirname(os.path.abspath(__file__)) # Use absolute path for reliability
    
    # Default paths (adjust if your structure is different)
    # Assumes script is in 'tools/scripts/', terrain is in root, composite is nested
    workspace_root = os.path.abspath(os.path.join(script_dir, '..', '..')) 
    default_terrain_path = os.path.join(workspace_root, 'terrain.png')
    default_composite_path = os.path.join(script_dir, 'minimap_data', 'extracted', 'stitched', 'composite.png')
    
    terrain_image_path = default_terrain_path
    composite_image_path = default_composite_path
    
    # Check if file paths were provided as command-line arguments
    if len(sys.argv) == 3:
        terrain_image_path = sys.argv[1]
        composite_image_path = sys.argv[2]
        print(f"Using command line arguments for paths:")
    elif len(sys.argv) != 1:
        print("\nUsage: python align_maps.py [<path_to_terrain.png> <path_to_composite.png>]")
        print("If no paths are provided, defaults will be used:")
        print(f"  Default Terrain: {default_terrain_path}")
        print(f"  Default Composite: {default_composite_path}\n")
        sys.exit(1)
    else:
        print(f"Using default paths:")
        print(f"(You can override by providing paths as command line arguments)")

    print(f"  Terrain: {terrain_image_path}")
    print(f"  Composite: {composite_image_path}")

    # --- Validate Paths ---
    valid_paths = True
    if not os.path.exists(terrain_image_path):
         print(f"\nError: Terrain image not found at '{terrain_image_path}'")
         valid_paths = False
    if not os.path.exists(composite_image_path):
         print(f"\nError: Composite image not found at '{composite_image_path}'")
         valid_paths = False

    # --- Run Matching ---
    if valid_paths:
        # You might want to adjust the patch size depending on image features
        # A larger patch might be more robust but slower.
        # A smaller patch is faster but might match in the wrong place if the pattern repeats.
        find_best_match(terrain_image_path, composite_image_path, patch_size=(100, 100))
    else:
        print("\nPlease correct the image paths and try again.") 