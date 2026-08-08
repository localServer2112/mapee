# @mapee/api

The beginning of the standalone API service the rewrite plan
([FLUTTER_REWRITE_PLAN.md](../../FLUTTER_REWRITE_PLAN.md) §7) calls for —
Hono on Node, contract-first against `@mapee/contracts`.

## What exists today

A small subset of the eventual `/v1` surface. As of this writing, `app.ts`
mounts:

| Route | Notes |
|---|---|
| `GET /healthz` | Plain Hono, deliberately outside the OpenAPI spec — see the comment in `src/routes/health.ts` for why a liveness probe isn't a versioned business endpoint |
| `GET /v1/config` | Contract-validated against `@mapee/contracts`' `getConfigRoute` |
| `GET /v1/geocode` | Ported from `apps/web/src/app/api/geocode/route.ts`; contract-validated against `getGeocodeRoute` |
| `GET /v1/openapi.json` | The live spec, generated from this app's actual route registrations via `.doc31()` — not the same file as `packages/contracts/openapi.json`, though the two are expected to converge as routes get ported |
| `GET /docs` | A browsable HTML UI (Scalar) for the spec above |

`src/app.ts` is the file to check for the current, authoritative route list —
this table describes it as of this writing, and routes get added ahead of
this doc being updated.

## Relationship to `apps/web`

**This does not replace `apps/web/src/app/api/*` yet.** That's still the live
API the deployed web app actually uses. `apps/api` is being built ahead of the
cutover — see `packages/contracts/README.md` for why the contract package
exists before the service does. Nothing here goes into production traffic
until routes are ported over *and* `apps/web` is repointed at this service.

## Running it

```bash
pnpm --filter @mapee/api dev
# or, from the repo root, across every package via Turborepo:
pnpm dev
```

Listens on port `8787` by default (override with `PORT`). With it running:

```bash
curl http://localhost:8787/healthz
curl http://localhost:8787/v1/config
curl http://localhost:8787/v1/openapi.json
open http://localhost:8787/docs   # browsable API reference
```

## Environment variables

All optional in the sense that the service boots and `/healthz` responds
with none of them set — but `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
and `ENCRYPTION_KEY` are load-bearing for every database-backed route (areas,
scans, installs, isp-rankings); without them every one of those returns
`x-database-status: not-configured` and an empty/degraded response instead
of erroring, same as `apps/web`'s API routes did.

| Variable | Used for | Required for |
|---|---|---|
| `PORT` | The port `src/index.ts` listens on. Defaults to `8787`. | — |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. | Any database-backed route |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key, for the anon-scoped client. | Any database-backed route |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key, bypasses RLS for server-side writes/own-data reads. | Installs, scan submission, `/v1/me/scans` |
| `ENCRYPTION_KEY` | 64-char hex AES-256-GCM key encrypting/decrypting stored coordinates. Must be exactly 64 hex characters, and must never change once real data exists — see `supabase/migrate-encryption.sql`. | Any route touching `lat`/`lng` |
| `TRUSTED_PROXIES` | Comma-separated list of proxy IPs `src/lib/client-ip.ts` trusts when resolving a client's real IP from `X-Forwarded-For`. Unset means no proxy is trusted and the immediate socket address is used. | — |
| `OPENCELLID_API_KEY` | Proxies cell tower data via `/v1/towers`. Unset returns 503 from that one route; the rest of the service is unaffected. | `/v1/towers` only |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis, used for response caching (e.g. geocode) and rate limiting. Both unset falls back to an in-memory cache/limiter — fine for local dev, not for a multi-instance deployment. | — |
| `SENTRY_DSN` | Error reporting via `src/lib/sentry.ts`. Unset disables reporting entirely rather than erroring. | — |

## Deployment (Railway)

`.github/workflows/ci.yml`'s `deploy-api` job deploys this on every push to
`main` that passes the `ci` job first — not Railway's own git integration,
which would deploy an untested commit the moment it's pushed. One-time setup:

1. Create a Railway project, add an empty service named exactly `api`
   (matching `--service api` in the deploy step).
2. Set the environment variables above in that service (Railway dashboard →
   service → Variables) — at minimum the four marked "load-bearing" if you
   want database-backed routes to actually work in this deployment.
3. Generate a **project** token (Railway dashboard → project → Settings →
   Tokens, not a personal account token — a project token scopes CI auth to
   this one project without an interactive `railway link`) and add it as the
   `RAILWAY_TOKEN` secret in this repo's GitHub Settings → Secrets → Actions.

Root-level `railway.json` (not `apps/api/railway.json`) controls the actual
build/start commands — it has to live at the repo root because this is a
pnpm workspace and, per the note above about `tsx` vs `dist/`, `apps/api` in
production needs `@mapee/core`/`@mapee/contracts`' source present alongside
it, not just its own directory. The same class of mistake that hit
`apps/web`'s Vercel "Root Directory" setting earlier — scoping the build to
one package's directory silently breaks workspace dependency resolution.

## Two things that are easy to get wrong here

**Relative imports need an explicit `.js` extension.** `package.json` sets
`"type": "module"` — this is real Node ESM, not a bundler-mediated module
system. TypeScript resolves extensionless relative imports (`./app`) fine at
type-check time, and both `tsx` (dev, start) and `vitest` (test) are lenient
about it too, so a missing extension is invisible under every workflow used
day to day. Node's own ESM loader is not lenient: it requires the literal
specifier, extension included, and a compiled or directly-`node`-run version
of this package will throw `ERR_MODULE_NOT_FOUND` on the first extensionless
import it hits. Write every relative import between local `.ts` files as
`from "./thing.js"`, never `from "./thing"` — grep `from "\.` in `src/` before
adding a new file if the pattern isn't obvious from the files around it.

**`start` runs via `tsx`, not `node dist/index.js`.** This is deliberate, not
a shortcut waiting to be productionised. `@mapee/core` and `@mapee/contracts`
ship raw TypeScript source with no build step of their own — their
`package.json` `main`/`exports` point straight at `./src/index.ts` — so a
`dist/`-based `node` runtime for this package would resolve fine at
compile time and then fail to load its own workspace dependencies at
runtime. Running everything through `tsx`, the same tool `dev` already uses,
matches how every other package in this workspace is actually consumed
(Next.js transpiles on the fly; vitest and tsx do too). The `build` script
(`tsc -p tsconfig.build.json`) still exists and still passes — it's a
compile-check gate CI runs, not a runtime anything currently executes.

## How routes are structured

Each `src/routes/*.ts` file exports a self-contained, mountable Hono (or
`OpenAPIHono`) sub-app, assembled with `app.route("/", ...)` calls in
`src/app.ts`. `src/routes/health.ts` is the plain-Hono example; `config.ts`
and `geocode.ts` are the `OpenAPIHono` ones.

Routes that reuse a contract from `@mapee/contracts` don't redefine the route
shape locally — they import a named `RouteConfig` export (`getConfigRoute`,
`getGeocodeRoute`) and pass it to `.openapi(...)`, so the request/response
shape validated at runtime is the same object the contract package's own
`openapi.json` was generated from, not a hand-kept copy of it. The process
for adding a new endpoint — defining its schema, registering it, regenerating
the spec — is documented in full in `packages/contracts/README.md`'s "How to
add a new endpoint" section; this file doesn't duplicate it.

## Tests

```bash
pnpm --filter @mapee/api test
pnpm --filter @mapee/api test:watch
```

Route tests exercise the assembled `app` (or, for a sub-app not yet mounted
into it, the sub-app directly) via Hono's `.request()`/`.fetch()`, without
opening a real socket.
