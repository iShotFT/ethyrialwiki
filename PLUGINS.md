# Outline Plugins and Editor Extensions

This document explains the two different types of extensibility in Outline:

## Editor Extensions

Editor extensions are components that extend the functionality of the Outline editor, which is built on ProseMirror. The editor's codebase is organized in `shared/editor/` with the following structure:

### Core Components

- `extensions/` - Editor extensions that enhance core functionality
- `nodes/` - Document structure elements (headings, paragraphs, etc.)
- `marks/` - Inline formatting (bold, italic, links, etc.)
- `commands/` - Editor commands for manipulating content
- `components/` - React components for rendering editor elements
- `embeds/` - Components for embedding external content

### Supporting Infrastructure

- `lib/` - Core utilities and base classes
- `plugins/` - ProseMirror plugins for complex functionality
- `rules/` - Input rules for special syntax
- `queries/` - Helper functions for querying editor state
- `styles/` - Editor styling utilities
- `types/` - TypeScript type definitions

### Extension Types

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

### Creating an Editor Extension

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

### Adding Node Views

For custom rendering of nodes:

```typescript
// shared/editor/components/MyNode.tsx
import React from "react";
import { ComponentProps } from "~/editor/types";

export default function MyNode(props: ComponentProps) {
  return <div className="my-node">{/* Custom rendering */}</div>;
}
```

### Adding Input Rules

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

## Outline Plugins

Outline plugins are standalone components that extend the functionality of the Outline application itself. These plugins are located in the `plugins/` directory and can add features like:

- Authentication providers (Google, Discord, Azure, etc.)
- Analytics integrations (Google Analytics, Matomo, Umami)
- Import/export capabilities (Notion, GitHub)
- Custom settings and configurations
- Webhooks and integrations (Slack, Email)
- Storage providers

## Plugin Directory Structure

Plugins in Outline follow this standard structure:

```
/plugins/your-plugin-name/
  ├── plugin.json            # Plugin metadata
  ├── client/                # Client-side code
  │   ├── index.ts           # Main client entry point
  │   └── components/        # React components
  ├── server/                # Server-side code
  │   ├── index.ts           # Main server entry point
  │   └── api.ts             # API endpoints
  └── shared/                # Code shared between client/server
      └── types.ts           # Shared type definitions
```

## Plugin Registration

Every plugin needs a `plugin.json` file:

```json
{
  "name": "your-plugin-name",
  "description": "Description of your plugin",
  "version": "1.0.0",
  "author": "Your Name",
  "requireUser": true, // Whether plugin requires a user context
  "export": "./client/index", // Path to client export
  "server": "./server/index" // Path to server export
}
```

## Server-Side Extensions

Server extensions can add API endpoints and functionality:

```typescript
// server/index.ts
import { Router } from "express";

export default function init(options: any) {
  const { app } = options;

  // Create a router for your plugin
  const router = Router();

  // Add API endpoints
  router.get("/api/my-plugin", async (req, res) => {
    // Endpoint implementation
    res.json({ success: true });
  });

  // Register the router under your plugin's namespace
  app.use("/my-plugin", router);
}
```

## Client-Side Registration

Register your client-side features:

```typescript
// client/index.ts
import MyComponent from "./MyComponent";

export default function init(options: any) {
  const { app } = options;

  // Return any components to register
  return {
    components: {
      // Register components that can be used in the UI
      MyComponent,
    },
  };
}
```

## Example: Discord Integration Plugin

Below is a conceptual implementation of a Discord integration plugin:

### Structure

```
/plugins/discord/
  ├── plugin.json
  ├── client/
  │   ├── index.ts
  │   └── DiscordSettings.tsx
  ├── server/
  │   ├── index.ts
  │   └── api.ts
  └── shared/
      └── types.ts
```

### Plugin Metadata

```json
// plugin.json
{
  "name": "discord",
  "description": "Adds Discord integration for notifications and authentication",
  "version": "1.0.0",
  "author": "Your Name",
  "requireUser": true
}
```

### Server-Side Implementation

```typescript
// server/api.ts
import { Router } from "express";
import { authenticate } from "~/middlewares/authentication";

export default function init(options: any) {
  const { app } = options;
  const router = Router();

  // Endpoint to configure Discord webhook
  router.post("/webhook", authenticate(), async (req, res) => {
    const { webhookUrl } = req.body;
    const { user } = req;

    if (!webhookUrl) {
      return res.status(400).json({ error: "Webhook URL is required" });
    }

    try {
      // Save webhook configuration
      await saveWebhookConfig(user.id, webhookUrl);
      return res.json({ success: true });
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Could not save webhook configuration" });
    }
  });

  // Register the router under the discord namespace
  app.use("/discord", router);
}
```

### Client Registration

```typescript
// client/index.ts
import DiscordSettings from "./DiscordSettings";

export default function init(options: any) {
  const { app } = options;

  return {
    components: {
      DiscordSettings,
    },
  };
}
```

## Testing Plugins

1. **Development Mode**:

   - Place your plugin in the `/plugins` directory
   - Restart Outline to load your plugin

2. **Debug Mode**:

   - Set `DEBUG=outline:plugins` environment variable to see plugin loading info
   - Use browser dev tools to debug client-side issues

3. **Common Issues**:
   - Plugin not loading: Check exports and plugin.json
   - Server routes not responding: Check route registration and authentication
   - Client components not rendering: Check component registration

## Best Practices

1. **Separation of Concerns**:

   - Keep client and server code separate
   - Use shared types for consistency

2. **Performance**:

   - Optimize API calls
   - Cache data when appropriate

3. **User Experience**:

   - Provide clear feedback for user actions
   - Follow Outline's design patterns

4. **Error Handling**:

   - Handle edge cases gracefully
   - Provide meaningful error messages

5. **Documentation**:
   - Document your plugin's features
   - Include examples of how to use it

## Resources

- [Express Route Documentation](https://expressjs.com/en/guide/routing.html)
- [React Component Documentation](https://reactjs.org/docs/components-and-props.html)

## Contribution

When developing new plugins, consider contributing them back to the Outline community by creating a pull request to the main repository.
