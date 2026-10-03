# Fireboard

A Firestore browser and editor for projects that live in more than one region: every project, every named database (`(default)`, `default-eu`, `default-au`...), typed values, inline editing, queries, right-click actions, anonymized snapshots of real data for the emulator, and an MCP server for Claude Code.

- **Hosted:** [fireboard.dev](https://fireboard.dev). You sign in with your own Google account and Firestore is read straight from Google into your browser; the server never sees your data.
- **Local:** run it on your own machine with a service account or your gcloud login (below).

## Source-available, no support

Fireboard is **source-available** under the [Functional Source License (FSL-1.1-MIT)](LICENSE.md): read it, audit it, run it locally, modify it and fork it for your own use. You may not use it to offer a competing commercial product or service. Each version becomes MIT-licensed two years after its release.

It is provided **as-is, without support**. Issues are turned off; we don't help with individual setups. Pull requests may be ignored. If you want to check what it does with your data (tracking, network calls), the code is all here: start with `shared/firestore-rest/`, `app/drivers/` and `nuxt.config.ts` (the Content Security Policy lists every host the hosted app may contact).

## Run locally

```bash
git clone https://github.com/martincolley/fireboard.git
cd fireboard
npm install
npm run dev        # http://127.0.0.1:4321
```

Or build once and run without Vite: `npm run build && npm start`. The server binds to 127.0.0.1 only and is never meant to be deployed. A longer guide: [fireboard.dev/docs/local](https://fireboard.dev/docs/local).

## Team setup (your own Google login)

Each person runs Fireboard on their own machine with their own Google account, so everyone only sees what their own IAM permissions allow. No keys are shared.

1. Install Node 22+, git and the [gcloud CLI](https://cloud.google.com/sdk/docs/install).
2. Log in for local tools and set the quota project:
   ```bash
   gcloud auth application-default login
   gcloud auth application-default set-quota-project YOUR_PROJECT_ID
   ```
3. Clone, install, run: `npm install && npm run dev`, then open http://127.0.0.1:4321.
4. Sidebar `+` → **gcloud login (ADC)** → your project id → Save. Databases are discovered automatically.

Your Google account needs, on the project: **Cloud Datastore Viewer** (read) or **Cloud Datastore User** (read/write), plus **Service Usage Consumer** for the quota project. Project Owner/Editor already covers all of these.

## Connections

Add connections in the UI (sidebar `+`). They are saved to `~/.config/fireboard/connections.json` (override with `FIREBOARD_CONFIG`):

```json
{
	"connections": [
		{
			"id": "northwind",
			"name": "Northwind production",
			"projectId": "northwind-prod",
			"credential": { "type": "serviceAccount", "path": "/home/me/keys/northwind-prod.json" },
			"readOnly": true,
			"color": "#e5484d"
		},
		{
			"id": "staging",
			"name": "Staging (gcloud login)",
			"projectId": "my-staging",
			"credential": { "type": "adc" }
		}
	]
}
```

- `credential.type: "adc"` uses `gcloud auth application-default login`.
- Databases are discovered automatically. Add `"databases": ["(default)", "default-au"]` to pin a list if the credential cannot list databases.
- `readOnly` is enforced by the server for every write.

## Emulator with anonymized real data

1. Add a connection with **Emulator** credentials (host such as `127.0.0.1:8080`, project id matching your emulator, e.g. `demo-northwind`).
2. Open any real collection or document and click the camera button: Fireboard copies it (optionally with subcollections, up to a max doc count), anonymizes it, and saves a snapshot to `~/.config/fireboard/snapshots/`.
3. In the sidebar **Snapshots** list, load it into the emulator (optionally wiping it first).

Anonymization is deterministic (the same real email always becomes the same fake), so links between documents survive. It replaces emails (also inside text and document ids), person and company names (including copies such as `userName`, `lodgedBy`, `nameLower`), phones, addresses, IPs, birth dates, secrets/tokens, tax and bank numbers, and long free text. Edit `~/.config/fireboard/anonymize.json` to tune rules. Review a snapshot before sharing it: business data that isn't personal (amounts, statuses, task titles) is kept as is.

Snapshots only load into emulator connections.

## MCP (Claude Code and other agents)

While Fireboard is running, it serves a read-only MCP endpoint at `http://127.0.0.1:4321/mcp`:

```bash
claude mcp add --transport http --scope user fireboard http://127.0.0.1:4321/mcp
```

Tools: `get_current_view` (what you have open in the UI, with its results), `open_in_fireboard` (Claude opens a tab for you), `list_connections`, `list_databases`, `list_collections`, `get_document`, `query_collection`, `count_documents`. No write tools yet.

## Hosted app (Cloudflare)

### One-time setup

1. **Google OAuth client** (Google Cloud console, any project you own) → APIs & Services → Credentials → Create OAuth client ID → _Web application_.
   - Authorized JavaScript origins: your hosted URL (e.g. `https://fireboard.<you>.workers.dev`) and `http://127.0.0.1:8788`.
   - Authorized redirect URI: `https://<hosted-url>/api/auth/callback/google`.
   - OAuth consent screen: _External_, publishing status _Testing_, add yourself and teammates as test users. Scopes used: `openid email profile` (app sign-in) and, in the browser only, `datastore` + `cloud-platform.read-only` (Firestore and the project picker). Going public requires Google's verification of the sensitive `datastore` scope.
2. **Cloudflare** (personal `martincolley` profile, already bound to this folder):
   ```bash
   npx wrangler auth create martincolley              # if the login expired
   npx wrangler d1 create fireboard                   # put the id in wrangler.jsonc
   npm run db:migrate:remote
   npx wrangler secret put BETTER_AUTH_SECRET         # openssl rand -hex 32
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   ```
   In `wrangler.jsonc` `vars`: `GOOGLE_CLIENT_ID`, `NUXT_PUBLIC_GOOGLE_CLIENT_ID` (same id), and `PUBLIC_BASE_URL`. Set `ALLOWED_EMAILS` as a secret (`npx wrangler secret put ALLOWED_EMAILS`): comma-separated verified Google emails that are admins and get access for free.
3. **Stripe (optional, for paid access):** create a recurring price, then `wrangler secret put STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` and set `STRIPE_PRICE_ID`. Webhook endpoint: `https://<hosted-url>/api/auth/stripe/webhook`. Without Stripe, only allowlisted emails get in.

### Deploy

```bash
npm run deploy:cloud
```

### Local test of the hosted build

```bash
npm run build:cloud
npm run db:migrate:local
# .dev.vars: BETTER_AUTH_SECRET=..., ENABLE_PASSWORD_LOGIN=true, ALLOWED_EMAILS=you@example.com
npx wrangler dev --port 8788 --ip 127.0.0.1
```

### Using it

- The hosted build serves a public homepage at `/` (`app/components/landing/`) and the app at `/app`. The local build serves the app at `/`.

- **Connect Google** (sidebar): grants the browser a one-hour token to read your Firestore projects. Nothing is sent to the Fireboard server.
- Add a project (pick from your Google projects) or a local emulator.
- Snapshots are built and kept in your browser. Download them as files to share with a teammate, who imports them and loads them into their own emulator.
- **Claude Code / MCP:** run the local build as a companion (`FIREBOARD_ALLOWED_ORIGINS=https://<hosted-url> npm run dev`), then in the hosted app's account menu turn on _Share view with local MCP companion_. Your browser sends what you are looking at to `127.0.0.1` only.

## Notes

- Use the database pill in a tab's toolbar to open the same path in another database.
- Plain browsing shows documents that only hold subcollections (italic), which normal queries skip.
- JSON uses extended types: `{"__time__": "..."}`, `{"__ref__": "path"}`, `{"__lat__": 0, "__lon__": 0}`, `{"__bytes__": "base64"}`, `{"__vector__": [..]}`.
- Never deploy this app. It is meant to run only on your machine.
