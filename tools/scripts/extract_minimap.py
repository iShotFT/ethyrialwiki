import os
import struct

def extract_png(filepath, output_path):
    with open(filepath, 'rb') as f:
        # Read the entire file
        data = f.read()
        
        # Find the PNG marker
        png_start = data.find(b'\x89PNG')
        if png_start == -1:
            print(f"No PNG data found in {filepath}")
            return False
        
        # Extract the PNG data
        png_data = data[png_start:]
        
        # Write the PNG data to a file
        with open(output_path, 'wb') as out:
            out.write(png_data)
        
        print(f"Extracted PNG to {output_path}")
        return True

def main():
    # Get the directory containing the minimap files
    directory = os.path.join(os.path.dirname(__file__), 'minimap_data')
    
    # Create output directory
    output_dir = os.path.join(directory, 'extracted')
    os.makedirs(output_dir, exist_ok=True)
    
    # Process each minimap file
    files = [f for f in os.listdir(directory) if f.endswith('.minimap')]
    for file in files:
        input_path = os.path.join(directory, file)
        output_path = os.path.join(output_dir, f"{os.path.splitext(file)[0]}.png")
        extract_png(input_path, output_path)

if __name__ == '__main__':
    main() 