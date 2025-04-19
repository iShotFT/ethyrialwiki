import passport from "@outlinewiki/koa-passport";
import { Strategy as SteamStrategy } from "passport-steam";
import type { Context } from "koa";
import Router from "koa-router";
import { slugifyDomain } from "@shared/utils/domains";
import accountProvisioner from "@server/commands/accountProvisioner";
import serverEnv from "@server/env";
import { AuthenticationError } from "@server/errors";
import passportMiddleware from "@server/middlewares/passport";
import { User } from "@server/models";
import { AuthenticationResult } from "@server/types";
import {
  getTeamFromContext,
  getClientFromContext,
} from "@server/utils/passport";
import config from "../../plugin.json";
import env from "../env";

const router = new Router();

// Use hardcoded URLs for local development to match the actual app URL
const APP_URL = process.env.NODE_ENV === "development" 
  ? "http://app.local.test:8080"
  : serverEnv.PUBLIC_URL;

// Steam authentication implementation
passport.use(
  config.id,
  new SteamStrategy(
    {
      returnURL: `${APP_URL}/auth/${config.id}.callback`,
      realm: APP_URL,
      apiKey: env.STEAM_API_KEY || "", // API key is optional but recommended
      passReqToCallback: true, // Pass request to callback
    },
    async function (
      req: any,
      identifier: string,
      profile: any,
      done: (
        err: Error | null,
        user: User | null,
        result?: AuthenticationResult
      ) => void
    ) {
      try {
        const ctx = req;
        const team = await getTeamFromContext(ctx);
        const client = getClientFromContext(ctx);

        // Extract Steam ID from profile
        const steamId = profile.id;
        
        if (!steamId) {
          throw AuthenticationError("Unable to extract Steam ID from profile");
        }

        // Set defaults for user data
        let userName = profile.displayName || `Steam User ${steamId.substring(0, 6)}`;
        let userAvatarUrl = profile.photos?.[2]?.value || null; // Use large avatar if available
        
        // Steam doesn't provide email, so we'll use the Steam ID as a pseudo-email
        const email = `${steamId}@steam.id`;
        const domain = "steam.id";
        const subdomain = slugifyDomain("steam");
        
        // Use the same accountProvisioner pattern as other auth providers
        const result = await accountProvisioner({
          ip: ctx.ip,
          team: {
            teamId: team?.id,
            name: "Steam Users",
            domain,
            subdomain,
          },
          user: {
            name: userName,
            email,
            avatarUrl: userAvatarUrl,
          },
          authenticationProvider: {
            name: config.id,
            providerId: "steam",
          },
          authentication: {
            providerId: steamId,
            accessToken: steamId, // Using Steam ID as access token
            refreshToken: "",
            scopes: [],
          },
        });
        
        return done(null, result.user, { ...result, client });
      } catch (err) {
        console.error("Steam authentication error:", err);
        return done(err instanceof Error ? err : new Error(String(err)), null);
      }
    }
  )
);

// Routes for authentication
router.get(config.id, passport.authenticate(config.id));
router.get(`${config.id}.callback`, passportMiddleware(config.id));

export default router; 