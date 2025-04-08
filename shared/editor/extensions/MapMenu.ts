import { EditorState } from "prosemirror-state";
import Extension from "../lib/Extension";
import { MenuItem } from "../types";

export default class MapMenu extends Extension {
  get name() {
    return "map_menu";
  }

  get type() {
    return "extension";
  }

  menuItems(): MenuItem[] {
    return [
      {
        name: "map",
        title: "Insert Map",
        icon: "🗺️",
        keywords: "map location geography",
        attrs: () => ({}),
        active: (state: EditorState) => {
          const { schema } = state;
          return !!schema.nodes.map;
        },
      },
    ];
  }
}
