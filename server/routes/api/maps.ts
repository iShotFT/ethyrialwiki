import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import Router from "koa-router";
import { Readable } from 'stream'; // Import Readable
import env from "@server/env";
import { NotFoundError } from "@server/errors";
import Logger from "@server/logging/Logger";
import auth from "@server/middlewares/authentication"; // Optional: for protected endpoints later
import { GameMap, MapIcon, MarkerCategory, Marker } from "@server/models";
import {
  presentMap,
  presentMarkerCategory,
  presentMarker,
} from "@server/presenters"; // Need to create these
import RedisAdapter from "@server/storage/redis"; // Import Redis Adapter

const router = new Router();

// --- Redis Cache Configuration ---
const redis = RedisAdapter.defaultClient;
const TILE_CACHE_TTL_SECONDS = 12 * 60 * 60; // 12 hours

// Helper function to convert Readable stream to Buffer
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// Placeholder for S3 client - configure properly based on env
const s3Client = new S3Client({
  region: env.AWS_REGION,
  endpoint: env.AWS_S3_UPLOAD_BUCKET_URL, // Assuming this is the endpoint
  forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID!, // Add non-null assertion if confident it's set
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY!, // Add non-null assertion
  },
});

// --- Map Info Endpoint ---
router.get("/:mapId", async (ctx) => {
  const { mapId } = ctx.params;
  Logger.info(
    "utils",
    `[API /maps/:mapId] Received request for mapId: [${mapId}]`
  );

  const map = await GameMap.findByPk(mapId);
  Logger.info(
    "utils",
    `[API /maps/:mapId] Map.findByPk result: ${
      map ? `Found Map Title: ${map.getDataValue("title")}` : "NOT FOUND"
    }`
  );

  if (!map || !map.getDataValue("public")) {
    throw NotFoundError("Map not found or access denied");
  }

  ctx.body = {
    data: presentMap(map),
  };
});

// --- Categories Endpoint ---
router.get("/:mapId/categories", async (ctx) => {
  const { mapId } = ctx.params;
  const map = await GameMap.findByPk(mapId, { attributes: ["id", "public"] });
  if (!map || !map.getDataValue("public")) {
    throw NotFoundError("Map not found or access denied");
  }

  // Fetch all public categories, including children association
  const categories = await MarkerCategory.findAll({
    where: { public: true, parentId: null }, // Only top-level categories
    include: [
      { model: MapIcon, as: "icon" },
      {
        model: MarkerCategory,
        as: "children",
        include: [{ model: MapIcon, as: "icon" }], // Include icons for children too
      },
    ],
    order: [
      ["title", "ASC"],
      [{ model: MarkerCategory, as: "children" }, "title", "ASC"], // Order children
    ],
  });

  // Need a presenter that handles the nested structure
  // Simplified for now - assumes presenter handles children
  ctx.body = {
    data: categories.map(presentMarkerCategory),
  };
});

// --- Markers Endpoint ---
router.get("/:mapId/markers", async (ctx) => {
  const { mapId } = ctx.params;
  const map = await GameMap.findByPk(mapId, { attributes: ["id", "public"] });
  if (!map || !map.getDataValue("public")) {
    throw NotFoundError("Map not found or access denied");
  }

  const markers = await Marker.findAll({
    where: {
      mapId,
      public: true,
    },
    include: [
      { model: MapIcon, as: "icon" },
    ],
  });

  // --- REMOVE DEBUGGING LOGS --- //
  /*
  Logger.info("utils", `Fetched ${markers.length} markers for map ${mapId}`);
  for(let i = 0; i < Math.min(5, markers.length); i++) {
    Logger.info("utils", `Marker ${i} Title: "${markers[i].getDataValue('title')}", CategoryId: ${markers[i].getDataValue('categoryId')}, CategoryIsLabel: ${markers[i].category?.getDataValue('isLabel')}`);
  }
  const townCategoryId = "a438dc66-a4eb-57e8-a976-da22cc4906db";
  const markerInTownCategory = markers.find(m => m.getDataValue('categoryId') === townCategoryId);
  if (markerInTownCategory) {
      Logger.info("utils", `Marker IN TOWN CATEGORY found: Title="${markerInTownCategory.getDataValue('title')}"`);
      Logger.info("utils", `Marker IN TOWN CATEGORY raw category data: ${JSON.stringify(markerInTownCategory.category, null, 2)}`);
      Logger.info("utils", `Marker IN TOWN CATEGORY category.isLabel via getDataValue: ${markerInTownCategory.category?.getDataValue('isLabel')}`);
  } else {
      Logger.warn("utils", new Error(`No markers found with CategoryId = ${townCategoryId}`)); // Fix warn call
  }
  */
  // --- END DEBUGGING --- 

  ctx.body = {
    data: markers.map(presentMarker),
  };
});

// --- Tile Server Endpoint ---
router.get("/:mapId/tiles/:z/:x/:y", async (ctx) => {
  const { mapId, z, x, y: yRaw } = ctx.params;
  const yMatch = yRaw.match(/^([-\d]+)/);
  const y = yMatch ? yMatch[1] : null;

  if (!y) {
    ctx.throw(400, "Invalid Y coordinate format");
  }

  const map = await GameMap.findByPk(mapId, {
    attributes: ["id", "public", "path"],
  });
  const mapIsPublic = map?.getDataValue("public");
  const mapPath = map?.getDataValue("path");

  if (!map || !mapIsPublic) {
    ctx.status = 404;
    return;
  }
  if (!mapPath) {
    Logger.error(
      "Map found but path is missing",
      new Error("Map path missing"),
      { mapId }
    );
    ctx.status = 500;
    return;
  }

  // --- Caching Logic ---
  const cacheKey = `map-tile:${mapId}:${z}:${x}:${y}`;
  let cachedTile: Buffer | null = null;

  try {
    cachedTile = await redis.getBuffer(cacheKey);
  } catch (redisError) {
    Logger.error(`Redis GET error for key ${cacheKey}`, redisError);
    // Proceed without cache if Redis fails
  }

  if (cachedTile) {
    Logger.debug("http", `Serving tile from Redis cache: ${cacheKey}`);
    ctx.set("Content-Type", "image/png"); // Assume PNG for cached tiles
    ctx.set("X-Cache", "HIT"); // Custom header to indicate cache hit
    ctx.set("Cache-Control", "public, max-age=31536000, immutable");
    ctx.body = cachedTile;
    return;
  }
  // --- End Caching Logic ---

  Logger.debug("http", `Tile cache miss: ${cacheKey}. Fetching from S3...`);
  const s3Bucket = env.AWS_S3_UPLOAD_BUCKET_NAME;
  // Construct S3 key using the parsed 'y' value
  const s3Key = `${mapPath}/${z}/${x}-${y}-${z}.png`; // Use the parsed y

  Logger.debug(
    "http",
    `Attempting to fetch tile from S3: ${s3Bucket}/${s3Key}`
  );

  try {
    const command = new GetObjectCommand({
      Bucket: s3Bucket,
      Key: s3Key,
    });
    const response = await s3Client.send(command);

    if (!response.Body) {
        throw new Error("S3 response body is empty");
    }

    // Ensure body is a Readable stream before converting
    if (!(response.Body instanceof Readable)) {
        // Handle Blob or other types if necessary, or throw error
        throw new Error("S3 response body is not a readable stream");
    }

    const tileDataBuffer = await streamToBuffer(response.Body);

    // Cache the buffer in Redis
    try {
      await redis.setex(cacheKey, TILE_CACHE_TTL_SECONDS, tileDataBuffer);
      Logger.debug("http", `Stored tile in Redis cache: ${cacheKey}`);
    } catch (redisError) {
      Logger.error(`Redis SETEX error for key ${cacheKey}`, redisError);
      // Continue serving even if caching fails
    }

    ctx.set("Content-Type", response.ContentType || "image/png");
    ctx.set("Cache-Control", "public, max-age=31536000, immutable");
    ctx.set("X-Cache", "MISS"); // Custom header
    ctx.body = tileDataBuffer; // Send the buffer we read

  } catch (error: any) { // Explicitly type error
    if (error.name === "NoSuchKey") {
      Logger.warn(`Tile not found in S3: ${s3Bucket}/${s3Key}`);
      ctx.status = 404;
    } else {
      Logger.error(`Error fetching tile from S3: ${s3Bucket}/${s3Key}`, error);
      ctx.status = 500;
    }
  }
});

export default router;
