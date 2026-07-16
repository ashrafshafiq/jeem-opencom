# Jeemcom

**Class reminders and support, powered by Aya.**

Jeemcom is a self-hosted customer messaging platform for Jeem. It reminds subscribers when their
classes are happening, and when they reply with questions, an AI agent named **Aya** answers them
from your knowledge base — escalating to a live human whenever she can't confidently help.

Jeemcom is built on [Opencom](https://github.com/opencom-org/opencom) (AGPL-3.0). See
[License & attribution](#license--attribution).

---

## Contents

- [How it works](#how-it-works)
- [Project status](#project-status)
- [Quick start (Docker)](#quick-start-docker)
- [Configuring Aya](#configuring-aya)
- [Architecture](#architecture)
- [Environment variables](#environment-variables)
- [Widget installation](#widget-installation)
- [Development](#development)
- [Testing](#testing)
- [Deploying to a VPS](#deploying-to-a-vps)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [License & attribution](#license--attribution)

---

## How it works

The intended end-to-end flow for Jeem subscribers:

1. **Reminder** — a subscriber is reminded that their class is coming up, delivered over their
   preferred channel (in-app chat, SMS, or WhatsApp).
2. **Question** — if they reply ("can I reschedule?"), the reply lands in the Jeemcom inbox as a
   normal conversation.
3. **Aya answers** — Aya generates a reply grounded in your Help Center articles and snippets
   (retrieval-augmented), scored with a confidence value.
4. **Escalation** — if confidence is low, the subscriber asks for a human, or the topic is
   sensitive (billing, refunds, complaints), Aya hands off: the conversation is reopened, flagged
   `handoff`, and your team is notified in the inbox.

Aya's behaviour — name, personality, confidence threshold, handoff message, knowledge sources, and
model — is configured per workspace in **Settings → AI Agent**.

## Project status

| Capability                                     | Status         |
| ---------------------------------------------- | -------------- |
| Jeemcom branding                               | ✅ Done        |
| Aya (named AI agent, persona, handoff)         | ✅ Done        |
| Aya on OpenRouter                              | ✅ Done        |
| Local Docker stack (self-hosted Convex)        | ✅ Done        |
| In-app chat + email channels                   | ✅ Inherited   |
| Twilio SMS + WhatsApp channels                 | 🚧 Planned     |
| Automated class reminders                      | 🚧 Planned     |

Chat and email work today. SMS/WhatsApp delivery and the class-reminder scheduler are the next two
workstreams — the reminder flow above is the target design, not yet shipped.

---

## Quick start (Docker)

This runs **everything** locally — a self-hosted Convex backend, the Convex dashboard, and all
three web apps. **No Convex account required.** Source is bind-mounted, so code changes hot-reload.

**Requirements:** Docker + Docker Compose v2, and `openssl`.

```bash
cp .env.docker.example .env
echo "CONVEX_INSTANCE_SECRET=$(openssl rand -hex 32)" >> .env   # or edit .env by hand

docker compose up --build
```

Startup is fully automated and ordered: the Convex backend becomes healthy → an admin key is
derived from `CONVEX_INSTANCE_SECRET` → a one-shot job sets `JWT_PRIVATE_KEY`/`JWKS`/`SITE_URL`
and pushes the `packages/convex` functions → the dev servers start.

| Service          | URL                   | Notes                                    |
| ---------------- | --------------------- | ---------------------------------------- |
| Web dashboard    | http://localhost:3000 | Agent/admin app — **start here**         |
| Landing site     | http://localhost:4000 | Marketing site                           |
| Widget dev       | http://localhost:5173 | Vite widget dev server                   |
| Convex dashboard | http://localhost:6791 | Data/functions browser                   |
| Convex backend   | http://localhost:3210 | API/WebSocket (+ :3211 for HTTP actions) |

### First run

1. Open http://localhost:3000 and **sign up**. The first account becomes the admin.
2. Create a workspace.
3. Copy the workspace ID into `.env` as `OPENCOM_WORKSPACE_ID=...`, then
   `docker compose up -d web landing widget` to power the widget/landing demos.
4. Add an OpenRouter key to turn Aya on — see [Configuring Aya](#configuring-aya).

### Useful commands

```bash
docker compose up -d                 # start detached
docker compose logs -f web           # follow a service
docker compose down                  # stop (data persists in the convex-data volume)
docker compose down -v               # stop and WIPE all data
docker compose down -v && docker compose up --build   # after changing any package.json/lockfile
```

---

## Configuring Aya

Aya runs through an **OpenAI-compatible** gateway. **OpenRouter is the recommended provider** —
it lets you switch between OpenAI, Anthropic, and others with one key.

1. Get an OpenRouter key (`sk-or-...`) from [openrouter.ai](https://openrouter.ai).
2. Add it to `.env`:

   ```bash
   AI_GATEWAY_API_KEY=sk-or-your-key-here
   ```

   The base URL is auto-detected from the key prefix (`sk-or-` → OpenRouter, `vck_` → Vercel AI
   Gateway, otherwise OpenAI). Set `AI_GATEWAY_BASE_URL` only to override.

3. `docker compose up -d convex-deploy` to push the key to the deployment.
4. In **Settings → AI Agent**: enable the agent, set the **model** to an OpenRouter id
   (e.g. `openai/gpt-4o-mini` or `anthropic/claude-3.5-sonnet`), and confirm the **Agent name**
   (defaults to `Aya`).

### Aya's settings

| Setting                | What it does                                                                |
| ---------------------- | --------------------------------------------------------------------------- |
| **Agent name**         | Display name in the widget and inbox, and her identity in the system prompt  |
| **Personality**        | Free-text persona injected into the system prompt                            |
| **Knowledge sources**  | Which content she answers from (articles, internal articles, snippets)       |
| **Confidence threshold** | Below this, she hands off to a human instead of guessing                    |
| **Handoff message**    | What she says when escalating                                                |
| **Model**              | Provider/model id, e.g. `anthropic/claude-3.5-sonnet`                        |
| **Working hours**      | Optional window for AI handling                                              |

Aya only answers well if she has something to read — add content under **Articles** and
**Snippets**. Every generation is logged with its confidence and sources for the inbox AI review
panel and the AI report.

---

## Architecture

- **Frontend**: React, Next.js, Tailwind CSS
- **Widget**: Vite (embeddable IIFE bundle)
- **Mobile**: React Native / Expo
- **Backend**: [Convex](https://convex.dev) — schema, queries/mutations/actions, vector search
- **Package manager**: PNPM workspaces

```
jeem-opencom/
├── apps/
│   ├── web/              # Next.js dashboard for agents/admins
│   ├── mobile/           # Expo app for iOS/Android (Admin App)
│   ├── widget/           # Embeddable chat widget (Vite)
│   └── landing/          # Next.js marketing site
├── packages/
│   ├── convex/           # Convex schema + functions (the backend)
│   ├── types/            # Shared TypeScript types
│   ├── ui/               # Shared React components + brand constants
│   ├── sdk-core/         # Shared SDK business logic
│   ├── react-native-sdk/ # React Native SDK
│   ├── ios-sdk/          # Native iOS SDK (Swift)
│   └── android-sdk/      # Native Android SDK (Kotlin)
├── scripts/docker/       # Container bootstrap (admin key, env, deploy)
├── Dockerfile.dev
└── docker-compose.yml
```

### A note on naming

The **user-facing** brand is Jeemcom (`BRAND_NAME` in `packages/ui/src/brand.ts` is the source of
truth). **Internal identifiers deliberately keep the original `opencom` name** to avoid breaking
wiring and public embed contracts:

- npm package names — `@opencom/web`, `@opencom/convex`, …
- widget embed attributes — `data-opencom-convex-url`, `data-opencom-workspace-id`
- the discovery endpoint — `/.well-known/opencom.json`
- env var prefixes — `NEXT_PUBLIC_OPENCOM_*`, `OPENCOM_*`

Renaming these is a breaking change for any existing embed or SDK consumer. Leave them alone
unless you intend that.

### Backend conventions

The backend is Convex. Functions live in `packages/convex/convex/`, with the schema split by
domain under `packages/convex/convex/schema/`. Use the new function syntax with explicit
`args`/`returns` validators, and index-based queries (`withIndex`) rather than filters — every
table is workspace-isolated by a `workspaceId` foreign key. To regenerate Convex's own AI coding
guidelines, run `npx convex ai-files install`.

---

## Environment variables

### Docker Compose (`.env` at repo root)

| Variable                 | Required | Description                                                       |
| ------------------------ | -------- | ----------------------------------------------------------------- |
| `CONVEX_INSTANCE_SECRET` | Yes      | 32-byte hex seed for the instance + derived admin key. Keep stable |
| `OPENCOM_WORKSPACE_ID`   | No       | Workspace for widget/landing demos                                |
| `CONVEX_BACKEND_TAG`     | No       | Pin the Convex backend image (default `latest`)                   |
| `AI_GATEWAY_API_KEY`     | For Aya  | OpenRouter (`sk-or-…`), Vercel AI Gateway (`vck_…`), or OpenAI key |
| `AI_GATEWAY_BASE_URL`    | No       | Override the auto-detected gateway base URL                       |
| `RESEND_API_KEY`         | For email | Transactional/campaign email                                     |
| `EMAIL_FROM`             | For email | Sender identity, e.g. `Jeem <noreply@yourdomain.com>`            |

Anything set here is pushed to the Convex deployment by the one-shot `convex-deploy` job (only if
not already set).

### Convex backend

Set automatically by the Docker bootstrap; set manually in the Convex dashboard for cloud/VPS.

| Variable                        | Required             | Description                                            |
| ------------------------------- | -------------------- | ------------------------------------------------------ |
| `JWT_PRIVATE_KEY` / `JWKS`      | Yes                  | Convex Auth session signing/verification keypair        |
| `SITE_URL`                      | Yes                  | Web app URL for auth callbacks                          |
| `AI_GATEWAY_API_KEY`            | For Aya              | Model provider credential                               |
| `RESEND_API_KEY` / `EMAIL_FROM` | For email            | Email channel                                           |
| `RESEND_WEBHOOK_SECRET`         | For email            | Verify inbound Resend webhook signatures                |
| `ENFORCE_WEBHOOK_SIGNATURES`    | Recommended (`true`) | Fail closed on webhook validation                       |
| `OPENCOM_PUBLIC_CORS_ORIGINS`   | Production           | Allowlist for the discovery endpoint (localhost in dev) |
| `ALLOW_TEST_DATA` / `TEST_ADMIN_SECRET` | Testing      | Gate test-data mutations                                |

### Apps

| Variable                                  | App     | Description                       |
| ----------------------------------------- | ------- | --------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`                  | web/landing | Backend URL used by the browser |
| `NEXT_PUBLIC_OPENCOM_DEFAULT_BACKEND_URL` | web     | Pre-filled backend on login       |
| `VITE_CONVEX_URL` / `VITE_WORKSPACE_ID`   | widget  | Widget dev-server bootstrap       |
| `EXPO_PUBLIC_OPENCOM_DEFAULT_BACKEND_URL` | mobile  | Pre-filled backend on login       |

---

## Widget installation

Add the snippet before the closing `</body>` tag. Find your exact pre-filled snippet in
**Settings → Widget Installation** (or the Onboarding page).

```html
<script
  src="/opencom-widget.iife.js"
  data-opencom-convex-url="YOUR_CONVEX_URL"
  data-opencom-workspace-id="YOUR_WORKSPACE_ID"
  data-opencom-track-page-views="true"
></script>
```

Build and distribute the widget bundle to the apps' public dirs:

```bash
bash scripts/build-widget-for-tests.sh
```

### Identifying subscribers

Link conversations to a known Jeem subscriber:

```javascript
OpencomWidget.identify({
  email: "subscriber@example.com",
  name: "Jane Doe",
  userId: "jeem_user_123",
  customAttributes: { plan: "pro" },
});
```

### Tracking events

```javascript
OpencomWidget.trackEvent("class_booked", { classId: "yoga-101" });
```

---

## Development

The Docker stack is the recommended path. To run against Convex Cloud instead:

```bash
./scripts/setup.sh          # interactive: configures a Convex dev deployment + env files
```

Common commands:

```bash
pnpm dev                    # start all apps
pnpm dev:web                # dashboard only
pnpm dev:widget             # widget only
pnpm build                  # build all apps
pnpm lint
pnpm typecheck
pnpm format
```

## Testing

```bash
pnpm test:convex            # backend tests
pnpm test:unit              # Vitest
pnpm test:e2e               # Playwright
pnpm ci:check               # full gate: lint, typecheck, security gates, tests, build
```

E2E and seeding need `ALLOW_TEST_DATA=true` and a matching `TEST_ADMIN_SECRET` on the deployment.

---

## Deploying to a VPS

The bundled `docker-compose.yml` is a **development** setup (bind-mounted source, dev servers,
http on localhost). For a server:

- **TLS + public origins** — front the stack with a reverse proxy (Caddy/nginx/Traefik). Set the
  backend's `CONVEX_CLOUD_ORIGIN`/`CONVEX_SITE_ORIGIN` to your public HTTPS URLs, and point the
  apps' `NEXT_PUBLIC_CONVEX_URL`/`VITE_CONVEX_URL` at the backend's HTTPS URL.
- **Production builds** — swap the `next dev`/`vite` commands for `next build` + `next start` and
  a static widget build. With `NODE_ENV=production` the strict CSP applies automatically.
- **CORS** — set `OPENCOM_PUBLIC_CORS_ORIGINS` to your real web origins.
- **Secrets & persistence** — keep `CONVEX_INSTANCE_SECRET` stable and secret; use a managed
  volume or Postgres (`POSTGRES_URL`) for `convex-data`.

### Local-dev carve-outs (production-safe)

Two behaviours exist only outside production, so a plain `http://localhost` backend works without
manual steps. Both are gated — production keeps the strict defaults:

- `packages/types/src/backendValidation.ts` accepts `http://` for **loopback hosts only** and maps
  the API port to the HTTP-actions port (`3210` → `3211`). Remote backends still require HTTPS.
- `apps/web/next.config.js` allows `http://localhost:*` / `ws://localhost:*` in the CSP
  `connect-src` **only when `NODE_ENV !== "production"`**.

---

## Security

- **Never commit secrets.** `.env` and `*.env.local` are gitignored. Rotate keys periodically.
- **Workspace isolation** — every record is scoped by `workspaceId`; all mutations check auth.
- **Roles** — Owner > Admin > Agent > Viewer.
- **Signed visitor sessions** — visitor-facing endpoints require a session token (`wst_…`); raw
  visitor IDs are never trusted alone.
- **Bot messages** are restricted to internal callers, so Aya's identity can't be spoofed.
- **CORS hardening** — no wildcard `Access-Control-Allow-Origin`; per-workspace origin allowlists.
- **Identity verification** — enable HMAC verification in **Settings → Security** for production
  and generate user hashes server-side to prevent impersonation.
- **Webhooks** fail closed by default (`ENFORCE_WEBHOOK_SIGNATURES`), with a replay window set by
  `WEBHOOK_MAX_AGE_SECONDS` (default 300s).

---

## Troubleshooting

**`convex deploy` fails with a version error**
The Convex backend image must match the pinned CLI (`convex` in `package.json`). Pin
`CONVEX_BACKEND_TAG`/`CONVEX_DASHBOARD_TAG` in `.env` to a compatible tag.

**Admin key generation fails**
Generate one manually:
`docker compose run --rm --entrypoint sh convex-backend -c 'cd /convex && ./generate_admin_key.sh'`

**"HTTPS is required" or "Could not connect" on the login screen**
Hard-refresh once — a previous failure may be cached in localStorage. Confirm the backend is
healthy (`curl http://localhost:3210/version`) and that discovery responds
(`curl http://localhost:3211/.well-known/opencom.json`).

**Aya never replies**
Check that the agent is enabled in Settings → AI Agent, that `AI_GATEWAY_API_KEY` is set on the
deployment (`docker compose logs convex-deploy`), that the model id is valid for your provider,
and that there is content for her to read (Articles/Snippets). Config errors surface in the AI
Agent settings card.

**Dependency changes not picked up**
`docker compose down -v && docker compose up --build` — node_modules live in named volumes.

**Port already in use**
Stop the conflicting process or remap the port in `docker-compose.yml`.

---

## License & attribution

Jeemcom is a derivative of [Opencom](https://github.com/opencom-org/opencom) and is licensed under
the **GNU Affero General Public License v3.0**. See [LICENSE](LICENSE).

AGPL-3.0 is a copyleft license: if you run a modified version of this software as a network
service, you must make the corresponding source available to its users.
