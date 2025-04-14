import { Context, Next } from "koa";
import { Minute } from "@shared/utils/time";
import env from "@server/env"; // Import main env
import Logger from "@server/logging/Logger";
import { CustomDomain } from "@server/models";
import RedisAdapter from "@server/storage/redis";

const CACHE_PREFIX = "custom_domain:";
const CACHE_TTL = 5 * Minute.seconds;
const DEFAULT_HANDLER_TYPE = "default_app";

export type DomainConfig = {
  type: string;
  config: Record<string, any> | null;
};

export default function customDomainResolver() {
  return async function customDomainResolverMiddleware(
    ctx: Context,
    next: Next
  ) {
    const hostname = ctx.hostname;
    // const cacheKey = `${CACHE_PREFIX}${hostname}`; // Cache disabled
    let domainConfig: DomainConfig | undefined | null = undefined;
    let logSource = "init";

    if (env.DEBUG_AUTH) {
      Logger.debug("http", `>>> Request for hostname: [${hostname}]`);
    }

    /* Cache Disabled
    // 1. Check Cache
    try {
      const cached = await RedisAdapter.defaultClient.get(cacheKey);
      if (cached) {
        domainConfig = JSON.parse(cached) as DomainConfig;
        ctx.state.domainConfigSource = "cache";
        logSource = "cache";
      }
    } catch (error) {
      Logger.error(`Error fetching custom domain config from cache for ${hostname}`, error);
    }
    */

    // 2. Check DB (always runs since cache is disabled)
    if (domainConfig === undefined) {
      try {
        const record = await CustomDomain.findOne({
          where: {
            hostname,
          },
        });

        if (env.DEBUG_AUTH) {
          Logger.debug(
            "http",
            `<<< Raw DB record for ${hostname}: ${JSON.stringify(record)}`
          );
        }

        // Use getDataValue for reliable access
        const handlerType = record ? record.getDataValue("handlerType") : null;
        if (env.DEBUG_AUTH) {
          Logger.debug("http", `<<< Extracted handlerType: [${handlerType}]`);
        }

        if (record && handlerType) {
          // Check record and the extracted handlerType
          domainConfig = {
            type: handlerType, // Use the extracted value
            config: record.getDataValue("handlerConfig"), // Use getDataValue here too
          };
          ctx.state.domainConfigSource = "db";
          logSource = `db (found type: ${handlerType})`;

          /* Cache Disabled
          // 3. Store in Cache
          try {
            await RedisAdapter.defaultClient.set(
              cacheKey,
              JSON.stringify(domainConfig),
              "EX",
              CACHE_TTL
            );
          } catch (error) {
            Logger.error(`Error storing custom domain config in cache for ${hostname}`, error);
          }
          */
        } else {
          domainConfig = null;
          ctx.state.domainConfigSource = record
            ? "db_invalid_record"
            : "not_found";
          logSource = record ? "db (invalid record)" : "db (not found)";
          if (record) {
            Logger.warn(
              `CustomDomain record found for ${hostname} but handlerType [${handlerType}] is missing or invalid.`
            );
          }
        }
      } catch (error) {
        Logger.error(
          `Error fetching custom domain config from DB for ${hostname}`,
          error
        );
        domainConfig = null;
        ctx.state.domainConfigSource = "db_error";
        logSource = "db (error)";
      }
    }

    // 4. Set default if no specific config found
    if (!domainConfig) {
      domainConfig = {
        type: DEFAULT_HANDLER_TYPE,
        config: null,
      };
      logSource += ` -> default`;
    }

    // 5. Attach to context state
    ctx.state.domainConfig = domainConfig;
    if (env.DEBUG_AUTH) {
      Logger.debug(
        "http",
        `<<< Source: ${logSource}, Final domainConfig: ${JSON.stringify(
          domainConfig
        )}`
      );
    }

    await next();
  };
}
