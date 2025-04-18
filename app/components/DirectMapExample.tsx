import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { Style, Icon, Fill, Stroke, Text } from 'ol/style';
import { 
  faGem, 
  faLeaf, 
  faPaw, 
  faTree, 
  faScroll, 
  faSkullCrossbones, 
  faMapMarkerAlt, 
  faCity, 
  faCrosshairs,
  faQuestionCircle,
  faChessRook,
  faUniversity,
  faStreetView,
  faDragon
} from "@fortawesome/free-solid-svg-icons";
import IngameBorderedDiv from './EthyrialStyle/IngameBorderedDiv';

// Import the createEthyrialMarker function
import { createEthyrialMarker } from '../utils/markerStyleUtils';

const Container = styled.div`
  padding: 2rem;
  background-color: #151515;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const MapContainer = styled.div`
  width: 100%;
  height: 600px;
  max-width: 1200px;
  margin-top: 2rem;
  border: 1px solid #4e443a;
`;

const Title = styled.h1`
  color: #ffd5ae;
  margin-bottom: 1rem;
  font-family: 'Asul', sans-serif;
`;

const InfoPanel = styled.div`
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 100;
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 4px;
  padding: 10px;
  color: white;
  max-width: 300px;
  font-size: 14px;
`;

// Map of marker category to FontAwesome icon
const CATEGORY_ICONS = {
  'ORE': faGem,
  'HERB': faLeaf,
  'SKIN': faPaw,
  'TREE': faTree,
  'CLOTH': faScroll,
  'ENEMY': faSkullCrossbones,
  'POI': faMapMarkerAlt,
  'NPC': faCrosshairs,
  'TOWN': faCity,
  'OTHER': faQuestionCircle,
  'DUNGEON': faChessRook,
  'BANK': faUniversity,
  'TELEPORT': faStreetView,
  'DAILY_QUEST': faScroll,
  'RAID': faDragon,
  'WORLD_BOSS': faDragon,
};

// Map of marker category to color
const CATEGORY_COLORS = {
  'ORE': "#c0c0ff",
  'HERB': "#90ee90", 
  'SKIN': "#ffd700", 
  'TREE': "#228b22", 
  'CLOTH': "#dda0dd", 
  'ENEMY': "#ff4500", 
  'POI': "#ffd5ae", 
  'NPC': "#add8e6", 
  'TOWN': "#e6e6fa", 
  'DUNGEON': "#800080", 
  'BANK': "#ffd700", 
  'TELEPORT': "#00ffff", 
  'DAILY_QUEST': "#4169e1", 
  'RAID': "#ff4500", 
  'WORLD_BOSS': "#ff0000",
  'OTHER': "#a0a0a0", 
};

interface Marker {
  id: string;
  categoryId: string;
  coordinate: [number, number];
  title: string;
}

/**
 * Component that demonstrates a map with proper FontAwesome icon markers
 * by directly creating the marker styles without any abstraction.
 */
const DirectMapExample: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const olMapRef = useRef<Map | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [markerStyles, setMarkerStyles] = useState<Record<string, Style>>({});
  
  // Precompute marker styles (URL data URIs) for each category
  useEffect(() => {
    const styles: Record<string, Style> = {};
    
    // Create a style for each category
    Object.entries(CATEGORY_ICONS).forEach(([categoryId, icon]) => {
      const color = CATEGORY_COLORS[categoryId as keyof typeof CATEGORY_COLORS] || "#ffd5ae";
      
      // Generate the marker SVG using our utility
      const markerUrl = createEthyrialMarker(icon, color);
      
      // Create an OpenLayers style with the SVG icon
      styles[categoryId] = new Style({
        image: new Icon({
          src: markerUrl,
          anchor: [0.5, 0.95], // Anchor at bottom-center of pin
          scale: 1.0
        }),
        // Also add text for the marker
        text: new Text({
          text: '', // Will be set per feature
          font: 'bold 14px Asul, sans-serif',
          fill: new Fill({ color: '#FFFFFF' }),
          stroke: new Stroke({ color: '#000000', width: 2 }),
          offsetY: -30, // Position above the marker
          textAlign: 'center'
        })
      });
    });
    
    // Store the styles
    setMarkerStyles(styles);
    console.log(`Created ${Object.keys(styles).length} marker styles`);
  }, []);
  
  // Generate sample markers
  useEffect(() => {
    // Create markers in a grid pattern
    const categoryIds = Object.keys(CATEGORY_ICONS);
    const sampleMarkers: Marker[] = [];
    
    // Create a ring of markers
    const centerX = 0;
    const centerY = 0;
    const ringCount = 3;
    
    for (let ring = 0; ring < ringCount; ring++) {
      const radius = (ring + 1) * 20;
      const markerCount = 6 * (ring + 1);
      
      for (let i = 0; i < markerCount; i++) {
        const angle = (i / markerCount) * Math.PI * 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        // Pick a category for this marker
        const categoryIndex = (i + ring) % categoryIds.length;
        const categoryId = categoryIds[categoryIndex];
        
        sampleMarkers.push({
          id: `marker-${ring}-${i}`,
          categoryId,
          coordinate: [x, y],
          title: `${categoryId}`
        });
      }
    }
    
    // Create a central marker
    sampleMarkers.push({
      id: 'marker-center',
      categoryId: 'POI',
      coordinate: [centerX, centerY],
      title: 'Center Point'
    });
    
    setMarkers(sampleMarkers);
    console.log(`Created ${sampleMarkers.length} sample markers`);
  }, []);
  
  // Initialize the OpenLayers map
  useEffect(() => {
    if (!mapRef.current) return;
    
    // Create the vector source for markers
    const vectorSource = new VectorSource();
    
    // Function to style features based on category
    const styleFunction = (feature: Feature) => {
      const categoryId = feature.get('categoryId') as string;
      const title = feature.get('title') as string;
      
      // Get the precomputed style for this category
      const style = markerStyles[categoryId];
      
      // If we have a style, clone it and set the text
      if (style) {
        const clonedStyle = style.clone();
        const text = clonedStyle.getText();
        if (text) {
          text.setText(title);
        }
        return clonedStyle;
      }
      
      // Fallback style
      return new Style({
        image: new Icon({
          src: createEthyrialMarker(faQuestionCircle, '#ffd5ae'),
          anchor: [0.5, 0.95],
          scale: 1.0
        })
      });
    };
    
    // Create vector layer
    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: styleFunction
    });
    
    // Create the map
    olMapRef.current = new Map({
      target: mapRef.current,
      layers: [
        // Background tile layer
        new TileLayer({
          source: new XYZ({
            url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
          })
        }),
        // Vector layer for markers
        vectorLayer
      ],
      view: new View({
        center: [0, 0],
        zoom: 3
      })
    });
    
    // Add markers to the map
    markers.forEach(marker => {
      const feature = new Feature({
        geometry: new Point(marker.coordinate),
        categoryId: marker.categoryId,
        title: marker.title
      });
      vectorSource.addFeature(feature);
    });
    
    return () => {
      if (olMapRef.current) {
        olMapRef.current.setTarget(undefined);
        olMapRef.current = null;
      }
    };
  }, [markers, markerStyles]);
  
  return (
    <Container>
      <IngameBorderedDiv className="w-full max-w-[1200px]">
        <Title>Direct Map Example</Title>
        <p style={{ color: '#e0e0e0', marginBottom: '1rem' }}>
          This example demonstrates markers with proper FontAwesome icons by directly creating
          marker styles without any dynamic lookup mechanisms.
        </p>
        
        <MapContainer ref={mapRef}>
          <InfoPanel>
            <h3 style={{ color: '#ffd5ae', marginBottom: '5px' }}>Map Controls</h3>
            <p>
              Drag to pan<br />
              Scroll to zoom<br />
              Created {markers.length} markers with {Object.keys(markerStyles).length} styles
            </p>
          </InfoPanel>
        </MapContainer>
      </IngameBorderedDiv>
    </Container>
  );
};

export default DirectMapExample; 