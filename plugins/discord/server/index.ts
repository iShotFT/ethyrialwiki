import { PluginManager, Hook } from "@server/utils/PluginManager";
import config from "../plugin.json";
import router from "./auth/discord";
import env from "./env";

// Re-adding debug logs
// console.log("### Discord Plugin Index Loading ###");
// console.log(`- Discord Env ID: [${env.DISCORD_CLIENT_ID}]`);
// console.log(`- Discord Env Secret: [${env.DISCORD_CLIENT_SECRET}]`);

const enabled = !!env.DISCORD_CLIENT_ID && !!env.DISCORD_CLIENT_SECRET;

// console.log(`- Discord Plugin Enabled Check: ${enabled}`);
// console.log("####################################");

if (enabled) {
  PluginManager.add({
    ...config,
    type: Hook.AuthProvider,
    value: { router, id: config.id },
  });
}
