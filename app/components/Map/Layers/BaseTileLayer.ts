import TileLayer from 'ol/layer/Tile';
import TileImage from 'ol/source/TileImage';
import TileGrid from 'ol/tilegrid/TileGrid';
import { getBottomLeft } from 'ol/extent';
import type { Projection } from 'ol/proj';
import { LAYER_Z_INDEXES } from './LayerManager';

export interface BaseTileLayerOptions {
  mapId: string;
  zLayer: number;
  projection: Projection;
  mapExtent: [number, number, number, number];
  transition?: number;
}

/**
 * Creates a base tile layer for the map
 */
export function createBaseTileLayer(options: BaseTileLayerOptions): TileLayer<TileImage> {
  const { mapId, zLayer, projection, mapExtent, transition = 200 } = options;
  
  // Tile dimensions
  const tileWidth = 1000;
  const tileHeight = 1000;
  
  // Create tile grid
  const tileGrid = new TileGrid({
    origin: getBottomLeft(mapExtent),
    extent: mapExtent,
    resolutions: [1],
    tileSize: [tileWidth, tileHeight],
  });
  
  // Create tile source with Z-layer support
  const tileSource = new TileImage({
    projection,
    tileGrid,
    wrapX: false,
    transition,
    tileUrlFunction: (tileCoord) => {
      const ol_z_idx = tileCoord[0];
      const x = tileCoord[1];
      const y_ol = tileCoord[2];
      
      const z_filename = zLayer;
      const filenameY = -y_ol - 1;
      
      // Check bounds
      if (x < 0 || x > 5 || filenameY < 0 || filenameY > 4) {
        return undefined;
      }
      
      return `/api/maps/${mapId}/tiles/${z_filename}/${x}/${filenameY}`;
    },
  });
  
  // Create tile layer
  const tileLayer = new TileLayer({
    source: tileSource,
    zIndex: LAYER_Z_INDEXES.BASE_TILE,
    properties: {
      layerType: 'basemap',
      id: 'base-osm'
    }
  });
  
  return tileLayer;
}

export default createBaseTileLayer; 