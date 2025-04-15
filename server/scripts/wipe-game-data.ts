import "./bootstrap"; // Initialize environment, db connection etc.
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import env from "@server/env";
import Logger from "@server/logging/Logger";
import { sequelize } from "@server/storage/database";

// --- Configuration ---
const WIPE_S3_ICONS = true; // SET TO true TO WIPE S3 icons/ FOLDER! Use with caution.
// Remove TARGET_S3_FOLDER constant
// const TARGET_S3_FOLDER = "icons";
// ---------------------

// List of game-related tables to truncate (in order respecting FKs, mostly)
// Join tables first, then main tables
const tablesToWipe = [
  // Map related (ensure map data is okay to wipe)
  "markers",
  "marker_categories", // FK to map_icons
  "map_icons",
  // Game Data Join Tables
  "game_item_item_categories",
  "game_item_modifiers",
  // Game Data Resource Nodes
  "game_resources",
  // Game Data Blueprint Slots
  "game_blueprint_slots",
  // Game Data Main Tables
  "game_items", // References Blueprints, Skills, Rarities, Icons
  "game_blueprints", // References Items, Skills
  "game_item_categories", // References Icons
  "game_skills", // References Icons
  "game_item_rarities",
  "game_icons",
];

// --- S3 Client (if needed) ---
let s3Client: S3Client | null = null;
if (WIPE_S3_ICONS) {
  s3Client = new S3Client({
    region: env.AWS_REGION,
    endpoint: env.AWS_S3_UPLOAD_BUCKET_URL,
    forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

// --- Wipe S3 Folder Function ---
async function wipeS3Folder(bucket: string, prefix: string) {
  if (!s3Client) return;
  // Update log message
  const targetDesc = prefix ? `folder: s3://${bucket}/${prefix}/` : `entire bucket: s3://${bucket}/`;
  Logger.info("utils", `Wiping S3 ${targetDesc}`);
  let isTruncated = true;
  let continuationToken: string | undefined;
  let deletedCount = 0;

  try {
    while (isTruncated) {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });
      const listResponse = await s3Client.send(listCommand);

      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        Logger.info("utils", "S3 folder is empty or does not exist.");
        break;
      }

      const objectsToDelete = listResponse.Contents.map(obj => ({ Key: obj.Key }));
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: objectsToDelete, Quiet: true },
      });
      const deleteResponse = await s3Client.send(deleteCommand);

      deletedCount += objectsToDelete.length;
      Logger.info("utils", `Deleted ${objectsToDelete.length} objects (Total: ${deletedCount})...`);

      if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
          Logger.error("utils", new Error(`Errors occurred during S3 deletion:`), deleteResponse.Errors);
          // Decide whether to stop or continue on errors
      }

      isTruncated = listResponse.IsTruncated ?? false;
      continuationToken = listResponse.NextContinuationToken;
    }
    // Update log message
    Logger.info("utils", `Finished wiping S3 ${targetDesc}. Total objects deleted: ${deletedCount}.`);
  } catch (error) {
      // Update log message
      Logger.error("utils", new Error(`Failed to wipe S3 ${targetDesc}`), error);
      // Decide if DB wipe should continue after S3 failure
      throw error; // Re-throw to stop DB wipe by default
  }
}

// --- Wipe Database Tables Function ---
async function wipeDatabaseTables() {
  const transaction = await sequelize.transaction();
  Logger.info("utils", `Starting database wipe for tables: ${tablesToWipe.join(", " )}`);
  try {
    // Disable FK checks for the duration of the transaction (PostgreSQL specific)
    await sequelize.query("SET CONSTRAINTS ALL DEFERRED;", { transaction });

    for (const tableName of tablesToWipe) {
      Logger.info("utils", `Truncating table: ${tableName}...`);
      // Use TRUNCATE for speed and to reset sequences. CASCADE handles FKs.
      await sequelize.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE;`, {
        transaction,
      });
    }

    // Re-enable FK checks
    await sequelize.query("SET CONSTRAINTS ALL IMMEDIATE;", { transaction });
    await transaction.commit();
    Logger.info("utils", "Database tables wiped successfully.");
  } catch (error) {
    await transaction.rollback();
    Logger.error("utils", new Error("Database wipe failed"), error);
    throw error;
  }
}

// --- Main Execution ---
async function runWipe() {
  if (WIPE_S3_ICONS) {
    const bucket = env.AWS_S3_UPLOAD_BUCKET_NAME;
    if (!bucket) {
      throw new Error("AWS_S3_UPLOAD_BUCKET_NAME must be set to wipe S3.");
    }
    // Pass empty prefix to wipe entire bucket
    await wipeS3Folder(bucket, "");
  }

  await wipeDatabaseTables();
}

void runWipe()
  .then(() => {
    Logger.info("utils", "Wipe script finished.");
    process.exit(0);
  })
  .catch((error) => {
    Logger.error("utils", new Error("Wipe script failed"), error);
    process.exit(1);
  }); 