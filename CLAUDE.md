# CLAUDE.md - Fireboard

Firestore browser/editor (a Firefoo replacement) with first-class support for multiple projects and multiple named databases per project (regional databases such as `(default)`, `default-au`, `default-eu`).

One codebase, two builds (see `nuxt.config.ts`):

- **local** (default): a local-only tool. The Nitro server holds the user's credentials, serves the UI on 127.0.0.1, the MCP endpoint, and server-side snapshots.
- **cloud** (`FIREBOARD_MODE=cloud`): the hosted app on Cloudflare Workers. The server only handles app accounts (Better Auth on D1) and billing (Stripe). Firestore is read and written **from the browser** with the user's own Google token, so the server never holds or sees anyone's Google credentials or data.

## Tech Stack

- Nuxt 4 (SPA, `ssr: false`) + Vue 3 Composition API + TypeScript
- Naive UI (dark theme), `@vicons/ionicons5`
- Local build: Nitro (node-server) routes using `firebase-admin` (one Admin App per connection)
- Cloud build: Nitro `cloudflare_module`, Better Auth (D1, `@better-auth/stripe`), `nuxt-security` (CSP with nonces), `@vite-pwa/nuxt`
- Browser data access: `shared/firestore-rest` (Firestore REST API) with Google Identity Services tokens
- Zod for request validation, Vitest for unit tests

## Security Model (read before changing server code)

Local build: holds live production credentials, so it is **local-only**.

- **Never** deploy the local build. Only the cloud build (`npm run build:cloud`) is deployed, and only to Cloudflare with the `martincolley` wrangler profile (never a work account).
- Local-only server code lives in `server/local/` with **explicit imports**. Never put it back in `server/utils/` (auto-imported, so the cloud bundle would compile it and pull Firebase Admin into the Worker). Local-only routes are excluded from the cloud build via `LOCAL_ONLY` in `nuxt.config.ts`; add new local routes there.
- Dev and start scripts bind to `127.0.0.1`. Do not add `--host` without an address.
- `server/middleware/localOnly.ts` must keep: loopback `Host` check (DNS rebinding), `Origin` match, and the `x-fireboard: 1` header on non-GET requests (CSRF). Client calls go through `api()` in `app/composables/useApi.ts`, which adds that header.
- Credentials are never stored in the repo. Connections live in `~/.config/fireboard/connections.json` (override with `FIREBOARD_CONFIG`), written with mode 600. Service account keys are referenced by path only and never returned in full or logged.
- Every write route must use `resolveWritableTarget()` so read-only connections are enforced server side.
- Companion bridge: origins in `FIREBOARD_ALLOWED_ORIGINS` (the hosted app) may call only `POST /api/view` and `GET /api/events`, with CORS + Private Network Access headers. Never widen that list.
- `/mcp` is exempt from the `x-fireboard` header (MCP clients can't send it) but keeps the Host/Origin checks. Adding MCP write tools or exposing `/mcp` beyond localhost (tunnels, shared access) needs per-user auth, scoped grants and an audit log first; ask the user before doing either.

## Cloud security model

- The Worker must never receive Google access tokens or Firestore data. Browser code calls Firestore directly; Google tokens live in memory only (`useGoogleAuth`), never in storage.
- Better Auth stores no OAuth provider tokens (`databaseHooks` strip them). App sign-in is Google (openid/email) in production; email/password only when `ENABLE_PASSWORD_LOGIN=true` (local testing).
- Access = verified email in `ALLOWED_EMAILS`, or an active/trialing Stripe subscription (`server/cloud/access.ts`). Every `/api/cloud/*` data route calls `requireEntitled()` and scopes by user id.
- CSP (`nuxt-security`, nonces + strict-dynamic) allows scripts only from self and Google Identity Services, and connections only to self, Google APIs and localhost (emulator, companion). Don't add third-party scripts.
- Snapshots in the hosted app are built and stored in the browser (IndexedDB), never sent to the server.

## Architecture

- `shared/types/` - `FsValue` (lossless tagged Firestore value), `FsDoc`, query types, `Connection`.
- `shared/utils/` - extended JSON (`__time__`, `__ref__`, `__lat__/__lon__`, `__bytes__`, `__vector__`), timestamp ISO with nanos, path helpers.
- `server/local/` (local build only, explicit imports) - connection store, Admin App/database cache, `fsCodec` (Admin SDK <-> `FsValue`), query builder, REST listDocuments (shows "missing" docs that only hold subcollections).
- `server/api/connections/*` - CRUD for connections, `GET :id/databases` discovers every database in the project via the Firestore Admin REST API.
- `server/api/fs/*` - `collections`, `doc` (get/put/post/delete), `field` (patch one field), `query`, `count`.
- `server/local/fsService.ts` - every Firestore operation; API routes and MCP tools both call it. Put new operations here, not in route handlers.
- `server/mcp/` + `server/routes/mcp.ts` - stateless Streamable HTTP MCP server (read-only tools). `server/local/liveView.ts` bridges the UI: the UI posts its active tab to `/api/view` and listens on `/api/events` (SSE) for commands such as `open_in_fireboard`.
- `server/cloud/` + `server/api/auth`, `server/api/cloud/*` (cloud build only) - Better Auth, entitlement, per-user projects in D1. `migrations/` holds the D1 schema.
- `shared/firestore-rest/` - Firestore REST client + codec + structured query builder (same semantics as the server API, incl. missing docs and cursors). Integration spec runs against an emulator with `FIREBOARD_TEST_EMULATOR=host:port`.
- `app/drivers/` - `DataDriver` per connection: `localDriver` (server API) or `restDriver` (browser REST). Components use `useDriver()`, never the API directly.
- `app/composables/` - `useMode`, `useDriver`, `useAccount` (Better Auth client), `useGoogleAuth`, `useCompanion`, `useConnections`, `useTabs` (tabs persisted to localStorage, each pinned to connection + database), `useDocWrites`, `useFieldEditor` (provide/inject for nested field rows).
- `app/components/sidebar`, `browser`, `value` - auto-imported as `Sidebar*`, `Browser*`, `Value*`.

## Rules

- **Values cross the wire only as `FsValue`.** Never send raw Admin SDK objects to the client or parse plain JSON into writes without `fromExtJson`/`fsValueSchema`; that is how types (timestamps, refs) get silently lost.
- Firestore cannot address array elements: nested edits inside arrays go through `toFieldUpdate()` which rewrites the nearest field above the array.
- Plain browsing (no filters/order) lists by id with `showMissing`; filtered queries run structured queries. The local server (Admin SDK) and `shared/firestore-rest` (browser) must keep the same semantics and both return `FsQueryResult`.
- Keep files small and single-purpose; add a new component rather than growing an existing one.

## Emulator and anonymized snapshots

- Emulator connections (`credential.type: "emulator"`, host must be localhost) are built with `@google-cloud/firestore` directly, because firebase-admin refuses to create a Firestore client without Google credentials. Keep `@google-cloud/firestore` pinned to the version firebase-admin uses so `instanceof Timestamp` etc. still match.
- `shared/snapshots/collect.ts` walks and collects documents for both builds. Local snapshots (`server/local/snapshots/`) copy real data, anonymize it, and write `~/.config/fireboard/snapshots/<name>/docs.ndjson`. Raw documents stay in memory only; never write un-anonymized data to disk.
- Hosted snapshots (`app/snapshots/`) are built in the browser, stored in IndexedDB, and can be downloaded/imported as `.fireboard.ndjson` files.
- The anonymizer (`shared/anonymize/`, pure JS so it runs in Node and the browser) is two-pass: `learn()` every document, then `fields()`, so names copied into other fields (userName, lodgedBy, nameLower, free text) are replaced too. Rules live in the user's `anonymize.json`; defaults in `config.ts`. Any change here needs a test in `__tests__/anonymizer.spec.ts` that proves the real value no longer appears.
- `loadSnapshot` must refuse non-emulator targets. Never add a path that loads snapshots into a real project.

## Delivery

- Work on a feature branch, never commit directly to `main` unless the user asks. Commit and push at logical checkpoints; when implementation is complete, open or update a draft PR.
- Then run `/ci-review` (`.claude/skills/ci-review/SKILL.md`) for the exact PR head, verify and fix confirmed findings, then hand to an independent `/functional-review` (`.claude/skills/functional-review/SKILL.md`). Never self-approve functional review. Codex reads the same skills via `.agents/skills`.
- Mark ready only after both receipts match the current head. Merge only with the user's explicit approval. No GitHub CI is configured; don't wait for checks.
- Deploy only the cloud build, only with the `martincolley` wrangler profile (bound to this folder), and only when the user asks.

## Tooling

- **TABS only.** `npx oxfmt <files>` and `npx oxlint <files>` before handing back.
- Typecheck: `npm run typecheck` (`vue-tsc -b --noEmit`). If auto-imported names are missing, run `npx nuxi prepare` first.
- Tests: `npm test`. Add tests for codec/edit/query logic (lossless round-trips, field update rules), not for ordinary UI wiring.
- Dev server: `npm run dev` (127.0.0.1:4321) belongs to the user. For agent verification use another port, e.g. `FIREBOARD_CONFIG=<scratch config> npx nuxt dev --host 127.0.0.1 --port 5399`, record the PID and kill only that PID.
- Verify UI with an isolated browser session: `agent-browser --session fireboard open http://127.0.0.1:5399/`.
- When verifying against real projects, use a scratch config with `"readOnly": true` unless the user explicitly approves writes to a specific database.
