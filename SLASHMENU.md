# Slash Menu Integration for Map Component

## Required Changes

To fully integrate the map component with the slash menu, the following changes are needed:

1. **Register Map Command in Slash Menu**

   - Add map command to the available commands in the slash menu
   - Create appropriate icon for the map command

2. **Command Definition**

   ```typescript
   {
     name: "map",
     description: "Insert a map location",
     shortcut: "/map",
     icon: <MapIcon />,
     perform: () => insertMap(editor),
   }
   ```

3. **Map Node Schema**

   - Ensure the map node is properly defined in the schema:

   ```typescript
   map_block: {
     attrs: {
       map: { default: "ethyrial" },
       x: { default: 0 },
       y: { default: 0 },
       z: { default: 0 },
       mapZoom: { default: 6 },
       name: { default: "" }
     },
     parseDOM: [{ tag: "div.map-block" }],
     toDOM: node => ["div", { class: "map-block", "data-x": node.attrs.x, "data-y": node.attrs.y }, 0]
   }
   ```

4. **Map Insertion Function**

   - Create helper function to insert the map:

   ```typescript
   function insertMap(editor) {
     // Get current position and/or prompt for coordinates
     const coordinates = promptForCoordinates() || { x: 0, y: 0, z: 0 };

     editor
       .chain()
       .focus()
       .insertContent({
         type: "map_block",
         attrs: {
           map: "ethyrial",
           x: coordinates.x,
           y: coordinates.y,
           z: coordinates.z,
           mapZoom: 6,
         },
       })
       .run();
   }
   ```

5. **Coordinate Input UI**

   - Create a simple dialog for inputting coordinates
   - Allow searching for known locations

6. **Extension Registration**

   - Register the map extension with the editor:

   ```typescript
   import MapExtension from "shared/editor/extensions/Map";

   // In editor setup
   extensions: [
     // ... other extensions
     MapExtension,
   ];
   ```

7. **CSS Integration**
   - Ensure the map component styles are properly loaded
   - Add appropriate styling for the map in the editor
