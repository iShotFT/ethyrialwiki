import { v5 as uuidv5 } from "uuid";
import path from "path";

// Use a single, consistent namespace UUID across the entire seeder
export const NAMESPACE_UUID = "e7a7b7f6-2a2b-4c4c-8d8d-9e9e9e9e9e9e";

export function generateSlug(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, "") // Remove invalid chars
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, ""); // Trim hyphens from start/end
}

export function formatTitle(text: string): string {
  if (!text) return "";
  // Remove terms like " Vein", " Flower", " Bush", " Plant", " Tree", " Sapling", " Ancient", " Aging", " Verdant"
  // Adjusted regex to be more specific and handle potential prefixes/suffixes
  const baseName = text
    .replace(
      /\s+(Vein|Flower|Bush|Plant|Tree|Sapling|Ancient|Aging|Verdant)$/i,
      ""
    )
    .trim();

  // Re-add common suffixes based on original pattern - can be expanded
  let finalTitle = baseName;
  if (text.match(/vein$/i)) {
    finalTitle += " Ore";
  } else if (
    text.match(
      /(Acacia|Oak|Elystram|Spiritwood|Moonwillow|Wispwood|Staroak|Aetherbark|Mana Ash|Shadewood|Duskroot|Primordial)$/i
    )
  ) {
    finalTitle += " Logs";
  } else if (text.match(/flower$/i)) {
    finalTitle += " Flower"; // Example re-adding
  } else if (text.match(/plant$/i)) {
    finalTitle += " Plant";
  } // Add more rules if necessary for fibers, petals etc.

  // General title formatting (space before caps, capitalize words)
  return finalTitle
    .replace(/([A-Z])/g, " $1") // Add space before capitals
    .replace(/[\s_]+/g, " ") // Replace underscores/multiple spaces with single space
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize first letter of each word
}

// Generates a deterministic UUID based on the slug
export function generateId(slug: string): string {
  return uuidv5(slug, NAMESPACE_UUID);
}

// Path helpers
export const SEEDER_DIR = path.resolve(process.cwd(), "seeder");
export const INPUT_DIR = path.join(SEEDER_DIR, "input");
export const OUTPUT_DIR = path.join(SEEDER_DIR, "output");
export const PYTHON_SCRIPTS_DIR = path.join(SEEDER_DIR, "python_scripts");
