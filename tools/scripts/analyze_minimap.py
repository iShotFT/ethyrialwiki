import os
import struct

def analyze_file(filepath):
    print(f"Analyzing file: {filepath}")
    print("-" * 50)
    
    with open(filepath, 'rb') as f:
        # Read and print first 128 bytes in hex
        first_bytes = f.read(128)
        print("First 128 bytes (hex):")
        for i in range(0, len(first_bytes), 16):
            chunk = first_bytes[i:i+16]
            print(" ".join(f"{b:02x}" for b in chunk))
        print()
        
        # Print first 128 bytes as ASCII (if printable)
        print("First 128 bytes (ASCII):")
        print("".join(chr(b) if 32 <= b <= 126 else '.' for b in first_bytes))
        print()
        
        # Get file size
        f.seek(0, 2)  # Seek to end
        file_size = f.tell()
        print(f"Total file size: {file_size} bytes")
        print()
        
        # Try to interpret the first few bytes as different data types
        f.seek(0)
        print("Possible interpretations of first bytes:")
        print(f"First 4 bytes as uint32: {struct.unpack('<I', first_bytes[:4])[0]}")
        print(f"Next 4 bytes as uint32: {struct.unpack('<I', first_bytes[4:8])[0]}")
        print(f"Next 4 bytes as uint32: {struct.unpack('<I', first_bytes[8:12])[0]}")
        print(f"Next 4 bytes as uint32: {struct.unpack('<I', first_bytes[12:16])[0]}")
        print(f"Next 4 bytes as uint32: {struct.unpack('<I', first_bytes[16:20])[0]}")
        print()
        
        # Look for any patterns in the data
        print("Looking for repeating patterns...")
        f.seek(0)
        data = f.read()
        for i in range(4, 20):
            if len(data) > i:
                pattern = data[:i]
                count = data.count(pattern)
                if count > 1:
                    print(f"Found repeating pattern of length {i} (appears {count} times)")
        
        # Look for potential image data
        print("\nLooking for potential image data...")
        f.seek(0)
        data = f.read()
        # Look for common image markers
        if b'\x89PNG' in data:
            print("Found PNG marker")
        if b'\xFF\xD8' in data:
            print("Found JPEG marker")
        if b'BM' in data:
            print("Found BMP marker")
        
        # Try to find where the actual image data might start
        print("\nLooking for potential image data start...")
        # Look for large sections of non-zero data
        chunk_size = 1024
        for i in range(0, len(data), chunk_size):
            chunk = data[i:i+chunk_size]
            if sum(1 for b in chunk if b != 0) > chunk_size * 0.8:  # If more than 80% non-zero
                print(f"Found potential image data starting around byte {i}")

if __name__ == '__main__':
    # Get the directory containing the minimap files
    directory = os.path.join(os.path.dirname(__file__), 'minimap_data')
    
    # Find the first minimap file
    files = [f for f in os.listdir(directory) if f.endswith('.minimap')]
    if files:
        first_file = os.path.join(directory, files[0])
        analyze_file(first_file)
    else:
        print("No minimap files found in the directory") 