import passport from "@outlinewiki/koa-passport";
import { Context } from "koa";
import { InternalOAuthError } from "passport-oauth2";
import { Client } from "@shared/types";
import env from "@server/env";
import { AuthenticationError, OAuthStateMismatchError } from "@server/errors";
import Logger from "@server/logging/Logger";
import { AuthenticationResult } from "@server/types";
import { signIn } from "@server/utils/authentication";
import { parseState } from "@server/utils/passport";

interface StateInfo {
  host: string;
  client?: Client;
}

export default function createMiddleware(providerName: string) {
  return function passportMiddleware(ctx: Context) {
    // Use passport.authenticate instead of authorize for initial redirect
    // to ensure the strategy runs and sets the cookie before redirecting.
    return passport.authenticate(
      providerName,
      {
        session: false,
        // Pass options needed by the specific strategy (like scope for Discord)
        scope: providerName === 'discord' ? ["identify", "email", "guilds", "guilds.members.read"] : undefined,
        prompt: providerName === 'discord' ? "consent" : undefined, 
      },
      // This callback is typically only for the *final* verification stage,
      // not the initial redirect. We rely on the authenticate call above
      // triggering the strategy's first step which includes StateStore.store.
      // We add logging *after* the authenticate call returns to see headers.
      async (err, user, result: AuthenticationResult, stateInfo?: StateInfo) => {
        // This part handles the CALLBACK from the provider
        if (err) {
          Logger.error("Authentication Error", err, { providerName, stateInfo });
          // Redirect with error notice
          if (err.id) {
            const notice = err.id.replace(/_/g, "-");
            const redirectPath = err.redirectPath ?? "/";
            const hasQueryString = redirectPath?.includes("?");

            // Every authentication action is routed through the apex domain.
            // But when there is an error, we want to redirect the user on the
            // same domain or subdomain that they originated from (found in state).

            // Use stateInfo if available, otherwise fallback to parsing cookie again
            const state = stateInfo?.host
               ? stateInfo
               : ctx.cookies.get("state") ? parseState(ctx.cookies.get("state")!) : undefined;

            // form a URL object with the err.redirectPath and replace the host
            const reqProtocol =
              state?.client === Client.Desktop ? "outline" : ctx.protocol;

            const requestHost =
              err instanceof OAuthStateMismatchError
                  ? ctx.hostname // Cannot trust state.host if state is mismatched
                : state?.host ?? ctx.hostname;

            const url = new URL(
              env.isCloudHosted
                ? `${reqProtocol}://${requestHost}${redirectPath}`
                : `${env.URL}${redirectPath}`
            );

            return ctx.redirect(
              `${url.toString()}${hasQueryString ? "&" : "?"}notice=${notice}`
            );
          }

          if (env.isDevelopment) {
            throw err;
          }

          return ctx.redirect(`/?notice=auth-error`);
        }

        // Passport.js may invoke this callback with err=null and user=null in
        // the event that error=access_denied is received from the OAuth server.
        // I'm not sure why this exception to the rule exists, but it does:
        // https://github.com/jaredhanson/passport-oauth2/blob/e20f26aad60ed54f0e7952928cbb64979ef8da2b/lib/strategy.js#L135
        if (!user && !result?.user) {
          Logger.error(
            "No user returned during authentication",
            AuthenticationError()
          );
          return ctx.redirect(`/?notice=auth-error`);
        }

        // Handle errors from Azure which come in the format: message, Trace ID,
        // Correlation ID, Timestamp in these two query string parameters.
        const { error, error_description } = ctx.request.query;

        if (error && error_description) {
          Logger.error(
            "Error from Azure during authentication",
            new Error(String(error_description))
          );
          // Display only the descriptive message to the user, log the rest
          const description = String(error_description).split("Trace ID")[0];
          return ctx.redirect(`/?notice=auth-error&description=${description}`);
        }

        if (result.user.isSuspended) {
          return ctx.redirect("/?notice=user-suspended");
        }

        const originalHost = stateInfo?.host ?? ctx.hostname;
        await signIn(ctx, providerName, result, originalHost);

        // Log headers just before the sign-in completes the response/redirect
        if (env.DEBUG_AUTH) {
          Logger.debug("authentication", `[passportMiddleware Callback] Response headers BEFORE signIn redirect: ${JSON.stringify(ctx.response.headers)}`);
        }
      }
    // Immediately invoke the middleware function returned by passport.authenticate
    )(ctx).then(() => {
        // This block executes AFTER passport.authenticate has potentially initiated
        // the redirect TO the provider (Discord). Log headers here.
        if (ctx.status === 302) { // Check if it's a redirect response
             if (env.DEBUG_AUTH) {
               Logger.debug("authentication", `[passportMiddleware Initial Redirect] Response headers SENT for redirect TO provider: ${JSON.stringify(ctx.response.headers)}`);
             }
        }
    }).catch((err: Error) => {
        // Handle potential errors during the initial authenticate call itself
        Logger.error("Error during initial passport.authenticate call", err);
        ctx.redirect(`/?notice=auth-error`);
    });
  };
}
