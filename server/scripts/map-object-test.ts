import "./bootstrap";
import { GameMap as MapModel } from "@server/models";
import Logger from "@server/logging/Logger";

async function testMapLookup() {
  try {
    Logger.info("utils", "Starting map lookup test");
    
    // Fetch the map
    const map = await MapModel.findOne({ where: { title: "Irumesa" } });
    
    if (!map) {
      Logger.info("utils", "Map 'Irumesa' not found");
      return;
    }
    
    // Examine map object
    Logger.info("utils", "Map found, examining object structure");
    
    // Try different ways to access the ID
    Logger.info("utils", `Direct ID access: ${map.id}`);
    Logger.info("utils", `ID type: ${typeof map.id}`);
    
    // Try accessing through dataValues
    if (map.dataValues) {
      Logger.info("utils", `ID via dataValues: ${map.dataValues.id}`);
      Logger.info("utils", `dataValues ID type: ${typeof map.dataValues.id}`);
    }
    
    // Try get method
    if (typeof map.get === 'function') {
      const idViaGet = map.get('id');
      Logger.info("utils", `ID via get(): ${idViaGet}`);
      Logger.info("utils", `get() ID type: ${typeof idViaGet}`);
    }
    
    // Print available properties
    const plainMap = map.toJSON ? map.toJSON() : map;
    Logger.info("utils", `Map properties: ${Object.keys(plainMap).join(', ')}`);
    
    // Try direct JSON.stringify - logging only a few properties to avoid sensitive data
    const safeProps = {
      id: map.id,
      title: map.title, 
      public: map.public
    };
    Logger.info("utils", `Safe map properties: ${JSON.stringify(safeProps)}`);
    
    // Try using toString
    if (map.id && typeof map.id.toString === 'function') {
      Logger.info("utils", `ID.toString(): ${map.id.toString()}`);
    }
    
    Logger.info("utils", "Map test completed");
  } catch (error) {
    if (error instanceof Error) {
      Logger.error("utils", error, { test: "map-lookup" });
    } else {
      Logger.error("utils", new Error("Unknown error in map lookup"), { error });
    }
  }
}

// Run the test
testMapLookup()
  .then(() => {
    Logger.info("utils", "Test script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    if (error instanceof Error) {
      Logger.error("utils", error, { location: "main" });
    } else {
      Logger.error("utils", new Error("Unknown error"), { error });
    }
    process.exit(1);
  });