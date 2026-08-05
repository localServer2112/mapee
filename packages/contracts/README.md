# @mapee/contracts

The single source of truth for the v1 API contract.

## Why this package exists

Before now, the request/response shapes for Mapee's API lived only as inferred
TypeScript types in `apps/web/src/app/api/*` — implicit, and only checkable by
reading route handler code. As the API moves toward a standalone service
(`apps/api`, not yet built — see [FLUTTER_REWRITE_PLAN.md](../../FLUTTER_REWRITE_PLAN.md)
§7), the contract needs to exist independently of any one implementation, so
the API service and every client (web, and eventually Dart mobile) can be
written against the same definition instead of drifting from whichever route
handler happened to ship first.

This package defines that contract as Zod schemas, and derives an OpenAPI 3.1
document (`openapi.json`) from them mechanically. Nothing here talks to a
database or a request — schemas describe shapes, `registry.ts` maps shapes to
paths, and `generate.ts` renders the result to JSON.

## Constraints

- **No hand-edits to `openapi.json`.** It is generated output, not a source
  file. Edit a schema in `schemas/` or a path in `registry.ts`, then
  regenerate. CI enforces this — see below.
- **No I/O, no server.** This package only describes the contract; it does not
  implement it. `apps/api` doesn't exist yet.
- **One schema file per resource**, listed under Contents below.

## The workflow

```
schemas/*.ts  →  registry.ts  →  pnpm --filter @mapee/contracts run generate  →  openapi.json (committed)
```

1. A resource's shape is defined as a Zod schema in `src/schemas/<resource>.ts`,
   using the shared `z` from `src/zod-setup.ts` (which extends Zod with
   `.openapi()` — every schema file must import `z` from there, not from
   `"zod"` directly, or `.openapi()` metadata is silently dropped).
2. `src/registry.ts` maps each schema to an HTTP method + path via
   `registry.registerPath(...)`, including request query/body/param shapes and
   response schemas per status code.
3. `pnpm --filter @mapee/contracts run generate` runs `src/generate.ts`, which
   feeds the registry through `@asteasolutions/zod-to-openapi`'s
   `OpenApiGeneratorV31` and writes `packages/contracts/openapi.json`. (The
   root-level `pnpm gen` runs the broader `generate:all` script, which also
   regenerates the TS client types described below — see Client generation.)
4. The generator is deterministic — running it twice with no source changes
   produces byte-identical output — so `openapi.json` is committed to git
   rather than built on demand.

**CI enforces step 4.** The `Check OpenAPI spec is up to date` step in
`.github/workflows/ci.yml` reruns the generator and fails the build if
`packages/contracts/openapi.json` comes out dirty, i.e. if someone changed a
schema or the registry without regenerating and committing the result.

## Contents

| Schema file | Covers |
|---|---|
| `common` | Shared primitives: `LatSchema`/`LngSchema`, `MapBoundsSchema`, `ISPNameSchema`, `LatencyStatusSchema`, `DeviceTypeSchema`, `ErrorEnvelopeSchema` (the shape of every error response) |
| `scan` | `Scan`, `ScanDetail`, list/create query and body schemas for `/v1/scans*` |
| `area` | `Area` (aggregated map cell) and its list query, for `/v1/areas` |
| `tower` | `CellTower` and its query, for `/v1/towers` |
| `network` | `NetworkIdentify`, for `/v1/network/identify` |
| `isp-ranking` | `ISPRanking` and its query, for `/v1/isp-rankings` |
| `geocode` | `GeocodeResult` and its query, for `/v1/geocode` |

## The v1 paths

`registry.ts` defines 7 paths, mapped from the current 5 Next.js routes under
`apps/web/src/app/api/`:

| v1 path | Replaces | Notes |
|---|---|---|
| `GET /v1/areas` | `/api/stats` (map aggregation) | Backed by the `hexbin_stats` materialized view |
| `GET /v1/scans` | `/api/pings` (list) | Returns grid-snapped, not exact, coordinates |
| `POST /v1/scans` | `/api/pings` (submit) | Idempotent on a client-supplied id |
| `GET /v1/scans/{id}` | *(new)* | The only endpoint that returns exact coordinates, and only to the submitting install once A4 auth lands — split out to fix the current `/api/pings` behavior of returning exact coordinates to any caller |
| `GET /v1/isp-rankings` | `/api/stats?type=isp` | Split out of the overloaded `?type=` param; response fields normalised to camelCase |
| `GET /v1/geocode` | `/api/geocode` | Proxies Nominatim; `countrycodes` query param renamed to `country` |
| `GET /v1/towers` | `/api/towers` | Proxies OpenCelliD, clamped to its 4 sq km per-request limit |
| `GET /v1/network/identify` | `/api/asn` | Renamed — "asn" described the lookup mechanism (WHOIS + GeoIP), not the purpose |

Not yet covered: `/v1/config`, `/v1/installs`, `/v1/me/scans`, `/v1/measure/*`.
These land with auth in a later phase (A4), once there's a server to
authenticate against.

## Where this goes next

`apps/api` doesn't exist yet. This package defines the contract ahead of the
implementation on purpose — so the shapes are settled before there's a service
to build against. Once `apps/api` is stood up, it reuses these same Zod
schemas at runtime for request validation via `@hono/zod-openapi`, rather than
duplicating validation logic between "what the spec says" and "what the server
actually checks."

## Client generation

As of this writing, a typed TypeScript client is wired up (no Dart client
yet). `package.json` in this package defines three generate scripts:

- `generate` — the spec-only script described above; writes `openapi.json`.
- `generate:client` — runs `openapi-typescript` over `openapi.json` and writes
  `generated/api.d.ts` (types only, no runtime code).
- `generate:all` — runs both, in order. This is what the root-level `pnpm gen`
  now invokes.

`src/client.ts` exports `createApiClient`, a thin factory around
[`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/) parameterised with
the generated `paths` type, giving callers a fetch client whose request/response
types are checked against the same contract `openapi.json` describes. Both
`createApiClient` and the `paths` type are re-exported from this package's
`src/index.ts`.

`packages/contracts/generated/` (the `openapi-typescript` output) is
git-ignored — unlike `openapi.json`, it is not committed, since it is
mechanically derivable from the committed spec and regenerating it is cheap.
Because of this, the CI drift check above deliberately runs only the
spec-generation step, not `generate:all` — it checks the one generated
artifact that *is* committed and must match its source.

## How to add a new endpoint

1. Add a new schema, or extend an existing one, in `src/schemas/<resource>.ts`
   (create the file if it's a new resource, and re-export it from
   `src/index.ts`).
2. Register the path in `src/registry.ts` via `registry.registerPath(...)`,
   including request query/body/params and response schemas per status code.
3. Run `pnpm gen` from the repo root (or `pnpm --filter @mapee/contracts run
   generate`) to regenerate `openapi.json`.
4. Commit the updated `openapi.json` alongside the schema/registry change, in
   the same commit. This is what the CI drift check enforces — a PR that
   changes a schema without regenerating will fail CI.

## Tests

```bash
pnpm --filter @mapee/contracts test
pnpm --filter @mapee/contracts test:watch
```

Each schema file has a matching `*.test.ts`, plus `registry.test.ts` covering
the registry as a whole.
