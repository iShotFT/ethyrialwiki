import { Transaction } from "sequelize";
import Logger from "@server/logging/Logger";
import { CustomDomain } from "@server/models";
import env from "@server/env";
import { generateId } from "./utils";
import { seederLogger } from "./seederLogger";

/**
 * Seeds CustomDomain entries for the application.
 * Uses environment variables to determine the proper domain names for each environment.
 * 
 * @param transaction The Sequelize transaction
 */
export async function seedCustomDomains(transaction: Transaction): Promise<void> {
  Logger.info("utils", "Seeding custom domains...");
  
  // Extract base domain from environment variables
  // Use URL or PUBLIC_URL to determine base domain
  let baseDomain: string;
  
  try {
    // Parse from PUBLIC_URL first as it's intended for external access
    const publicUrlObj = new URL(env.PUBLIC_URL);
    baseDomain = publicUrlObj.hostname;
    
    // For non-localhost domains, try to get the base domain (e.g., example.com from app.example.com)
    if (baseDomain !== "localhost" && baseDomain.split('.').length > 2) {
      baseDomain = baseDomain.split('.').slice(-2).join('.');
    }
    
    seederLogger.info(`Using ${baseDomain} derived from PUBLIC_URL`);
  } catch (error) {
    try {
      // Fallback to URL
      const urlObj = new URL(env.URL);
      baseDomain = urlObj.hostname;
      
      // For non-localhost domains, try to get the base domain
      if (baseDomain !== "localhost" && baseDomain.split('.').length > 2) {
        baseDomain = baseDomain.split('.').slice(-2).join('.');
      }
      
      seederLogger.info(`Using ${baseDomain} derived from URL`);
    } catch (err) {
      seederLogger.warn(`Could not determine base domain from URLs. Using localhost as fallback.`);
      baseDomain = "localhost";
    }
  }
  
  // For local development using port in URL
  if (baseDomain.includes(":")) {
    baseDomain = baseDomain.split(":")[0];
  }
  
  seederLogger.info(`Using base domain: ${baseDomain}`);
  
  // Generate the Irumesa map ID (must match the ID in seedMapData.ts)
  const irumesaMapId = generateId("Irumesa");
  
  // Create the domains to seed
  const mapHostname = `map.${baseDomain}`;
  const appHostname = `app.${baseDomain}`;
  
  const domains = [
    {
      id: generateId(`custom_domain_${mapHostname}`),
      hostname: mapHostname,
      handlerType: "map_view",
      handlerConfig: {
        mapId: irumesaMapId // Now includes the mapId in the configuration
      },
      teamId: null, // Could be linked to a team if needed
    },
    {
      id: generateId(`custom_domain_${appHostname}`),
      hostname: appHostname,
      handlerType: "default_app",
      handlerConfig: null,
      teamId: null,
    }
  ];
  
  // Seed each domain using findOrCreate for idempotency
  let created = 0;
  let updated = 0;
  let errors = 0;
  
  for (const domain of domains) {
    try {
      const [record, wasCreated] = await CustomDomain.findOrCreate({
        where: { hostname: domain.hostname },
        defaults: domain,
        transaction,
      });
      
      if (wasCreated) {
        created++;
        seederLogger.info(`Created custom domain: ${domain.hostname}`);
      } else {
        // Update if exists but needs changes
        await record.update(
          {
            handlerType: domain.handlerType,
            handlerConfig: domain.handlerConfig,
          },
          { transaction }
        );
        updated++;
        seederLogger.info(`Updated custom domain: ${domain.hostname}`);
      }
    } catch (error) {
      errors++;
      seederLogger.error(`Error seeding custom domain ${domain.hostname}`, error);
      throw error;
    }
  }
  
  // Record the counts
  seederLogger.recordCounts("Custom Domains", created, updated, errors);
} 