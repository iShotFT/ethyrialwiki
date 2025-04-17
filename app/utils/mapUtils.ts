import Logger from "./Logger";

// Base62 character set (0-9, a-z, A-Z)
const BASE62_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  
/**
 * Encodes a resource ID to base62
 * @param resourceId The resource ID to encode
 * @returns Base62 encoded string
 */
export const encodeResource = (resourceId: string): string => {
  if (!resourceId) return '';
  try {
    // Convert each character to its numeric value and encode to base62
    let num = 0n; // Use BigInt for large numbers
    
    // Convert resourceId to a large integer (treating each char as base-256 digit)
    for (let i = 0; i < resourceId.length; i++) {
      num = num * 256n + BigInt(resourceId.charCodeAt(i));
    }
    
    // Convert the integer to base62
    let encoded = '';
    
    // Handle special case for 0
    if (num === 0n) return BASE62_CHARS[0];
    
    // Convert to base62
    while (num > 0n) {
      encoded = BASE62_CHARS[Number(num % 62n)] + encoded;
      num = num / 62n;
    }
    
    Logger.debug("misc", `[ResourceDebug] Encoded ${resourceId} to base62: ${encoded}`);
    return encoded;
  } catch (error) {
    Logger.error("misc", new Error(`Error encoding resource ID: ${error}`));
    return '';
  }
};

/**
 * Decodes a base62 string to a resource ID
 * @param base62 The base62 encoded string
 * @returns Decoded resource ID or null if invalid
 */
export const decodeResource = (base62: string): string | null => {
  if (!base62) return null;
  try {
    // Convert from base62 to big integer
    let num = 0n;
    for (let i = 0; i < base62.length; i++) {
      const charValue = BigInt(BASE62_CHARS.indexOf(base62[i]));
      if (charValue === -1n) {
        throw new Error(`Invalid base62 character: ${base62[i]}`);
      }
      num = num * 62n + charValue;
    }
    
    // Convert big integer back to string
    let decoded = '';
    
    // Convert back to string (char by char)
    while (num > 0n) {
      const charCode = Number(num % 256n);
      decoded = String.fromCharCode(charCode) + decoded;
      num = num / 256n;
    }
    
    Logger.debug("misc", `[ResourceDebug] Decoded base62 ${base62} to: ${decoded}`);
    return decoded;
  } catch (error) {
    Logger.error("misc", new Error(`Error decoding resource ID: ${error}`));
    return null;
  }
};

/**
 * Parse a map hash from the URL
 * @param hash The URL hash string without the leading #
 * @returns Parsed values or null if invalid
 */
export const parseMapHash = (hash: string) => {
  if (!hash) return null;
  
  const cleanHash = hash.replace("#map=", "");
  const parts = cleanHash.split("/");
  
  if (parts.length < 3) return null;
  
  const zoom = parseInt(parts[0], 10);
  const x = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  
  if (isNaN(zoom) || isNaN(x) || isNaN(y)) return null;
  
  // Parse Z-layer if present (new in format)
  let zLayer = 1; // Default Z-layer if not specified
  let resourceIdIndex = 3; // Default position of resource ID
  
  if (parts.length >= 4) {
    const parsedZ = parseInt(parts[3], 10);
    if (!isNaN(parsedZ)) {
      zLayer = parsedZ;
      resourceIdIndex = 4; // Resource ID is now at position 4
    }
  }
  
  let resourceId = null;
  if (parts.length > resourceIdIndex && parts[resourceIdIndex]) {
    resourceId = decodeResource(parts[resourceIdIndex]);
  }
  
  return {
    zoom,
    center: [x, y],
    zLayer,
    resourceId
  };
};

/**
 * Updates the URL hash with map position, Z-layer, and selected resource
 * @param zoom Current zoom level
 * @param center Current center coordinates [x, y]
 * @param zLayer Current Z-layer (height)
 * @param resourceId Optional resource ID to encode in URL
 */
export const updateMapHashWithZ = (zoom: number, center: [number, number], zLayer: number, resourceId?: string) => {
  // Build the base hash with position and Z-layer
  let newHash = `#map=${Math.round(zoom)}/${Math.round(center[0])}/${Math.round(center[1])}/${zLayer}`;
  
  // Add resource info if available
  if (resourceId) {
    const encodedResource = encodeResource(resourceId);
    if (encodedResource) {
      newHash += `/${encodedResource}`;
      Logger.debug("misc", `[ResourceDebug] Added resource to URL: ${encodedResource} (full URL: ${newHash})`);
    }
  }
  
  // Update URL without triggering a navigation
  window.history.replaceState(null, "", newHash);
  Logger.debug("misc", `[MapDebug] Updated URL hash with Z-layer: ${newHash}`);
};

/**
 * Backward compatibility function for updating URL hash without Z-layer
 * @deprecated Use updateMapHashWithZ instead
 */
export const updateMapHash = (zoom: number, center: [number, number], resourceId?: string) => {
  // Default to Z-layer 1 for backward compatibility
  updateMapHashWithZ(zoom, center, 1, resourceId);
}; 