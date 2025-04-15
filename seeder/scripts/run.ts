// Bootstrap environment (assuming it sets up DB connection, env vars etc.)
// Adjust the path relative to the new seeder script location
import "../../server/scripts/bootstrap";
import { Command } from "commander";
import { spawnSync } from "child_process";
import path from "path";
import Logger from "@server/logging/Logger";
import { sequelize } from "@server/storage/database";
import { INPUT_DIR, OUTPUT_DIR, PYTHON_SCRIPTS_DIR } from "../lib/utils";
import { seedCoreData } from "../lib/seedCoreData";
import { seedItemsAndIcons } from "../lib/seedItemsAndIcons";
import { seedMapData } from "../lib/seedMapData";
import { seedMapTiles } from "../lib/seedMapTiles";
import { seedResources } from "../lib/seedResources";

const program = new Command();

program
  .name("unified-seeder")
  .description("Runs all seeding steps for EthyrialWiki game data")
  .option(
    "--skip-python",
    "Skip Python scripts (extract_minimap, stitch_minimap)"
  )
  .option("--skip-tile-upload", "Skip uploading map tiles to S3")
  .option(
    "--skip-icon-upload",
    "Skip uploading icons to S3 (assumes they exist)"
  )
  .option(
    "--map-title <title>",
    "Specify the target map title for resource/tile seeding",
    "Irumesa"
  ) // Default to Irumesa
  .parse(process.argv);

const options = program.opts();

// Define paths based on utils and options
const minimapInputDir = path.join(INPUT_DIR, "minimap_data");
const backgroundInputFile = path.join(INPUT_DIR, "background.png");
const extractedTilesDir = path.join(OUTPUT_DIR, "extracted_tiles");
const stitchedOutputDir = path.join(OUTPUT_DIR, "stitched_maps");

async function runPythonScript(
  scriptName: string,
  args: string[]
): Promise<void> {
  Logger.info("utils", `Running Python script: ${scriptName}...`);
  const scriptPath = path.join(PYTHON_SCRIPTS_DIR, scriptName);
  const result = spawnSync("python3", [scriptPath, ...args], {
    stdio: "inherit",
  }); // Use python3, inherit stdio

  if (result.status !== 0) {
    throw new Error(
      `Python script ${scriptName} failed with exit code ${result.status}`
    );
  }
  Logger.info("utils", `Finished Python script: ${scriptName}.`);
}

async function runSeeder() {
  Logger.info("utils", "Starting Unified Seeder...");
  const startTime = Date.now();

  try {
    // --- Step 1: Python Map Processing (Optional) ---
    if (!options.skipPython) {
      await runPythonScript("extract_minimap.py", [
        "--input-dir",
        minimapInputDir,
        "--background-file",
        backgroundInputFile,
        "--output-dir",
        extractedTilesDir,
      ]);
      // Stitching is less critical for seeding, maybe make optional?
      // await runPythonScript('stitch_minimap.py', [
      //     '--input-dir', extractedTilesDir,
      //     '--background-file', backgroundInputFile,
      //     '--output-dir', stitchedOutputDir,
      // ]);
    } else {
      Logger.info("utils", "Skipping Python map processing steps.");
    }

    // --- Step 2: Database Seeding (within a transaction) ---
    await sequelize.transaction(async (transaction) => {
      Logger.info("utils", "Starting database seeding transaction...");

      // 2a. Seed Core Data (Skills, Rarities)
      const { skillIdMap, rarityIdMap } = await seedCoreData(transaction);

      // 2b. Seed Map Data (Icons, Categories, Maps, Markers from JSON)
      // Note: This now relies on INPUT_DIR/markers_markers_full_dump.json
      await seedMapData(transaction);

      // 2c. Seed Icons, Items (Ores/Bars), Categories (Ores/Bars), Relationships
      // Note: This now relies on INPUT_DIR/icons/
      await seedItemsAndIcons(
        options.skipIconUpload,
        skillIdMap,
        rarityIdMap,
        transaction
      );

      // 2d. Seed Game Resources (from scraped JSON)
      // Note: This now relies on INPUT_DIR/scraped_objects.json
      await seedResources(options.mapTitle, transaction);

      Logger.info("utils", "Database seeding transaction committed.");
    });

    // --- Step 3: Map Tile Upload (Optional) ---
    if (!options.skipTileUpload) {
      await seedMapTiles(options.mapTitle);
    } else {
      Logger.info("utils", "Skipping map tile upload.");
    }
  } catch (error) {
    Logger.error("Unified Seeder failed", error as Error);
    process.exit(1);
  }

  const duration = (Date.now() - startTime) / 1000;
  Logger.info(
    "utils",
    `Unified Seeder finished successfully in ${duration.toFixed(2)} seconds.`
  );
  process.exit(0);
}

// Execute the seeder
void runSeeder();
