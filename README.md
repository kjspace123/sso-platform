# SSO Platform

A centralized identity provider (OAuth 2.0 / OpenID Connect) with an SSO web app, an admin
portal, and two demo consumer applications proving cross-app SSO. See
[`SSO_System_Implementation_Plan(1).md`](./SSO_System_Implementation_Plan(1).md) for the full
spec — architecture, database design, security requirements, phased delivery plan, and
definition of done.

**Status:** The core authentication, email verification, OIDC, user portal, demo clients, and
admin-management features are implemented. The provider exposes authorization, token, discovery, JWKS,
userinfo, revocation, and RP-initiated logout endpoints; clients use Authorization Code + PKCE,
validate state/nonce and signed ID tokens, and keep their local session in an encrypted cookie.
Central account/session revocation also removes the account's Redis-backed OIDC sessions,
grants, authorization codes, and tokens.

**The actual cross-app SSO proof (section 20 / Milestone 3) is verified end-to-end:** sign in via
Demo App A, then open Demo App B — its `/authorize` request resolves straight to the *consent*
prompt with zero login prompt, because it reuses the SSO session Demo App A already established.
That's the whole point of this project, and it demonstrably works.

The admin portal supports users, role assignment, role permissions, applications, secret
rotation, enable/disable controls, audit logs, platform-wide session visibility/revocation, and
a configuration-backed security status page. Users can edit their profile, change passwords,
manage sessions, and inspect or revoke connected-application grants. State-changing `/api/*`
requests require an allowlisted Origin/Referer in addition to the SameSite session cookie.

Security hardening includes separate hashed session credentials, verified email changes,
privilege checks on account edits, atomic OIDC token consumption, and shared Redis request
limits covering both API and protocol routes. Dependency patches are pinned in the lockfile.

Validation includes unit tests, database-backed security/protocol tests (`pnpm test:integration`),
and Chromium cross-app SSO tests (`pnpm test:browser`). Both integration commands use disposable
Postgres/Redis services, not your development database. See [production deployment](docs/production.md)
for the separate HTTPS deployment configuration, explicit migration/bootstrap steps, backup and
recovery procedures, and release checks. Production approval still requires verifying your actual
SMTP, TLS, monitoring, recovery, and load requirements.

## Stack

TypeScript monorepo (pnpm workspaces) — NestJS API with `oidc-provider` mounted inside it,
Prisma/PostgreSQL, Redis, four Next.js apps (SSO web, admin portal, two demo apps), Docker
Compose + Nginx. Full rationale in the implementation plan, sections 5–6.

## Prerequisites

- Node.js 22+
- pnpm 11+ (`corepack enable` will pick up the pinned version)
- Docker (for Postgres/Redis, or the full stack)

## Getting started

Two ways to run this locally — pick one:

- **Fastest: everything in Docker.** One command brings up Postgres, Redis, the API, all four
  frontends, and Nginx, with migrations and seed data applied automatically. Best if you just
  want the app running to click around. See [Full stack via Docker Compose](#full-stack-via-docker-compose)
  below — you'll need one `/etc/hosts` line first.
- **For active development: apps on the host, infra in Docker.** Only Postgres/Redis run in
  containers; every app runs via `pnpm dev` with hot reload. See
  [Quick start (local dev)](#quick-start-local-dev-apps-run-on-the-host) below.

Either way, once it's running, sign in at http://localhost:3000 (or http://sso.sso.test for the
Docker path) — there's no account yet, so click **Create one** to register, or set
`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` in `apps/api/.env` beforehand to get a ready-made
super-admin. See [How sign-in works](#how-sign-in-works-oidc) and
[Try cross-app SSO](#try-cross-app-sso) for what to do once you're in.

## Quick start (local dev, apps run on the host)

```bash
pnpm install

# Start just the infrastructure
docker compose up postgres redis -d

# Configure the API
cp apps/api/.env.example apps/api/.env
# generate real values for CLIENT_SECRET_ENCRYPTION_KEY / COOKIE_SECRET:
openssl rand -base64 32   # -> CLIENT_SECRET_ENCRYPTION_KEY
openssl rand -base64 32   # -> COOKIE_SECRET
# OIDC_JWKS can stay blank in development (an ephemeral key is generated at
# boot); generate a persistent one with: pnpm --filter @sso-platform/api generate-jwks

# Configure each frontend (defaults already point at localhost)
cp apps/sso-web/.env.example apps/sso-web/.env.local
cp apps/admin-web/.env.example apps/admin-web/.env.local

# Apply the schema and seed baseline roles/permissions
pnpm prisma:migrate
pnpm prisma:generate
pnpm --filter @sso-platform/api exec prisma db seed

# Run everything (each app's dev script binds its own port — see below)
pnpm dev
```

| App        | URL                     |
| ---------- | ----------------------- |
| api        | http://localhost:4000   |
| api docs   | http://localhost:4000/docs (Swagger, non-production only) |
| sso-web    | http://localhost:3000   |
| admin-web  | http://localhost:3001   |
| demo-app-a | http://localhost:3002   |
| demo-app-b | http://localhost:3003   |

To get an admin account, set `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `apps/api/.env`
before running the seed command above.

## Full stack via Docker Compose

```bash
cp apps/api/.env.example apps/api/.env   # fill in real secrets
docker compose up --build
```

This brings up Postgres, Redis, the API, all four frontends, and Nginx as a single entrypoint.
The API entrypoint applies committed migrations and idempotently seeds roles, permissions, and
the two Compose demo clients before starting. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`
in `apps/api/.env` if the Compose stack should also create a super-admin.
Add the development domains once before opening the stack:

```text
127.0.0.1 sso.sso.test admin.sso.test app-a.sso.test app-b.sso.test api.sso.test
```

On macOS/Linux, append that line to `/etc/hosts` with administrator privileges. These names
share the registrable site `sso.test`, so SameSite cookies work between the frontend and API
without weakening them to `SameSite=None`. Nginx routes the following hostnames:

| Hostname            | Routes to    |
| -------------------- | ------------ |
| http://sso.sso.test | sso-web      |
| http://admin.sso.test | admin-web  |
| http://app-a.sso.test | demo-app-a |
| http://app-b.sso.test | demo-app-b |
| http://api.sso.test | api          |

Each app is its own origin here; SSO still works through OIDC redirects, while host-only cookies
remain scoped to the service that issued them (see sections 4 and 11 of the plan).
The local Compose stack uses HTTP and binds published ports to loopback.
Use `compose.production.yaml` for deployment; see [the production guide](docs/production.md).

## How sign-in works (OIDC)

`oidc-provider` is mounted inside the API process (not a separate service — see the
architecture note in the commit history), gated to only its own paths (`/authorize`, `/token`,
`/jwks`, `/.well-known/*`, `/session/end`, `/me`, …) so it coexists with the Nest-routed `/api/*`
controllers in the same Express app — see the comments in `apps/api/src/main.ts` if you're
touching that wiring, it has two non-obvious gotchas (module-init ordering, and Koa's lack of
Express-style `next()` fallthrough).

Login and consent are rendered by the SSO web app, not oidc-provider's own UI
(`features.devInteractions` is disabled). The flow:

1. A client redirects the browser to `{API}/authorize?...&code_challenge=...`.
2. oidc-provider redirects to `{SSO_BASE_URL}/login?interaction=<uid>` (or `/consent`) —
   `apps/api/src/oidc/oidc-provider.service.ts`'s `interactions.url`.
3. Those pages call `GET/POST /api/oidc/interaction/:uid[/login|/register|/confirm|/abort]`
   (`apps/api/src/oidc/interaction.controller.ts`), which reads/writes oidc-provider's own
   interaction state via `interactionDetails`/`interactionResult` — never oidc-provider's own
   response-writing `interactionFinished`, since these are JSON endpoints, not page renders.
4. The endpoint returns `{ redirectTo }`; the page does a real browser navigation there (not a
   fetch — the resume chain can cross origins all the way to the client's own `redirect_uri`).

To register a client by hand: sign in to admin-web, Applications → New application (type
Confidential), and copy the issued `clientId`/`clientSecret` — see "Try cross-app SSO" below for
the working example, or build your own authorize URL with `@sso-platform/auth-client`'s
`buildAuthorizeUrl()` (PKCE + `prompt=consent` included by default, since refresh tokens require
it — see section 12).

## Try cross-app SSO

Both demo apps (`apps/demo-app-a`, `apps/demo-app-b`) are real, independent OIDC clients: `/login`
starts the PKCE flow, `/callback` exchanges the code server-side (verifying the ID token against
the issuer's JWKS, then calling `/me` for profile claims), and the session lives in an encrypted
cookie. Set both up to see the actual SSO proof:

```bash
# Register each one (once the API + admin-web are running — see Quick start above):
#   admin-web -> Applications -> New application
#   - Type: Confidential
#   - Redirect URI: http://localhost:3002/callback (app A) or http://localhost:3003/callback (app B)

cp apps/demo-app-a/.env.example apps/demo-app-a/.env.local
cp apps/demo-app-b/.env.example apps/demo-app-b/.env.local
# paste each app's clientId/clientSecret into its own .env.local, and:
openssl rand -base64 32   # -> SESSION_SECRET, once per app

pnpm --filter @sso-platform/demo-app-a dev
pnpm --filter @sso-platform/demo-app-b dev
```

Open http://localhost:3002, click Log in — you'll land on the SSO web app's `/login`, then (the
first time) a consent screen, then back on Demo App A, signed in. Now open
http://localhost:3003 and click Log in there too: you'll go straight to the *consent* screen —
no login prompt — because you already have an SSO session. That's cross-app SSO working.

## Monorepo layout

```
apps/
  api/            NestJS backend — domain modules (section 8) + OIDC provider (apps/api/src/oidc)
    prisma/       Full data model (section 10) + seed script. Lives here (not at the repo
                   root, despite section 9) because @prisma/client/prisma resolve relative to
                   the schema's own node_modules under pnpm's isolated layout — a top-level
                   prisma/ folder would leave `prisma generate` unable to find them.
  sso-web/        Central login/registration/profile/session UI (Next.js)
  admin-web/      Admin portal — users, applications, roles, audit (Next.js)
  demo-app-a/     Demo OIDC client #1 — working end-to-end (Phase 6)
  demo-app-b/     Demo OIDC client #2 — working end-to-end, proves cross-app SSO (Phase 7)

packages/
  types/          Shared TS types + permission/audit-action constants
  validation/     Shared Zod schemas (used by both frontend forms and API DTOs)
  config/         Shared env schema/loader
  auth-client/    PKCE + authorize-URL helpers for OIDC consumer apps
  ui/             Shared UI primitives (cn() helper today; grows with Phase 5/8)
  eslint-config/  Shared flat ESLint configs
  tsconfig/       Shared base tsconfig

docker/           Dockerfiles + Nginx config
compose.yaml      Full-stack local orchestration
```

## Common commands

```bash
pnpm dev                 # builds packages/*, then runs every app in parallel
pnpm build                # builds packages/*, then builds every app
pnpm build:packages       # just the shared packages (types/validation/config/ui/auth-client)
pnpm lint / pnpm typecheck / pnpm test
pnpm prisma:studio        # inspect the database
pnpm prisma:migrate       # create/apply a migration

# API-specific (run from apps/api, or prefix with `pnpm --filter @sso-platform/api`)
pnpm test:integration     # from the repo root: disposable DB/Redis + security/protocol tests
pnpm test:browser         # from the repo root: real Chromium cross-app SSO
pnpm export-openapi       # regenerate docs/api/openapi.json (see docs/api/README.md)
```

> Shared `packages/*` compile to real `dist/` output (not run from source) — pnpm's isolated
> `node_modules` means the API can't reliably load workspace `.ts` files at runtime otherwise.
> `pnpm dev` / `pnpm build` handle this automatically; after editing a shared package, re-run
> `pnpm build:packages` (or that package's own `pnpm build`) before your changes show up in a
> running app.
