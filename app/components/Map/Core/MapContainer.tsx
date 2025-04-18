import * as React from "react";
import styled from "styled-components";

type Props = {
  children: JSX.Element | JSX.Element[];
};

/**
 * Styled container for the map with optimized rendering settings
 */
const StyledMapContainer = styled.div`
  width: 100%;
  height: 100%;
  background-color: #2a61e2;
  transform: translateZ(0);
  backface-visibility: hidden;
  perspective: 1000;
  will-change: transform;
  isolation: isolate;
`;

const MapContainer: React.FC<Props> = ({ children }) => {
  return <StyledMapContainer>{children}</StyledMapContainer>;
};

export default MapContainer; 