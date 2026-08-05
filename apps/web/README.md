# @mapee/web

The Mapee web client: a Leaflet map of crowdsourced network-quality scans, plus —
for now — the HTTP API that every client talks to.

## Running it

From the repository root:

```bash
pnpm dev
```

Or from here: `pnpm --filter @mapee/web dev`. Serves on http://localhost:3000.

Without a configured database the app still runs: read routes return empty
arrays, and submitted scans are queued in `localStorage` for later sync.

## Structure

```
src/
  app/           Routes. app/api/* is the HTTP API (moving out — see plan §7)
  components/    map/, flow/, overlays/, stats/, search/, layout/, ui/
  hooks/         Geolocation waterfall, network test, bounds, ASN lookup, caching
  lib/           App-local utilities + re-export shims over @mapee/core
  stores/        pingLogStore — reducer + context for scans and sync state
  types/         Re-exports @mapee/core entities plus this app's state shapes
```

### The shims in `lib/`

`lib/latency.ts`, `lib/confidence.ts`, `lib/towers.ts`,
`lib/isp-verification.ts`, `lib/constants.ts`, and `types/index.ts` mostly
re-export [@mapee/core](../../packages/core). They exist so the workspace
migration did not have to rewrite imports across ~30 files. Prefer importing from
`@mapee/core` directly in new code; the shims will be retired once nothing
depends on them.

What deliberately did *not* move to core, and why:

| Stays here | Reason |
|---|---|
| `getLatencyColor` | Neon hex values — presentation. The API has no use for it |
| `MAP_CONFIG`, `STORAGE_KEYS`, `API_URLS` | Leaflet tile URLs, browser storage, this app's own routes |
| `PingLogState`, `PingLogAction`, `FlowStep` | This app's reducer, not the domain |
| `hexbin.ts` | Client-side binning, being retired in favour of server aggregation |
| `encryption.ts`, `rate-limit.ts`, `redis.ts`, `supabase.ts` | Server-only; these move to `apps/api` |
| `speedtest.ts`, `privacy.ts` | Browser measurement and jittering |

## API routes

| Route | Purpose |
|---|---|
| `GET/POST /api/pings` | Read scans in a bounding box; submit a scan |
| `GET /api/pings/[id]` | Single scan, for shareable report pages |
| `GET /api/stats` | Aggregated cells, or ISP rankings with `?type=isp` |
| `GET /api/geocode` | Nominatim proxy |
| `GET /api/towers` | OpenCelliD proxy |
| `GET /api/asn` | WHOIS + GeoIP carrier lookup |

These need a Node runtime, not edge: `/api/asn` uses `whoiser`, which opens a raw
TCP connection on port 43.

## Environment

Copy `.env.example` to `.env.local` and fill it in. The app checks for
configuration at runtime and degrades rather than failing to boot, so a missing
variable shows up as empty data rather than an error.

## Known issues

Documented in the rewrite plan §9, not yet fixed here:

- `download_speed` / `upload_speed` are derived from latency with a random
  multiplier in `lib/speedtest.ts` — they are not measurements.
- `GET /api/pings` decrypts and returns exact coordinates to any caller.
- Two location waterfalls run per session, duplicating GPS and IP requests.
- The `towers` rate limiter is defined in `lib/rate-limit.ts` and never applied.
- `request.ip` is Vercel-specific; on other hosts every caller shares one
  rate-limit bucket.
