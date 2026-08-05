# Mapee

Crowdsourced network-quality mapping. Users run a "scan" — a latency and
throughput measurement tagged with their location and ISP — and the results
aggregate into a public map of connectivity quality, focused on Nigeria.

## Repository layout

This is a pnpm workspace. It is mid-migration from a Next.js monolith to a
separated API plus multiple clients, per [FLUTTER_REWRITE_PLAN.md](./FLUTTER_REWRITE_PLAN.md).

```
apps/
  web/          Next.js 13 app — UI and, for now, the /api/* routes
packages/
  core/         @mapee/core — domain logic shared by every client and the API
supabase/       Database schema and migrations
```

### What lives where

`packages/core` holds the domain: latency classification, sample statistics,
confidence scoring, tower geometry, and ISP name matching. It has no Flutter,
React, browser, or server dependency, so the API service and the web app compute
identical results from identical inputs. It is also the reference for the Dart
port.

`apps/web` holds presentation plus, currently, the API routes. Those routes move
to a standalone `apps/api` service in a later phase — see the plan, §7.

Anything that is presentation (colour values, Tailwind classes), browser-specific
(storage keys, tile URLs), or app-specific (route paths, reducer shapes) stays in
the app, not in core. The old `@/lib/*` and `@/types` paths still work as
re-export shims so the migration did not require touching every import.

## Getting started

Requires Node 20+ and pnpm 9 (via corepack — `corepack enable`).

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # then fill it in
pnpm dev
```

The app runs at http://localhost:3000. It degrades gracefully without a
database: API routes return empty results and scans queue locally.

## Commands

Run from the repository root. Turborepo fans these out across packages.

| Command | What it does |
|---|---|
| `pnpm dev` | Start the web app in development |
| `pnpm build` | Build everything |
| `pnpm lint` | Lint everything |
| `pnpm test` | Run all tests |
| `pnpm typecheck` | Type-check everything without emitting |

Target a single package with `pnpm --filter <name>`, e.g.
`pnpm --filter @mapee/core test:watch`. Shorthands: `pnpm web <script>` and
`pnpm core <script>`.

## Environment

All variables belong to `apps/web/.env.local`; see
[apps/web/.env.example](./apps/web/.env.example) for the full list and where to
obtain each value. `packages/core` requires no configuration.

When the API is extracted, the server-side secrets (`ENCRYPTION_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, provider keys) move to that service and the web app
keeps only a public API base URL.

## Database

Schema lives in [supabase/schema.sql](./supabase/schema.sql). Apply it to a fresh
Supabase project through the SQL editor or the Supabase CLI. It requires the
PostGIS extension and creates the `ping_logs` table, the `hexbin_stats`
materialized view, the `isp_rankings` view, and two RPC functions the API routes
call.

`hexbin_stats` is a materialized view — it needs periodic
`SELECT refresh_hexbin_stats();` or new scans will not appear in aggregates.

## Branches

`archive/nextjs-monolith` is a permanent snapshot of the pre-restructure layout,
kept for reference. Do not delete it.
