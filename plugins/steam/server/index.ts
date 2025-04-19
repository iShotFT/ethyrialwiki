import { PluginManager, Hook } from "@server/utils/PluginManager";
import config from "../plugin.json";
import router from "./auth/steam";
import env from "./env";

// Steam OpenID authentication doesn't require API keys, but we'll still check for the
// optional Steam API key to determine if extra profile data should be fetched
const enabled = true;

if (enabled) {
  PluginManager.add({
    ...config,
    type: Hook.AuthProvider,
    value: { router, id: config.id },
  });
} 