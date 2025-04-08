import { NodeSpec, NodeType } from "prosemirror-model";
import { Command, TextSelection } from "prosemirror-state";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { ComponentProps } from "../types";
import ReactNode from "./ReactNode";

// Define types for OpenLayers components
interface OLMap {
  setTarget: (target: HTMLElement | string | undefined) => void;
  setView: (view: any) => void;
  updateSize: () => void;
  getLayers: () => any;
  addLayer: (layer: any) => void;
}

// Dialog component for map configuration
const MapDialog = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: ${(props) => props.theme.background};
  border-radius: 4px;
  box-shadow: 0 0 0 1px ${(props) => props.theme.divider},
    0 4px 8px ${(props) => props.theme.shadow};
  padding: 16px;
  z-index: 1000;
`;

const MapForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const FormRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`;

const Label = styled.label`
  font-weight: 500;
  min-width: 100px;
`;

const Input = styled.input`
  border: 1px solid ${(props) => props.theme.inputBorder};
  border-radius: 4px;
  padding: 6px 8px;
  flex-grow: 1;
  background: ${(props) => props.theme.background};
  color: ${(props) => props.theme.text};

  &:focus {
    outline: none;
    border-color: ${(props) => props.theme.inputBorderFocused};
  }
`;

const Select = styled.select`
  border: 1px solid ${(props) => props.theme.inputBorder};
  border-radius: 4px;
  padding: 6px 8px;
  flex-grow: 1;
  background: ${(props) => props.theme.background};
  color: ${(props) => props.theme.text};

  &:focus {
    outline: none;
    border-color: ${(props) => props.theme.inputBorderFocused};
  }
`;

const Button = styled.button`
  padding: 8px 16px;
  background: ${(props) => props.theme.buttonNeutralBackground};
  color: ${(props) => props.theme.buttonNeutralText};
  border: 1px solid ${(props) => props.theme.buttonNeutralBorder};
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease-in-out;

  &:hover {
    background: ${(props) => props.theme.listItemHoverBackground};
  }

  &:active {
    transform: translateY(1px);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
`;

const MapContainer = styled.div`
  position: relative;
  width: 100%;
  height: 400px;
  background: ${(props) => props.theme.background};
  border: 1px solid ${(props) => props.theme.divider};
  border-radius: 4px;
  overflow: hidden;
`;

const ResizeHandle = styled.div`
  position: absolute;
  bottom: 0;
  right: 0;
  width: 20px;
  height: 20px;
  cursor: se-resize;
  background: ${(props) => props.theme.backgroundSecondary};
  border-top: 1px solid ${(props) => props.theme.divider};
  border-left: 1px solid ${(props) => props.theme.divider};
  opacity: 0;
  transition: opacity 150ms ease-in-out;

  ${MapContainer}:hover & {
    opacity: 1;
  }
`;

const ZSlider = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  background: ${(props) => props.theme.background};
  border-radius: 4px;
  padding: 8px;
  box-shadow: 0 0 0 1px ${(props) => props.theme.divider},
    0 2px 4px ${(props) => props.theme.shadow};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;

const ZLevel = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: ${(props) => props.theme.text};
`;

export default class MapNode extends ReactNode {
  get name() {
    return "map";
  }

  get schema(): NodeSpec {
    return {
      attrs: {
        height: {
          default: 400,
        },
        width: {
          default: "100%",
        },
        mapType: {
          default: "irumesa",
        },
        x: {
          default: 0,
        },
        y: {
          default: 0,
        },
        z: {
          default: 0,
        },
      },
      group: "block",
      selectable: true,
      draggable: true,
      parseDOM: [
        {
          tag: "div.map-container",
          getAttrs: (dom: HTMLDivElement) => ({
            height: parseInt(dom.style.height || "400"),
            width: dom.style.width || "100%",
            mapType: dom.dataset.mapType || "irumesa",
            x: parseInt(dom.dataset.x || "0"),
            y: parseInt(dom.dataset.y || "0"),
            z: parseInt(dom.dataset.z || "0"),
          }),
        },
      ],
      toDOM: (node) => [
        "div",
        {
          class: "map-container",
          style: `height: ${node.attrs.height}px; width: ${node.attrs.width};`,
          "data-map-type": node.attrs.mapType,
          "data-x": node.attrs.x,
          "data-y": node.attrs.y,
          "data-z": node.attrs.z,
        },
        0,
      ],
    };
  }

  component = (props: ComponentProps) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const mapInstance = useRef<OLMap | null>(null);
    const isResizing = useRef(false);
    const startHeight = useRef(0);
    const startY = useRef(0);
    const [showConfig, setShowConfig] = useState(false);
    const [currentZ, setCurrentZ] = useState(props.node.attrs.z);

    // Form state
    const [formState, setFormState] = useState({
      mapType: props.node.attrs.mapType,
      x: props.node.attrs.x,
      y: props.node.attrs.y,
      z: props.node.attrs.z,
    });

    useEffect(() => {
      if (!mapRef.current) {
        return;
      }

      // Dynamic imports for OpenLayers to solve ESM/CommonJS compatibility
      const loadMap = async () => {
        try {
          const [
            { default: Map },
            { default: View },
            { default: TileLayer },
            { default: XYZ },
            Control,
          ] = await Promise.all([
            import("ol/Map"),
            import("ol/View"),
            import("ol/layer/Tile"),
            import("ol/source/XYZ"),
            import("ol/control"),
          ]);

          // Calculate the center based on provided x, y coordinates
          const center = [props.node.attrs.x, props.node.attrs.y];

          // Create a custom tile source for Ethyrial map
          const ethyrialSource = new XYZ({
            url: `/static/maps/ethyrial/${props.node.attrs.mapType}/layer_${currentZ}.png`,
            crossOrigin: "anonymous",
          });

          // Initialize OpenLayers map
          if (mapRef.current) {
            mapInstance.current = new Map({
              target: mapRef.current,
              controls: Control.defaults ? Control.defaults() : [],
              layers: [
                new TileLayer({
                  source: ethyrialSource,
                }),
              ],
              view: new View({
                center,
                zoom: 2,
                maxZoom: 6,
              }),
            });

            setMapLoaded(true);
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("Failed to load OpenLayers:", error);
        }
      };

      // Execute map loading and handle any rejection
      void loadMap();

      // Cleanup function
      return () => {
        if (mapInstance.current) {
          mapInstance.current.setTarget(undefined);
          mapInstance.current = null;
        }
      };
    }, [currentZ]);

    // Update map when Z level changes
    useEffect(() => {
      if (mapInstance.current && mapLoaded) {
        const updateMapLayer = async () => {
          try {
            const [{ default: TileLayer }, { default: XYZ }] =
              await Promise.all([
                import("ol/layer/Tile"),
                import("ol/source/XYZ"),
              ]);

            // Remove existing layers
            mapInstance.current?.getLayers().clear();

            // Create new layer with updated Z
            const newSource = new XYZ({
              url: `/static/maps/ethyrial/${props.node.attrs.mapType}/layer_${currentZ}.png`,
              crossOrigin: "anonymous",
            });

            const newLayer = new TileLayer({
              source: newSource,
            });

            mapInstance.current?.addLayer(newLayer);
            mapInstance.current?.updateSize();
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error("Failed to update map layer:", error);
          }
        };

        void updateMapLayer();
      }
    }, [currentZ, mapLoaded]);

    const handleResizeStart = (e: React.MouseEvent) => {
      isResizing.current = true;
      startHeight.current = props.node.attrs.height;
      startY.current = e.clientY;
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
    };

    const handleResizeMove = (e: MouseEvent) => {
      if (!isResizing.current) {
        return;
      }

      const deltaY = e.clientY - startY.current;
      const newHeight = Math.max(200, startHeight.current + deltaY);

      const { state, dispatch } = props.view;
      const { tr } = state;
      const pos = props.getPos();

      if (pos !== undefined) {
        tr.setNodeMarkup(pos, undefined, {
          ...props.node.attrs,
          height: newHeight,
        });
        dispatch(tr);
      }
    };

    const handleResizeEnd = () => {
      isResizing.current = false;
      document.removeEventListener("mousemove", handleResizeMove);
      document.removeEventListener("mouseup", handleResizeEnd);
    };

    const handleZChange = (newZ: number) => {
      setCurrentZ(newZ);

      // Update the node attributes
      const { state, dispatch } = props.view;
      const { tr } = state;
      const pos = props.getPos();

      if (pos !== undefined) {
        tr.setNodeMarkup(pos, undefined, {
          ...props.node.attrs,
          z: newZ,
        });
        dispatch(tr);
      }
    };

    const handleConfigSubmit = () => {
      // Update the node with new settings
      const { state, dispatch } = props.view;
      const { tr } = state;
      const pos = props.getPos();

      if (pos !== undefined) {
        tr.setNodeMarkup(pos, undefined, {
          ...props.node.attrs,
          mapType: formState.mapType,
          x: formState.x,
          y: formState.y,
          z: formState.z,
        });
        dispatch(tr);

        // Update current Z to match the new setting
        setCurrentZ(formState.z);
      }

      setShowConfig(false);
    };

    const handleFormChange = (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
      const { name, value } = e.target;
      setFormState((prev) => ({
        ...prev,
        [name]:
          name === "x" || name === "y" || name === "z"
            ? parseInt(value)
            : value,
      }));
    };

    return (
      <MapContainer ref={mapRef} style={{ height: props.node.attrs.height }}>
        {!mapLoaded && (
          <div style={{ padding: "1em", textAlign: "center" }}>
            Loading map...
          </div>
        )}

        {showConfig && (
          <MapDialog>
            <MapForm>
              <FormRow>
                <Label>Map Type</Label>
                <Select
                  name="mapType"
                  value={formState.mapType}
                  onChange={handleFormChange}
                >
                  <option value="irumesa">Irumesa</option>
                </Select>
              </FormRow>
              <FormRow>
                <Label>X coordinate</Label>
                <Input
                  type="number"
                  name="x"
                  value={formState.x}
                  onChange={handleFormChange}
                />
              </FormRow>
              <FormRow>
                <Label>Y coordinate</Label>
                <Input
                  type="number"
                  name="y"
                  value={formState.y}
                  onChange={handleFormChange}
                />
              </FormRow>
              <FormRow>
                <Label>Z coordinate</Label>
                <Input
                  type="number"
                  name="z"
                  value={formState.z}
                  onChange={handleFormChange}
                />
              </FormRow>
              <ButtonGroup>
                <Button type="button" onClick={() => setShowConfig(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleConfigSubmit}>
                  Apply
                </Button>
              </ButtonGroup>
            </MapForm>
          </MapDialog>
        )}

        {mapLoaded && (
          <>
            <Button
              type="button"
              style={{
                position: "absolute",
                top: "10px",
                left: "10px",
                zIndex: 1,
              }}
              onClick={() => setShowConfig(!showConfig)}
            >
              Configure
            </Button>

            <ZSlider>
              <Button
                type="button"
                onClick={() => handleZChange(Math.min(30, currentZ + 1))}
                disabled={currentZ >= 30}
              >
                ▲
              </Button>
              <ZLevel>Z: {currentZ}</ZLevel>
              <Button
                type="button"
                onClick={() => handleZChange(Math.max(-3, currentZ - 1))}
                disabled={currentZ <= -3}
              >
                ▼
              </Button>
            </ZSlider>
          </>
        )}

        <ResizeHandle onMouseDown={handleResizeStart} />
      </MapContainer>
    );
  };

  commands({ type }: { type: NodeType }) {
    return {
      createMap: (): Command => (state, dispatch) => {
        const { selection } = state;
        const pos =
          selection instanceof TextSelection ? selection.$to.pos : undefined;

        if (pos === undefined) {
          return false;
        }

        const node = type.create();
        const transaction = state.tr.insert(pos, node);
        dispatch?.(transaction);
        return true;
      },
    };
  }
}
