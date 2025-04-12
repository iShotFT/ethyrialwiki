# Outline Editor Extensions

Editor extensions are components that extend the functionality of the Outline editor, which is built on ProseMirror. The editor's codebase is organized in `shared/editor/` with the following structure:

## Core Components

- `extensions/` - Editor extensions that enhance core functionality (e.g., History, Math, Mermaid, Placeholder)
- `nodes/` - Document structure elements (headings, paragraphs, etc.)
- `marks/` - Inline formatting (bold, italic, links, etc.)
- `commands/` - Editor commands for manipulating content
- `components/` - React components for rendering editor elements
- `embeds/` - Components for embedding external content

## Supporting Infrastructure

- `lib/` - Core utilities and base classes
- `plugins/` - ProseMirror plugins for complex functionality
- `rules/` - Input rules for special syntax
- `queries/` - Helper functions for querying editor state
- `styles/` - Editor styling utilities
- `types/` - TypeScript type definitions

## Extension Types

1. **Node Extensions** (`nodes/`)

   - Define document structure elements
   - Examples: Headings, paragraphs, lists, tables
   - Extend the `Node` class

2. **Mark Extensions** (`marks/`)

   - Define inline formatting
   - Examples: Bold, italic, links, code
   - Extend the `Mark` class

3. **Core Extensions** (`extensions/`)
   - Add functionality without being nodes/marks
   - Examples: History, placeholders, suggestions
   - Extend the `Extension` class

## Creating an Editor Extension

Editor extensions follow a consistent pattern:

```typescript
// shared/editor/extensions/MyExtension.ts
import { Extension } from "~/editor/lib/Extension";

export default class MyExtension extends Extension {
  get name() {
    return "myExtension";
  }

  get plugins() {
    // Return an array of ProseMirror plugins
    return [];
  }

  commands() {
    // Define commands that can be executed
    return {
      myCommand: () => (state, dispatch) => {
        // Command implementation
        return true;
      },
    };
  }

  inputRules({ schema }) {
    // Define input rules for special syntax
    return [];
  }
}
```

## Adding Node Views

For custom rendering of nodes:

```typescript
// shared/editor/components/MyNode.tsx
import React from "react";
import { ComponentProps } from "~/editor/types";

export default function MyNode(props: ComponentProps) {
  return <div className="my-node">{/* Custom rendering */}</div>;
}
```

## Adding Input Rules

For special syntax handling:

```typescript
// shared/editor/rules/myRule.ts
import { InputRule } from "~/editor/lib/InputRule";

export default function myRule() {
  return new InputRule(/pattern/, (state, match, start, end) => {
    // Rule implementation
    return state.tr;
  });
}
```

## Testing Extensions

1. **Development Mode**:

   - Place your extension in the appropriate directory under `shared/editor/`
   - Restart Outline to load your extension

2. **Debug Mode**:

   - Use browser dev tools to debug client-side issues
   - Check the editor's state and plugin system

3. **Common Issues**:
   - Extension not loading: Check registration and implementation
   - Node views not rendering: Check component implementation
   - Commands not working: Check command registration and implementation

## Best Practices

1. **Performance**:

   - Keep extensions lightweight
   - Optimize node views and plugins

2. **User Experience**:

   - Provide visual feedback for user actions
   - Follow Outline's design patterns

3. **Error Handling**:
   - Handle edge cases gracefully
   - Provide meaningful error messages

## Resources

- [ProseMirror Documentation](https://prosemirror.net/docs/)
- [React Component Documentation](https://reactjs.org/docs/components-and-props.html)
