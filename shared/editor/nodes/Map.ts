import { NodeSpec } from "prosemirror-model";
import { Plugin } from "prosemirror-state";
import MapBlock from "./MapBlock";

export default class Map extends MapBlock {
  get name() {
    return "map";
  }

  get schema(): NodeSpec {
    return {
      inline: true,
      atom: true,
      attrs: {
        x: { default: 0 },
        y: { default: 0 },
        z: { default: 0 },
        map: { default: "irumesa" },
      },
      parseDOM: [
        {
          tag: "span.map",
          getAttrs: (dom: HTMLElement) => ({
            x: parseInt(dom.getAttribute("data-x") || "0", 10),
            y: parseInt(dom.getAttribute("data-y") || "0", 10),
            z: parseInt(dom.getAttribute("data-z") || "0", 10),
            map: dom.getAttribute("data-map") || "irumesa",
          }),
        },
      ],
      toDOM: (node) => [
        "span",
        {
          class: "map",
          "data-x": node.attrs.x,
          "data-y": node.attrs.y,
          "data-z": node.attrs.z,
          "data-map": node.attrs.map,
        },
      ],
    };
  }

  toMarkdown(state: any, node: any) {
    state.write(
      `[map:${node.attrs.map}:${node.attrs.x},${node.attrs.y},${node.attrs.z}]`
    );
  }

  parseMarkdown() {
    return {
      node: "map",
      block: "map",
      getAttrs: (token: any) => {
        // Parse attributes from markdown content
        // Expected format: [map:mapname:x,y,z]
        const attrs: Record<string, any> = {
          x: 0,
          y: 0,
          z: 0,
          map: "irumesa",
        };

        if (token.content) {
          const match = token.content.match(
            /\[map:([^:]+):(\d+),(\d+),(\d+)\]/
          );
          if (match) {
            attrs.map = match[1];
            attrs.x = parseInt(match[2], 10);
            attrs.y = parseInt(match[3], 10);
            attrs.z = parseInt(match[4], 10);
          }
        }

        return attrs;
      },
    };
  }

  get plugins(): Plugin[] {
    return [];
  }
}
