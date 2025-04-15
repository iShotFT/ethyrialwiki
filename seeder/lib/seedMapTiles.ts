import path from "path";
import { glob } from "glob";
import env from "@server/env";
import Logger from "@server/logging/Logger";
import { GameMap as MapModel } from "@server/models";
import { uploadFileToS3 } from "./s3Utils";
import { OUTPUT_DIR } from "./utils";

const CONCURRENCY = 10; // Number of parallel uploads

/**
 * Uploads extracted map tiles to S3.
 * @param mapTitle - The title of the map to find the S3 path for.
 */
export async function seedMapTiles(mapTitle: string): Promise<void> {
  Logger.info("utils", `Uploading tiles for map: ${mapTitle}...`);

  const s3Bucket = env.AWS_S3_UPLOAD_BUCKET_NAME;
  if (!s3Bucket) {
    throw new Error(
      "AWS_S3_UPLOAD_BUCKET_NAME environment variable is not set."
    );
  }

  // Find the target map in the database
  const targetMap = await MapModel.findOne({ where: { title: mapTitle } });
  if (!targetMap) {
    throw new Error(`Map with title "${mapTitle}" not found in the database.`);
  }

  const mapPath = targetMap.getDataValue("path");
  if (!mapPath) {
    throw new Error(
      `Map "${mapTitle}" found, but its 'path' attribute is missing.`
    );
  }

  const s3KeyPrefix = mapPath; // Base path in S3 for this map's tiles
  const sourceTilesDir = path.join(OUTPUT_DIR, "extracted_tiles"); // Tiles are expected here after python script

  Logger.info("utils", `Target Map: ${targetMap.title} (ID: ${targetMap.id})`);
  Logger.info("utils", `Source Dir: ${sourceTilesDir}`);
  Logger.info("utils", `Target S3 Prefix: s3://${s3Bucket}/${s3KeyPrefix}/`);

  // Find all PNG files in the source directory
  const pattern = path.join(sourceTilesDir, "*.png").replace(/\\/g, "/");
  const tileFiles = await glob(pattern);
  Logger.info("utils", `Found ${tileFiles.length} tile files to upload.`);

  if (tileFiles.length === 0) {
    Logger.warn(
      "utils",
      new Error("No tile files found in the source directory. Skipping upload.")
    );
    return;
  }

  // Upload files in parallel batches
  let successfulUploads = 0;
  let failedUploads = 0;
  const queue = [...tileFiles];

  async function worker() {
    while (queue.length > 0) {
      const localFilePath = queue.shift();
      if (!localFilePath) {
        continue;
      }

      const fileName = path.basename(localFilePath);
      const match = fileName.match(/^(-?\d+)-(-?\d+)-(-?\d+)\.png$/);
      if (!match) {
        Logger.warn(
          "utils",
          new Error(`Skipping tile with invalid format: ${fileName}`)
        );
        failedUploads++;
        continue;
      }
      const [, , , z] = match; // Extract Z level
      const s3Key = `${s3KeyPrefix}/${z}/${fileName}`; // Construct S3 key including Z level

      const success = await uploadFileToS3(s3Bucket!, s3Key, localFilePath);
      if (success) {
        successfulUploads++;
      } else {
        failedUploads++;
      }

      if (
        (successfulUploads + failedUploads) % 50 === 0 &&
        successfulUploads + failedUploads > 0
      ) {
        Logger.info(
          "utils",
          `Upload Progress: ${successfulUploads} uploaded, ${failedUploads} failed...`
        );
      }
    }
  }

  const workers = Array(CONCURRENCY).fill(null).map(worker);
  await Promise.all(workers);

  Logger.info("utils", "--- Upload Summary ---");
  Logger.info("utils", `Successfully uploaded: ${successfulUploads}`);
  Logger.info("utils", `Failed uploads:        ${failedUploads}`);
  Logger.info("utils", "----------------------");

  if (failedUploads > 0) {
    throw new Error(`${failedUploads} tile uploads failed.`);
  }
}
