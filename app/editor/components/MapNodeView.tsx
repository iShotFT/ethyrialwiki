import * as React from "react";
import { ComponentProps } from "@shared/editor/types";
import EthyrialMap from "~/components/EthyrialMap";

/**
 * MapNodeView renders an EthyrialMap inside the editor
 * This component is used by the ReactNode component view system
 */
const MapNodeView: React.FC<ComponentProps> = ({
  node,
  isSelected,
  isEditable,
}) => {
  const { x, y, z, map } = node.attrs;

  return (
    <div
      contentEditable={false}
      className={isSelected ? "ProseMirror-selectednode" : ""}
    >
      <EthyrialMap
        x={x}
        y={y}
        z={z}
        mapName={map || "irumesa"}
        height="300px"
      />
    </div>
  );
};

export default MapNodeView;
