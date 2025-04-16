import Logger from "@server/logging/Logger";
import RedisAdapter from "@server/storage/redis";
import { seederLogger } from "./seederLogger";

/**
 * Flushes the entire Redis cache.
 * This is a destructive operation that removes all keys stored in Redis.
 * Use with caution as it affects all data, not just map-related caches.
 */
export async function flushRedisCache(): Promise<void> {
  try {
    Logger.info("utils", "Flushing Redis cache (FLUSHALL)...");
    const redis = RedisAdapter.defaultClient;
    
    // Count keys before flushing to get a sense of how many were cleared
    const keyCount = await redis.dbsize();
    
    await redis.flushall();
    Logger.info("utils", `Redis cache successfully flushed (cleared ${keyCount} keys)`);
    
    seederLogger.recordCounts("Redis Keys Cleared", keyCount, 0);
  } catch (error) {
    Logger.error("utils", new Error("Failed to flush Redis cache"), { originalError: error.message });
    throw error;
  }
} 