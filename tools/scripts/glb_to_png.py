import bpy
import sys
import os
from mathutils import Vector

os.environ["PYOPENGL_PLATFORM"] = "egl"  # Use EGL for better NVIDIA support
os.environ["CUDA_VISIBLE_DEVICES"] = "0"  # Use first NVIDIA GPU

def clear_scene():
    """Clear all objects from the scene"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

def setup_scene(cam_distance=5.0):
    """Set up the scene with lighting and camera"""
    # Add lighting (sun lamp)
    bpy.ops.object.light_add(type='SUN', location=(0, 0, 5))
    sun = bpy.context.active_object
    sun.data.energy = 2.0
    
    # Add camera
    bpy.ops.object.camera_add(location=(0, -cam_distance, 0))
    camera = bpy.context.active_object
    camera.rotation_euler = (1.5708, 0, 0)  # Point at the center (90 degrees in radians)
    bpy.context.scene.camera = camera
    
    # Set world background to white
    bpy.context.scene.world.color = (1, 1, 1)
    
    return camera

def import_glb(glb_path):
    """Import a GLB file"""
    bpy.ops.import_scene.gltf(filepath=glb_path)
    
    # Get all imported objects
    imported_objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    return imported_objects

def auto_frame_objects(camera, objects, padding=1.1):
    """Adjust camera to frame all objects"""
    if not objects:
        return
    
    # Calculate bounds of all objects
    min_co = Vector((float('inf'), float('inf'), float('inf')))
    max_co = Vector((float('-inf'), float('-inf'), float('-inf')))
    
    for obj in objects:
        # Get object's world matrix
        matrix_world = obj.matrix_world
        
        # Get object's bounding box in world space
        for v in obj.bound_box:
            world_v = matrix_world @ Vector(v)
            min_co.x = min(min_co.x, world_v.x)
            min_co.y = min(min_co.y, world_v.y)
            min_co.z = min(min_co.z, world_v.z)
            max_co.x = max(max_co.x, world_v.x)
            max_co.y = max(max_co.y, world_v.y)
            max_co.z = max(max_co.z, world_v.z)
    
    # Calculate center and dimensions of the bounding box
    center = (min_co + max_co) / 2
    dimensions = max_co - min_co
    
    # Position the camera to look at the center
    camera.location = (0, -max(dimensions) * padding, center.z)
    camera.rotation_euler = (1.5708, 0, 0)
    
    # Make sure the camera is far enough to see the entire object
    # This is a simplified approach - might need adjustments for different models
    camera_distance = max(dimensions) * padding
    camera.location.y = -camera_distance

def render_to_png(output_path, resolution_x=1920, resolution_y=1080):
    """Render the scene to a PNG file"""
    # Set render settings
    bpy.context.scene.render.resolution_x = resolution_x
    bpy.context.scene.render.resolution_y = resolution_y
    bpy.context.scene.render.resolution_percentage = 100
    bpy.context.scene.render.film_transparent = True  # Transparent background
    bpy.context.scene.render.image_settings.file_format = 'PNG'
    
    # Set output path
    bpy.context.scene.render.filepath = output_path
    
    # Render
    bpy.ops.render.render(write_still=True)

def glb_to_png(glb_path, output_path, resolution_x=1920, resolution_y=1080):
    """Convert a GLB file to a PNG screenshot"""
    # Clear any existing scene
    clear_scene()
    
    # Setup scene with camera and lighting
    camera = setup_scene()
    
    # Import GLB file
    imported_objects = import_glb(glb_path)
    
    # Frame the objects in the camera view
    auto_frame_objects(camera, imported_objects)
    
    # Render to PNG
    render_to_png(output_path, resolution_x, resolution_y)
    
    print(f"Rendered {glb_path} to {output_path}")

def batch_convert(input_dir, output_dir, resolution_x=1920, resolution_y=1080):
    """Convert all GLB files in a directory to PNG screenshots"""
    os.makedirs(output_dir, exist_ok=True)
    
    for filename in os.listdir(input_dir):
        if filename.lower().endswith('.glb'):
            glb_path = os.path.join(input_dir, filename)
            output_path = os.path.join(output_dir, os.path.splitext(filename)[0] + '.png')
            glb_to_png(glb_path, output_path, resolution_x, resolution_y)

if __name__ == "__main__":
    # Check if running as a script with arguments
    if len(sys.argv) > 4 and sys.argv[-2] == "--":
        # Running from command line with arguments passed after "--"
        input_path = sys.argv[-1]
        
        if os.path.isdir(input_path):
            # Batch convert all GLB files in the directory
            output_dir = input_path + "_png"
            batch_convert(input_path, output_dir)
        else:
            # Convert single GLB file
            output_path = os.path.splitext(input_path)[0] + '.png'
            glb_to_png(input_path, output_path)
    else:
        # Example usage if run directly
        print("No input provided. Example usage:")
        print("1. Single file: blender --background --python script.py -- /path/to/model.glb")
        print("2. Directory: blender --background --python script.py -- /path/to/glb_directory")

# To run this script from the command line:
# blender --background --python glb_to_png.py -- /path/to/your/model.glb
# OR
# blender --background --python glb_to_png.py -- /path/to/directory/with/glbs