import { PluginSimple } from "markdown-it";
import { NodeSpec, NodeType, Node as ProsemirrorNode } from "prosemirror-model";
import { Command, TextSelection } from "prosemirror-state";
import * as React from "react";
import { MarkdownSerializerState } from "../lib/markdown/serializer";
import { ComponentProps } from "../types";
import ReactNode from "./ReactNode";

// Inline implementation of mapRule to avoid import issues
const mapRule: PluginSimple = (md) => {
  md.block.ruler.after(
    "blockquote",
    "map_block",
    (state, start, end, silent) => {
      let firstLine,
        lastLine,
        next,
        lastPos,
        found = false,
        pos = state.bMarks[start] + state.tShift[start],
        max = state.eMarks[start];

      if (pos + 6 > max) {
        return false;
      }

      if (state.src.slice(pos, pos + 6) !== "```map") {
        return false;
      }

      pos += 6;
      firstLine = state.src.slice(pos, max);

      if (silent) {
        return true;
      }

      if (firstLine.trim().slice(-3) === "```") {
        // Single line expression
        firstLine = firstLine.trim().slice(0, -3);
        found = true;
      }

      for (next = start; !found; ) {
        next++;

        if (next >= end) {
          break;
        }

        pos = state.bMarks[next] + state.tShift[next];
        max = state.eMarks[next];

        if (pos < max && state.tShift[next] < state.blkIndent) {
          // non-empty line with negative indent should stop the list:
          break;
        }

        if (state.src.slice(pos, max).trim().slice(-3) === "```") {
          lastPos = state.src.slice(0, max).lastIndexOf("```");
          lastLine = state.src.slice(pos, lastPos);
          found = true;
        }
      }

      state.line = next + 1;

      const token = state.push("map_block", "map", 0);
      token.block = true;
      token.content =
        (firstLine && firstLine.trim() ? firstLine + "\n" : "") +
        state.getLines(start + 1, next, state.tShift[start], true) +
        (lastLine && lastLine.trim() ? lastLine : "");
      token.map = [start, state.line];
      token.markup = "```map";

      return true;
    },
    {
      alt: ["paragraph", "reference", "blockquote", "list"],
    }
  );
};

export default class MapBlock extends ReactNode {
  get name() {
    return "map_block";
  }

  get schema(): NodeSpec {
    return {
      attrs: {
        x: { default: 0 },
        y: { default: 0 },
        z: { default: 0 },
        map: { default: "irumesa" },
      },
      content: "text*",
      group: "block",
      isolating: true,
      draggable: true,
      parseDOM: [
        {
          tag: "div.map-block",
          getAttrs: (dom: HTMLElement) => ({
            x: parseInt(dom.getAttribute("data-x") || "0", 10),
            y: parseInt(dom.getAttribute("data-y") || "0", 10),
            z: parseInt(dom.getAttribute("data-z") || "0", 10),
            map: dom.getAttribute("data-map") || "irumesa",
          }),
        },
      ],
      toDOM: (node) => [
        "div",
        {
          class: "map-block",
          "data-x": node.attrs.x,
          "data-y": node.attrs.y,
          "data-z": node.attrs.z,
          "data-map": node.attrs.map,
        },
        0,
      ],
    };
  }

  get rulePlugins(): PluginSimple[] {
    return [mapRule];
  }

  component({ node, isSelected, isEditable }: ComponentProps) {
    // Create a placeholder element that will be replaced by the MapNodeView
    // The real implementation will be loaded from the app layer
    // This is a technique to allow rendering React components in the editor
    return React.createElement(
      "div",
      {
        className: "map-block-placeholder",
        "data-x": node.attrs.x,
        "data-y": node.attrs.y,
        "data-z": node.attrs.z,
        "data-map": node.attrs.map,
        "data-selected": isSelected,
        "data-editable": isEditable,
        style: {
          border: "3px solid red",
          padding: "10px",
          margin: "10px 0",
          position: "relative",
          minHeight: "100px",
        },
      },
      // Add a debug text element as a child
      React.createElement(
        "div",
        {
          style: {
            color: "red",
            fontWeight: "bold",
            padding: "5px",
            backgroundColor: "rgba(255,255,255,0.8)",
          },
        },
        `DEBUG: Map Placeholder (${node.attrs.x}, ${node.attrs.y}, ${node.attrs.z}) - Map: ${node.attrs.map}`
      )
    );
  }

  commands({ type }: { type: NodeType }) {
    return (): Command => (state, dispatch) => {
      console.log("MapBlock command called", { type, state });

      const tr = state.tr.replaceSelectionWith(
        type.create({
          x: 0,
          y: 0,
          z: 0,
          map: "irumesa",
        })
      );

      console.log("MapBlock node created with attributes", {
        x: 0,
        y: 0,
        z: 0,
        map: "irumesa",
      });

      dispatch?.(
        tr
          .setSelection(
            TextSelection.near(tr.doc.resolve(state.selection.from - 1))
          )
          .scrollIntoView()
      );

      console.log("MapBlock transaction dispatched");
      return true;
    };
  }

  toMarkdown(state: MarkdownSerializerState, node: ProsemirrorNode) {
    state.write("```map\n");
    state.write(
      `x=${node.attrs.x} y=${node.attrs.y} z=${node.attrs.z} map=${node.attrs.map}\n`
    );
    state.write("```");
    state.closeBlock(node);
  }

  parseMarkdown() {
    return {
      node: "map_block",
      block: "map_block",
      getAttrs: (token: any) => {
        // Parse attributes from markdown content
        // Expected format: x=0 y=0 z=0 map=irumesa
        const attrs: Record<string, any> = {
          x: 0,
          y: 0,
          z: 0,
          map: "irumesa",
        };

        if (token.content) {
          const parts = token.content.split(" ");
          parts.forEach((part: string) => {
            const [key, value] = part.split("=");
            if (key && value) {
              if (key === "map") {
                attrs[key] = value;
              } else {
                attrs[key] = parseInt(value, 10);
              }
            }
          });
        }

        return attrs;
      },
    };
  }
}
