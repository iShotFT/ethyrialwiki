import tkinter as tk
from tkinter import messagebox, filedialog
import re
import struct
from dataclasses import dataclass
import sys
import os
from typing import List, Tuple
from datetime import datetime

@dataclass
class Position:
    x: float
    y: float
    z: float

class UDPStreamAnalyzer:
    def __init__(self):
        # Updated patterns based on actual coordinate format
        self.position_patterns = [
            rb'\x43(?:..){1,2}\x30\x00\x62\x01([\x00-\xff]{4})([\x00-\xff]{4})',  # Main pattern
            rb'\x43..\x00\x30\x00\x62\x01([\x00-\xff]{4})([\x00-\xff]{4})'  # Alternative pattern
        ]
        self.movements = []
        self.current_position = None
        self.last_position = None
        self.debug_mode = True  # Enable detailed debugging

    def decode_float(self, bytes_data: bytes) -> float:
        """Decode 4 bytes into a float value"""
        try:
            # Try different byte orders and formats
            formats = ['<f', '>f', '<i', '>i']
            for fmt in formats:
                try:
                    val = struct.unpack(fmt, bytes_data)[0]
                    if isinstance(val, int):
                        val = float(val)
                    # More permissive range check
                    if 0 <= val <= 5000:  # Increased range to catch all valid coordinates
                        return val
                except:
                    continue
            return 0.0
        except struct.error as e:
            print(f"Error decoding float: {e}, bytes: {bytes_data.hex()}")
            return 0.0

    def parse_position(self, data: bytes) -> Position:
        """Extract position from raw bytes"""
        if self.debug_mode:
            # Print first matching bytes for each pattern
            for i, pattern in enumerate(self.position_patterns):
                matches = re.finditer(pattern, data)
                for match in matches:
                    try:
                        full_match = match.group(0)
                        x_bytes = match.group(1)
                        y_bytes = match.group(2)
                        print(f"\nPattern {i+1} match:")
                        print(f"Full match (hex): {full_match.hex()}")
                        print(f"X bytes (hex): {x_bytes.hex()}")
                        print(f"Y bytes (hex): {y_bytes.hex()}")
                        
                        # Try both float and integer decoding
                        x = self.decode_float(x_bytes)
                        y = self.decode_float(y_bytes)
                        
                        print(f"Decoded values: x={x}, y={y}")
                        
                        # More permissive validation
                        if 1000 <= x <= 2000 and 3000 <= y <= 4000:  # Range around your known position
                            return Position(x, y, 1.0)
                    except Exception as e:
                        print(f"Error processing match: {str(e)}")
                        continue
        else:
            for pattern in self.position_patterns:
                matches = re.finditer(pattern, data)
                for match in matches:
                    try:
                        x_bytes = match.group(1)
                        y_bytes = match.group(2)
                        x = self.decode_float(x_bytes)
                        y = self.decode_float(y_bytes)
                        if 1000 <= x <= 2000 and 3000 <= y <= 4000:
                            return Position(x, y, 1.0)
                    except:
                        continue
        return None

    def analyze_stream(self, raw_data: bytes) -> List[str]:
        """Analyze a UDP stream and return list of detected movements"""
        events = []
        
        # Add debug information
        events.append(f"Stream size: {len(raw_data)} bytes")
        
        # Add more detailed hex analysis
        events.append("\nDetailed hex analysis:")
        events.append("Looking for coordinate patterns after 43 XX XX 30 00 62 01")
        
        # Look for potential coordinate sections
        coord_sections = re.finditer(rb'\x43(?:..){1,2}\x30\x00\x62\x01', raw_data)
        for i, section in enumerate(coord_sections):
            start = section.start()
            events.append(f"\nPotential coordinate section {i+1} at offset {start}:")
            # Show more context around the match
            context_start = max(0, start - 10)
            context_end = min(len(raw_data), start + 30)  # Increased context size
            context = raw_data[context_start:context_end]
            events.append(f"Context: {context.hex()}")
            
            # Try to decode coordinates from this section
            if start + 30 <= len(raw_data):
                coord_data = raw_data[start:start+30]
                pos = self.parse_position(coord_data)
                if pos:
                    events.append(f"Found coordinates: ({pos.x:.1f}, {pos.y:.1f}, {pos.z:.1f})")
        
        # Process all messages
        messages = raw_data.split(b'\x86\x00\x00\x18\x00\x43')  # Updated message separator
        events.append(f"\nFound {len(messages)} message segments")
        
        positions = []
        for i, msg in enumerate(messages):
            if not msg:
                continue
                
            pos = self.parse_position(msg)
            if pos:
                positions.append(pos)
                if not self.current_position:
                    self.current_position = pos
                    events.append(f"Initial position: ({pos.x:.1f}, {pos.y:.1f}, {pos.z:.1f})")
                else:
                    # Detect movement
                    dx = pos.x - self.current_position.x
                    dy = pos.y - self.current_position.y
                    
                    if abs(dx) > 0.1 or abs(dy) > 0.1:  # Account for floating point imprecision
                        direction = self.get_movement_direction(dx, dy)
                        events.append(f"Moved {direction} to ({pos.x:.1f}, {pos.y:.1f}, {pos.z:.1f})")
                        self.current_position = pos
        
        if positions:
            events.append(f"\nFinal position: ({positions[-1].x:.1f}, {positions[-1].y:.1f}, {positions[-1].z:.1f})")
        
        if not positions:  # If no positions detected
            events.append("\nNo valid positions detected - Debug raw data:")
            events.append("First 200 bytes in hex (grouped by 4):")
            hex_bytes = raw_data[:200]
            hex_groups = [hex_bytes[i:i+4].hex() for i in range(0, len(hex_bytes), 4)]
            events.append(' '.join(hex_groups))
            
        return events

    def get_movement_direction(self, dx: float, dy: float) -> str:
        """Convert coordinate changes to cardinal directions"""
        directions = []
        
        if abs(dx) > 0.1:
            directions.append("East" if dx > 0 else "West")
        if abs(dy) > 0.1:
            directions.append("North" if dy > 0 else "South")
            
        return " and ".join(directions) if directions else "Unknown direction"

class AnalyzerGUI(tk.Tk):
    def __init__(self):
        super().__init__()

        # Configure the window
        self.title("Ethyrial UDP Stream Analyzer")
        self.geometry("400x300")
        
        # Create main frame
        self.main_frame = tk.Frame(self, bg='lightgray')
        self.main_frame.pack(padx=10, pady=10, expand=True, fill='both')
        
        # Create and configure button
        self.button = tk.Button(
            self.main_frame,
            text="Select UDP Stream File",
            command=self.select_file,
            width=20,
            height=2
        )
        self.button.pack(expand=True)
        
        # Add instructions label
        self.label = tk.Label(
            self.main_frame,
            text="Click the button to select a UDP stream file to analyze",
            bg='lightgray',
            wraplength=350
        )
        self.label.pack(expand=True)

    def select_file(self):
        """Handle file selection"""
        file_path = filedialog.askopenfilename(
            title="Select UDP Stream file",
            filetypes=[("Text files", "*.txt"), ("All files", "*.*")]
        )
        if file_path:
            self.analyze_file(file_path)

    def analyze_file(self, file_path):
        """Analyze the selected file"""
        try:
            analyzer = UDPStreamAnalyzer()
            
            with open(file_path, 'rb') as f:
                data = f.read()
            
            events = analyzer.analyze_stream(data)
            
            # Create output filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_dir = os.path.dirname(file_path)
            output_file = os.path.join(output_dir, f"movement_analysis_{timestamp}.txt")
            
            # Write analysis to file with UTF-8 encoding
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write("=== Movement Analysis ===\n")
                for event in events:
                    f.write(event + "\n")
                f.write("======================\n")
            
            messagebox.showinfo("Success", 
                              f"Analysis complete!\nResults saved to:\n{output_file}")
            
        except Exception as e:
            messagebox.showerror("Error", f"Failed to analyze file:\n{str(e)}")

if __name__ == "__main__":
    app = AnalyzerGUI()
    app.mainloop()