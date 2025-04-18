import passport from "@outlinewiki/koa-passport";
import { isURL } from "class-validator";
import type {
  RESTGetAPICurrentUserGuildsResult,
  RESTGetAPICurrentUserResult,
  RESTGetCurrentUserGuildMemberResult,
} from "discord-api-types/v10";
import type { Context } from "koa";
import Router from "koa-router";

import { Strategy } from "passport-oauth2";
import { languages } from "@shared/i18n";
import { slugifyDomain } from "@shared/utils/domains";
import { parseEmail } from "@shared/utils/email";
import slugify from "@shared/utils/slugify";
import accountProvisioner from "@server/commands/accountProvisioner";
import serverEnv from "@server/env";
import { InvalidRequestError, TeamDomainRequiredError } from "@server/errors";
import passportMiddleware from "@server/middlewares/passport";
import { User } from "@server/models";
import { AuthenticationResult } from "@server/types";
import {
  StateStore,
  getTeamFromContext,
  getClientFromContext,
  request,
} from "@server/utils/passport";
import config from "../../plugin.json";
import pluginEnv from "../env";
import { DiscordGuildError, DiscordGuildRoleError } from "../errors";

const router = new Router();

const scope = ["identify", "email"];

if (pluginEnv.DISCORD_SERVER_ID) {
  scope.push("guilds", "guilds.members.read");
}

if (pluginEnv.DISCORD_CLIENT_ID && pluginEnv.DISCORD_CLIENT_SECRET) {
  passport.use(
    config.id,
    new Strategy(
      {
        clientID: pluginEnv.DISCORD_CLIENT_ID,
        clientSecret: pluginEnv.DISCORD_CLIENT_SECRET,
        passReqToCallback: true,
        scope,
        // @ts-expect-error Type mismatch between Koa context and Express request expected by passport-oauth2 types
        store: new StateStore(),
        state: true,
        callbackURL: `${serverEnv.PUBLIC_URL}/auth/${config.id}.callback`,
        authorizationURL: "https://discord.com/api/oauth2/authorize",
        tokenURL: "https://discord.com/api/oauth2/token",
        pkce: false,
      },
      async function (
        ctx: Context,
        accessToken: string,
        refreshToken: string,
        params: { expires_in: number },
        _profile: unknown,
        done: (
          err: Error | null,
          user: User | null,
          result?: AuthenticationResult
        ) => void
      ) {
        try {
          const team = await getTeamFromContext(ctx);
          const client = getClientFromContext(ctx);
          /** Fetch the user's profile */
          const profile: RESTGetAPICurrentUserResult = await request(
            "GET",
            "https://discord.com/api/users/@me",
            accessToken
          );

          const email = profile.email;
          if (!email) {
            /** We have the email scope, so this should never happen */
            throw InvalidRequestError("Discord profile email is missing");
          }
          const { domain } = parseEmail(email);

          if (!domain) {
            throw TeamDomainRequiredError();
          }

          /** Determine the user's language from the locale */
          const { locale } = profile;
          const language = locale
            ? languages.find((l) => l.startsWith(locale))
            : undefined;

          /** Default user and team names metadata */
          let userName = profile.username;
          let teamName = "Wiki";
          let userAvatarUrl: string = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`;
          let teamAvatarUrl: string | undefined = undefined;
          let subdomain = slugifyDomain(domain);

          /**
           * If a Discord server is configured, we will check if the user is a member of the server
           * Additionally, we can get the user's nickname in the server if it exists
           */
          if (pluginEnv.DISCORD_SERVER_ID) {
            /** Fetch the guilds a user is in */
            const guilds: RESTGetAPICurrentUserGuildsResult = await request(
              "GET",
              "https://discord.com/api/users/@me/guilds",
              accessToken
            );

            /** Find the guild that matches the configured server ID */
            const guild = guilds?.find(
              (g) => g.id === pluginEnv.DISCORD_SERVER_ID
            );

            /** If the user is not in the server, throw an error */
            if (!guild) {
              throw DiscordGuildError();
            }

            /**
             * Get the guild's icon
             * https://discord.com/developers/docs/reference#image-formatting-cdn-endpoints
             **/
            if (guild.icon) {
              const isGif = guild.icon.startsWith("a_");
              if (isGif) {
                teamAvatarUrl = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.gif`;
              } else {
                teamAvatarUrl = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`;
              }
            }

            teamName = guild.name;
            subdomain = slugify(guild.name);

            /** If the guild name is a URL, use the subdomain instead – we do not allow URLs in names. */
            if (
              isURL(teamName, {
                require_host: false,
                require_protocol: false,
              })
            ) {
              teamName = subdomain;
            }

            /** Fetch the user's member object in the server for nickname and roles */
            const guildMember: RESTGetCurrentUserGuildMemberResult =
              await request(
                "GET",
                `https://discord.com/api/users/@me/guilds/${pluginEnv.DISCORD_SERVER_ID}/member`,
                accessToken
              );

            /** If the user has a nickname in the server, use that as the name */
            if (guildMember.nick) {
              userName = guildMember.nick;
            }

            /** If the user has a custom avatar in the server, use that as the avatar */
            if (guildMember.avatar) {
              userAvatarUrl = `https://cdn.discordapp.com/guilds/${guild.id}/users/${profile.id}/avatars/${guildMember.avatar}.png`;
            }

            /** If server roles are configured, check if the user has any of the roles */
            if (pluginEnv.DISCORD_SERVER_ROLES) {
              const { roles } = guildMember;
              const hasRole = roles?.some((role) =>
                pluginEnv.DISCORD_SERVER_ROLES?.includes(role)
              );

              /** If the user does not have any of the roles, throw an error */
              if (!hasRole) {
                throw DiscordGuildRoleError();
              }
            }
          }

          // if a team can be inferred, we assume the user is only interested in signing into
          // that team in particular; otherwise, we will do a best effort at finding their account
          // or provisioning a new one (within AccountProvisioner)
          const result = await accountProvisioner({
            ip: ctx.ip,
            team: {
              teamId: team?.id,
              name: teamName,
              domain,
              subdomain,
              avatarUrl: teamAvatarUrl,
            },
            user: {
              email,
              name: userName,
              language,
              avatarUrl: userAvatarUrl,
            },
            authenticationProvider: {
              name: config.id,
              providerId: pluginEnv.DISCORD_SERVER_ID ?? "",
            },
            authentication: {
              providerId: profile.id,
              accessToken,
              refreshToken,
              expiresIn: params.expires_in,
              scopes: scope,
            },
          });
          return done(null, result.user, { ...result, client });
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );

  router.get(
    config.id,
    passport.authenticate(config.id, {
      scope,
      prompt: "consent",
    })
  );
  router.get(`${config.id}.callback`, passportMiddleware(config.id));
}

export default router;
