import "./bootstrap"; // Initialize environment, db connection etc.
import fs from "fs";
import path from "path";
import { glob } from "glob";
import mime from "mime-types";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import env from "@server/env";
import Logger from "@server/logging/Logger";
import { Map as MapModel } from "@server/models";

// --- Configuration ---
const SOURCE_TILES_DIR = path.resolve(process.cwd(), 'tools/scripts/minimap_data/extracted');
const TARGET_MAP_TITLE = 'Irumesa'; // Or make this a command-line argument
const CONCURRENCY = 10; // Number of parallel uploads
// ---------------------

const s3Client = new S3Client({
  region: env.AWS_REGION,
  endpoint: env.AWS_S3_UPLOAD_BUCKET_URL,
  forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function uploadTile(s3Bucket: string, s3KeyPrefix: string, localFilePath: string) {
  const fileName = path.basename(localFilePath);
  // Extract coordinates from filename (assuming x-y-z.png format)
  const match = fileName.match(/^(-?\d+)-(-?\d+)-(-?\d+)\.png$/);
  if (!match) {
    Logger.warn("utils", new Error(`Skipping file with invalid format: ${fileName}`));
    return false;
  }
  const [, x, y, z] = match;

  const s3Key = `${s3KeyPrefix}/${z}/${fileName}`;
  const contentType = mime.lookup(localFilePath) || 'application/octet-stream';

  try {
    const fileStream = fs.createReadStream(localFilePath);
    const command = new PutObjectCommand({
      Bucket: s3Bucket,
      Key: s3Key,
      Body: fileStream,
      ContentType: contentType,
      ACL: env.AWS_S3_ACL === 'public-read' ? 'public-read' : 'private', // Or adjust based on need
    });

    await s3Client.send(command);
    // Logger.debug("scripts", `Uploaded ${fileName} to ${s3Bucket}/${s3Key}`);
    return true;
  } catch (error) {
    Logger.error(`Failed to upload ${fileName} to ${s3Bucket}/${s3Key}`, error);
    return false;
  }
}

async function run() {
  Logger.info("utils", "Starting map tile upload script...");

  const s3Bucket = env.AWS_S3_UPLOAD_BUCKET_NAME;
  if (!s3Bucket) {
    throw new Error("AWS_S3_UPLOAD_BUCKET_NAME environment variable is not set.");
  }

  // Find the target map in the database
  const targetMap = await MapModel.findOne({ where: { title: TARGET_MAP_TITLE } });
  // Add logging to inspect the result
  Logger.info("utils", `Found map data: ${JSON.stringify(targetMap)}`);

  if (!targetMap) {
    throw new Error(`Map with title "${TARGET_MAP_TITLE}" not found in the database.`);
  }
  
  // Use getDataValue to reliably access the path
  const mapPath = targetMap.getDataValue('path');
  Logger.info("utils", `Extracted map path using getDataValue: [${mapPath}]`);

  if (!mapPath) {
    // Check the extracted value
    throw new Error(`Map with title "${TARGET_MAP_TITLE}" found, but its 'path' attribute is missing or empty.`);
  }
  
  const s3KeyPrefix = mapPath; // Use the reliably extracted path
  Logger.info("utils", `Target Map: ${targetMap.getDataValue('title')} (ID: ${targetMap.getDataValue('id')})`); // Also use getDataValue here
  Logger.info("utils", `Target S3 Prefix: s3://${s3Bucket}/${s3KeyPrefix}/`);

  // Find all PNG files in the source directory
  const pattern = path.join(SOURCE_TILES_DIR, '*.png').replace(/\\/g, '/'); // Ensure forward slashes for glob
  Logger.info("utils", `Searching for tiles in: ${SOURCE_TILES_DIR} using pattern: ${pattern}`);
  const tileFiles = await glob(pattern);
  Logger.info("utils", `Found ${tileFiles.length} potential tile files.`);

  if (tileFiles.length === 0) {
    Logger.warn("utils", new Error("No tile files found in the source directory. Exiting."));
    return;
  }

  // Upload files in parallel batches
  let successfulUploads = 0;
  let failedUploads = 0;
  const queue = [...tileFiles]; // Copy files to a mutable queue

  async function worker() {
    while (queue.length > 0) {
      const filePath = queue.shift();
      if (!filePath) continue;

      const success = await uploadTile(s3Bucket!, s3KeyPrefix, filePath);
      if (success) {
        successfulUploads++;
      } else {
        failedUploads++;
      }
      // Log progress periodically
      if ((successfulUploads + failedUploads) % 50 === 0) {
         Logger.info("utils", `Progress: ${successfulUploads} uploaded, ${failedUploads} failed...`);
      }
    }
  }

  const workers = Array(CONCURRENCY).fill(null).map(worker);
  await Promise.all(workers);

  Logger.info("utils", "--- Upload Summary ---");
  Logger.info("utils", `Successfully uploaded: ${successfulUploads}`);
  Logger.info("utils", `Failed uploads:        ${failedUploads}`);
  Logger.info("utils", "----------------------");
}

void run()
  .then(() => {
    Logger.info("utils", "Tile upload script finished.");
    process.exit(0);
  })
  .catch((error) => {
    Logger.error("Tile upload script failed", error);
    process.exit(1);
  }); 