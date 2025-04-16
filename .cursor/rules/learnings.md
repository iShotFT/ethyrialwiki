# Learnings from Development

- **Code Organization**: Extracted complex functions from large components into separate utility files to improve maintainability
  - Created `mapUtils.ts` for Base62 encoding/decoding and URL hash management
  - Created `heatmapUtils.ts` for handling heatmap data visualization
  - Created `markerStyleUtils.ts` for marker icon styling and rendering

- **TypeScript Best Practices**: 
  - Added proper type annotations to prevent "implicit any" errors
  - Used type-safe references in React components
  - Fixed errors related to ref handling in React-DnD drag and drop

- **UI Component Development**:
  - Created the `SelectedItemButton` component using Ethyrial's distinctive style
  - Implemented visual indication of selected resources
  - Added a convenient way to clear selection

- **Error Handling Best Practices**:
  - Fixed Logger warnings by correctly creating Error objects rather than passing strings
  - Implemented proper TypeScript error handling patterns

- **Path Management**:
  - Fixed import paths in scripts after file relocation
  - Ensured relative paths work correctly when files are moved

- **Data Extraction**:
  - Created a script to extract and analyze game data categories and resources
  - Implemented JSON output format for better data portability

- **Styling Patterns**:
  - Used the Ethyrial style system consistently across new components
  - Maintained visual consistency with the existing application
  - Utilized the iconography system correctly

- **Component Interaction**:
  - Implemented clear parent-child communication patterns
  - Added proper callback handling for selection/deselection
  - Maintained state across component boundaries 

# Project Navigation & Context Notes

- **Code Structure Key Locations**:
  - UI components in `app/components/` - Main React components
  - Ethyrial style system in `app/components/EthyrialStyle/` - Contains GameItemIcon and styling components
  - Utility functions in `app/utils/` - Place for extracted functions like mapUtils, heatmapUtils
  - Server models in `server/models/` - Database models for game items, resources, categories
  - Scripts in `seeder/scripts/` - Data extraction and seeding scripts

- **Important Component Files**:
  - `app/components/HeatmapOverlayPanel.tsx` - Controls the heatmap resource selection UI
  - `app/components/EthyrialMapFull.tsx` - Main map component (very large file)
  - `app/components/MapOverlayPanel.tsx` - Controls category selection interface
  - `app/components/EthyrialStyle/GameItemIcon.tsx` - Renders item icons with proper styling

- **Data Model Relationships**:
  - Game items belong to categories via `GameItemItemCategory` join table
  - Resources are linked to items via `itemId` foreign key
  - Icons are linked to both items and categories
  - `GameItemCategory` has DisplayGroup enum with "HEATMAP" value

- **Style Patterns & Conventions**:
  - Use `IngameBorderedDiv` for panel containers
  - Use dark color theme: background `#38322c` with inner `#151515`
  - Border pattern is typically `border-[#4e443a]` for lighter borders
  - Selected items use `#ffd5ae` highlight color
  - Use `className={cn()}` pattern for conditional class names

- **URL & Navigation Patterns**:
  - URL hash format for map: `#map=zoom/x/y/resourceId`
  - Resource IDs in URL use Base62 encoding for compactness
  - Update URL with `window.history.replaceState()` to avoid navigation

- **Script Execution Context**:
  - Data extraction scripts should create output in `output/` directory
  - Script imports require relative paths from script location
  - Need to import `server/bootstrap` before using DB models

- **Logging Patterns**:
  - Use `Logger.debug("misc", "Message")` for debug logs
  - For warnings and errors, use `Logger.warn("misc", new Error("Message"))`
  - Add prefixes like `[ResourceDebug]` for easy log filtering

- **Drag & Drop Implementation**:
  - React-DnD requires separate refs for preview and drag handle
  - Connect drag ref with `connectDrag(ref.current)` in useEffect
  - Custom drag layer needed for proper preview 