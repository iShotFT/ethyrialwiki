import { NodeSpec } from "prosemirror-model";
import { NodeType } from "prosemirror-model";
import { Command } from "prosemirror-state";
import { ComponentProps } from "../types";
import ReactNode from "./ReactNode";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import { useEffect, useRef } from "react";
import styled from "styled-components";

const MapContainer = styled.div`
  width: 100%;
  height: 400px;
  position: relative;
  margin: 1em 0;
  border-radius: 4px;
  overflow: hidden;
  background: ${props => props.theme.backgroundSecondary};
`;

const ResizeHandle = styled.div`
  position: absolute;
  bottom: 0;
  right: 0;
  width: 20px;
  height: 20px;
  cursor: se-resize;
  background: ${props => props.theme.backgroundSecondary};
  border-top: 1px solid ${props => props.theme.divider};
  border-left: 1px solid ${props => props.theme.divider};
  opacity: 0;
  transition: opacity 150ms ease-in-out;

  ${MapContainer}:hover & {
    opacity: 1;
  }
`;

export default class MapNode extends ReactNode {
  get name() {
    return "map";
  }

  get schema(): NodeSpec {
    return {
      attrs: {
        height: {
          default: 400
        },
        width: {
          default: "100%"
        }
      },
      group: "block",
      selectable: true,
      draggable: true,
      parseDOM: [{
        tag: "div.map-container",
        getAttrs: (dom: HTMLDivElement) => ({
          height: parseInt(dom.style.height || "400"),
          width: dom.style.width || "100%"
        })
      }],
      toDOM: node => ["div", {
        class: "map-container",
        style: `height: ${node.attrs.height}px; width: ${node.attrs.width};`
      }, 0]
    };
  }

  component = (props: ComponentProps) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<Map | null>(null);
    const isResizing = useRef(false);
    const startHeight = useRef(0);
    const startY = useRef(0);

    useEffect(() => {
      if (!mapRef.current) return;

      // Initialize OpenLayers map
      mapInstance.current = new Map({
        target: mapRef.current,
        layers: [
          new TileLayer({
            source: new OSM()
          })
        ],
        view: new View({
          center: [0, 0],
          zoom: 2
        })
      });

      return () => {
        if (mapInstance.current) {
          mapInstance.current.setTarget(undefined);
          mapInstance.current = null;
        }
      };
    }, []);

    const handleResizeStart = (e: React.MouseEvent) => {
      isResizing.current = true;
      startHeight.current = props.node.attrs.height;
      startY.current = e.clientY;
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
    };

    const handleResizeMove = (e: MouseEvent) => {
      if (!isResizing.current) return;

      const deltaY = e.clientY - startY.current;
      const newHeight = Math.max(200, startHeight.current + deltaY);

      const { state, dispatch } = props.view;
      const { tr } = state;
      const pos = props.getPos();

      if (pos !== undefined) {
        tr.setNodeMarkup(pos, undefined, {
          ...props.node.attrs,
          height: newHeight
        });
        dispatch(tr);
      }
    };

    const handleResizeEnd = () => {
      isResizing.current = false;
      document.removeEventListener("mousemove", handleResizeMove);
      document.removeEventListener("mouseup", handleResizeEnd);
    };

    return (
      <MapContainer ref={mapRef} style={{ height: props.node.attrs.height }}>
        <ResizeHandle onMouseDown={handleResizeStart} />
      </MapContainer>
    );
  };

  commands({ type }: { type: NodeType }) {
    return {
      insertMap: (): Command => (state, dispatch) => {
        const { selection } = state;
        const position = selection.$cursor?.pos || selection.$to.pos;
        
        if (position === undefined) return false;

        const node = type.create();
        const transaction = state.tr.insert(position, node);
        dispatch?.(transaction);
        return true;
      }
    };
  }
} 