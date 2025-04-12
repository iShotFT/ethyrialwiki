import * as React from "react";
import { useRef } from "react";
import styled from "styled-components";
import { ComponentProps } from "@shared/editor/types";
import EthyrialMap from "~/components/EthyrialMap";

type Props = ComponentProps & {
  isSelected?: boolean;
  view?: any;
};

const MapWrapper = styled.div`
  position: relative;
  margin: 1em 0;
  pointer-events: auto;

  &:hover {
    outline: 2px solid #e0e0e0;
  }
`;

/**
 * MapComponent renders the EthyrialMap component in the editor
 */
const MapComponent: React.FC<Props> = ({ isSelected, node }) => {
  const { x, y, z, map } = node.attrs;
  const ref = useRef<HTMLDivElement>(null);

  return (
    <MapWrapper
      className={isSelected ? "ProseMirror-selectednode" : ""}
      contentEditable={false}
      ref={ref}
    >
      <EthyrialMap
        x={x}
        y={y}
        z={z}
        mapName={map || "irumesa"}
        height="300px"
      />
    </MapWrapper>
  );
};

export default MapComponent;
