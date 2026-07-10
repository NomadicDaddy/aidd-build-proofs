# Why Spernakit v2 - Technology Decisions

This document explains the technology choices made for Spernakit v2 and why each v1 component was replaced. The theme across the changes: lean on Bun's native capabilities, cut dependencies, and make the code easier to work with.

---

## Backend Framework: Elysia over Express

**v1**: Express 5
**v2**: Elysia on Bun

| Consideration | Express                                           | Elysia                                                  |
| ------------- | ------------------------------------------------- | ------------------------------------------------------- |
| Runtime       | Node.js (with Bun as wrapper)                     | Native Bun - uses Bun's HTTP server directly            |
| Type Safety   | Bolt-on via `@types/express`                      | Built-in - routes, params, and bodies are type-inferred |
| Validation    | Separate library (Joi)                            | Built-in via `t.Object()` schemas (based on TypeBox)    |
| Performance   | Mature but Node.js-bound                          | Bun-native, significantly faster throughput             |
| WebSocket     | Requires `ws` library                             | Native Bun WebSocket via Elysia plugin                  |
| Middleware    | Express middleware chain                          | Elysia plugin system with lifecycle hooks               |
| Swagger       | Manual setup (swagger-jsdoc + swagger-ui-express) | First-party `@elysiajs/swagger` plugin                  |

**Why**: Express was designed for Node.js. Running it under Bun works, but you carry Node.js abstractions (streams, the middleware chain, separate type definitions) that Bun doesn't need. Elysia is built for Bun - it uses Bun's HTTP server directly, infers types end to end from route to response, and folds validation, routing, and documentation into a single declaration. The result: fewer dependencies, fewer type definition packages, and faster cold starts.

**What we dropped**: `express`, `cors`, `helmet`, `compression`, `cookie-parser`, `morgan`, `express-rate-limit`, `express-validator`, and all their `@types/*` packages. Elysia's plugin system replaces all of these with lighter, Bun-native equivalents.

---

## ORM: Drizzle over Prisma

**v1**: Prisma 7
**v2**: Drizzle ORM with `bun:sqlite`

| Consideration     | Prisma                                                 | Drizzle                                            |
| ----------------- | ------------------------------------------------------ | -------------------------------------------------- |
| Schema Definition | `.prisma` DSL file (separate language)                 | TypeScript - schema is code                        |
| Code Generation   | Required (`prisma generate` after every schema change) | None - schema is imported directly                 |
| Query API         | Client methods (`.findMany()`, `.create()`)            | SQL-like builder (`select().from().where()`)       |
| Type Safety       | Generated types from schema                            | Types derived from schema definitions              |
| Database Driver   | Prisma engine (binary)                                 | `bun:sqlite` - Bun's built-in SQLite binding       |
| Migration         | Migration files + `migrate dev` + `migrate deploy`     | Schema push in dev (`db:push`), no migration files |
| Binary Size       | Large - Prisma engine binary (~15MB)                   | Zero binary overhead                               |
| Cold Start        | Slower - engine initialization                         | Instant - direct SQLite access                     |

**Why**: Prisma's code generation adds a build-time step and a binary engine. Every schema change needs `prisma generate` before TypeScript can see the new types. Drizzle drops that: the schema is TypeScript, so types are always in sync. Paired with `bun:sqlite` (Bun's built-in SQLite binding), you get direct database access with no intermediate layers. The schema push workflow (`db:push`) is simpler for development - no migration directories to manage.

**What we dropped**: `@prisma/client`, `@prisma/adapter-libsql`, `prisma` CLI, the `prisma/` directory, `postinstall` hooks for `prisma generate`, and the concept of migration files in development.

---

## Logging: Pino over Winston

**v1**: Winston + winston-daily-rotate-file
**v2**: Pino + pino-pretty

| Consideration | Winston                              | Pino                                           |
| ------------- | ------------------------------------ | ---------------------------------------------- |
| Performance   | Slower - synchronous formatting      | Fastest Node.js/Bun logger - async by default  |
| Output Format | Configurable transports              | Structured JSON (dev-friendly via pino-pretty) |
| Dependencies  | Winston + daily rotate + stream deps | Pino + pino-pretty (2 packages)                |
| Configuration | Complex transport configuration      | Simple options object                          |

**Why**: Winston's transport system is flexible but more than a self-hosted application template needs. Pino produces structured JSON logs by default (machine-parseable for production), with `pino-pretty` for human-readable development output. It's faster, pulls in fewer dependencies, and the configuration is short.

---

## UI Components: shadcn/ui over Custom + DaisyUI

**v1**: Custom components + Tailwind CSS + DaisyUI
**v2**: shadcn/ui + Radix UI primitives + Tailwind CSS v4

| Consideration | DaisyUI                                        | shadcn/ui + Radix                                 |
| ------------- | ---------------------------------------------- | ------------------------------------------------- |
| Ownership     | CSS class library - styles are in node_modules | Source code copied into your project - you own it |
| Accessibility | Basic                                          | Full WAI-ARIA via Radix primitives                |
| Customization | Theme variables only                           | Full control - components are in your source tree |
| Dark Mode     | `data-theme` attribute                         | Tailwind v4 dark variant + CSS variables          |
| Dependency    | Runtime CSS dependency                         | Build-time only - no runtime library              |

**Why**: DaisyUI gives you CSS classes, but the components aren't yours - they live in node_modules and customization stops at theme variables. shadcn/ui takes the opposite approach: components are generated into your project source (`frontend/src/components/ui/`). You own every line and can change anything. The Radix UI primitives underneath handle accessibility (keyboard navigation, screen readers, focus management) that DaisyUI's CSS-only approach can't.

---

## HTTP Client: Native Fetch over Axios

**v1**: Axios
**v2**: Native `fetch` via custom `ApiClient` class

| Consideration | Axios                       | Native Fetch + ApiClient                         |
| ------------- | --------------------------- | ------------------------------------------------ |
| Bundle Size   | ~13KB minified              | 0KB - `fetch` is built into the browser          |
| Dependency    | External package + `@types` | Zero dependencies                                |
| Interceptors  | Axios interceptor chain     | Custom `handleResponse()` + `fetchWithRefresh()` |
| Type Safety   | Generic but loose           | Typed per-method (`get<T>`, `post<T>`)           |

**Why**: Modern browsers and Bun both ship `fetch`. Axios mattered when browser `fetch` support was inconsistent, but that era is over. The custom `ApiClient` in `frontend/src/api/client.ts` gives the same ergonomics (typed methods, automatic error handling, token refresh) without an external dependency.

---

## Toast Notifications: Sonner over react-hot-toast

**v1**: react-hot-toast
**v2**: Sonner

| Consideration  | react-hot-toast                | Sonner                                  |
| -------------- | ------------------------------ | --------------------------------------- |
| API            | `toast()` function             | `toast()` function (same ergonomics)    |
| Styling        | Custom CSS or Tailwind classes | Built-in themes + Tailwind integration  |
| Animations     | Basic enter/exit               | Smooth, polished animations             |
| Promise Toasts | Manual                         | Built-in `toast.promise()`              |
| Stacking       | Basic                          | Expandable stack with hover interaction |

**Why**: Sonner gives a more polished UX out of the box: better animations, promise-based toasts, and expandable stacking. The API is nearly identical, so migration takes little effort.

---

## Forms: react-hook-form over Manual State

**v1**: Manual `useState` + `onChange` handlers
**v2**: react-hook-form

**Why**: Manual form state leads to excessive re-renders - every keystroke re-renders the whole form - plus boilerplate `handleChange` functions. react-hook-form uses uncontrolled components by default and only re-renders what changes. It integrates with Zod for schema validation (the same schemas work on the backend) and handles nested forms, arrays, and conditional fields that manual state makes painful.

---

## State Management: Zustand (Explicit) over Context-Only

**v1**: React Context for most global state
**v2**: Zustand for global state, Context for dependency injection only

**Why**: React Context re-renders the entire subtree whenever any part of the context value changes. Zustand uses selector-based subscriptions - a component re-renders only when the slice of state it reads changes. It also works outside React: the auth store's `logout()` is called from the API client's error handler, which isn't a React component.

---

## Tables: @tanstack/react-table over Custom

**v1**: Custom table components
**v2**: @tanstack/react-table

**Why**: Tables with sorting, filtering, pagination, column resizing, and row selection are harder than they look. TanStack Table is a headless, type-safe table engine that handles those interactions correctly. Paired with shadcn/ui's `DataTable` pattern, you get accessible, fast tables without rebuilding the logic yourself.

---

## Testing: Bun Test + happy-dom over Vitest + jsdom

**v1**: Vitest + jsdom + @vitest/coverage-v8
**v2**: Bun test (`bun:test`) + happy-dom

**Why**: Since the whole stack runs on Bun, Bun's built-in test runner drops the Vitest dependency and its configuration. happy-dom is a faster, lighter DOM implementation than jsdom. The test API (`describe`, `it`, `expect`) is compatible, so test code migrates with few changes.

---

## Command Palette: cmdk (New in v2)

**v2 addition**: cmdk (Command Menu)

**Why**: Power users lean on keyboard-driven navigation. cmdk provides a `Cmd+K` command palette (like VS Code, GitHub, Linear) that plugs into the existing keyboard shortcuts system. It's small (~3KB) and composes with shadcn/ui's command component.

---

## Backend Architecture: Plugins + Guards over Middleware + Controllers

**v1**: Express middleware chain → Controllers → Services
**v2**: Elysia plugins → Guards → Routes → Services

| v1 Pattern                                | v2 Pattern                                      |
| ----------------------------------------- | ----------------------------------------------- |
| `backend/src/controllers/`                | Removed - logic in routes + services            |
| `backend/src/middleware/`                 | `backend/src/plugins/` (Elysia lifecycle hooks) |
| `backend/src/middleware/authorization.js` | `backend/src/guards/role.ts`                    |
| `req.user` via global type augmentation   | `user` in Elysia context (type-safe)            |

**Why**: Express controllers are a convention, not a framework feature - they're just functions that receive `(req, res)`. In Elysia, route handlers receive typed context objects and validation sits next to the route definition, so the controller layer is dead weight. Guards handle authorization as a composable pattern instead of middleware you have to order correctly in a chain.

---

## What Stayed the Same

Not everything changed. These choices proved correct in v1 and carry forward:

- **React 19** - Component model, hooks, concurrent features
- **TanStack Query** - Server state management and caching
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first styling (upgraded to v4)
- **SQLite** - Database engine (now via `bun:sqlite` instead of Prisma)
- **JWT + HTTP-only Cookies** - Authentication strategy
- **5-Tier RBAC** - Role hierarchy (SYSOP > ADMIN > MANAGER > OPERATOR > VIEWER)
- **Soft Delete Pattern** - Recoverable deletion
- **Audit Trail** - Action logging
- **JSON Configuration** - No `.env` files, `bunfig.toml` has `env = false`
- **Monorepo Workspace** - Frontend + Backend in one repository
- **Docker Monolithic Container** - nginx + supervisord + Bun
- **lucide-react** - Icon library
