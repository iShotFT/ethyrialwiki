import Router from "koa-router";
import { Op } from "sequelize";
import { Readable } from 'stream';
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import mime from "mime-types";
import { NotFoundError } from "@server/errors";
import { GameItem, GameItemCategory, GameIcon, GameItemRarity } from "@server/models";
import { DisplayGroup } from "@server/models/GameItemCategory"; // Import enum
import env from "@server/env"; // Import env
import { presentGameItem } from "@server/presenters/gameItem";
import { presentMarkerCategory } from "@server/presenters/maps"; // Reuse map category presenter
import RedisAdapter from "@server/storage/redis"; // Import Redis Adapter
import Logger from "@server/logging/Logger"; // Import Logger
import pagination from "./middlewares/pagination";

const router = new Router();

// --- Redis Cache Configuration ---
const redis = RedisAdapter.defaultClient;
const ICON_CACHE_TTL_SECONDS = 12 * 60 * 60; // 12 hours

// Helper function to convert Readable stream to Buffer
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// Configure S3 client (ensure this matches your main config)
const s3Client = new S3Client({
  region: env.AWS_REGION,
  endpoint: env.AWS_S3_UPLOAD_BUCKET_URL,
  forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
  },
});

// New Endpoint: Get categories by display group
router.get("/categories/by-group/:groupName", pagination(), async (ctx) => {
  const { groupName } = ctx.params;

  // Validate groupName against enum
  if (!Object.values(DisplayGroup).includes(groupName.toUpperCase() as DisplayGroup)) {
      ctx.throw(400, `Invalid display group name: ${groupName}`);
  }

  const categories = await GameItemCategory.findAll({
    where: {
      displayGroup: groupName.toUpperCase() as DisplayGroup,
      public: true
    },
    include: [
      { model: GameIcon, as: 'icon', attributes: ['path'] } // Include icon
    ],
    order: [['title', 'ASC']],
    offset: ctx.state.pagination.offset,
    limit: ctx.state.pagination.limit,
  });

  ctx.body = {
    // Reuse the map category presenter, but ensure it includes needed fields
    // We might need a dedicated GameItemCategory presenter later
    data: categories.map(cat => ({
        id: cat.getDataValue('id'),
        slug: cat.getDataValue('slug'),
        title: cat.getDataValue('title'),
        iconId: cat.getDataValue('iconId'), // Keep iconId
        // Construct URL using iconId
        iconUrl: cat.getDataValue('iconId') ? `/api/game-data/icons/${cat.getDataValue('iconId')}` : null,
    })),
    pagination: ctx.state.pagination,
  };
});

// New Endpoint: Get game icon by ID
router.get("/icons/:iconId", async (ctx) => {
  const { iconId } = ctx.params;

  const cacheKey = `game-icon:${iconId}`;
  let cachedIcon: Buffer | null = null;

  // 1. Check Redis Cache
  try {
    cachedIcon = await redis.getBuffer(cacheKey);
  } catch (redisError) {
    Logger.error(`Redis GET error for icon ${iconId}`, redisError);
  }

  if (cachedIcon) {
    Logger.debug("http", `Serving icon from Redis cache: ${cacheKey}`);
    ctx.set("Content-Type", mime.lookup(".png") || "image/png"); // Assume png
    ctx.set("X-Cache", "HIT");
    ctx.set("Cache-Control", "public, max-age=31536000, immutable");
    ctx.body = cachedIcon;
    return;
  }

  // 2. Fetch Icon Path from DB
  const gameIcon = await GameIcon.findByPk(iconId, { attributes: ['id', 'path'] });

  if (!gameIcon) {
    throw NotFoundError("Icon not found");
  }
  const s3Path = gameIcon.getDataValue('path');
  if (!s3Path) {
    throw NotFoundError("Icon path not found");
  }

  // 3. Fetch Icon from S3
  Logger.debug("http", `Icon cache miss: ${cacheKey}. Fetching from S3: ${s3Path}...`);
  const s3Bucket = env.AWS_S3_UPLOAD_BUCKET_NAME;
  try {
    const command = new GetObjectCommand({ Bucket: s3Bucket, Key: s3Path });
    const response = await s3Client.send(command);

    if (!response.Body || !(response.Body instanceof Readable)) {
        throw new Error("S3 icon response body is not a readable stream");
    }

    const iconDataBuffer = await streamToBuffer(response.Body);

    // 4. Cache in Redis
    try {
      await redis.setex(cacheKey, ICON_CACHE_TTL_SECONDS, iconDataBuffer);
      Logger.debug("http", `Stored icon in Redis cache: ${cacheKey}`);
    } catch (redisError) {
      Logger.error(`Redis SETEX error for icon ${cacheKey}`, redisError);
    }

    // 5. Send Response
    ctx.set("Content-Type", response.ContentType || mime.lookup(s3Path) || "application/octet-stream");
    ctx.set("Cache-Control", "public, max-age=31536000, immutable");
    ctx.set("X-Cache", "MISS");
    ctx.body = iconDataBuffer;

  } catch (error: any) {
    if (error.name === "NoSuchKey") {
      Logger.warn(`Icon not found in S3: ${s3Bucket}/${s3Path}`);
      ctx.status = 404;
    } else {
      Logger.error(`Error fetching icon from S3: ${s3Bucket}/${s3Path}`, error);
      ctx.status = 500;
    }
  }
});

// Endpoint to fetch game items by category slug
router.get("/items/by-category/:categorySlug", pagination(), async (ctx) => {
  const { categorySlug } = ctx.params;
  const { sort = 'tier', direction = 'ASC' } = ctx.query;

  const category = await GameItemCategory.findOne({
    where: { slug: categorySlug, public: true },
    attributes: ['id'] // Only need ID to filter items
  });

  if (!category) {
    throw NotFoundError(`Category with slug "${categorySlug}" not found.`);
  }

  // Find items belonging to this category
  const items = await GameItem.findAll({
    where: { public: true }, // Only public items
    include: [
      {
        model: GameItemCategory,
        where: { id: category.id },
        attributes: [], // Don't need category attributes here
        through: { attributes: [] }, // Don't need join table attributes
        required: true, // INNER JOIN
      },
      {
        model: GameIcon, // Include icon for URL
        as: 'icon',
        attributes: ['path'],
      },
      {
        model: GameItemRarity, // Include rarity for color hex
        as: 'rarity',
        attributes: ['colorHex'], // Only need the color
      }
    ],
    order: [
      [sort as string, direction as string], // Apply sorting
      ['title', 'ASC'] // Secondary sort by title
    ],
    offset: ctx.state.pagination.offset,
    limit: ctx.state.pagination.limit,
  });

  ctx.body = {
    data: items.map(presentGameItem),
    pagination: ctx.state.pagination,
  };
});

export default router; 