import os
import sys
import time
import random
from PIL import Image
try:
    import matplotlib.pyplot as plt
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False

def calculate_match_percentage(terrain_img, composite_img, terrain_pixels, composite_pixels, 
                               offset_tx, offset_ty, pre_sampled_points, alpha_threshold=10):
    """Calculates the percentage of exactly matching RGB pixels for a given offset, 
       considering only opaque pixels in the composite and valid overlaps.
    """
    terrain_w, terrain_h = terrain_img.size
    # composite_w, composite_h = composite_img.size # Not needed here
    
    match_count = 0
    valid_samples_in_overlap = 0

    for cx, cy in pre_sampled_points:
        # 1. Check transparency in composite using pre-loaded pixel data
        try:
            comp_pixel = composite_pixels[cx, cy]
            # Assume RGBA format
            if comp_pixel[3] <= alpha_threshold:
                continue # Skip transparent composite pixels
        except IndexError:
             # This should not happen if pre-sampled points are within composite bounds
             print(f"Warning: Pre-sampled point ({cx},{cy}) out of composite bounds.")
             continue 

        # 2. Calculate corresponding terrain coordinates
        terrain_x = offset_tx + cx
        terrain_y = offset_ty + cy

        # 3. Check if terrain coordinates are within terrain bounds
        if 0 <= terrain_x < terrain_w and 0 <= terrain_y < terrain_h:
            # This sample point corresponds to a valid overlapping pixel
            valid_samples_in_overlap += 1
            try:
                # 4. Get terrain pixel and compare RGB values
                terr_pixel = terrain_pixels[terrain_x, terrain_y]
                
                # Exact RGB match check
                if comp_pixel[0] == terr_pixel[0] and \
                   comp_pixel[1] == terr_pixel[1] and \
                   comp_pixel[2] == terr_pixel[2]:
                    match_count += 1
            except IndexError:
                 # Should not happen because of the bounds check above, but safety first
                 pass 
                 
    # Calculate percentage based on valid overlapping samples
    if valid_samples_in_overlap == 0:
        return 0.0 # Avoid division by zero if no valid opaque samples overlap

    return (match_count / valid_samples_in_overlap) * 100.0

def visualize_best_match(terrain_img, composite_img, initial_offset):
    """Displays the terrain with the composite overlayed at the best offset found.
       Allows toggling visibility ('t'), adjusting alpha (scroll), and dragging.
    """
    global MATPLOTLIB_AVAILABLE
    if not MATPLOTLIB_AVAILABLE:
        print("Matplotlib not available, skipping visualization.")
        return

    current_offset = list(initial_offset) # Use a mutable list for current offset
    composite_w, composite_h = composite_img.size
    terrain_w, terrain_h = terrain_img.size 

    fig, ax = plt.subplots(figsize=(12, 9))
    
    # --- State for Interaction --- 
    interaction_state = {
        'composite_visible': True,
        'current_alpha': 1.0, 
        'is_dragging': False,
        'drag_start_pos': None, # (event.xdata, event.ydata)
        'drag_start_offset': None # (tx, ty)
    }
    # --- End State --- 

    def update_title():
        vis_text = "Visible" if interaction_state['composite_visible'] else "Hidden"
        alpha_val = interaction_state['current_alpha'] if interaction_state['composite_visible'] else "N/A"
        title = (f"Offset: ({current_offset[0]:.1f}, {current_offset[1]:.1f}) | "
                 f"Alpha: {alpha_val:.2f} (Scroll) | "
                 f"Toggle: '{vis_text}' (t) | Drag: Click & Drag Overlay")
        ax.set_title(title, fontsize=10)

    update_title() # Initial title set
    
    # Display terrain image
    ax.imshow(terrain_img, extent=[0, terrain_w, terrain_h, 0]) 
    
    # Display composite image overlayed using extent
    composite_extent = [current_offset[0], current_offset[0] + composite_w, 
                        current_offset[1] + composite_h, current_offset[1]]
    composite_layer = ax.imshow(composite_img, extent=composite_extent, 
                                alpha=interaction_state['current_alpha'])

    # --- Event Handlers --- 
    def on_key(event):
        if event.inaxes != ax: return
        if event.key == 't':
            interaction_state['composite_visible'] = not interaction_state['composite_visible']
            composite_layer.set_visible(interaction_state['composite_visible'])
            update_title()
            print(f"Overlay toggled: {'Visible' if interaction_state['composite_visible'] else 'Hidden'}")
            try: fig.canvas.draw_idle() 
            except Exception as e: print(f"Warning: Error redrawing plot - {e}")

    def on_scroll(event):
        if event.inaxes != ax: return
        if not interaction_state['composite_visible']: return # Don't change alpha if hidden
            
        current_alpha = interaction_state['current_alpha']
        # Adjust alpha: scroll up increases, down decreases
        new_alpha = current_alpha + event.step * 0.1 # Adjust step size as needed
        new_alpha = max(0.0, min(1.0, new_alpha)) # Clamp between 0 and 1

        if new_alpha != current_alpha:
            interaction_state['current_alpha'] = new_alpha
            composite_layer.set_alpha(new_alpha)
            update_title()
            try: fig.canvas.draw_idle() 
            except Exception as e: print(f"Warning: Error redrawing plot - {e}")
            
    def on_press(event):
        if event.inaxes != ax: return
        if not interaction_state['composite_visible']: return # Can't drag if hidden
        
        # Check if click is within the current composite bounds
        tx, ty = current_offset
        extent = composite_layer.get_extent() # [left, right, bottom, top]
        contains, _ = composite_layer.contains(event)
        
        # Use extent check as primary, contains might be less reliable with alpha
        in_bounds = (extent[0] <= event.xdata <= extent[1] and 
                     extent[3] <= event.ydata <= extent[2]) # y-axis is flipped in extent

        if event.button == 1 and in_bounds: # Left click inside composite
            interaction_state['is_dragging'] = True
            interaction_state['drag_start_pos'] = (event.xdata, event.ydata)
            interaction_state['drag_start_offset'] = tuple(current_offset) # Store offset at drag start
            # print("Drag Start") # Debug
            
    def on_motion(event):
        if not interaction_state['is_dragging']: return
        if event.inaxes != ax: return
        if event.xdata is None or event.ydata is None: return # Ignore if outside axes

        start_x, start_y = interaction_state['drag_start_pos']
        start_tx, start_ty = interaction_state['drag_start_offset']
        
        # Calculate delta movement in data coordinates
        dx = event.xdata - start_x
        dy = event.ydata - start_y
        
        # Update current offset
        current_offset[0] = start_tx + dx
        current_offset[1] = start_ty + dy
        
        # Update the extent of the composite layer
        new_extent = [current_offset[0], current_offset[0] + composite_w, 
                      current_offset[1] + composite_h, current_offset[1]]
        composite_layer.set_extent(new_extent)
        update_title()
        try: fig.canvas.draw_idle() 
        except Exception as e: print(f"Warning: Error redrawing plot - {e}")

    def on_release(event):
        if event.button == 1 and interaction_state['is_dragging']:
            interaction_state['is_dragging'] = False
            interaction_state['drag_start_pos'] = None
            interaction_state['drag_start_offset'] = None
            print(f"Drag End. Final Offset: ({current_offset[0]:.1f}, {current_offset[1]:.1f})")
            
    # --- Connect Events --- 
    fig.canvas.mpl_connect('key_press_event', on_key)
    fig.canvas.mpl_connect('scroll_event', on_scroll)
    fig.canvas.mpl_connect('button_press_event', on_press)
    fig.canvas.mpl_connect('button_release_event', on_release)
    fig.canvas.mpl_connect('motion_notify_event', on_motion)

    # --- Adjust Plot Limits and Show --- 
    view_min_x = min(0, current_offset[0])
    view_max_x = max(terrain_w, current_offset[0] + composite_w)
    view_min_y = min(0, current_offset[1])
    view_max_y = max(terrain_h, current_offset[1] + composite_h)
    ax.set_xlim(view_min_x, view_max_x)
    ax.set_ylim(view_max_y, view_min_y) 

    print("\nDisplaying interactive visualization.")
    print(" - Drag overlay with mouse to reposition.")
    print(" - Scroll wheel over plot to change overlay alpha.")
    print(" - Press 't' IN THE PLOT WINDOW to toggle overlay visibility.")
    print(" - Close the plot window to exit the script.")
    
    try:
        plt.show() 
    except Exception as e:
        print(f"Error displaying plot: {e}")

def align_images_sampled(terrain_img_path, composite_img_path, num_samples=1000, top_n=10):
    """Aligns images by sampling points and finding the offset with the highest exact match percentage."""
    # Load images first, return None if they fail to load
    terrain_img, composite_img = None, None
    try:
        print(f"Loading terrain image: {terrain_img_path}")
        terrain_img = Image.open(terrain_img_path).convert('RGBA')
        print(f"Loading composite image: {composite_img_path}")
        composite_img = Image.open(composite_img_path).convert('RGBA')
    except FileNotFoundError as e:
        print(f"Error loading image: {e}")
        return None, None, None # Return None for images and offset
    except Exception as e:
        print(f"An error occurred opening images: {e}")
        return None, None, None

    # If images loaded, proceed
    terrain_w, terrain_h = terrain_img.size
    composite_w, composite_h = composite_img.size
    print(f"Terrain dimensions: {terrain_w}x{terrain_h}")
    print(f"Composite dimensions: {composite_w}x{composite_h}")
    
    # Get pixel accessors
    try:
        terrain_pixels = terrain_img.load()
        composite_pixels = composite_img.load()
    except Exception as e:
        print(f"Error accessing pixel data: {e}")
        # Return loaded images, but None for offset as we can't proceed
        return terrain_img, composite_img, None 

    # --- Pre-sample points --- 
    print(f"Pre-sampling {num_samples} points from composite image ({composite_w}x{composite_h})...")
    pre_sampled_points = []
    for _ in range(num_samples):
        cx = random.randint(0, composite_w - 1)
        cy = random.randint(0, composite_h - 1)
        pre_sampled_points.append((cx, cy))
    print(f"Using {len(pre_sampled_points)} pre-sampled points.")
    
    # --- Define Offset Ranges --- 
    min_tx = 0
    max_tx = terrain_w - composite_w 
    min_ty = 0
    max_ty = 100 

    # Validate horizontal range
    if max_tx < min_tx:
        print(f"Error: Composite width ({composite_w}) is greater than Terrain width ({terrain_w}).")
        print(f"Calculated tx range [{min_tx}, {max_tx}] is invalid.")
        # Return images, but None for offset
        return terrain_img, composite_img, None 

    print(f"Iterating through offsets: tx from {min_tx} to {max_tx}, ty from {min_ty} to {max_ty}")
    
    results = []
    total_offsets = (max_tx - min_tx + 1) * (max_ty - min_ty + 1)
    print(f"Total offsets to check: {total_offsets}")
    processed_offsets = 0
    start_time = time.time()
    last_print_time = start_time

    # --- Iterate through offsets --- 
    for ty in range(min_ty, max_ty + 1):
        for tx in range(min_tx, max_tx + 1):
            percentage = calculate_match_percentage(
                terrain_img, composite_img, terrain_pixels, composite_pixels,
                tx, ty, pre_sampled_points
            )
            if percentage > 0: 
                results.append(((tx, ty), percentage))
            
            processed_offsets += 1
            # --- Progress Reporting --- 
            current_time = time.time()
            if current_time - last_print_time > 5.0: # Print every 5 seconds
                 elapsed = current_time - start_time
                 rate = processed_offsets / elapsed if elapsed > 0 else 0
                 percentage_done = (processed_offsets / total_offsets) * 100 if total_offsets > 0 else 0
                 # Added space at end to clear previous line fully
                 print(f"  Processed {processed_offsets}/{total_offsets} offsets ({percentage_done:.2f}%) in {elapsed:.1f}s ({rate:.1f} offsets/sec). Last: ({tx},{ty}), Match: {percentage:.2f}%   ", end='\r')
                 last_print_time = current_time
    
    print("\nFinished processing all offsets.                                ") # Clear progress line
    total_time = time.time() - start_time
    print(f"Total processing time: {total_time:.2f} seconds.")

    # --- Sort and Print Results --- 
    if not results:
        print("\nNo matching offsets found (all calculated percentages were 0%).")
        return terrain_img, composite_img, None # Return images, None offset
        
    print(f"\nSorting {len(results)} results with non-zero match percentage...")
    results.sort(key=lambda item: item[1], reverse=True)

    print(f"\nTop {min(top_n, len(results))} matches found:")
    for i, ((tx, ty), percentage) in enumerate(results[:top_n]):
        print(f"  {i+1}. Offset: (tx={tx:4d}, ty={ty:4d}) - Match Percentage: {percentage:.4f}%")
        
    # Get the best offset for visualization
    best_offset = results[0][0]
    
    # Return images and the best offset found
    return terrain_img, composite_img, best_offset

# --- Main execution block --- 
if __name__ == '__main__':
    # --- Configuration & Argument Parsing --- 
    script_dir = os.path.dirname(os.path.abspath(__file__)) 
    workspace_root = os.path.abspath(os.path.join(script_dir, '..', '..')) 
    default_terrain_path = os.path.join(workspace_root, 'terrain.png')
    default_composite_path = os.path.join(script_dir, 'minimap_data', 'extracted', 'stitched', 'composite.png')
    
    terrain_image_path = default_terrain_path
    composite_image_path = default_composite_path
    num_samples_arg = 1000 # Default number of samples
    top_n_arg = 10 # Default number of top results to show

    # Basic argument parsing (can be expanded with argparse)
    args = sys.argv[1:]
    if len(args) >= 2 and not args[0].startswith('-'):
        terrain_image_path = args[0]
        composite_image_path = args[1]
        print(f"Using command line arguments for paths:")
        args = args[2:] # Consume path args
    else:
         print(f"Using default paths:")
    
    print(f"  Terrain: {terrain_image_path}")
    print(f"  Composite: {composite_image_path}")

    # Example for parsing optional args like --samples N or --top N
    i = 0
    while i < len(args):
        if args[i] == '--samples' and i + 1 < len(args):
            try:
                num_samples_arg = int(args[i+1])
                print(f"  Using custom number of samples: {num_samples_arg}")
                i += 2
            except ValueError:
                print(f"Warning: Invalid value for --samples '{args[i+1]}'. Using default {num_samples_arg}.")
                i += 1
        elif args[i] == '--top' and i + 1 < len(args):
             try:
                top_n_arg = int(args[i+1])
                print(f"  Showing top {top_n_arg} results.")
                i += 2
             except ValueError:
                print(f"Warning: Invalid value for --top '{args[i+1]}'. Using default {top_n_arg}.")
                i += 1
        else:
            print(f"Warning: Unknown argument '{args[i]}'")
            i += 1
            
    if len(args) > 0 and args[0] in ('-h', '--help'):
         print("\nUsage: python align_maps_sampled.py [<terrain_path> <composite_path>] [--samples N] [--top N]")
         print("  Calculates alignment based on random pixel sampling and exact match percentage.")
         print("  Options:")
         print("    --samples N : Number of points to sample from the composite image (default: 1000).")
         print("    --top N     : Number of best matching offsets to display (default: 10).")
         sys.exit(0)

    # --- Validate Paths --- 
    valid_paths = True
    if not os.path.exists(terrain_image_path):
         print(f"\nError: Terrain image not found at '{terrain_image_path}'")
         valid_paths = False
    if not os.path.exists(composite_image_path):
         print(f"\nError: Composite image not found at '{composite_image_path}'")
         valid_paths = False

    # --- Run Alignment --- 
    if valid_paths:
        # align_images_sampled now returns images and best offset
        terrain_img, composite_img, best_offset_found = align_images_sampled(
            terrain_image_path, composite_image_path, 
            num_samples=num_samples_arg, top_n=top_n_arg
        )
        
        # --- Visualize Result --- 
        # Check if alignment ran successfully and found a result
        if best_offset_found is not None and terrain_img is not None and composite_img is not None:
             visualize_best_match(terrain_img, composite_img, best_offset_found)
        elif terrain_img is None or composite_img is None:
             print("\nSkipping visualization due to image loading errors.")
        elif best_offset_found is None: # Explicitly check for None offset
             print("\nSkipping visualization as no suitable match was found or an error occurred during alignment.")
             
    else:
        print("\nPlease correct the image paths and try again.") 