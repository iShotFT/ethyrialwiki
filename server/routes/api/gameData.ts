import { Readable } from "stream";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import Router from "koa-router";
import mime from "mime-types";
import { Op } from "sequelize";
import env from "@server/env"; // Import env
import { NotFoundError, ValidationError } from "@server/errors";
import Logger from "@server/logging/Logger"; // Import Logger
import {
  GameIcon,
  GameItem,
  GameItemCategory,
  GameItemRarity,
  GameResource,
} from "@server/models";
import { DisplayGroup } from "@server/models/GameItemCategory"; // Import enum
import { presentGameItem } from "@server/presenters/gameItem";
import RedisAdapter from "@server/storage/redis"; // Import Redis Adapter
import {
  AggregatedPoint,
  PointAggregator,
} from "@server/utils/PointAggregator"; // Added AggregatedPoint type
import pagination from "./middlewares/pagination";
import { Sequelize } from "sequelize";

const router = new Router();

// --- Redis Cache Configuration ---
const redis = RedisAdapter.defaultClient;
const ICON_CACHE_TTL_SECONDS = 12 * 60 * 60; // 12 hours

// Helper function to convert Readable stream to Buffer
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) =>
      chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk))
    );
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
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
  if (
    !Object.values(DisplayGroup).includes(
      groupName.toUpperCase() as DisplayGroup
    )
  ) {
    ctx.throw(400, `Invalid display group name: ${groupName}`);
  }

  const categories = await GameItemCategory.findAll({
    where: {
      displayGroup: groupName.toUpperCase() as DisplayGroup,
      public: true,
    },
    include: [
      { model: GameIcon, as: "icon", attributes: ["path"] }, // Include icon
    ],
    order: [["title", "ASC"]],
    offset: ctx.state.pagination.offset,
    limit: ctx.state.pagination.limit,
  });

  ctx.body = {
    // Reuse the map category presenter, but ensure it includes needed fields
    // We might need a dedicated GameItemCategory presenter later
    data: categories.map((cat) => ({
      id: cat.getDataValue("id"),
      slug: cat.getDataValue("slug"),
      title: cat.getDataValue("title"),
      iconId: cat.getDataValue("iconId"), // Keep iconId
      // Construct URL using iconId
      iconUrl: cat.getDataValue("iconId")
        ? `/api/game-data/icons/${cat.getDataValue("iconId")}`
        : null,
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
  const gameIcon = await GameIcon.findByPk(iconId, {
    attributes: ["id", "path"],
  });

  if (!gameIcon) {
    throw NotFoundError("Icon not found");
  }
  const s3Path = gameIcon.getDataValue("path");
  if (!s3Path) {
    throw NotFoundError("Icon path not found");
  }

  // 3. Fetch Icon from S3
  Logger.debug(
    "http",
    `Icon cache miss: ${cacheKey}. Fetching from S3: ${s3Path}...`
  );
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
    ctx.set(
      "Content-Type",
      response.ContentType || mime.lookup(s3Path) || "application/octet-stream"
    );
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
  const { sort = "tier", direction = "ASC" } = ctx.query;

  const category = await GameItemCategory.findOne({
    where: { slug: categorySlug, public: true },
    attributes: ["id"], // Only need ID to filter items
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
        as: "icon",
        attributes: ["path"],
      },
      {
        model: GameItemRarity, // Include rarity for color hex
        as: "rarity",
        attributes: ["colorHex", "itemBackgroundColorHex", "sortOrder"], // Include sortOrder too
      },
    ],
    order: [
      ['tier', 'ASC'], // First sort by tier ascending
      ['rarity', 'sortOrder', 'ASC'], // Then by rarity.sortOrder ascending
      ['title', 'ASC'], // Finally by title ascending
    ],
    offset: ctx.state.pagination.offset,
    limit: ctx.state.pagination.limit,
  });

  ctx.body = {
    data: items.map(presentGameItem),
    pagination: ctx.state.pagination,
  };
});

// --- Heatmap Endpoint ---
// Updated route to include mapId
// Added optional bbox query params: ?minX=...&minY=...&maxX=...&maxY=...
router.get("/heatmap/:mapId/:itemId/:zoom", async (ctx) => {
  const { mapId, itemId } = ctx.params;
  const zoomParam = ctx.params.zoom;
  const zoomLevel = parseInt(zoomParam, 10);

  // Bounding Box Query Parameters
  const {
    minX: minXStr,
    minY: minYStr,
    maxX: maxXStr,
    maxY: maxYStr,
  } = ctx.query;

  // Validate zoom
  if (isNaN(zoomLevel) || zoomLevel < 0 || zoomLevel > 28) {
    throw ValidationError("Invalid zoom level provided.");
  }

  // Parse and validate bounding box coordinates - with extra sanitization
  let bbox = null;
  if (minXStr && minYStr && maxXStr && maxYStr) {
    // Handle potential query parameter format issues by sanitizing each value
    const sanitize = (val: string | string[]) => {
      // Handle cases where the parameter value might be an array or have extra question marks
      const strVal = Array.isArray(val) ? val[0] : String(val);
      return strVal.replace(/\?+$/, ''); // Remove any trailing question marks
    };

    const minX = parseFloat(sanitize(minXStr));
    const minY = parseFloat(sanitize(minYStr));
    const maxX = parseFloat(sanitize(maxXStr));
    const maxY = parseFloat(sanitize(maxYStr));

    if (!isNaN(minX) && !isNaN(minY) && !isNaN(maxX) && !isNaN(maxY)) {
      bbox = { minX, minY, maxX, maxY };
      Logger.debug(
        "http",
        `[API /heatmap] Received bbox: ${JSON.stringify(bbox)}`
      );
    } else {
      Logger.warn("[API /heatmap] Received invalid bbox query parameters.");
      ctx.status = 400;
      ctx.body = { error: "Invalid bounding box parameters" };
      return;
    }
  } else {
    Logger.warn("[API /heatmap] Missing required bbox query parameters.");
    ctx.status = 400;
    ctx.body = { error: "Missing bounding box parameters (minX, minY, maxX, maxY)" };
    return;
  }

  Logger.debug(
    "http",
    `[API /heatmap] Request for map: ${mapId}, item: ${itemId}, zoom: ${zoomLevel}`
  );

  // 1. Build the database query conditions
  const whereClause: any = {
    mapId, // Filter by mapId
    itemId,
    public: true,
  };

  // Add bounding box filter if valid bbox provided
  if (bbox) {
    // For JSONB queries, we need to use raw SQL condition
    // Using a simpler approach that doesn't rely on accessing undefined properties
    Logger.debug("http", `[API /heatmap] Applying bbox filter: ${JSON.stringify(bbox)}`);
    
    // Instead of complex literal queries, use the raw WHERE clause for the coordinates JSON fields
    whereClause[Op.and] = [
      Sequelize.where(
        Sequelize.cast(Sequelize.json("coordinates.x"), "float"),
        { [Op.between]: [bbox.minX, bbox.maxX] }
      ),
      Sequelize.where(
        Sequelize.cast(Sequelize.json("coordinates.y"), "float"),
        { [Op.between]: [bbox.minY, bbox.maxY] }
      )
    ];
  }

  // Fetch coordinates based on constructed where clause
  const resourceNodes = await GameResource.findAll({
    where: whereClause,
    attributes: ["coordinates"],
    raw: true,
  });

  Logger.debug(
    "utils",
    `[API /heatmap] Found ${resourceNodes.length} resource nodes for item ${itemId} on map ${mapId}` +
      (bbox ? " within bbox" : "")
  );

  // Define point type for clarity
  type HeatmapPoint = { x: number; y: number };

  // Transform coordinates
  const points: HeatmapPoint[] = resourceNodes.map((node) => ({
    x: node.coordinates.x,
    y: node.coordinates.y,
  }));

  if (points.length === 0) {
    Logger.info(
      "utils",
      `[API /heatmap] No points found for item ${itemId} on map ${mapId}, returning empty array.`
    );
    ctx.body = { data: [] };
    return;
  }

  // 2. Instantiate PointAggregator
  // Include bbox in cache key if present to differentiate cached results
  const cacheKeyPrefix = bbox 
    ? `${mapId}:${itemId}:bbox:${bbox.minX}-${bbox.minY}-${bbox.maxX}-${bbox.maxY}`
    : `${mapId}:${itemId}`; 
  
  const aggregatorOptions: Partial<PointAggregator<HeatmapPoint>["options"]> = {
    minCellSize: 1,
    maxCellSize: 64,
    useCache: true,
    minPointsPerCell: 1,
  };

  const aggregator = new PointAggregator(
    cacheKeyPrefix,
    redis,
    aggregatorOptions
  );

  // 3. Set data and get aggregated points
  aggregator.setData(points);
  const aggregatedPoints: AggregatedPoint[] =
    await aggregator.getAggregatedPoints(zoomLevel);

  Logger.debug(
    "http",
    `[API /heatmap] Aggregated ${points.length} points into ${aggregatedPoints.length} heatmap points for item ${itemId} on map ${mapId} at zoom ${zoomLevel}`
  );

  // 4. Return aggregated data
  ctx.body = {
    data: aggregatedPoints,
  };
});

export default router;
