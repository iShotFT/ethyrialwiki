import React, { useState } from 'react';
import MapMarkerExample from '~/components/MapMarkerExample';
import IconTestUtility from '~/components/IconTestUtility';
import DirectMarkerExample from '~/components/DirectMarkerExample';
import DirectMapExample from '~/components/DirectMapExample';
import styled from 'styled-components';

const TabContainer = styled.div`
  background-color: #151515;
  min-height: 100vh;
`;

const TabButtons = styled.div`
  display: flex;
  border-bottom: 1px solid #4e443a;
  background-color: #38322c;
  flex-wrap: wrap;
`;

const TabButton = styled.button<{ $active: boolean }>`
  padding: 1rem 2rem;
  color: ${props => props.$active ? '#ffd5ae' : '#e0e0e0'};
  background-color: ${props => props.$active ? '#151515' : 'transparent'};
  border: none;
  border-bottom: 3px solid ${props => props.$active ? '#ffd5ae' : 'transparent'};
  font-family: 'Asul', sans-serif;
  cursor: pointer;
  
  &:hover {
    color: #ffd5ae;
  }
`;

const TabContent = styled.div`
  height: calc(100vh - 58px); /* 58px is the tab button height */
`;

/**
 * Demo page for Ethyrial map markers with both the map example
 * and icon test utility
 */
export default function MapMarkerDemo() {
  const [activeTab, setActiveTab] = useState<'map' | 'icons' | 'direct' | 'directmap'>('directmap');
  
  return (
    <TabContainer>
      <TabButtons>
        <TabButton 
          $active={activeTab === 'map'} 
          onClick={() => setActiveTab('map')}
        >
          Map Markers Demo
        </TabButton>
        <TabButton 
          $active={activeTab === 'icons'} 
          onClick={() => setActiveTab('icons')}
        >
          Icon Test Utility
        </TabButton>
        <TabButton 
          $active={activeTab === 'direct'} 
          onClick={() => setActiveTab('direct')}
        >
          Direct Markers
        </TabButton>
        <TabButton 
          $active={activeTab === 'directmap'} 
          onClick={() => setActiveTab('directmap')}
        >
          Working Map Demo ✓
        </TabButton>
      </TabButtons>
      
      <TabContent>
        {activeTab === 'map' ? (
          <MapMarkerExample />
        ) : activeTab === 'icons' ? (
          <IconTestUtility />
        ) : activeTab === 'direct' ? (
          <DirectMarkerExample />
        ) : (
          <DirectMapExample />
        )}
      </TabContent>
    </TabContainer>
  );
} 