import * as ol from "ol";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import { fromLonLat } from "ol/proj";
import { OSM } from "ol/source";
import { Node } from "prosemirror-model";
import { Plugin, PluginKey, PluginSpec, EditorState } from "prosemirror-state";
import { NodeViewConstructor } from "prosemirror-view";

// MapView will be a class that handles the OpenLayers map rendering
class MapView {
  dom: HTMLElement;
  contentDOM: HTMLElement | null;

  constructor(
    private node: Node,
    private view: any,
    private getPos: () => number,
    private mapOptions: any,
    private pluginKey: PluginKey<IMapPluginState>,
    private onDestroy: () => void
  ) {
    // Create the DOM structure for the map
    const mapContainer = document.createElement("div");
    mapContainer.className = "openlayers-map-container";
    mapContainer.style.width = "100%";
    mapContainer.style.height = "300px";
    mapContainer.style.backgroundColor = "#f5f5f5";
    mapContainer.style.border = "1px solid #e0e0e0";
    mapContainer.style.borderRadius = "4px";
    mapContainer.style.overflow = "hidden";
    mapContainer.style.position = "relative";

    // Add a label showing the coordinates for debugging
    const coordsLabel = document.createElement("div");
    coordsLabel.className = "openlayers-coords-label";
    coordsLabel.style.position = "absolute";
    coordsLabel.style.bottom = "5px";
    coordsLabel.style.left = "5px";
    coordsLabel.style.padding = "4px 8px";
    coordsLabel.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    coordsLabel.style.color = "white";
    coordsLabel.style.fontSize = "12px";
    coordsLabel.style.fontFamily = "monospace";
    coordsLabel.style.borderRadius = "4px";
    coordsLabel.style.zIndex = "1";
    coordsLabel.style.pointerEvents = "none";

    // Set initial text content
    coordsLabel.textContent = `Map: ${this.node.attrs.map} (${this.node.attrs.x}, ${this.node.attrs.y}, ${this.node.attrs.z})`;

    // Update label styling based on theme
    const updateLabelTheme = () => {
      const isDarkTheme =
        document.documentElement.classList.contains("dark") ||
        document.body.classList.contains("dark");

      coordsLabel.style.backgroundColor = isDarkTheme
        ? "rgba(255, 255, 255, 0.2)"
        : "rgba(0, 0, 0, 0.7)";
      coordsLabel.style.color = "white";
    };

    updateLabelTheme();

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      updateLabelTheme();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    mapContainer.appendChild(coordsLabel);

    this.dom = mapContainer;

    // Create contentDOM for handling content
    const contentDOM = document.createElement("div");
    contentDOM.style.display = "none"; // Hide the content DOM
    mapContainer.appendChild(contentDOM);
    this.contentDOM = contentDOM;

    // Initialize the map after a short delay to ensure DOM attachment
    setTimeout(() => this.initMap(), 100);

    // Prevent drag events from propagating to the editor
    mapContainer.addEventListener("mousedown", (e) => {
      e.stopPropagation();
    });
  }

  // Add map initialization
  private map: ol.Map | null = null;

  private initMap() {
    try {
      // Initialize OpenLayers map
      const { mapZoom } = this.node.attrs;

      this.map = new ol.Map({
        target: this.dom,
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
        ],
        controls: [], // Remove default controls for cleaner look
        view: new View({
          center: fromLonLat([this.node.attrs.x / 10, this.node.attrs.y / 10]),
          zoom: mapZoom || 6,
          maxZoom: 19,
          minZoom: 1,
        }),
      });

      // Force map to render properly by updating its size after initialization
      setTimeout(() => {
        if (this.map) {
          this.map.updateSize();
        }
      }, 200);

      // Add drag prevention
      const mapContainer = this.dom.querySelector(
        ".ol-viewport"
      ) as HTMLElement;
      if (mapContainer) {
        mapContainer.addEventListener("mousedown", (e) => {
          e.stopPropagation();
        });
      }

      // Add coords label
      const coordsLabel = document.createElement("div");
      coordsLabel.className = "coords-label";
      coordsLabel.style.position = "absolute";
      coordsLabel.style.bottom = "5px";
      coordsLabel.style.right = "5px";
      coordsLabel.style.backgroundColor = "rgba(255, 255, 255, 0.7)";
      coordsLabel.style.padding = "5px";
      coordsLabel.style.borderRadius = "3px";
      coordsLabel.style.fontSize = "12px";
      coordsLabel.style.pointerEvents = "none";
      coordsLabel.textContent = `${this.node.attrs.name || "Map"} (${
        this.node.attrs.x || 0
      }, ${this.node.attrs.y || 0}, ${this.node.attrs.z || 0})`;
    } catch (error) {
      // Silent error
    }
  }

  update(node: Node) {
    // Check if the node has changed in a way we care about
    if (
      node.attrs.map !== this.node.attrs.map ||
      node.attrs.x !== this.node.attrs.x ||
      node.attrs.y !== this.node.attrs.y ||
      node.attrs.z !== this.node.attrs.z
    ) {
      this.node = node;

      // Update the coordinate label
      const coordsLabel = this.dom.querySelector("div");
      if (coordsLabel) {
        coordsLabel.textContent = `Map: ${this.node.attrs.map} (${this.node.attrs.x}, ${this.node.attrs.y}, ${this.node.attrs.z})`;
      }

      // Update the map position
      this.updateMapPosition();
    }
    return true;
  }

  updateMapPosition() {
    if (!this.map) {
      return;
    }

    try {
      // Get the view and update the center
      const view = this.map.getView();
      view.setCenter(
        fromLonLat([this.node.attrs.x / 10, this.node.attrs.y / 10])
      );
      view.setZoom(6);
    } catch (error) {
      // Silent error
    }
  }

  destroy() {
    // Clean up any OpenLayers resources
    if (this.map) {
      this.map.setTarget(undefined);
      this.map = null;
    }

    if (this.onDestroy) {
      this.onDestroy();
    }
  }

  selectNode() {
    this.dom.classList.add("ProseMirror-selectednode");
  }

  deselectNode() {
    this.dom.classList.remove("ProseMirror-selectednode");
  }

  onChange = (_state: EditorState) => {
    try {
      // ... existing code ...
    } catch (error) {
      // Silent error
    }
  };
}

export interface IMapPluginState {
  activeMapViews: MapView[];
}

const MAP_PLUGIN_KEY = new PluginKey<IMapPluginState>("ethyrial-map");

export function createMapView(): NodeViewConstructor {
  return (node, view, getPos) => {
    // Load OpenLayers CSS
    if (!document.querySelector('link[href*="ol.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/ol@v7.4.0/ol.css";
      document.head.appendChild(link);
    }

    const pluginState = MAP_PLUGIN_KEY.getState(view.state);
    if (!pluginState) {
      return {
        dom: document.createElement("div"),
        contentDOM: null,
        update: () => true,
        destroy: () => {},
      };
    }

    const mapViews = pluginState.activeMapViews;

    // Set up NodeView
    const nodeView = new MapView(
      node,
      view,
      getPos as () => number,
      {
        // Map options could go here
      },
      MAP_PLUGIN_KEY,
      () => {
        // Remove this view from the plugin state when destroyed
        const index = mapViews.indexOf(nodeView);
        if (index > -1) {
          mapViews.splice(index, 1);
        }
      }
    );

    mapViews.push(nodeView);

    return nodeView;
  };
}

const mapPluginSpec: PluginSpec<IMapPluginState> = {
  key: MAP_PLUGIN_KEY,
  state: {
    init() {
      return {
        activeMapViews: [],
      };
    },
    apply(tr, value) {
      return {
        activeMapViews: value.activeMapViews,
      };
    },
  },
  props: {
    nodeViews: {
      map_block: createMapView(),
    },
  },
};

export default new Plugin(mapPluginSpec);
