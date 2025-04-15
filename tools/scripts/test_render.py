import numpy as np
import trimesh
import pyrender
import matplotlib.pyplot as plt

# Create a simple mesh
sphere = trimesh.creation.icosphere()
mesh = pyrender.Mesh.from_trimesh(sphere)

# Create a scene and add the mesh
scene = pyrender.Scene()
scene.add(mesh)

# Add a camera
camera = pyrender.PerspectiveCamera(yfov=np.pi / 3.0)
scene.add(camera, pose=np.array([
    [1.0, 0.0, 0.0, 0.0],
    [0.0, 1.0, 0.0, 0.0],
    [0.0, 0.0, 1.0, 2.5],
    [0.0, 0.0, 0.0, 1.0]
]))

# Add light
light = pyrender.DirectionalLight(color=np.ones(3), intensity=1.0)
scene.add(light)

# Render
r = pyrender.OffscreenRenderer(400, 400)
color, depth = r.render(scene)
r.delete()

# Display the result
plt.figure(figsize=(8, 8))
plt.imshow(color)
plt.savefig('test_render.png')
print("Test complete. Check test_render.png")