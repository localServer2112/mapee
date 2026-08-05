# @mapee/core

Domain logic shared by every Mapee client and by the API service.

## Why this package exists

Aggregation and classification logic duplicated per client drifts. The web app
and the database already disagreed about how to bucket scans into cells — one
used offset hexagons, the other axis-aligned rectangles, so cells covering the
same ground never matched. This package is where that logic lives once.

## Constraints

- **No Flutter, React, browser, or Node-server dependency.** Consumed by the web
  app, the API service, and mirrored into Dart for mobile.
- **No presentation.** Colour values, CSS classes, and icon names belong to the
  client. `getLatencyStatus` lives here; `getLatencyColor` does not.
- **No client state.** Reducer shapes and storage keys belong to the client.
- **Pure functions only.** No I/O, no globals. This is what makes it testable in
  isolation and portable to Dart.

## Contents

| Module | What it provides |
|---|---|
| `types` | Domain entities: `PingLog`, `CellTower`, `HexBin`, `ASNInfo`, `Coordinates`, `MapBounds`, `GeocodeResult` |
| `constants` | `ISP_LIST`, latency thresholds, data-freshness weights, aggregation `GRID` size, measurement endpoints |
| `latency` | Status classification, labels, mean/median, jitter as population standard deviation |
| `confidence` | Freshness weighting, weighted average latency, confidence score and level, consistency, top ISP, ISP rankings |
| `towers` | Haversine distance, nearest-N lookup, spider-leg geometry, bounds filtering, type grouping |
| `isp-verification` | Match a WHOIS/GeoIP carrier name to the canonical `ISP_LIST` |

## Ported to Dart

Everything here is the reference implementation for `apps/mobile/lib/domain/`.
When changing a threshold or formula, change it in both, and keep the test cases
in step — the tests double as the specification for the port.

Two behaviours worth knowing before porting, both pinned by tests:

- Latency thresholds are **inclusive upper bounds** — exactly 50 ms is "good",
  not "fair". The SQL in `hexbin_stats` must agree.
- `calculateJitter` returns `0` for fewer than two samples rather than `NaN`,
  because the value is written to a `NOT NULL … CHECK (jitter >= 0)` column.

## Grid constants

`GRID.LAT_STEP` and `GRID.LNG_STEP` must stay in sync with the `hexbin_stats`
materialized view in `supabase/schema.sql`, which buckets by
`FLOOR(lat_grid / 0.0045)` and `FLOOR(lng_grid / 0.005)`. The server owns
aggregation; clients use these only to interpret returned cell centres, and must
not re-bin scans themselves.

## Tests

```bash
pnpm --filter @mapee/core test
pnpm --filter @mapee/core test:watch
```

59 tests covering the boundary conditions that matter: empty sample sets,
freshness-weight cutoffs, ISP tie-breaking, single-sample jitter, and the
punctuation-stripping in ISP pattern matching.
