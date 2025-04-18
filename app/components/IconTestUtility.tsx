import React from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
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
import { createEthyrialMarker } from '~/utils/markerStyleUtils';

const Container = styled.div`
  padding: 2rem;
  background-color: #151515;
  min-height: 100vh;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
`;

const IconCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background-color: #2c2824;
  border-radius: 4px;
`;

const IconRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  background-color: #38322c;
  border-radius: 4px;
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
`;

// Map of all icons we're using
const ICONS = {
  'gem': faGem,
  'leaf': faLeaf,
  'paw': faPaw,
  'tree': faTree,
  'scroll': faScroll,
  'skull-crossbones': faSkullCrossbones,
  'map-marker-alt': faMapMarkerAlt,
  'city': faCity,
  'crosshairs': faCrosshairs,
  'question-circle': faQuestionCircle,
  'chess-rook': faChessRook,
  'university': faUniversity,
  'street-view': faStreetView,
  'dragon': faDragon
};

// Map categories to their icons (based on MapOverlayPanel)
const CATEGORY_MAP = {
  'ORE': { icon: faGem, color: '#c0c0ff' },
  'HERB': { icon: faLeaf, color: '#90ee90' },
  'SKIN': { icon: faPaw, color: '#ffd700' },
  'TREE': { icon: faTree, color: '#228b22' },
  'CLOTH': { icon: faScroll, color: '#dda0dd' },
  'ENEMY': { icon: faSkullCrossbones, color: '#ff4500' },
  'POI': { icon: faMapMarkerAlt, color: '#ffd5ae' },
  'NPC': { icon: faCrosshairs, color: '#add8e6' },
  'TOWN': { icon: faCity, color: '#e6e6fa' },
  'DUNGEON': { icon: faChessRook, color: '#800080' },
  'BANK': { icon: faUniversity, color: '#ffd700' },
  'TELEPORT': { icon: faStreetView, color: '#00ffff' },
  'DAILY_QUEST': { icon: faScroll, color: '#4169e1' },
  'RAID': { icon: faDragon, color: '#ff4500' },
  'WORLD_BOSS': { icon: faDragon, color: '#ff0000' },
  'OTHER': { icon: faQuestionCircle, color: '#a0a0a0' },
};

/**
 * A utility component to test and verify that all required FontAwesome icons 
 * are loading correctly for the map markers
 */
const IconTestUtility: React.FC = () => {
  return (
    <Container>
      <IngameBorderedDiv>
        <Title>Ethyrial Map Icon Test Utility</Title>
        
        <Subtitle>Icon Library Test</Subtitle>
        <Grid>
          {Object.entries(ICONS).map(([name, icon]) => (
            <IconRow key={name}>
              <span style={{ color: '#e0e0e0', flex: 1 }}>{name}</span>
              <FontAwesomeIcon 
                icon={icon} 
                style={{ color: '#ffd5ae', fontSize: '1.5rem' }} 
              />
            </IconRow>
          ))}
        </Grid>
        
        <Subtitle>Category Icon Test</Subtitle>
        <Grid>
          {Object.entries(CATEGORY_MAP).map(([category, { icon, color }]) => (
            <IconRow key={category}>
              <span style={{ color: '#e0e0e0', flex: 1 }}>{category}</span>
              <FontAwesomeIcon 
                icon={icon} 
                style={{ color, fontSize: '1.5rem' }} 
              />
            </IconRow>
          ))}
        </Grid>
        
        <Subtitle>Marker Rendering Test</Subtitle>
        <Grid>
          {Object.entries(CATEGORY_MAP).map(([category, { icon, color }]) => (
            <IconCard key={`marker-${category}`}>
              <span style={{ color: '#e0e0e0', marginBottom: '0.5rem' }}>{category}</span>
              <img 
                src={createEthyrialMarker(icon, color)}
                alt={category}
                width={48}
                height={48}
              />
            </IconCard>
          ))}
        </Grid>
      </IngameBorderedDiv>
    </Container>
  );
};

export default IconTestUtility; 