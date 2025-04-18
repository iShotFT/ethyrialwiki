# Map Overlay System

This system provides a flexible and dynamic way to create and manage map UI overlays with consistent positioning, dragging, and UI reset functionality.

## Key Components

- **BaseOverlay**: Base component for all overlay panels
- **OverlayRegistry**: Central registry for managing overlay components

## Using the Overlay System

### Creating a New Overlay

To create a new overlay that automatically integrates with the positioning system:

```tsx
import React from 'react';
import { BaseOverlay } from '~/components/MapOverlays';

// Define constants for your overlay
const OVERLAY_ID = 'my-custom-overlay';  
const STORAGE_KEY = 'my-custom-overlay-position';
const DRAG_TYPE = 'my-custom-overlay';

const MyCustomOverlay: React.FC = () => {
  return (
    <BaseOverlay
      id={OVERLAY_ID}  // Optional but recommended for clarity
      title="My Custom Panel"
      collapsedTitle="MCP"  // Optional abbreviated title when collapsed
      localStorageKey={STORAGE_KEY}
      defaultPosition={{ position: 'middle-top' }}
      zIndex={15}
      dragType={DRAG_TYPE}
      className="w-[250px]"
    >
      {/* Your overlay content here */}
      <div>Content goes here</div>
    </BaseOverlay>
  );
};

export default MyCustomOverlay;
```

That's it! The new overlay will automatically:

- Register itself with the OverlayRegistry
- Save/load its position from localStorage
- Reset to its default position when the "Reset UI" option is used
- Support dragging with the proper preview

### Advanced Usage

You can also manually register overlays with the registry:

```tsx
import { registerOverlay } from '~/components/MapOverlays';

// Register an overlay without creating the component yet
registerOverlay({
  id: 'future-overlay',
  localStorageKey: 'future-overlay-position',
  defaultPosition: { position: 'bottom-left' },
  title: 'Future Panel'
});
```

## Available Position Options

The following standard positions are available:

- `top-left`
- `top-right`
- `bottom-left`
- `bottom-right`
- `middle-left`
- `middle-right`
- `middle-top`
- `middle-bottom`

You can also add custom offsets:

```tsx
defaultPosition={{ 
  position: 'top-right', 
  offset: { x: 20, y: 50 } 
}}
```

## Resetting UI Positions

The "Reset UI" option in the context menu will automatically reset all registered overlays to their default positions. 