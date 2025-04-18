import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
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
import { createEthyrialMarker } from '~/utils/markerStyleUtils';
import IngameBorderedDiv from './EthyrialStyle/IngameBorderedDiv';

const Container = styled.div`
  padding: 2rem;
  background-color: #151515;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const MarkerGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
  width: 100%;
  max-width: 1200px;
  margin-top: 2rem;
`;

const MarkerCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background-color: #2c2824;
  border-radius: 4px;
  transition: transform 0.3s;
  
  &:hover {
    transform: scale(1.05);
  }
`;

const Title = styled.h1`
  color: #ffd5ae;
  margin-bottom: 1rem;
  font-family: 'Asul', sans-serif;
`;

const Subtitle = styled.h2`
  color: #ffd5ae;
  margin: 1.5rem 0 0.5rem;
  font-family: 'Asul', sans-serif;
  align-self: flex-start;
  width: 100%;
  max-width: 1200px;
`;

const MarkerText = styled.div`
  color: #e0e0e0;
  font-size: 14px;
  margin-top: 0.5rem;
  text-align: center;
`;

// Direct map of categories to icon definitions (bypass all helper functions)
const DIRECT_ICONS = {
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

// Category to color mapping
const DIRECT_COLORS = {
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

/**
 * A simplified component to directly demonstrate marker creation
 * without any OpenLayers complexity
 */
const DirectMarkerExample: React.FC = () => {
  const [markers, setMarkers] = useState<{id: string, icon: string, name: string}[]>([]);
  
  useEffect(() => {
    // Create markers for each category
    const createdMarkers = Object.entries(DIRECT_ICONS).map(([category, icon]) => {
      const color = DIRECT_COLORS[category as keyof typeof DIRECT_COLORS] || "#ffd5ae";
      return {
        id: category,
        name: category,
        icon: createEthyrialMarker(icon, color)
      };
    });
    
    setMarkers(createdMarkers);
  }, []);
  
  return (
    <Container>
      <IngameBorderedDiv className="w-full max-w-[1200px]">
        <Title>Direct Marker Demo</Title>
        <p style={{ color: '#e0e0e0', marginBottom: '1rem' }}>
          This demo directly creates markers from hardcoded FontAwesome icons,
          bypassing any dynamic lookup mechanisms.
        </p>
        
        <Subtitle>Category Markers</Subtitle>
        <MarkerGrid>
          {markers.map(marker => (
            <MarkerCard key={marker.id}>
              <img 
                src={marker.icon}
                alt={marker.name}
                width={64}
                height={64}
              />
              <MarkerText>{marker.name}</MarkerText>
            </MarkerCard>
          ))}
        </MarkerGrid>
      </IngameBorderedDiv>
    </Container>
  );
};

export default DirectMarkerExample; 