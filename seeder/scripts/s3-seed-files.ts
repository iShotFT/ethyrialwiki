#!/usr/bin/env node

import "../../server/scripts/bootstrap";
import { Command } from "commander";
import fs from "fs/promises";
import path from "path";
import Logger from "@server/logging/Logger";
import env from "@server/env";
import { uploadFileToS3, downloadFileFromS3 } from "../lib/s3Utils";
import { INPUT_DIR } from "../lib/utils";

// Define constants
const S3_BUCKET_NAME = env.AWS_S3_UPLOAD_BUCKET_NAME;
const S3_SEEDER_PREFIX = "seeder/";

// File mapping for seeder input files
const INPUT_FILE_MAPPING = [
  { localPath: "doodad_fixed.json", s3Path: S3_SEEDER_PREFIX + "doodad_fixed.json" },
  { localPath: "monsters.json", s3Path: S3_SEEDER_PREFIX + "monsters.json" },
  { localPath: "npcs.json", s3Path: S3_SEEDER_PREFIX + "npcs.json" },
  { localPath: "markers_markers_full_dump.json", s3Path: S3_SEEDER_PREFIX + "markers_markers_full_dump.json" },
];

// Configure command-line program
const program = new Command();
program
  .name("s3-seed-files")
  .description("Upload and download seeder input files to/from S3")
  .option(
    "-u, --upload",
    "Upload input files to S3 seeder folder"
  )
  .option(
    "-d, --download",
    "Download input files from S3 seeder folder"
  )
  .option(
    "-f, --file <fileName>",
    "Specific file to upload/download (doodad.json, monsters.json, or npcs.json)",
  )
  .parse(process.argv);

const options = program.opts();

if (!options.upload && !options.download) {
  console.error("Error: You must specify either --upload or --download");
  program.help();
  process.exit(1);
}

/**
 * Uploads seeder input files to S3
 * @param {string|undefined} specificFile - Optional specific file to upload
 */
async function uploadSeedFiles(specificFile?: string): Promise<void> {
  Logger.info("utils", "Starting upload of seeder input files to S3");
  
  if (!S3_BUCKET_NAME) {
    throw new Error("AWS_S3_UPLOAD_BUCKET_NAME environment variable is not set");
  }
  
  // Filter files to upload based on specificFile parameter
  const filesToUpload = specificFile 
    ? INPUT_FILE_MAPPING.filter(f => f.localPath === specificFile || path.basename(f.localPath) === specificFile)
    : INPUT_FILE_MAPPING;
  
  if (filesToUpload.length === 0) {
    throw new Error(`No matching files found to upload. Valid file names: ${INPUT_FILE_MAPPING.map(f => f.localPath).join(', ')}`);
  }

  // Upload each file
  let successCount = 0;
  let failCount = 0;
  
  for (const fileMap of filesToUpload) {
    const localFilePath = path.join(INPUT_DIR, fileMap.localPath);
    
    try {
      // Check if the file exists locally
      await fs.access(localFilePath);
      
      // Upload the file to S3
      Logger.info("utils", `Uploading ${fileMap.localPath} to S3...`);
      const success = await uploadFileToS3(
        S3_BUCKET_NAME,
        fileMap.s3Path,
        localFilePath
      );
      
      if (success) {
        Logger.info("utils", `Successfully uploaded ${fileMap.localPath} to S3 seeder folder`);
        successCount++;
      } else {
        Logger.warn(`Failed to upload ${fileMap.localPath}`);
        failCount++;
      }
    } catch (error) {
      Logger.error(
        `Error accessing or uploading file ${fileMap.localPath}`,
        error as Error
      );
      failCount++;
    }
  }
  
  Logger.info("utils", `Upload summary: ${successCount} succeeded, ${failCount} failed`);
}

/**
 * Downloads seeder input files from S3
 * @param {string|undefined} specificFile - Optional specific file to download
 */
async function downloadSeedFiles(specificFile?: string): Promise<void> {
  Logger.info("utils", "Starting download of seeder input files from S3");
  
  if (!S3_BUCKET_NAME) {
    throw new Error("AWS_S3_UPLOAD_BUCKET_NAME environment variable is not set");
  }
  
  // Filter files to download based on specificFile parameter
  const filesToDownload = specificFile
    ? INPUT_FILE_MAPPING.filter(f => f.localPath === specificFile || path.basename(f.localPath) === specificFile)
    : INPUT_FILE_MAPPING;
  
  if (filesToDownload.length === 0) {
    throw new Error(`No matching files found to download. Valid file names: ${INPUT_FILE_MAPPING.map(f => f.localPath).join(', ')}`);
  }

  // Download each file
  let successCount = 0;
  let failCount = 0;
  
  for (const fileMap of filesToDownload) {
    const localFilePath = path.join(INPUT_DIR, fileMap.localPath);
    
    try {
      // Ensure the input directory exists
      await fs.mkdir(INPUT_DIR, { recursive: true });
      
      // Download the file from S3
      Logger.info("utils", `Downloading ${fileMap.s3Path} from S3...`);
      const success = await downloadFileFromS3(
        S3_BUCKET_NAME,
        fileMap.s3Path,
        localFilePath
      );
      
      if (success) {
        Logger.info("utils", `Successfully downloaded ${fileMap.s3Path} to ${localFilePath}`);
        successCount++;
      } else {
        Logger.warn(`Failed to download ${fileMap.s3Path}`);
        failCount++;
      }
    } catch (error) {
      Logger.error(
        `Error downloading file ${fileMap.s3Path}`,
        error as Error
      );
      failCount++;
    }
  }
  
  Logger.info("utils", `Download summary: ${successCount} succeeded, ${failCount} failed`);
}

// Main function
async function main() {
  try {
    // Execute based on options
    if (options.upload) {
      await uploadSeedFiles(options.file);
    }
    
    if (options.download) {
      await downloadSeedFiles(options.file);
    }
    
    process.exit(0);
  } catch (error) {
    Logger.error("Error in s3-seed-files script", error as Error);
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
}

// Run the main function
main(); 