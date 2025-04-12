# tools/scripts/inspect_binary.py
import argparse
import os

def inspect_binary_file(input_filepath, output_dir):
    """Reads a binary file and outputs hex and ASCII dump files."""

    base_filename = os.path.basename(input_filepath)
    hex_output_filename = os.path.splitext(base_filename)[0] + '.hex.txt'
    ascii_output_filename = os.path.splitext(base_filename)[0] + '.ascii.txt'

    hex_output_path = os.path.join(output_dir, hex_output_filename)
    ascii_output_path = os.path.join(output_dir, ascii_output_filename)

    bytes_per_line = 16

    try:
        with open(input_filepath, 'rb') as infile, \
             open(hex_output_path, 'w') as hex_outfile, \
             open(ascii_output_path, 'w') as ascii_outfile:

            offset = 0
            while True:
                chunk = infile.read(bytes_per_line)
                if not chunk:
                    break

                # --- Hex Dump Line ---
                hex_offset = f'{offset:08x}' # Format offset as 8-digit hex
                hex_bytes = ' '.join(f'{b:02x}' for b in chunk)
                # Pad hex bytes if chunk is smaller than bytes_per_line
                hex_bytes_padded = hex_bytes.ljust(bytes_per_line * 3 - 1)

                # --- ASCII Representation ---
                ascii_repr = ''.join(chr(b) if 32 <= b <= 126 else '.' for b in chunk)

                # Write hex line
                hex_outfile.write(f'{hex_offset}  {hex_bytes_padded}  |{ascii_repr}|\\n')

                # --- ASCII Dump Line ---
                ascii_outfile.write(ascii_repr)
                # Add newline occasionally to ascii dump for readability
                if offset % (bytes_per_line * 4) == 0 and offset > 0:
                    ascii_outfile.write('\\n')

                offset += len(chunk)

        print(f"Successfully created hex dump: {hex_output_path}")
        print(f"Successfully created ASCII dump: {ascii_output_path}")

    except FileNotFoundError:
        print(f"Error: Input file not found at {input_filepath}")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Create hex and ASCII dumps of a binary file.')
    parser.add_argument('input_file', help='Path to the input binary file.')
    parser.add_argument('-o', '--output_dir', default='./output',
                        help='Directory to save the output files (default: ./output).')

    args = parser.parse_args()

    # Ensure output directory exists
    os.makedirs(args.output_dir, exist_ok=True)

    inspect_binary_file(args.input_file, args.output_dir)