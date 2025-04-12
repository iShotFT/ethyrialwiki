import { Node } from "prosemirror-model";
import { Plugin } from "prosemirror-state";
import { EditorView, NodeView } from "prosemirror-view";
import * as React from "react";
import { createPortal } from "react-dom";
import MapComponent from "./MapComponent";

// Map of node types to React components
const nodeComponents: Record<string, React.ComponentType<any>> = {
  map_block: MapComponent,
};

/**
 * ReactNodeView bridges ProseMirror's NodeView with React components
 */
export class ReactNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement | null = null;
  node: Node;
  view: EditorView;
  getPos: () => number;
  private component: React.ReactPortal | null = null;
  private mountPoint: HTMLElement;
  private renderCallback: () => void;

  constructor(
    node: Node,
    view: EditorView,
    getPos: () => number,
    renderCallback: () => void
  ) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.renderCallback = renderCallback;

    // Create container DOM
    this.dom = document.createElement("div");
    this.dom.className = `react-node-view ${node.type.name}`;

    // Create mount point
    this.mountPoint = document.createElement("div");
    this.dom.appendChild(this.mountPoint);

    this.renderReactComponent(false);
  }

  renderReactComponent(isSelected: boolean = false) {
    const Component = nodeComponents[this.node.type.name];

    if (!Component) {
      console.warn(
        `No React component found for node type: ${this.node.type.name}`
      );
      return;
    }

    this.component = createPortal(
      <Component
        node={this.node}
        isSelected={isSelected}
        view={this.view}
        getPos={this.getPos}
      />,
      this.mountPoint
    );

    this.renderCallback();
  }

  update(node: Node) {
    if (node.type !== this.node.type) {
      return false;
    }

    this.node = node;
    this.renderReactComponent();
    return true;
  }

  selectNode() {
    this.dom.classList.add("ProseMirror-selectednode");
    this.renderReactComponent(true);
  }

  deselectNode() {
    this.dom.classList.remove("ProseMirror-selectednode");
    this.renderReactComponent(false);
  }

  destroy() {
    // No need to clean up createPortal as it will be removed from the DOM
    this.component = null;
  }
}

/**
 * Creates a plugin that provides React nodeViews for ProseMirror
 */
export function reactNodeViewPlugin(renderCallback: () => void): Plugin {
  return new Plugin({
    props: {
      nodeViews: {
        map_block: (node, view, getPos) =>
          new ReactNodeView(node, view, getPos as () => number, renderCallback),
      },
    },
  });
}
