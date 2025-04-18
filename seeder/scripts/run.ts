// Bootstrap environment (assuming it sets up DB connection, env vars etc.)
// Adjust the path relative to the new seeder script location
import "../../server/scripts/bootstrap";
import { Command } from "commander";
import { spawnSync } from "child_process";
import path from "path";
import Logger from "@server/logging/Logger";
import { sequelize } from "@server/storage/database";
import { INPUT_DIR, OUTPUT_DIR, PYTHON_SCRIPTS_DIR, SEEDER_DIR } from "../lib/utils";
import { seedCoreData } from "../lib/seedCoreData";
import { seedItemsAndIcons } from "../lib/seedItemsAndIcons";
import { seedMapData } from "../lib/seedMapData";
import { seedMapTiles } from "../lib/seedMapTiles";
import { seedResources } from "../lib/seedResources";
import { seedDoodadResources } from "../lib/seedDoodadResources";
import { seedCustomDomains } from "../lib/seedCustomDomains";
import { flushRedisCache } from "../lib/flushRedisCache";
import { seederLogger } from "../lib/seederLogger";
import fs from "fs/promises";

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
    "--upload-icons",
    "Enable uploading icons to S3 (disabled by default)"
  )
  .option(
    "--skip-resources",
    "Skip resource seeding (useful for testing and development)"
  )
  .option(
    "--skip-doodad-resources",
    "Skip doodad resource seeding (trees and other doodads)"
  )
  .option(
    "--resources-mode <mode>",
    "Run mode for resources: 'all' (both standard and doodad), 'standard' (only standard), or 'doodad' (only doodad)",
    "all"
  )
  .option(
    "--skip-custom-domains",
    "Skip custom domain seeding"
  )
  .option(
    "--skip-redis-flush",
    "Skip flushing Redis cache"
  )
  .option(
    "--map-title <title>",
    "Specify the target map title for resource/tile seeding",
    "Irumesa"
  ) // Default to Irumesa
  .option(
    "--batch-size <size>",
    "Database operation batch size (smaller values use less memory)",
    (value) => parseInt(value, 10),
    100
  ) // Default to smaller batch size (100)
  .parse(process.argv);

const options = program.opts();

// Validate resources-mode option
if (options.resourcesMode && !['all', 'standard', 'doodad'].includes(options.resourcesMode)) {
  console.error(`Error: Invalid resources-mode value: ${options.resourcesMode}`);
  console.error("Valid options are: 'all', 'standard', or 'doodad'");
  process.exit(1);
}

// Define paths based on utils and options
const csharpProjectDir = path.resolve(process.cwd(), "tools", "csharp", "markers");
const csharpBuildOutputDir = path.join(csharpProjectDir, "bin", "Release", "net8.0"); // Assuming .NET 8.0 - adjust if needed
const csharpExeName = process.platform === "win32" ? "markers.exe" : "markers";
const csharpDllName = "markers.dll";
const csharpScriptsDir = path.resolve(SEEDER_DIR, "csharp_scripts"); // Output dir for the built .exe
const csharpExePath = path.join(csharpScriptsDir, csharpExeName);
const csharpDllPath = path.join(csharpScriptsDir, csharpDllName);

const inputMarkerFile = path.join(INPUT_DIR, "minimap_data", "markers.minimapdata");
// The C# tool outputs relative to the input file's dir
const intermediateMarkerJson = path.join(INPUT_DIR, "minimap_data", "markers_markers_full_dump.json");
const finalMarkerJson = path.join(INPUT_DIR, "markers_markers_full_dump.json"); // Expected location for seedMapData

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
  const result = spawnSync("python", [scriptPath, ...args], {
    stdio: "inherit",
  }); // Use python3, inherit stdio

  if (result.status !== 0) {
    throw new Error(
      `Python script ${scriptName} failed with exit code ${result.status}`
    );
  }
  Logger.info("utils", `Finished Python script: ${scriptName}.`);
}

async function runCSharpMarkerExtractor(): Promise<void> {
  Logger.info("utils", "Running C# Marker Extractor...");

  try {
    // 1. Ensure output directory for the .exe exists
    await fs.mkdir(csharpScriptsDir, { recursive: true });
    Logger.info("utils", `Ensured C# scripts directory exists: ${csharpScriptsDir}`);

    // 2. Build the C# project
    Logger.info("utils", `Building C# project in: ${csharpProjectDir}`);
    
    // Check if the project directory exists
    try {
      await fs.access(csharpProjectDir);
    } catch (err) {
      throw new Error(`C# project directory not found at: ${csharpProjectDir}. Please check your directory structure.`);
    }

    // Check for project file
    const csharpProjectFile = path.join(csharpProjectDir, "markers.csproj");
    try {
      await fs.access(csharpProjectFile);
    } catch (err) {
      throw new Error(`C# project file not found at: ${csharpProjectFile}. Please check if the project file exists.`);
    }

    // Build the project
    const buildResult = spawnSync(
      "dotnet",
      ["build", csharpProjectFile, "-c", "Release"], 
      {
        cwd: csharpProjectDir, // Run dotnet build in the project directory
        stdio: "inherit",
        shell: true, // Use shell to potentially resolve dotnet path issues
      }
    );

    if (buildResult.status !== 0) {
      throw new Error(
        `C# project build failed with exit code ${buildResult.status}. Check if dotnet SDK is installed correctly.`
      );
    }
    Logger.info("utils", "C# project built successfully.");

    // 3. Copy the appropriate files (both .exe and .dll if they exist)
    const sourceExePath = path.join(csharpBuildOutputDir, csharpExeName);
    const sourceDllPath = path.join(csharpBuildOutputDir, csharpDllName);
    const sourceRuntimeConfigPath = path.join(csharpBuildOutputDir, "markers.runtimeconfig.json");
    const sourceDepsJsonPath = path.join(csharpBuildOutputDir, "markers.deps.json");
    
    // List build output files for debugging
    try {
      const outputFiles = await fs.readdir(csharpBuildOutputDir);
      Logger.info("utils", `Build output directory contents: ${outputFiles.join(', ')}`);
    } catch (err) {
      Logger.error("utils", new Error(`Could not read build output directory: ${csharpBuildOutputDir}.`), { originalError: err.message });
    }

    // Copy ALL files from the build output to ensure dependencies are available
    try {
      const outputFiles = await fs.readdir(csharpBuildOutputDir);
      await Promise.all(
        outputFiles.map(async (file) => {
          const sourcePath = path.join(csharpBuildOutputDir, file);
          const destPath = path.join(csharpScriptsDir, file);
          try {
            await fs.copyFile(sourcePath, destPath);
            Logger.info("utils", `Copied ${file} to ${csharpScriptsDir}`);
          } catch (copyErr) {
            Logger.warn(`Could not copy ${file}: ${copyErr.message}`);
          }
        })
      );
    } catch (err) {
      Logger.warn(`Could not read build output directory to copy files: ${err.message}`);
    }

    // 4. Run the C# marker extractor and wait for completion
    Logger.info("utils", `Checking if executable exists at ${csharpExePath}`);
    
    // Check for both the executable and the runtime config file
    let useExe = false;
    let hasRuntimeConfig = false;
    
    try {
      await fs.access(csharpExePath);
      useExe = true;
    } catch (err) {
      Logger.warn(`EXE not found at ${csharpExePath}, will try using DLL instead`);
    }
    
    try {
      const runtimeConfigPath = path.join(csharpScriptsDir, "markers.runtimeconfig.json");
      await fs.access(runtimeConfigPath);
      hasRuntimeConfig = true;
      Logger.info("utils", `Found runtime config file at ${runtimeConfigPath}`);
    } catch (err) {
      Logger.warn(`Runtime config file not found: ${err.message}`);
    }

    let runResult;
    if (useExe && hasRuntimeConfig) {
      // Run directly as framework-dependent EXE
      Logger.info("utils", `Running ${csharpExeName} for input: ${inputMarkerFile}`);
      // Use spawn instead of spawnSync to get real-time output
      const childProcess = require('child_process');
      
      await new Promise<void>((resolve, reject) => {
        const child = childProcess.spawn(csharpExePath, ["--non-interactive", inputMarkerFile], {
          stdio: "inherit",
          shell: true
        });
        
        // Set a reasonable timeout to detect potential hangs
        const timeout = setTimeout(() => {
          Logger.warn("C# marker extractor seems to be taking longer than expected. Still waiting...");
        }, 10000); // 10 second warning
        
        child.on('close', (code: number) => {
          clearTimeout(timeout);
          if (code !== 0) {
            reject(new Error(`C# marker extractor failed with exit code ${code}`));
          } else {
            Logger.info("utils", `C# marker extractor ran successfully.`);
            resolve();
          }
        });
        
        child.on('error', (err: Error) => {
          clearTimeout(timeout);
          reject(new Error(`C# marker extractor process error: ${err.message}`));
        });
      });
    } else if (hasRuntimeConfig) {
      // Run using dotnet command with DLL
      try {
        await fs.access(csharpDllPath);
        Logger.info("utils", `Running with dotnet command: dotnet ${csharpDllPath} ${inputMarkerFile}`);
        
        // Use spawn instead of spawnSync for real-time output
        const childProcess = require('child_process');
        
        await new Promise<void>((resolve, reject) => {
          const child = childProcess.spawn("dotnet", [csharpDllPath, "--non-interactive", inputMarkerFile], {
            stdio: "inherit",
            shell: true
          });
          
          // Set a reasonable timeout to detect potential hangs
          const timeout = setTimeout(() => {
            Logger.warn("C# marker extractor seems to be taking longer than expected. Still waiting...");
          }, 10000); // 10 second warning
          
          child.on('close', (code: number) => {
            clearTimeout(timeout);
            if (code !== 0) {
              reject(new Error(`C# marker extractor (dotnet) failed with exit code ${code}`));
            } else {
              Logger.info("utils", `C# marker extractor ran successfully.`);
              resolve();
            }
          });
          
          child.on('error', (err: Error) => {
            clearTimeout(timeout);
            reject(new Error(`C# marker extractor (dotnet) process error: ${err.message}`));
          });
        });
      } catch (err) {
        throw new Error(`Neither executable (${csharpExePath}) nor DLL (${csharpDllPath}) was found. Build may have failed or used a different output location.`);
      }
    } else {
      throw new Error(`Missing runtime configuration file (markers.runtimeconfig.json). Cannot run the C# executable.`);
    }

    // 5. Move the generated JSON to the expected input location
    // The C# tool writes output relative to the input file
    Logger.info("utils", `Moving ${intermediateMarkerJson} to ${finalMarkerJson}`);
    try {
        // Make sure the target directory exists
        await fs.mkdir(path.dirname(finalMarkerJson), { recursive: true });
        
        // Check if source file exists
        try {
            await fs.access(intermediateMarkerJson);
        } catch (err) {
            throw new Error(`Source file not found at ${intermediateMarkerJson}. The C# tool may not have produced the expected output.`);
        }
        
        // Move the file
        await fs.rename(intermediateMarkerJson, finalMarkerJson);
        Logger.info("utils", `Successfully moved marker JSON dump.`);
    } catch (renameError: any) {
        if (renameError.code === 'ENOENT') {
             Logger.error("utils", new Error(`Failed to move marker JSON: Source file not found at ${intermediateMarkerJson}. Did the C# tool run correctly and produce the dump file?`), { originalError: renameError });
        } else {
             Logger.error("utils", new Error(`Failed to move marker JSON: ${renameError.message}`), { originalError: renameError });
        }
        throw renameError; // Re-throw after logging specific info
    }

  } catch (error) {
    Logger.error("utils", new Error("C# Marker Extractor step failed."), { originalError: error });
    throw error; // Propagate the error to stop the seeder
  }
}

async function runSeeder() {
  // Initialize the seeder logger
  await seederLogger.init();
  seederLogger.info("Starting Unified Seeder...");
  const startTime = Date.now();

  try {
    // --- Step 0: Flush Redis Cache (unless skipped) ---
    if (!options.skipRedisFlush) {
      seederLogger.startStep("Redis Cache Flush");
      try {
        await flushRedisCache();
        seederLogger.completeStep("Redis Cache Flush");
      } catch (error) {
        seederLogger.error("Failed to flush Redis cache", error);
        seederLogger.warn("Continuing with other steps despite Redis flush failure");
        // Continue despite Redis flush failure
      }
    } else {
      seederLogger.info("Skipping Redis cache flush as requested");
    }

    // --- Step 1: Python Map Processing (Optional) ---
    if (!options.skipPython) {
      seederLogger.startStep("Python Map Processing");
      
      const logDir = path.join(extractedTilesDir, 'logs');
      seederLogger.info(`Python logs will be written to: ${logDir}`);
      
      try {
        await runPythonScript("extract_minimap.py", [
          "--input-dir",
          minimapInputDir,
          "--background-file",
          backgroundInputFile,
          "--output-dir",
          extractedTilesDir,
        ]);
        
        // Display log directory path again after completion
        const logPattern = path.join(logDir, 'minimap_extract_*.log');
        seederLogger.info(`Python extraction completed. Check logs in: ${logPattern}`);
        seederLogger.completeStep("Python Map Processing");
      } catch (error) {
        seederLogger.error("Python map processing failed", error);
        seederLogger.warn("Continuing with other steps despite Python processing failure");
      }
    } else {
      seederLogger.info("Skipping Python map processing steps");
    }

    // --- Step 1.5: Run C# Marker Extractor ---
    // This needs to run before seedMapData, which relies on the generated JSON dump.
    seederLogger.startStep("C# Marker Extraction");
    try {
      await runCSharpMarkerExtractor();
      seederLogger.completeStep("C# Marker Extraction");
    } catch (error) {
      seederLogger.error("C# marker extraction failed", error);
      return 1; // Exit with error if marker extraction fails (critical)
    }

    // --- Step 2a: Core Database Seeding ---
    seederLogger.startStep("Core Database Seeding");
    
    // Use a transaction for the non-resource database operations
    try {
      await sequelize.transaction(async (transaction) => {
        // Seed Core Data (Skills, Rarities)
        seederLogger.info("Seeding core data (skills, rarities)...");
        const { skillIdMap, rarityIdMap } = await seedCoreData(transaction);
        
        // Seed Map Data (Icons, Categories, Maps, Markers from JSON)
        seederLogger.info("Seeding map data (icons, categories, maps, markers)...");
        await seedMapData(transaction);
        
        // Seed Icons, Items (Ores/Bars), Categories (Ores/Bars), Relationships
        seederLogger.info("Seeding items and icons...");
        if (options.uploadIcons) {
          seederLogger.info("Icon upload is ENABLED - will upload icons to S3");
        } else {
          seederLogger.info("Icon upload is DISABLED (default) - use --upload-icons to enable");
        }
        
        await seedItemsAndIcons(
          !options.uploadIcons, // Skip icon upload by default, enable with --upload-icons flag
          skillIdMap,
          rarityIdMap,
          transaction
        );
        
        // Custom Domains
        if (!options.skipCustomDomains) {
          seederLogger.info("Seeding custom domains...");
          await seedCustomDomains(transaction);
        } else {
          seederLogger.info("Skipping custom domains seeding as requested");
        }
        
        seederLogger.info("Core database seeding transaction committed");
      });
      
      seederLogger.completeStep("Core Database Seeding");
    } catch (error) {
      seederLogger.error("Database transaction setup failed", error);
      return 1;
    }
    
    // --- Step 2b: Standard Resource Seeding (with independent transactions) ---
    // Determine if we should run standard resources based on flags and mode
    const runStandardResources = !options.skipResources && 
                                (options.resourcesMode === 'all' || options.resourcesMode === 'standard');
    
    if (!runStandardResources) {
      seederLogger.info("Skipping standard resource seeding (based on options)");
    } else {
      seederLogger.startStep("Standard Resource Seeding");
      seederLogger.info(`Using batch size of ${options.batchSize} for database operations`);
      
      try {
        // Note: seedResources will skip tree resources (handled by seedDoodadResources)
        await seedResources(options.mapTitle, null, options.batchSize);
        seederLogger.completeStep("Standard Resource Seeding");
      } catch (error) {
        seederLogger.error("Standard resource seeding failed", error);
        // Continue despite resource seeding failure
      }
    }

    // --- Step 2c: Doodad Resource Seeding (with independent transactions) ---
    // Determine if we should run doodad resources based on flags and mode
    const runDoodadResources = !options.skipDoodadResources && 
                              (options.resourcesMode === 'all' || options.resourcesMode === 'doodad');
    
    if (!runDoodadResources) {
      seederLogger.info("Skipping doodad resource seeding (based on options)");
    } else {
      seederLogger.startStep("Doodad Resource Seeding");
      seederLogger.info(`Using batch size of ${options.batchSize} for database operations`);
      
      try {
        // seedDoodadResources focuses on tree resources and other doodads
        await seedDoodadResources(options.mapTitle, null, options.batchSize);
        seederLogger.completeStep("Doodad Resource Seeding");
      } catch (error) {
        seederLogger.error("Doodad resource seeding failed", error);
        // Continue despite doodad resource seeding failure
      }
    }

    // --- Step 3: Map Tile Upload (Optional) ---
    if (!options.skipTileUpload) {
      seederLogger.startStep("Map Tile Upload");
      seederLogger.info("Map tile upload is ENABLED - will upload tiles to S3");
      
      try {
        await seedMapTiles(options.mapTitle);
        seederLogger.completeStep("Map Tile Upload");
      } catch (error) {
        seederLogger.error("Map tile uploading to S3 failed", error);
        // Non-critical failure, continue
      }
    } else {
      seederLogger.info("Map tile upload is DISABLED - remove --skip-tile-upload to enable");
    }
  } catch (error) {
    seederLogger.error("Unified Seeder failed with an unexpected error", error);
    
    // Log summary before exiting
    seederLogger.logSummary();
    await seederLogger.close();
    
    process.exit(1);
  }

  const duration = (Date.now() - startTime) / 1000;
  seederLogger.info(`Unified Seeder finished successfully in ${duration.toFixed(2)} seconds`);
  
  // Log final summary
  seederLogger.logSummary();
  await seederLogger.close();
  
  process.exit(0);
}

// Execute the seeder
void runSeeder();
