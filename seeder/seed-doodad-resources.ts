#!/usr/bin/env node

import { program } from "commander";
import Logger from "@server/logging/Logger";
import { sequelize, checkConnection } from "@server/storage/database";
import { seedDoodadResources } from "./lib/seedDoodadResources";
import { seederLogger } from "./lib/seederLogger";

// Configure command-line program
program
  .name("seed-doodad-resources")
  .description("Seeds resource nodes from the cleaned_doodad.json file")
  .option(
    "-m, --map <mapTitle>",
    "Title of the map to add resources to (e.g., 'Irumesa')"
  )
  .option("-b, --batch-size <size>", "Batch size for processing", "100")
  .parse(process.argv);

const options = program.opts();

if (!options.map) {
  console.error("Error: Map title is required. Use --map or -m option.");
  process.exit(1);
}

const mapTitle = options.map;
const batchSize = parseInt(options.batchSize, 10);

// Validate batch size
if (isNaN(batchSize) || batchSize <= 0) {
  console.error("Error: Batch size must be a positive number.");
  process.exit(1);
}

// Main function
async function main() {
  console.log(`Seeding doodad resources for map: ${mapTitle} (batch size: ${batchSize})`);
  
  try {
    // Initialize database connection
    await checkConnection(sequelize);
    
    // Initialize seeder logger
    await seederLogger.init();
    
    // Start timer
    const startTime = Date.now();
    
    // Run seeder without parent transaction
    await seedDoodadResources(mapTitle, null, batchSize);
    
    // Log completion time
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Done! Seeding completed in ${elapsedSeconds} seconds.`);
    
    // Print summary
    seederLogger.logSummary();
    
    // Close logger
    await seederLogger.close();
    
    process.exit(0);
  } catch (error) {
    Logger.error("Failed to seed doodad resources", error as Error);
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
}

// Run the main function
main(); 