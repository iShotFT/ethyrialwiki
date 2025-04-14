import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import Router from "koa-router";
import env from "@server/env";
import { NotFoundError } from "@server/errors";
import Logger from "@server/logging/Logger";
import auth from "@server/middlewares/authentication"; // Optional: for protected endpoints later
import { Map, MapIcon, MarkerCategory, Marker } from "@server/models";
import {
  presentMap,
  presentMarkerCategory,
  presentMarker,
} from "@server/presenters"; // Need to create these

const router = new Router();

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

  const map = await Map.findByPk(mapId);
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
  const map = await Map.findByPk(mapId, { attributes: ["id", "public"] });
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
  const map = await Map.findByPk(mapId, { attributes: ["id", "public"] });
  if (!map || !map.getDataValue("public")) {
    throw NotFoundError("Map not found or access denied");
  }

  const markers = await Marker.findAll({
    where: {
      mapId,
      public: true,
    },
    include: [{ model: MapIcon, as: "icon" }],
  });

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

  const map = await Map.findByPk(mapId, {
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

  const s3Bucket = env.AWS_S3_UPLOAD_BUCKET_NAME;
  const s3Key = `${mapPath}/${z}/${x}-${y}-${z}.png`;

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

    ctx.set("Content-Type", response.ContentType || "image/png");
    ctx.set("Cache-Control", "public, max-age=31536000, immutable");
    ctx.body = response.Body;
  } catch (error) {
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
