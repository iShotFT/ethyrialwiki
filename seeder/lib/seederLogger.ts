import fs from "fs/promises";
import path from "path";
import { createWriteStream, WriteStream } from "fs";
import { format } from "util";
import Logger from "@server/logging/Logger";

/**
 * SeederLogger provides both console and file logging for the seeder process.
 * It creates a timestamped log file in the seeder/logs directory and writes
 * all important seeder events to it.
 */
export class SeederLogger {
  private logFile: string;
  private writeStream: WriteStream | null = null;
  private startTime: number;
  private stepStartTime: number = 0;
  private totalRecordsCounts: Record<string, number> = {};

  /**
   * Creates a new SeederLogger instance
   */
  constructor() {
    this.startTime = Date.now();
    
    // Create a timestamped log file name
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    this.logFile = path.resolve(process.cwd(), 'seeder', 'logs', `seeder-${timestamp}.log`);
  }

  /**
   * Initializes the logger by creating the log file
   */
  async init(): Promise<void> {
    try {
      // Ensure the logs directory exists
      const logsDir = path.dirname(this.logFile);
      await fs.mkdir(logsDir, { recursive: true });
      
      // Create a write stream
      this.writeStream = createWriteStream(this.logFile, { flags: 'a' });
      
      this.info(`Seeder started at ${new Date().toISOString()}`);
      this.info(`Log file: ${this.logFile}`);
    } catch (error) {
      Logger.error("utils", new Error(`Failed to initialize seeder log file: ${this.logFile}`), { originalError: error.message });
      // Continue without file logging if it fails
    }
  }

  /**
   * Logs an informational message to both console and log file
   */
  info(message: string): void {
    const formattedMessage = `[INFO] ${new Date().toISOString()} - ${message}`;
    
    // Log to console
    Logger.info("utils", message);
    
    // Log to file
    this.writeToFile(formattedMessage);
  }

  /**
   * Logs a warning message to both console and log file
   */
  warn(message: string): void {
    const formattedMessage = `[WARN] ${new Date().toISOString()} - ${message}`;
    
    // Log to console
    Logger.warn(message);
    
    // Log to file
    this.writeToFile(formattedMessage);
  }

  /**
   * Logs an error message to both console and log file
   */
  error(message: string, error?: Error): void {
    const errorDetails = error ? `: ${error.message}` : '';
    const formattedMessage = `[ERROR] ${new Date().toISOString()} - ${message}${errorDetails}`;
    
    // Log to console
    Logger.error("utils", new Error(message), { originalError: error?.message });
    
    // Log to file
    this.writeToFile(formattedMessage);
  }

  /**
   * Marks the start of a seeder step
   */
  startStep(stepName: string): void {
    this.stepStartTime = Date.now();
    this.info(`Starting step: ${stepName}`);
  }

  /**
   * Marks the completion of a seeder step with elapsed time
   */
  completeStep(stepName: string, additionalInfo?: string): void {
    const elapsed = (Date.now() - this.stepStartTime) / 1000;
    const info = additionalInfo ? ` - ${additionalInfo}` : '';
    this.info(`Completed step: ${stepName} in ${elapsed.toFixed(2)}s${info}`);
  }

  /**
   * Records the count of created/updated records for a specific entity
   */
  recordCounts(entityName: string, created: number, updated: number, errors = 0): void {
    // Store for summary
    this.totalRecordsCounts[entityName] = (this.totalRecordsCounts[entityName] || 0) + created + updated;
    
    // Log the counts
    this.info(`${entityName}: ${created} created, ${updated} updated${errors ? `, ${errors} errors` : ''}`);
  }

  /**
   * Logs a detailed summary of the seeder run
   */
  logSummary(): void {
    const totalDuration = (Date.now() - this.startTime) / 1000;
    
    let summaryMessage = `\n====================\n`;
    summaryMessage += `SEEDER SUMMARY\n`;
    summaryMessage += `====================\n`;
    summaryMessage += `Total runtime: ${totalDuration.toFixed(2)}s\n\n`;
    
    // Add counts by entity
    summaryMessage += `Records processed:\n`;
    Object.entries(this.totalRecordsCounts).forEach(([entity, count]) => {
      summaryMessage += `- ${entity}: ${count}\n`;
    });
    
    summaryMessage += `\nSeeder completed at ${new Date().toISOString()}\n`;
    summaryMessage += `====================\n`;
    
    // Log to console and file
    this.info(summaryMessage);
  }

  /**
   * Closes the log file
   */
  async close(): Promise<void> {
    if (this.writeStream) {
      return new Promise((resolve) => {
        this.writeStream!.end(() => {
          this.writeStream = null;
          resolve();
        });
      });
    }
  }

  /**
   * Writes a message to the log file
   */
  private writeToFile(message: string): void {
    if (this.writeStream) {
      this.writeStream.write(format("%s\n", message));
    }
  }
}

// Export a singleton instance
export const seederLogger = new SeederLogger(); 