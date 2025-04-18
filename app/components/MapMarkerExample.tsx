import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { 
  MapContainer, 
  MapInstance, 
  MapProvider,
  MarkerLayer
} from './Map';
import { CATEGORY_ICONS, CATEGORY_COLORS } from '~/utils/markerSamples';
import IngameBorderedDiv from './EthyrialStyle/IngameBorderedDiv';

const DemoContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background-color: #151515;
`;

const MapWrapper = styled.div`
  position: relative;
  flex-grow: 1;
  width: 100%;
  height: 100%;
`;

const SampleMarkersWrapper = styled.div`
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 100;
  max-width: 400px;
  max-height: calc(100% - 20px);
  overflow-y: auto;
`;

const DebugOutput = styled.pre`
  position: absolute;
  bottom: 10px;
  right: 10px;
  background-color: rgba(0, 0, 0, 0.75);
  color: white;
  padding: 10px;
  border-radius: 4px;
  font-size: 12px;
  max-width: 500px;
  max-height: 200px;
  overflow: auto;
  z-index: 2000;
  font-family: monospace;
`;

interface SampleMarker {
  id: string;
  coordinate: { x: number; y: number };
  categoryId: string;
  categoryTitle: string;
  title: string;
  description?: string;
}

// Ensure category definitions exactly match what's expected
// Using all uppercase to ensure consistent matching
const CATEGORY_DEFINITIONS = [
  { id: "ORE", title: "ORE" },
  { id: "HERB", title: "HERB" },
  { id: "SKIN", title: "SKIN" },
  { id: "TREE", title: "TREE" },
  { id: "CLOTH", title: "CLOTH" },
  { id: "ENEMY", title: "ENEMY" },
  { id: "POI", title: "POI" },
  { id: "NPC", title: "NPC" },
  { id: "TOWN", title: "TOWN" },
  { id: "DUNGEON", title: "DUNGEON" },
  { id: "BANK", title: "BANK" },
  { id: "TELEPORT", title: "TELEPORT" },
  { id: "DAILY_QUEST", title: "DAILY_QUEST" },
  { id: "RAID", title: "RAID" },
  { id: "WORLD_BOSS", title: "WORLD_BOSS" },
  { id: "OTHER", title: "OTHER" },
];

// Helper function to format category for display
const formatCategoryTitle = (title: string): string => {
  if (!title) return '';

  // Handle specific abbreviations
  if (title.toUpperCase() === 'POI') return 'POI';
  if (title.toUpperCase() === 'NPC') return 'NPC';

  // General formatting for others
  return title
    .toLowerCase() // Convert to lowercase first
    .replace(/_/g, ' ') // Replace underscores with spaces
    .replace(/\b\w/g, char => char.toUpperCase()); // Capitalize first letter of each word
};

/**
 * Demo component showing sample map markers using Ethyrial styling
 */
const MapMarkerExample: React.FC = () => {
  // Sample markers representing different categories
  const [sampleMarkers, setSampleMarkers] = useState<SampleMarker[]>([]);
  const [debugInfo, setDebugInfo] = useState<string>('Initializing markers...');
  
  // Print info about available icons
  useEffect(() => {
    console.log('Available category icons:', Object.keys(CATEGORY_ICONS));
  }, []);
  
  // Set up sample markers
  useEffect(() => {
    // Create sample markers in a circular pattern
    const center = { x: 2500, y: 2500 };
    const radius = 500;
    const markerCount = CATEGORY_DEFINITIONS.length;
    
    const markers: SampleMarker[] = CATEGORY_DEFINITIONS.map((category, index) => {
      // Calculate position in a circle
      const angle = (index / markerCount) * Math.PI * 2;
      const x = center.x + Math.cos(angle) * radius;
      const y = center.y + Math.sin(angle) * radius;
      
      // Create marker with consistent uppercase IDs
      return {
        id: `sample-${category.id}`,
        coordinate: { x, y },
        categoryId: category.id,
        categoryTitle: category.title,
        title: formatCategoryTitle(category.title)
      };
    });
    
    // Add a central marker
    markers.push({
      id: 'sample-center',
      coordinate: center,
      categoryId: 'POI',
      categoryTitle: 'POI',
      title: 'Center Point',
      description: 'The center of the sample markers'
    });
    
    // Debug output
    setDebugInfo(`Created ${markers.length} markers\n` + 
                markers.map(m => `${m.id}: categoryId=${m.categoryId}, categoryTitle=${m.categoryTitle}`).join('\n'));
    
    setSampleMarkers(markers);
  }, []);
  
  return (
    <DemoContainer>
      <MapWrapper>
        <MapProvider>
          <MapContainer>
            <MapInstance mapId="ethyrial-world">
              <MarkerLayer
                visible={true}
                categoryIconMap={CATEGORY_ICONS}
                onLayerReady={(layer, source) => {
                  // This exposes the layer and source if you need to manually manipulate them
                  if (sampleMarkers.length > 0) {
                    setTimeout(() => {
                      console.log('Adding markers to map...');
                      
                      // Add markers with a slight delay to ensure map is ready
                      const layerSource = layer.getSource();
                      if (layerSource) {
                        layerSource.clear();
                      }
                      
                      // Log marker info
                      console.log('Sample markers:', sampleMarkers.map(m => ({
                        id: m.id,
                        categoryId: m.categoryId,
                        categoryTitle: m.categoryTitle
                      })));
                      
                      // Pass markers data to our MarkerLayer component
                      (layer as any)?.addMarkers?.(sampleMarkers);
                      
                      setDebugInfo(prev => prev + '\nMarkers added to map');
                    }, 100);
                  }
                }}
              />
            </MapInstance>
          </MapContainer>
        </MapProvider>
        
        <SampleMarkersWrapper>
          <IngameBorderedDiv>
            <h3 className="text-[#ffd5ae] text-lg mb-4">Ethyrial Map Markers</h3>
            <p className="text-white text-sm mb-2">
              This example demonstrates the new styled map markers using SVG icons with Ethyrial styling.
            </p>
            <div className="grid grid-cols-2 gap-2 text-gray-300 text-sm">
              {CATEGORY_DEFINITIONS.map(category => (
                <div key={category.id} className="flex items-center mb-1">
                  <img 
                    src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
                        <circle cx="10" cy="10" r="9" fill="${CATEGORY_COLORS[category.id] || '#ffd5ae'}" stroke="#38322c" />
                      </svg>
                    `)}`} 
                    alt="" 
                    className="w-4 h-4 mr-1" 
                  />
                  <span>{formatCategoryTitle(category.title)}</span>
                </div>
              ))}
            </div>
          </IngameBorderedDiv>
        </SampleMarkersWrapper>
        
        {/* Debug output for troubleshooting */}
        <DebugOutput>
          {debugInfo}
        </DebugOutput>
      </MapWrapper>
    </DemoContainer>
  );
};

export default MapMarkerExample; 