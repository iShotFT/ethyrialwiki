import fs from "fs/promises";
import path from "path";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import mime from "mime-types";
import env from "@server/env";
import Logger from "@server/logging/Logger";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";

// Reusable S3 client instance
const s3Client = new S3Client({
  region: env.AWS_REGION,
  endpoint: env.AWS_S3_UPLOAD_BUCKET_URL,
  forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
  },
});

/**
 * Uploads a single file to S3.
 * @param s3Bucket - The target S3 bucket name.
 * @param s3Key - The full path (key) for the object in S3.
 * @param localFilePath - The local path to the file to upload.
 * @returns True if upload was successful, false otherwise.
 */
export async function uploadFileToS3(
  s3Bucket: string,
  s3Key: string,
  localFilePath: string
): Promise<boolean> {
  const fileName = path.basename(localFilePath);
  const contentType = mime.lookup(localFilePath) || "application/octet-stream";

  try {
    const fileBuffer = await fs.readFile(localFilePath);
    const command = new PutObjectCommand({
      Bucket: s3Bucket,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: env.AWS_S3_ACL === "public-read" ? "public-read" : "private",
    });

    await s3Client.send(command);
    // Logger.debug("utils", `Uploaded ${fileName} to ${s3Bucket}/${s3Key}`); // Optional: more detailed logging
    return true;
  } catch (error) {
    Logger.error(
      `Failed to upload ${fileName} to ${s3Bucket}/${s3Key}`,
      error as Error
    );
    return false;
  }
}

/**
 * Downloads a single file from S3.
 * @param s3Bucket - The source S3 bucket name.
 * @param s3Key - The full path (key) for the object in S3.
 * @param localFilePath - The local path where the file should be saved.
 * @returns True if download was successful, false otherwise.
 */
export async function downloadFileFromS3(
  s3Bucket: string,
  s3Key: string,
  localFilePath: string
): Promise<boolean> {
  try {
    // Ensure the directory exists
    const dirPath = path.dirname(localFilePath);
    await fs.mkdir(dirPath, { recursive: true });

    // Create a command to get the object from S3
    const command = new GetObjectCommand({
      Bucket: s3Bucket,
      Key: s3Key,
    });

    // Execute the command and get the response
    const response = await s3Client.send(command);
    
    if (!response.Body) {
      throw new Error(`No response body for S3 key: ${s3Key}`);
    }

    // Create a write stream to the local file
    const writeStream = createWriteStream(localFilePath);
    
    // Use pipeline to safely pipe the data from S3 to the local file
    await pipeline(
      response.Body as NodeJS.ReadableStream,
      writeStream
    );

    const fileName = path.basename(localFilePath);
    Logger.info("utils", `Downloaded ${s3Key} from ${s3Bucket} to ${localFilePath}`);
    return true;
  } catch (error) {
    Logger.error(
      `Failed to download ${s3Key} from ${s3Bucket}`,
      error as Error
    );
    return false;
  }
}
