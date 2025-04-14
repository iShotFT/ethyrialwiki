import crypto from "crypto";
import { addMinutes, subMinutes } from "date-fns";
import type { Context } from "koa";
import {
  StateStoreStoreCallback,
  StateStoreVerifyCallback,
} from "passport-oauth2";
import { Client } from "@shared/types";
import { getCookieDomain, parseDomain } from "@shared/utils/domains";
import env from "@server/env";
import { Team } from "@server/models";
import { InternalError, OAuthStateMismatchError } from "../errors";
import fetch from "./fetch";
import Logger from "@server/logging/Logger";
import { serialize } from "cookie";

export class StateStore {
  key = "state";

  store = (ctx: Context, callback: StateStoreStoreCallback) => {
    const token = crypto.randomBytes(8).toString("hex");
    const clientInput = ctx.query.client?.toString();
    const client = clientInput === Client.Desktop ? Client.Desktop : Client.Web;

    // *** Force use of PUBLIC_URL for host/domain determination ***
    let hostForState: string;
    // let cookieDomain: string; // <-- We'll determine this specifically for the state cookie
    try {
      const publicUrl = new URL(env.PUBLIC_URL);
      hostForState = publicUrl.hostname; // e.g., "app.local.test"
      // cookieDomain = getCookieDomain(hostForState, env.isCloudHosted); // Don't use parent domain for state cookie
    } catch (e) {
      Logger.error("Failed to parse PUBLIC_URL, falling back to ctx.hostname", e, { PUBLIC_URL: env.PUBLIC_URL });
      // Fallback (might still be wrong, but prevents crash)
      hostForState = ctx.hostname.split(':')[0]; 
      // cookieDomain = getCookieDomain(ctx.hostname, env.isCloudHosted);
    }

    // *** Use the specific hostname for the state cookie's domain ***
    const stateCookieDomain = hostForState; 

    const state = buildState(hostForState, token, client);
    const expires = addMinutes(new Date(), 10);

    if (env.DEBUG_AUTH) {
      Logger.debug("authentication", `[StateStore.store] Checking getCookieDomain condition...`); // Simplified this log
      Logger.debug("authentication", `[StateStore.store] Using Host for state (from PUBLIC_URL): [${hostForState}]`);
      Logger.debug("authentication", `[StateStore.store] Calculated Cookie Domain (Specific for state): [${stateCookieDomain}]`);
      Logger.debug("authentication", `[StateStore.store] Setting 'state' cookie with state: [${state}]`);
    }

    // *** Manually construct and append Set-Cookie header ***
    const cookieString = serialize(this.key, state, {
      domain: stateCookieDomain,
      path: "/",
      expires: expires,
      httpOnly: false, // State cookie needs to be readable by JS potentially? Check usage.
      sameSite: "lax",
      secure: ctx.protocol === "https"
    });
    if (env.DEBUG_AUTH) {
      Logger.debug("authentication", `[StateStore.store] Manually Appended Set-Cookie header: [${cookieString}]`);
    }
    ctx.response.append('Set-Cookie', cookieString);
    // ******************************************************

    // Original ctx.cookies.set (keep for reference, but header above should take precedence)
    /*
    ctx.cookies.set(this.key, state, {\n      expires: expires,\n      domain: stateCookieDomain, \n      sameSite: \"lax\", \n      httpOnly: false, \n      secure: ctx.protocol === \"https\",\n      path: \"/\" \n    });
    */
  
    // *** Add extra check log ***
    const isDev = env.isDevelopment;
    const endsWith = hostForState.endsWith(".local.test");
    Logger.debug("authentication", `[StateStore.store] Checking getCookieDomain condition: isDev=${isDev}, endsWith=${endsWith}, hostForState=[${hostForState}]`);
    // ***************************

    Logger.debug("authentication", `[StateStore.store] Using Host for state (from PUBLIC_URL): [${hostForState}]`);
    Logger.debug("authentication", `[StateStore.store] Calculated Cookie Domain (Specific for state): [${stateCookieDomain}]`);
    Logger.debug("authentication", `[StateStore.store] Manually Appended Set-Cookie header: [${cookieString}]`);
    Logger.debug("authentication", `[StateStore.store] Setting 'state' cookie with state: [${state}]`);

    callback(null, token);
  };

  verify = (
    ctx: Context,
    providedToken: string,
    callback: StateStoreVerifyCallback
  ) => {
    // *** DEVELOPMENT ONLY: Bypass state check ***
    if (env.isDevelopment && env.DEBUG_AUTH) { // Log only if DEBUG_AUTH is also true
      Logger.warn("[StateStore.verify] DEVELOPMENT MODE: Bypassing state verification.");
    }
    if (env.isDevelopment) { // Keep bypass logic but don't log unless DEBUG_AUTH
      const bypassState = buildState(env.PUBLIC_URL.split('//')[1]?.split(':')[0] || 'localhost', providedToken, Client.Web); // Construct a plausible state
      const { host: hostFromState, client: clientFromState } = parseState(bypassState);
      // @ts-expect-error Type in library is wrong, and we are adding extra args
      return callback(null, true, bypassState, { host: hostFromState, client: clientFromState });
    }
    // *** END DEVELOPMENT ONLY BYPASS ***

    const stateFromCookie = ctx.cookies.get(this.key);
    
    // *** Use specific hostname for verifying/deleting state cookie domain ***
    const originalHost = ctx.get('X-Forwarded-Host') || ctx.get('Host') || ctx.hostname;
    const stateCookieDomain = originalHost.split(':')[0]; // Get hostname without port

    if (env.DEBUG_AUTH) {
      Logger.debug("authentication", `[StateStore.verify] Verifying on host [${originalHost}] (using specific domain for state cookie: [${stateCookieDomain}])`);
      Logger.debug("authentication", `[StateStore.verify]   State from Cookie: [${stateFromCookie}]`);
      Logger.debug("authentication", `[StateStore.verify]   Token from URL:    [${providedToken}]`);
    }

    if (!stateFromCookie) {
      if (env.DEBUG_AUTH) Logger.warn("[StateStore.verify] State cookie not found.");
      return callback(
        OAuthStateMismatchError("State not return in OAuth flow"),
        false,
        stateFromCookie
      );
    }

    const { token: tokenFromCookie, host: hostFromState, client: clientFromState } = parseState(stateFromCookie);
    if (env.DEBUG_AUTH) Logger.debug("authentication", `[StateStore.verify]   Token from Cookie: [${tokenFromCookie}]`);

    // Destroy the one-time pad token using the specific domain and path
    ctx.cookies.set(this.key, "", {
      expires: subMinutes(new Date(), 1),
      domain: stateCookieDomain, // Use specific domain for deletion
      path: "/" // Match path for deletion
    });

    if (!tokenFromCookie || tokenFromCookie !== providedToken) {
      if (env.DEBUG_AUTH) Logger.warn("[StateStore.verify] Token mismatch or missing.");
      return callback(OAuthStateMismatchError(), false, stateFromCookie);
    }

    if (env.DEBUG_AUTH) Logger.debug("authentication", "[StateStore.verify] State verification successful.");
    // Pass back the original host and client from the state
    // @ts-expect-error Type in library is wrong, and we are adding extra args
    callback(null, true, stateFromCookie, { host: hostFromState, client: clientFromState });
  };
}

export async function request(
  method: "GET" | "POST",
  endpoint: string,
  accessToken: string
) {
  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch (err) {
    throw InternalError(
      `Failed to parse response from ${endpoint}. Expected JSON, got: ${text}`
    );
  }
}

function buildState(host: string, token: string, client?: Client) {
  return [host, token, client].join("|");
}

export function parseState(state: string) {
  const [host, token, client] = state.split("|");
  return { host, token, client };
}

export function getClientFromContext(ctx: Context): Client {
  const state = ctx.cookies.get("state");
  const client = state ? parseState(state).client : undefined;
  return client === Client.Desktop ? Client.Desktop : Client.Web;
}

export async function getTeamFromContext(ctx: Context) {
  // "domain" is the domain the user came from when attempting auth
  // we use it to infer the team they intend on signing into
  const state = ctx.cookies.get("state");
  const host = state ? parseState(state).host : ctx.hostname;
  const domain = parseDomain(host);

  let team;
  if (!env.isCloudHosted) {
    if (env.ENVIRONMENT === "test") {
      team = await Team.findOne({ where: { domain: env.URL } });
    } else {
      team = await Team.findOne({
        order: [["createdAt", "DESC"]],
      });
    }
  } else if (ctx.state?.rootShare) {
    team = await Team.findByPk(ctx.state.rootShare.teamId);
  } else if (domain.custom) {
    team = await Team.findOne({ where: { domain: domain.host } });
  } else if (domain.teamSubdomain) {
    team = await Team.findBySubdomain(domain.teamSubdomain);
  }

  return team;
}
