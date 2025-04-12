# OpenLayers Map Implementation in Ethyrial Wiki

## Overview

The Ethyrial Wiki now has a fully functional map component implemented using OpenLayers. This allows users to embed interactive maps within the wiki content.

## Key Features

- Interactive maps rendered using OpenLayers (v7.4.0)
- Custom map node in ProseMirror editor
- Coordinate display for location reference
- Automatic theme adaptation (light/dark mode support)
- Custom styling with clean UI

## Technical Implementation

The map is implemented as a ProseMirror NodeView in `shared/editor/extensions/Map.ts`. Key aspects of the implementation:

1. **MapView Class**: Handles rendering and lifecycle of the OpenLayers map
2. **Plugin System**: Integrated with ProseMirror's plugin architecture
3. **Dynamic Updates**: Map position updates when node attributes change
4. **Resource Management**: Proper cleanup of OpenLayers resources
5. **CSS Integration**: Automatic loading of OpenLayers CSS

## Map Functionality

- Maps center on specified coordinates (x, y)
- Zoom controls with min/max constraints
- Coordinates displayed in corner label
- Prevented event propagation to avoid editor conflicts

## Usage

The map component can be inserted into wiki content and will display locations from the Ethyrial world map based on the provided coordinates.

## Future Enhancements

- Custom map tile sources
- Markers for points of interest
- Legend and scale controls
- Custom style options
