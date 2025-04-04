# Outline Plugin Development Guide

This document provides guidance on creating custom plugins for Outline, based on our analysis of the existing plugin architecture.

## Plugin Architecture Overview

Outline has a flexible plugin system that allows extending functionality in multiple ways:

- **Editor Extensions**: Enhance the editor with new capabilities
- **Authentication Integrations**: Add new authentication methods
- **UI Components**: Add new UI elements or modify existing ones
- **Server-side Functionality**: Add new API endpoints and server-side features

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
  "requireUser": true,        // Whether plugin requires a user context
  "export": "./client/index",  // Path to client export
  "server": "./server/index"   // Path to server export
}
```

## Editor Extension Development

The editor is built on ProseMirror and uses three main extension types:

1. **Node Extensions**: Define document structure elements
2. **Mark Extensions**: Define inline formatting 
3. **Core Extensions**: Add functionality without being nodes/marks

### Creating an Editor Extension

Editor extensions extend the `Extension`, `Node`, or `Mark` classes:

```typescript
// client/MyExtension.ts
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
      }
    };
  }
  
  inputRules({ schema }) {
    // Define input rules for special syntax
    return [];
  }
}
```

### Adding Suggestion Functionality

For functionality like auto-complete, use the `SuggestionsMenuPlugin`:

```typescript
// client/SuggestionExtension.ts
import { Extension } from "~/editor/lib/Extension";
import { SuggestionsMenuPlugin } from "~/editor/plugins/Suggestions";

export default class SuggestionExtension extends Extension {
  get name() {
    return "suggestion";
  }

  get plugins() {
    return [
      new SuggestionsMenuPlugin({
        openRegex: /\@(\w*)$/,      // Trigger on @
        closeRegex: /\s$/,           // Close on space
        enabledInCode: false,
        trigger: "@",
        allowSpaces: false,
        requireSearchTerm: true,
      }, 
      {
        open: false,
        query: ""
      },
      /\@(\w*)$/),
    ];
  }
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
import MyExtension from "./MyExtension";

export default function init(options: any) {
  const { editor } = options;
  
  // Register editor extensions if needed
  if (editor) {
    editor.registerExtension(MyExtension);
  }
  
  // Return any components to register
  return {
    components: {
      // Register components that can be used in the UI
    }
  };
}
```

## Example: Wiki-Links Plugin

Below is a conceptual implementation of a Wiki-Links plugin:

### Structure

```
/plugins/wikilinks/
  ├── plugin.json
  ├── client/
  │   ├── index.ts
  │   └── WikiLinkExtension.ts
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
  "name": "wikilinks",
  "description": "Adds wiki-style linking using [brackets]",
  "version": "1.0.0",
  "author": "Your Name",
  "requireUser": true
}
```

### Editor Extension

```typescript
// client/WikiLinkExtension.ts
import { Extension } from "~/editor/lib/Extension";
import { SuggestionsMenuPlugin } from "~/editor/plugins/Suggestions";
import { PluginKey } from "prosemirror-state";

// Plugin key to identify our plugin's state
const WIKI_LINK_KEY = new PluginKey("wikiLinks");

export default class WikiLinkExtension extends Extension {
  get name() {
    return "wikiLinks";
  }

  get plugins() {
    // State for our suggestions menu
    const suggestionsState = {
      open: false,
      query: ""
    };
    
    // The regex to detect when a user is typing a wiki link
    const openRegex = /\[([^[\]]+)$/;
    
    return [
      // Create a suggestions plugin for wiki links
      new SuggestionsMenuPlugin({
        openRegex: openRegex,
        closeRegex: /\]$/,           // Close on ]
        enabledInCode: false,
        trigger: "[",
        allowSpaces: true,
        requireSearchTerm: false,
      }, 
      suggestionsState,
      openRegex),
    ];
  }

  // Define input rules for wiki link syntax
  inputRules({ schema }) {
    return [
      // Rule to transform [Title] into a wiki link
      // Implementation would go here
    ];
  }
  
  // Add commands to create wiki links
  commands() {
    return {
      createWikiLink: (attrs) => (state, dispatch) => {
        // Logic to create a wiki link node
        return true;
      }
    };
  }
}
```

### Server-Side Implementation

```typescript
// server/api.ts
import { Document } from "~/models";

// Find document by title
export async function findDocumentByTitle(title: string) {
  return await Document.findOne({
    where: { title },
  });
}

// Create a new document from title
export async function createDocumentFromTitle(title: string, userId: string) {
  return await Document.create({
    title,
    text: "",
    userId,
  });
}
```

```typescript
// server/index.ts
import { Router } from "express";
import { findDocumentByTitle, createDocumentFromTitle } from "./api";
import { authenticate } from "~/middlewares/authentication";

export default function init(options: any) {
  const { app } = options;
  const router = Router();

  // Endpoint to search for documents by title
  router.get("/search", authenticate(), async (req, res) => {
    const { query } = req.query;
    
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query is required" });
    }
    
    const documents = await Document.findAll({
      where: {
        title: {
          [Op.iLike]: `%${query}%`,
        },
      },
      limit: 10,
    });
    
    return res.json(documents);
  });

  // Endpoint to create a document from a title
  router.post("/create", authenticate(), async (req, res) => {
    const { title } = req.body;
    const { user } = req;
    
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }
    
    try {
      const document = await createDocumentFromTitle(title, user.id);
      return res.json(document);
    } catch (error) {
      return res.status(500).json({ error: "Could not create document" });
    }
  });

  // Register the router under the wikilinks namespace
  app.use("/wikilinks", router);
}
```

### Client Registration

```typescript
// client/index.ts
import WikiLinkExtension from "./WikiLinkExtension";

export default function init(options: any) {
  const { editor } = options;
  
  if (editor) {
    editor.registerExtension(WikiLinkExtension);
  }
  
  return {
    // Return any components this plugin adds
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
   - Editor extensions not working: Check registration and extension implementation
   - Server routes not responding: Check route registration and authentication

## Best Practices

1. **Separation of Concerns**:
   - Keep client and server code separate
   - Use shared types for consistency

2. **Performance**:
   - Editor extensions should be lightweight
   - Debounce API calls for features like autocomplete

3. **User Experience**:
   - Provide visual feedback for user actions
   - Follow Outline's design patterns

4. **Error Handling**:
   - Handle edge cases gracefully
   - Provide meaningful error messages

5. **Documentation**:
   - Document your plugin's features
   - Include examples of how to use it

## Resources

- [ProseMirror Documentation](https://prosemirror.net/docs/)
- [React Component Documentation](https://reactjs.org/docs/components-and-props.html)
- [Express Route Documentation](https://expressjs.com/en/guide/routing.html)

## Contribution

When developing new plugins, consider contributing them back to the Outline community by creating a pull request to the main repository. 