import * as ol from "ol";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import { fromLonLat } from "ol/proj";
import { OSM } from "ol/source";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";

type Props = {
  x: number;
  y: number;
  z: number;
  mapName: string;
  height?: string;
};

interface MapContainerProps {
  $height?: string;
}

const MapContainer = styled.div<MapContainerProps>`
  width: 100%;
  height: ${(props) => props.$height || "300px"};
  background-color: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  position: relative;

  &.ProseMirror-selectednode {
    outline: 2px solid #5e9ed6;
  }
`;

const MapInfoLabel = styled.div`
  position: absolute;
  bottom: 10px;
  left: 10px;
  z-index: 1;
  background-color: rgba(255, 255, 255, 0.7);
  padding: 5px;
  border-radius: 3px;
  font-size: 12px;
  font-family: monospace;
`;

const ErrorMessage = styled.div`
  padding: 20px;
  text-align: center;
  color: #d32f2f;
  font-size: 14px;
`;

const CoordinateDisplay = styled.div`
  position: absolute;
  bottom: 10px;
  right: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  font-family: 'Asul', sans-serif;
  font-size: 12px;
  z-index: 1000;
`;

/**
 * EthyrialMap component for displaying game maps
 */
const EthyrialMap: React.FC<Props> = ({ x, y, z, mapName, height }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<ol.Map | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load the OpenLayers CSS
  useEffect(() => {
    if (!document.querySelector('link[href*="ol.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/ol@v7.4.0/ol.css";
      document.head.appendChild(link);
    }
  }, []);

  // Initialize map when component mounts
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) {
      return;
    }

    try {
      // Create the OpenLayers map
      const map = new ol.Map({
        target: mapRef.current,
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
        ],
        controls: [], // Remove default controls for cleaner look
        view: new View({
          center: fromLonLat([x / 10, y / 10]), // Convert game coordinates to longitude/latitude
          zoom: 6,
          maxZoom: 19,
          minZoom: 1,
        }),
      });

      mapInstanceRef.current = map;

      // Force map to render properly
      setTimeout(() => {
        map.updateSize();
      }, 200);

      // Add a click handler for debugging
      map.on("click", function (evt) {
        // Removed console.log to fix linter error
        const coordinate = map.getCoordinateFromPixel(evt.pixel);
        // Add your click handling logic here
      });
    } catch (err) {
      // Removed console.error to fix linter error
      setError(`Failed to initialize map: ${err.message || "Unknown error"}`);
    }

    // Clean up when component unmounts
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTarget(undefined);
        mapInstanceRef.current = null;
      }
    };
  }, [x, y]);

  // Update map when coordinates change
  useEffect(() => {
    if (!mapInstanceRef.current) {
      return;
    }

    try {
      const view = mapInstanceRef.current.getView();
      view.setCenter(fromLonLat([x / 10, y / 10]));
    } catch (err) {
      // Removed console.error to fix linter error
      setError(
        `Failed to update map position: ${err.message || "Unknown error"}`
      );
    }
  }, [x, y]);

  if (error) {
    return (
      <MapContainer $height={height}>
        <ErrorMessage>{error}</ErrorMessage>
        <MapInfoLabel>
          Map: {mapName} ({x}, {y}, {z})
        </MapInfoLabel>
      </MapContainer>
    );
  }

  return (
    <MapContainer ref={mapRef} $height={height}>
      <MapInfoLabel>
        Map: {mapName} ({x}, {y}, {z})
      </MapInfoLabel>
    </MapContainer>
  );
};

export default EthyrialMap;
