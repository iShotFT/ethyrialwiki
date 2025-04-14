# Dynamic Domain Routing for Custom Pages

This document outlines the system implemented to handle custom domain names within the Ethyrial Wiki (Outline-based) application, allowing different domains or subdomains to serve distinct content (like the interactive map) while leveraging the core Outline authentication and infrastructure.

## Problem

We needed a way to serve unique content (initially, an interactive map page) on a specific domain (e.g., `map.ethyrial.wiki`) without hardcoding URLs into the routing logic. The solution needed to be flexible, scalable, and integrate with Outline's existing authentication.

## Solution: Dynamic Domain Configuration

A dynamic routing system was implemented using a combination of a new database table for configuration, Redis for caching (temporarily disabled during debug, see below), custom Koa middleware, and modifications to the main routing logic.

### 1. Database Configuration (`custom_domains` Table)

A new table was added to the PostgreSQL database to store the mapping between hostnames and the desired behavior.

*   **Migration:** `ethyrialwiki/server/migrations/20250726110000-create-custom-domains.js`
*   **Model:** `ethyrialwiki/server/models/CustomDomain.ts`
*   **Schema Highlights:**
    *   `hostname` (String, Unique): The specific domain/subdomain (e.g., "map.ethyrial.wiki", "map.localhost").
    *   `handlerType` (String): Defines how the request should be handled (e.g., 'map_view', 'default_app', 'static_page').
    *   `handlerConfig` (JSONB): Optional JSON object containing configuration specific to the `handlerType` (e.g., `{ "mapId": "..." }` for 'map_view').
    *   `teamId` (UUID, Nullable): Optional link to an Outline team for management.

### 2. Middleware (`customDomainResolver.ts`)

A new Koa middleware was created to resolve the domain configuration for each incoming request.

*   **File:** `ethyrialwiki/server/middlewares/customDomainResolver.ts`
*   **Functionality:**
    1.  Extracts the `hostname` from the request context (`ctx.hostname`).
    2.  **(Cache Temporarily Disabled):** Logic for Redis caching (get and set) was commented out during debugging to isolate database interaction issues.
    3.  **Database Lookup:** Queries the `custom_domains` table for a matching `hostname` using `CustomDomain.findOne({ where: { hostname } })`.
    4.  **Data Access:** Uses `record.getDataValue('attributeName')` to reliably retrieve values from the returned Sequelize model instance (`record`). **Key Learning:** Direct property access (e.g., `record.handlerType`) proved unreliable in this context and returned `undefined` despite the data being present in the raw query result. Using `getDataValue()` resolved this.
    5.  **Context Update:** Attaches the found or default configuration to `ctx.state.domainConfig`. The default config is `{ type: 'default_app', config: null }`.
    6.  Calls the next middleware.

### 3. Middleware Integration

The `customDomainResolver` middleware is added to the Koa application stack in `ethyrialwiki/server/services/web.ts`. It runs *before* the main application router (`routes`) is mounted.

```typescript
// ethyrialwiki/server/services/web.ts excerpt
// ...
app.use(mount("/auth", auth));
app.use(mount("/api", api));

// Resolve custom domain configuration *before* main routes
app.use(customDomainResolver()); // <--- Added here

// ... (Security headers, etc.) ...

app.use(mount(routes));
// ...
```

### 4. Routing Logic (`server/routes/index.ts`)

The main catch-all route (`router.get("*", ...)`) in `ethyrialwiki/server/routes/index.ts` was modified to use `ctx.state.domainConfig` for dispatching.

*   A `switch` statement checks `domainConfig.type`:
    *   `case 'map_view'`: Serves the placeholder `public/map.html`.
    *   `case 'static_page'`: Attempts to serve a static file based on `domainConfig.config.staticPath`.
    *   `case 'share'`: (Placeholder logic) Delegates to `renderShare`.
    *   `case 'default_app'` (and `default`): Falls back to the original logic for rendering the main Outline React application (`renderApp`).

### 5. Placeholder (`public/map.html`)

A basic HTML file (`ethyrialwiki/public/map.html`) was created as the entry point for the `'map_view'` handler type.

### 6. Local Testing (Proxy & `*.localhost`)

To test different hostnames locally without manual `hosts` file edits or requiring admin privileges:

*   **Reverse Proxy:** A Caddy reverse proxy was configured (`ethyrialwiki/Caddyfile`) and added as a service (`proxy`) to `ethyrialwiki/docker-compose.yml`. It listens on the host's port `8080` and forwards requests to the main Outline application running on the host (`host.docker.internal:4000`), preserving the original `Host` header.
*   **Automatic Resolution:** Modern browsers automatically resolve `*.localhost` domains (e.g., `map.localhost`, `app.localhost`) to `127.0.0.1`.
*   **Database Seeding:** Entries for test hostnames (e.g., `map.localhost`, `app.localhost`) were added manually to the `custom_domains` table with appropriate `handlerType` values.
*   **Testing:** Accessing `http://map.localhost:8080` routes through the proxy to the Outline app, which uses the `customDomainResolver` to identify the handler type based on the `Host` header and serve the correct page.

## How Authentication Works

1.  A request arrives via the proxy (e.g., `http://map.localhost:8080`).
2.  Browser sends existing cookies (for `map.localhost`).
3.  Proxy forwards the request to Outline (`http://host.docker.internal:4000`) with the original `Host: map.localhost` header.
4.  Request passes through Outline's middleware stack, including authentication, populating `ctx.state.user` if logged in.
5.  `customDomainResolver` runs, finds `handlerType: 'map_view'`, and sets `ctx.state.domainConfig`.
6.  The catch-all route in `server/routes/index.ts` executes.
7.  The `switch` directs the request to the `'map_view'` case.
8.  `map.html` is served. `ctx.state.user` is available if the user was logged in.
9.  Future JavaScript in `map.html` can make authenticated API calls using the browser's session cookie.

## Troubleshooting & Key Learnings

*   **Seeding:** Using `sequelize-cli db:seed` is unreliable as it doesn't track execution. Custom seeding scripts (e.g., `server/scripts/seed-map.ts`) using model methods like `Model.findOrCreate` or `Model.bulkCreate` provide more control and reliability. Use `yarn seed:map`, `yarn seed:domains` (or execute compiled scripts directly with `node ./build/server/scripts/...`) to run them.
*   **Bulk Upsert Bug:** `Model.bulkCreate` with `updateOnDuplicate` can fail in Sequelize v6 with certain data types (like UUIDs) due to SQL generation issues (`s.replace is not a function`). **Workaround:** Implement manual upsert logic using a loop with `Model.findOrCreate` and `instance.update`.
*   **Model Field Shadowing:** Defining public class fields in TypeScript models (e.g., `hostname: string;`) can shadow Sequelize's getters/setters, leading to issues accessing data fetched from the database. Using `instance.getDataValue('fieldName')` reliably retrieves the data. The `declare` keyword is the technically correct TS approach but caused Babel build issues in this project.
*   **tsx vs. Node Execution:** Running TS scripts directly with `tsx` (used by `yarn seed:*`) can have different type resolution behavior than running compiled JS with `node`. Errors related to missing explicit `DataType` decorators in core models appeared with `tsx` but not with `node`. Avoided modifying core models by running seeders via `node` after compiling.
*   **OAuth State Cookie:** Browsers can be strict about setting/sending cookies for parent domains (`.local.test`) defined via `hosts` files. The temporary `state` cookie for OAuth must be set for the *specific* hostname (`app.local.test`). The persistent `accessToken` cookie *can* be set for the parent domain (`.local.test`) to enable cross-subdomain login.
*   **OAuth State Verification (Dev Bypass):** The `state` cookie check is bypassed in development (`env.isDevelopment`) due to local setup issues. **REMOVE BEFORE PRODUCTION.**
*   **Koa Proxy/Hostname:** Setting `app.proxy = true` is necessary but wasn't sufficient to guarantee correct `ctx.hostname` resolution early in the Passport middleware chain. Using `env.PUBLIC_URL` or passing the original host via the state parameter was needed for correct cookie/redirect domains.
*   **API Routing:** Ensure API routers (`/api/...`) are mounted *before* catch-all application routers in Koa to prevent page HTML from being served instead of JSON API responses.
*   **Frontend API Client:** Use relative API paths (`/api/...`) from the frontend (`mapIndex.tsx`, `MapScene.tsx`) so requests target the same origin as the page, avoiding CORS issues when using the reverse proxy.
*   **OpenLayers Coordinates:** Carefully match the `TileGrid` origin (`getBottomLeft` for bottom-up Y) and the `tileUrlFunction` coordinate transformation (`maxYIndex - y_ol`) to the game's coordinate system and tile naming convention.
*   **OpenLayers Resolutions:** For tile sets with only one detail level, use `resolutions: [1]` in the `TileGrid` but provide multiple scaling resolutions in the `View` options to allow visual zooming.

## Future Work / Considerations

*   **Re-enable Redis Caching:** Uncomment caching in `customDomainResolver.ts`.
*   **Remove State Bypass:** Remove dev bypass in `server/utils/passport.ts`.
*   **Refine Seeder Categorization:** Improve logic in `seed-map.ts` to categorize resource nodes.
*   **Seeder Management:** Consider a more robust way to manage running seeders than manual Node execution (e.g., a dedicated script runner).
*   **Database Seeding/Management:** Create UI/CLI for `custom_domains`.
*   **Share Integration:** Define `custom_domains` vs. `shares` interaction.
*   **Frontend Bundling:** Update Vite config for map bundle.
*   **API Development:** Build marker CRUD endpoints.
*   **Error Handling:** Improve error handling.
*   **Map UI:** Implement search, marker filtering based on category toggles, marker popups/styling.
