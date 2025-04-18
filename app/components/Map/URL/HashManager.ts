import { useCallback, useEffect, useState } from 'react';
import Logger from '~/utils/Logger';

interface MapHashData {
  zoom: number;
  center: [number, number];
  zLayer: number;
  resourceId?: string;
}

/**
 * Parse hash string from URL
 * Format: #at=zoom,x,y,z[&resource=resourceId]
 * Examples: 
 * - #at=5,1200,3400,2
 * - #at=7,2500,1800,3&resource=iron_ore
 */
export function parseMapHash(hash: string): MapHashData | null {
  try {
    if (!hash || hash.length === 0) {
      return null;
    }

    // Remove the leading # if present
    if (hash.startsWith('#')) {
      hash = hash.substring(1);
    }

    // Split into parts (at=... and resource=...)
    const parts = hash.split('&');
    let atPart = '';
    let resourceId: string | undefined;

    // Process each part
    for (const part of parts) {
      if (part.startsWith('at=')) {
        atPart = part.substring(3);
      } else if (part.startsWith('resource=')) {
        resourceId = decodeResourceId(part.substring(9));
      }
    }

    if (!atPart) {
      // Try legacy format
      return parseLegacyHash(hash);
    }

    // Parse coordinates
    const coords = atPart.split(',');
    if (coords.length < 3) {
      return null;
    }

    const zoom = parseInt(coords[0], 10);
    const centerX = parseInt(coords[1], 10);
    const centerY = parseInt(coords[2], 10);
    
    let zLayer = 2; // Default z-layer
    if (coords.length >= 4) {
      const parsedZ = parseInt(coords[3], 10);
      if (!isNaN(parsedZ) && parsedZ >= -3 && parsedZ <= 40) {
        zLayer = parsedZ;
      }
    }
    
    if (isNaN(zoom) || isNaN(centerX) || isNaN(centerY)) {
      return null;
    }
    
    return {
      zoom,
      center: [centerX, centerY],
      zLayer,
      resourceId
    };
  } catch (err) {
    Logger.warn('misc', new Error(`Failed to parse map hash: ${err}`));
    return null;
  }
}

/**
 * Parse legacy hash format for backward compatibility
 * Legacy format: map=zoom/centerX/centerY/zLayer/[resourceId]
 */
function parseLegacyHash(hash: string): MapHashData | null {
  try {
    const cleanHash = hash.replace('map=', '');
    const parts = cleanHash.split('/');
    
    if (parts.length < 3) {
      return null;
    }

    const zoom = parseInt(parts[0], 10);
    const centerX = parseInt(parts[1], 10);
    const centerY = parseInt(parts[2], 10);
    
    let zLayer = 2; // Default z-layer
    if (parts.length >= 4) {
      const parsedZ = parseInt(parts[3], 10);
      if (!isNaN(parsedZ) && parsedZ >= -3 && parsedZ <= 40) {
        zLayer = parsedZ;
      }
    }
    
    let resourceId: string | undefined;
    if (parts.length >= 5 && parts[4]) {
      resourceId = decodeResourceId(parts[4]);
    }
    
    if (isNaN(zoom) || isNaN(centerX) || isNaN(centerY)) {
      return null;
    }
    
    return {
      zoom,
      center: [centerX, centerY],
      zLayer,
      resourceId
    };
  } catch (err) {
    Logger.warn('misc', new Error(`Failed to parse legacy map hash: ${err}`));
    return null;
  }
}

/**
 * Update URL hash with new map state using a human-readable format
 */
export function updateMapHashWithZ(
  zoom: number,
  center: [number, number],
  zLayer: number,
  resourceId?: string
): void {
  try {
    // Round values for cleaner URLs
    const roundedZoom = Math.round(zoom);
    const roundedX = Math.round(center[0]);
    const roundedY = Math.round(center[1]);
    
    // Create the new human-readable hash
    let newHash = `#at=${roundedZoom},${roundedX},${roundedY},${zLayer}`;
    
    // Add resource if available
    if (resourceId) {
      try {
        const encodedResource = encodeResourceId(resourceId);
        if (encodedResource) {
          newHash += `&resource=${encodedResource}`;
        }
      } catch (err) {
        Logger.warn('misc', new Error(`Failed to encode resource ID: ${err}`));
      }
    }
    
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', newHash);
      Logger.debug('misc', `[MapURL] Updated URL hash: ${newHash}`);
    }
  } catch (error) {
    Logger.error('misc', new Error(`Error updating URL hash: ${error}`));
  }
}

/**
 * Simple resource ID encoding to avoid special characters in URL
 */
export function encodeResourceId(id: string): string {
  return encodeURIComponent(id);
}

/**
 * Decode resource ID from URL
 */
export function decodeResourceId(encoded: string): string {
  return decodeURIComponent(encoded);
}

/**
 * Hook to manage map hash in URL
 */
export function useHashManager(selectedResourceId?: string) {
  const [currentZLayer, setCurrentZLayer] = useState<number>(2); // Default to z-layer 2
  const [initialResourceId, setInitialResourceId] = useState<string | null>(null);
  const [lastEncodedResourceRef] = useState<string | null>(null);
  
  // Initialize from URL hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const parsedHash = parseMapHash(hash);
      if (parsedHash) {
        setCurrentZLayer(parsedHash.zLayer);
        if (parsedHash.resourceId) {
          setInitialResourceId(parsedHash.resourceId);
        }
      }
    }
  }, []);
  
  // Update hash when z-layer changes
  const handleZLayerChange = useCallback((newZLayer: number) => {
    Logger.debug('misc', `[ZLayerDebug] Changing Z-layer from ${currentZLayer} to ${newZLayer}`);
    setCurrentZLayer(newZLayer);
    
    // Update URL hash to include Z-layer
    // This will be enhanced when integrated with MapContext
  }, [currentZLayer]);
  
  return {
    currentZLayer,
    initialResourceId,
    handleZLayerChange,
  };
}

export default useHashManager; 