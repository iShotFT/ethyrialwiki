import * as React from "react";
import { Plugin } from "prosemirror-state";
import { Node } from "prosemirror-model";
import { NodeView } from "prosemirror-view";
import MapComponent from "../components/MapComponent";

/**
 * Creates a React-based node view using a simple DOM approach
 */
class ReactMapNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement | null = null;

  constructor(
    private node: Node,
    private view: any,
    private getPos: () => number
  ) {
    // Create the outer DOM node
    this.dom = document.createElement("div");
    this.dom.className = "ethyrial-map-node-view";

    // Render the React component
    this.renderComponent();
  }

  renderComponent() {
    // Create an instance of MapComponent
    const mapComponent = React.createElement(MapComponent, {
      node: this.node,
      isSelected: this.dom.classList.contains("ProseMirror-selectednode"),
      view: this.view,
    });

    // Use ReactDOM to render
    this.dom.innerHTML = "";
    // @ts-ignore - Using custom rendering
    window.customElements &&
      window.customElements.upgrade &&
      window.customElements.upgrade(this.dom);

    // Replace with a simple React reference to the component
    this.dom.setAttribute("data-x", String(this.node.attrs.x));
    this.dom.setAttribute("data-y", String(this.node.attrs.y));
    this.dom.setAttribute("data-z", String(this.node.attrs.z));
    this.dom.setAttribute("data-map", this.node.attrs.map);

    // Add the map directly
    const mapContainer = document.createElement("div");
    this.dom.appendChild(mapContainer);
    const map = document.createElement("div");
    map.className = "ethyrial-map";
    map.style.width = "100%";
    map.style.height = "300px";
    mapContainer.appendChild(map);

    // Add coordinates label
    const label = document.createElement("div");
    label.style.position = "absolute";
    label.style.bottom = "10px";
    label.style.left = "10px";
    label.style.zIndex = "1";
    label.style.backgroundColor = "rgba(255,255,255,0.7)";
    label.style.padding = "5px";
    label.style.borderRadius = "3px";
    label.textContent = `Map: ${this.node.attrs.map} (${this.node.attrs.x}, ${this.node.attrs.y}, ${this.node.attrs.z})`;
    mapContainer.appendChild(label);
  }

  update(node: Node) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.renderComponent();
    return true;
  }

  selectNode() {
    this.dom.classList.add("ProseMirror-selectednode");
    this.renderComponent();
  }

  deselectNode() {
    this.dom.classList.remove("ProseMirror-selectednode");
    this.renderComponent();
  }

  destroy() {
    // Nothing to clean up
  }
}

/**
 * MapPlugin provides React-based rendering of map blocks
 */
export const MapPlugin = () => {
  return new Plugin({
    props: {
      nodeViews: {
        map_block: (node, view, getPos) => {
          return new ReactMapNodeView(node, view, getPos as () => number);
        },
      },
    },
  });
};
