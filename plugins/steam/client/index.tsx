import { Hook, PluginManager } from "~/utils/PluginManager";
import config from "../plugin.json";
import Icon from "./Icon";

// Register the Steam icon for use in the UI
PluginManager.add([
  {
    ...config,
    type: Hook.Icon,
    value: Icon,
  },
]); 