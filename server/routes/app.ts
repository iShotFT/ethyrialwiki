import fs from "fs";
import path from "path";
import util from "util";
import { Context, Next } from "koa";
import escape from "lodash/escape";
import { Sequelize } from "sequelize";
import isUUID from "validator/lib/isUUID";
import { IntegrationType, TeamPreference } from "@shared/types";
import { unicodeCLDRtoISO639 } from "@shared/utils/date";
import documentLoader from "@server/commands/documentLoader";
import env from "@server/env";
import Logger from "@server/logging/Logger";
import { Integration, User } from "@server/models";
import presentEnv from "@server/presenters/env";
import { getTeamFromContext } from "@server/utils/passport";
import prefetchTags from "@server/utils/prefetchTags";
import readManifestFile from "@server/utils/readManifestFile";

const readFile = util.promisify(fs.readFile);
const entry = "app/index.tsx";
const viteHost = env.URL.replace(new RegExp(`:\\d+`), ":4001");

let indexHtmlCache: Buffer | undefined;

const readIndexFile = async (): Promise<Buffer> => {
  if (env.isProduction || env.isTest) {
    if (indexHtmlCache) {
      return indexHtmlCache;
    }
  }

  if (env.isTest) {
    return await readFile(path.join(__dirname, "../static/index.html"));
  }

  if (env.isDevelopment) {
    return await readFile(
      path.join(__dirname, "../../../server/static/index.html")
    );
  }

  return (indexHtmlCache = await readFile(
    path.join(__dirname, "../../app/index.html")
  ));
};

export const renderApp = async (
  ctx: Context,
  next: Next,
  options: {
    title?: string;
    description?: string;
    canonical?: string;
    shortcutIcon?: string;
    rootShareId?: string;
    isShare?: boolean;
    analytics?: Integration<IntegrationType.Analytics>[];
    allowIndexing?: boolean;
  } = {}
) => {
  const {
    title = env.APP_NAME,
    description = "A modern team knowledge base for your internal documentation, product specs, support answers, meeting notes, onboarding, &amp; more…",
    canonical = "",
    shortcutIcon = `${env.CDN_URL || ""}/images/favicon-32.png`,
    allowIndexing = true,
  } = options;

  if (ctx.request.path === "/realtime/") {
    return next();
  }

  if (!env.isCloudHosted) {
    options.analytics?.forEach((integration) => {
      if (integration.settings?.instanceUrl) {
        const parsed = new URL(integration.settings?.instanceUrl);
        const csp = ctx.response.get("Content-Security-Policy");
        ctx.set(
          "Content-Security-Policy",
          csp.replace("script-src", `script-src ${parsed.host}`)
        );
      }
    });
  }

  const { shareId } = ctx.params;
  const page = await readIndexFile();
  const environment = `
    <script nonce="${ctx.state.cspNonce}">
      window.env = ${JSON.stringify(presentEnv(env, options)).replace(
        /</g,
        "\\u003c"
      )};
    </script>
  `;

  const noIndexTag = allowIndexing
    ? ""
    : '<meta name="robots" content="noindex, nofollow">';

  const scriptTags = env.isProduction
    ? `<script type="module" nonce="${ctx.state.cspNonce}" src="${
        env.CDN_URL || ""
      }/static/${readManifestFile()[entry]["file"]}"></script>`
    : `<script type="module" nonce="${ctx.state.cspNonce}">
        import RefreshRuntime from "${viteHost}/static/@react-refresh"
        RefreshRuntime.injectIntoGlobalHook(window)
        window.$RefreshReg$ = () => { }
        window.$RefreshSig$ = () => (type) => type
        window.__vite_plugin_react_preamble_installed__ = true
      </script>
      <script type="module" nonce="${ctx.state.cspNonce}" src="${viteHost}/static/@vite/client"></script>
      <script type="module" nonce="${ctx.state.cspNonce}" src="${viteHost}/static/${entry}"></script>
    `;

  // Ensure no caching is performed
  ctx.response.set("Cache-Control", "no-cache, must-revalidate");
  ctx.response.set("Expires", "-1");

  ctx.body = page
    .toString()
    .replace(/\{env\}/g, environment)
    .replace(/\{lang\}/g, unicodeCLDRtoISO639(env.DEFAULT_LANGUAGE))
    .replace(/\{title\}/g, escape(title))
    .replace(/\{description\}/g, escape(description))
    .replace(/\{noindex\}/g, noIndexTag)
    .replace(
      /\{manifest-url\}/g,
      options.isShare ? "" : "/static/manifest.webmanifest"
    )
    .replace(/\{canonical-url\}/g, canonical)
    .replace(/\{shortcut-icon-url\}/g, shortcutIcon)
    .replace(/\{cdn-url\}/g, env.CDN_URL || "")
    .replace(/\{prefetch\}/g, shareId ? "" : prefetchTags)
    .replace(/\{slack-app-id\}/g, env.public.SLACK_APP_ID || "")
    .replace(/\{script-tags\}/g, scriptTags)
    .replace(/\{csp-nonce\}/g, ctx.state.cspNonce);
};

export const renderShare = async (ctx: Context, next: Next) => {
  const rootShareId = ctx.state?.rootShare?.id;
  const shareId = rootShareId ?? ctx.params.shareId;
  const documentSlug = ctx.params.documentSlug;

  // Find the share record if publicly published so that the document title
  // can be returned in the server-rendered HTML. This allows it to appear in
  // unfurls with more reliability
  let share, document, team;
  let analytics: Integration<IntegrationType.Analytics>[] = [];

  try {
    team = await getTeamFromContext(ctx);
    const result = await documentLoader({
      id: documentSlug,
      shareId,
      teamId: team?.id,
    });
    share = result.share;
    if (isUUID(shareId) && share?.urlId) {
      // Redirect temporarily because the url slug
      // can be modified by the user at any time
      ctx.redirect(share.canonicalUrl);
      ctx.status = 307;
      return;
    }
    document = result.document;

    analytics = await Integration.findAll({
      where: {
        teamId: document.teamId,
        type: IntegrationType.Analytics,
      },
    });

    if (share && !ctx.userAgent.isBot) {
      await share.update(
        {
          lastAccessedAt: new Date(),
          views: Sequelize.literal("views + 1"),
        },
        {
          hooks: false,
        }
      );
    }
  } catch (err) {
    // If the share or document does not exist, return a 404.
    ctx.status = 404;
  }

  // Allow shares to be embedded in iframes on other websites
  ctx.remove("X-Frame-Options");

  // Inject share information in SSR HTML
  return renderApp(ctx, next, {
    title: document?.title,
    description: document?.getSummary(),
    shortcutIcon:
      team?.getPreference(TeamPreference.PublicBranding) && team.avatarUrl
        ? team.avatarUrl
        : undefined,
    analytics,
    isShare: true,
    rootShareId,
    canonical: share
      ? `${share.canonicalUrl}${documentSlug && document ? document.url : ""}`
      : undefined,
    allowIndexing: share?.allowIndexing,
  });
};

export const renderMap = async (
  ctx: Context,
  next: Next,
  options: {
    // Define any specific options needed for the map later
  } = {}
) => {
  const title = "Ethyrial Map";
  const description = "Interactive map for Ethyrial: Echoes of Yore";
  const canonical = ctx.href; // Or customize if needed
  const shortcutIcon = `${env.CDN_URL || ""}/images/favicon-32.png`; // Use default
  const mapEntry = "app/mapIndex.tsx"; // Our new entry point

  const page = await readFile(
    path.resolve(__dirname, "../../../public/map.html")
  );

  // Prepare environment variables for the map page
  // Include user info directly in the env object

  // *** Add specific logging for ctx.state.auth and ctx.state.user ***
  if (env.DEBUG_AUTH) {
    Logger.debug(
      "authentication",
      `[renderMap] ctx.state.auth value: ${JSON.stringify(ctx.state.auth)}`
    );
  }
  const user = ctx.state.auth?.user as User | null; // Use optional chaining
  if (env.DEBUG_AUTH) {
    Logger.debug(
      "authentication",
      `[renderMap] Extracted user value: ${user ? user.id : "null"}`
    );
  }
  // ***************************************************************

  const baseEnv = presentEnv(env, {});
  const mapEnv = {
    ...baseEnv,
    currentUser: user
      ? { id: user.id, name: user.name, email: user.email, teamId: user.teamId }
      : null,
    // Inject the handlerConfig determined by the middleware
    handlerConfig: ctx.state.domainConfig?.config ?? null,
  };

  const environmentScript = `
    <script nonce="${ctx.state.cspNonce}">
      window.env = ${JSON.stringify(mapEnv).replace(/</g, "\\u003c")};
    </script>
  `;

  const scriptTags = env.isProduction
    ? `<script type="module" nonce="${ctx.state.cspNonce}" src="${
        env.CDN_URL || ""
      }/static/${readManifestFile()[mapEntry]["file"]}"></script>` // Adjust if manifest structure differs
    : `<script type="module" nonce="${ctx.state.cspNonce}">
        import RefreshRuntime from "${viteHost}/static/@react-refresh"
        RefreshRuntime.injectIntoGlobalHook(window)
        window.$RefreshReg$ = () => { }
        window.$RefreshSig$ = () => (type) => type
        window.__vite_plugin_react_preamble_installed__ = true
      </script>
      <script type="module" nonce="${ctx.state.cspNonce}" src="${viteHost}/static/@vite/client"></script>
      <script type="module" nonce="${ctx.state.cspNonce}" src="${viteHost}/static/${mapEntry}"></script>
    `;

  // Ensure no caching is performed
  ctx.response.set("Cache-Control", "no-cache, must-revalidate");
  ctx.response.set("Expires", "-1");

  // Replace placeholders in the map template
  ctx.body = page
    .toString()
    .replace(/\{env\}/g, environmentScript)
    .replace(/\{lang\}/g, unicodeCLDRtoISO639(env.DEFAULT_LANGUAGE))
    .replace(/\{title\}/g, escape(title))
    .replace(/\{description\}/g, escape(description))
    .replace(/\{manifest-url\}/g, "") // No manifest for map page
    .replace(/\{canonical-url\}/g, canonical)
    .replace(/\{shortcut-icon-url\}/g, shortcutIcon)
    .replace(/\{cdn-url\}/g, env.CDN_URL || "")
    .replace(/\{prefetch\}/g, "") // No prefetch for map page
    .replace(/\{slack-app-id\}/g, "") // No slack app id for map page
    .replace(/\{script-tags\}/g, scriptTags)
    .replace(/\{csp-nonce\}/g, ctx.state.cspNonce);
};
