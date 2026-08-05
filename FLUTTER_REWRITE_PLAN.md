# Mapee → Flutter Rewrite Plan

Two pieces of work, deliberately sequenced:

1. **Extract the backend** out of the Next.js monolith into a standalone, versioned, documented HTTP
   API — one service that the Flutter app, the existing web app, and any future client all consume on
   equal terms.
2. **Rewrite the mobile frontend** in Flutter, designed against Apple's Human Interface Guidelines.

Today the API routes and the web UI are the same deployment: `src/app/api/*` shares a process, a build,
and a secret store with `src/app/page.tsx`. That works for one web client and breaks down at two —
every API change is a UI deploy, the web app is the only thing that can hold `ENCRYPTION_KEY`, and
there is no contract for a mobile binary to trust. §7 is now the largest section of this plan.

## Decisions taken

| Decision | Choice |
|---|---|
| Platforms | iOS + Android, **HIG-first** — one Apple-derived design system on both, with Android shims for back navigation, system font, and permission dialogs |
| Backend | **Standalone API service** in a monorepo — `apps/api` (Hono on Node, contract-first), consumed by `apps/mobile` (Flutter) and `apps/web` (the existing Next.js app, reduced to a pure frontend) |
| Map | **MapLibre vector tiles** (`maplibre_gl`), styled to a HIG light/dark palette |
| Scope | **Parity + fix what native unlocks** — real throughput measurement, socket-level latency, OS carrier/radio data, and a corrected aggregation grid |

---

## 1. What the current app actually does

Reading the source rather than the README, Mapee is a crowdsourced network-quality map for Nigeria:

**Core loop** — user runs a "scan": grant location → confirm/choose ISP → run a latency test → submit.
The scan becomes a public data point on a shared map. Orchestrated by
[NetworkTestFlow.tsx](src/components/flow/NetworkTestFlow.tsx) over four steps
(`location` → `isp` → `testing` → `success`).

**Map surface** — [LeafletMap.tsx](src/components/map/LeafletMap.tsx) with four overlay layers:
individual ping markers, a hexbin aggregation layer, a heatmap layer, and cell-tower markers with
spider-legs to the nearest towers.

**Supporting features** — location search via Nominatim proxy, area insight panels
([AreaSummarySheet](src/components/overlays/AreaSummarySheet.tsx),
[LocationInsightsPanel](src/components/overlays/LocationInsightsPanel.tsx)), shareable per-scan report
pages (`/report/[id]`), ISP rankings, a confidence score, offline queue with auto-sync, and a
first-run explainer.

**Server side** — five API routes doing coordinate encryption (AES-256-GCM), WHOIS+GeoIP dual lookup
for ISP verification, OpenCelliD and Nominatim proxying, Upstash Redis caching, and IP rate limiting.
Postgres holds encrypted exact coordinates plus a ~500 m grid coordinate for spatial queries, with a
`hexbin_stats` materialized view and an `isp_rankings` view.

### Carries over — relocated, not rewritten

- **Route logic** from all five `/api/*` handlers moves into `apps/api` largely intact; the framework
  wrapper changes, the behaviour doesn't (except the fixes in §7.5)
- The Postgres schema, RLS policies, PostGIS functions, and both views
- Coordinate encryption ([encryption.ts](src/lib/encryption.ts)) — moves to the API service, which
  becomes the only holder of `ENCRYPTION_KEY`
- Rate limiting, Redis caching, WHOIS/GeoIP lookup, and the Nominatim/OpenCelliD proxies
- The domain algorithms in `src/lib/` — [confidence.ts](src/lib/confidence.ts),
  [latency.ts](src/lib/latency.ts), [towers.ts](src/lib/towers.ts),
  [isp-verification.ts](src/lib/isp-verification.ts) — become `packages/core`, shared by the API and
  the web app, and are ported to Dart near line-for-line for mobile
- `ISP_LIST`, latency thresholds, and freshness weights from [constants.ts](src/lib/constants.ts) —
  become server-owned and served from `/v1/config` (§7.4)

### Does not carry over

- **The entire visual language.** Neon-on-black, `#00FFFF` cyan, JetBrains Mono, `UPPERCASE`
  labels, `SYS.TIME` clocks, "INITIALIZE SCAN", 10px tracking-widest headers, glow shadows. HIG asks
  for the system font at readable sizes, semantic colour, generous spacing, and sentence case. This is
  a redesign, not a restyle. Section 4 covers the replacement.
- The desktop two-pane layout (flexible map + fixed 350px sidebar) and its mobile hamburger overlay
- `framer-motion`, Radix primitives, Tailwind, shadcn components
- Client-side hexbin math ([hexbin.ts](src/lib/hexbin.ts)) — see §8
- The latency-derived fake speed numbers in [speedtest.ts](src/lib/speedtest.ts) — see §6

---

## 2. Target architecture

### 2.1 Repository shape

```
mapee/
  apps/
    api/               # standalone HTTP API — Hono on Node. The only thing with DB + secret access
    web/               # existing Next.js app, minus src/app/api/* — pure frontend
    mobile/            # Flutter
  packages/
    core/              # TS domain logic shared by api + web (confidence, latency, towers, isp match)
    contracts/         # Zod schemas → OpenAPI 3.1 spec → generated TS + Dart clients
  supabase/            # schema + migrations (unchanged location)
```

One pnpm workspace for the TypeScript side; `apps/mobile` is a plain Flutter package that consumes the
generated Dart client as a path dependency. Turborepo (or nx) for task graph and caching — the key
property is that `packages/contracts` builds before anything that depends on it, so a schema change
fails the API build and the client codegen in the same CI run.

### 2.2 Flutter internals

```
apps/mobile/lib/
  main.dart
  app/                 # bootstrap, router, theme wiring, env config
  design/              # HIG design system — tokens, primitives, sheets, haptics
  features/
    map/               # map screen, MapLibre controller, overlay layer builders
    scan/              # the four-step scan flow + result
    insights/          # area insight sheets, ISP rankings
    report/            # shareable scan report
    onboarding/        # first-run explainer, permission priming
    settings/          # units, theme, data-saver, privacy, delete-my-data
  domain/              # pure Dart: entities + algorithms (ported from src/lib)
    entities/          # PingLog, CellTower, AreaStats, AsnInfo, Coordinates, GeocodeResult
    confidence.dart  latency.dart  towers.dart  isp_matcher.dart  grid.dart
  data/
    api/               # thin wrapper over the *generated* Dart client — auth, retry, base URL
    db/                # Drift schema: cached pings, pending queue, cached areas
    repositories/      # PingRepository, AreaRepository, TowerRepository, GeocodeRepository
  services/
    measurement/       # latency (TCP), throughput (HTTP), jitter, sample stats
    location/          # location waterfall: GPS → coarse → IP
    radio/             # platform channel: carrier + signal (Android) / carrier (iOS)
    connectivity/  telemetry/  share/

apps/mobile/packages/
  mapee_radio/         # Pigeon-generated plugin for OS radio + network info
  mapee_api/           # generated Dart client (git-ignored, produced by `pnpm gen`)
```

**Layering rule** — `domain/` is pure Dart with no Flutter import, so the ported algorithms are unit
testable in isolation. `features/` never touches `data/api` directly; it goes through repositories.

**State** — Riverpod 2 with code generation. Providers replace the current
[pingLogStore.tsx](src/stores/pingLogStore.tsx) reducer:

| Today | Flutter |
|---|---|
| `PingLogProvider` + `useReducer` | `pingLogsProvider` (AsyncNotifier, backed by Drift) |
| `state.pendingSync` | `syncQueueProvider` + a background sync worker |
| `state.myPingIds` in `localStorage` | Drift `my_scans` table |
| `state.showTowers`, `showHeatmap` | `mapLayersProvider` (persisted preference) |
| `state.selectedHexbin` | `selectedAreaProvider` |
| `useMapBounds` | `mapCameraProvider` (throttled, not `setTimeout`-debounced) |
| `useLocationWaterfall` | `locationProvider` over `LocationWaterfallService` |

**Packages** (pin exact versions at bootstrap; several below are worth a compatibility spike first):

- Map — `maplibre_gl`
- State — `flutter_riverpod`, `riverpod_annotation`, `riverpod_generator`
- Network — `dio`, `dio_smart_retry`, `connectivity_plus`
- Local — `drift` + `sqlite3_flutter_libs`, `shared_preferences`, `flutter_secure_storage`
- Device — `geolocator`, `permission_handler`, `device_info_plus`, `package_info_plus`
- UI — `flutter_animate`, `fl_chart`, `share_plus`, `shimmer`
- Codegen — `build_runner`, `freezed`, `json_serializable`, `pigeon`

Deliberately **not** taking a dependency on any of the unmaintained carrier/signal-strength packages
on pub.dev. Section 6 writes a small first-party plugin instead.

---

## 3. Screen map

The current app is one page with modals stacked on it. Native gets real navigation — a
`CupertinoTabScaffold` with three tabs, which also fixes the discoverability problem where the
map-control toggles are unlabelled icon buttons floating over the map.

| Tab | Screen | Replaces |
|---|---|---|
| **Map** | Full-bleed map, floating search pill, layer control, "Run a scan" CTA | [page.tsx](src/app/page.tsx) + the 350px sidebar |
| | Area detail sheet (medium/large detents) | `AreaSummarySheet` + `LocationInsightsPanel` |
| | Scan flow (full-screen modal, 4 pages) | `NetworkTestFlow` + `GlassOverlay` |
| **Activity** | My scans list, pending-sync state, per-scan detail, share | Sidebar "Recent Scans" + `/report/[id]` |
| **Insights** | ISP rankings, national/regional stats, methodology | `ISPRankingChart` + `StatsGrid` |
| — | Onboarding (3 pages) + permission priming | `WelcomeExplainer` |
| — | Settings | *(new — required for App Store privacy compliance)* |

Two structural changes worth naming: the header bar's live clock and `NETWORK.MAP` wordmark are cut
entirely (they carry no information), and the map's two icon-only toggles become a labelled layers
sheet, since HIG expects controls to be self-describing.

---

## 4. HIG design system

This is the part of the rewrite with the most surface area. The current design is a deliberate
cyberpunk aesthetic; HIG optimisation means rebuilding on Apple's foundations — clarity, deference,
depth — while keeping Mapee recognisable.

### 4.1 Colour

Drop the fixed neon palette. Every colour becomes a semantic token resolving per-appearance, via a
`MapeeColors` `ThemeExtension` so both `CupertinoTheme` and any Material fallback read the same source.

| Token | Light | Dark | Use |
|---|---|---|---|
| `label` / `secondaryLabel` / `tertiaryLabel` | Apple label ramp | Apple dark label ramp | All text; never a hardcoded grey |
| `systemBackground`, `secondary`, `tertiary` | Grouped-background ramp | Elevated dark ramp | Screens, cards, sheets |
| `separator` | `systemGray4` @ 36% | `systemGray` @ 36% | Hairlines — replaces `cyber-border` |
| `accent` | Mapee brand blue | Lightened for contrast | Interactive tint, replaces neon-cyan |
| `qualityExcellent` | `systemGreen` | dark-variant | Best tier |
| `qualityGood` | `systemTeal` | dark-variant | |
| `qualityFair` | `systemYellow` | dark-variant | |
| `qualityUsable` | `systemOrange` | dark-variant | |
| `qualityPoor` | `systemRed` | dark-variant | Worst tier |
| `qualityUnknown` | `systemGray3` | `systemGray` | **Untested area** — distinct from Poor (§12.4) |

Five quality tiers, not three — per §12.4, and the numeric band for each tier differs per metric
(latency, download, upload), so the token names are quality levels rather than latency ranges. The
sixth token matters as much as the other five: today "no data" and "bad data" both render as nothing,
and they need to look different.

Three hard rules: (1) quality is **never encoded by colour alone** — every quality chip pairs colour
with a label and a distinct glyph, so it survives deuteranopia and greyscale, which matters more at
five tiers than at three; (2) all text clears WCAG AA (4.5:1 body, 3:1 large) in both appearances,
verified in CI — today's `text-muted-foreground/50` on `#050505` fails this comfortably; (3) the five
tiers must stay distinguishable in both appearances *and* in greyscale, which constrains the middle
three more than the endpoints — verify with a simulated-vision pass, not by eye.

The map gets two hand-authored MapLibre styles, light and dark, that switch with
`MediaQuery.platformBrightness` — replacing today's always-dark CARTO raster tiles.

### 4.2 Typography

The single largest readability change: **no monospace UI, no uppercase labels.** SF Pro on iOS, Roboto
on Android, via `-apple-system`-equivalent platform defaults.

| Style | Size / weight | Use |
|---|---|---|
| Large Title | 34 / Bold | Tab-root screen titles, collapsing on scroll |
| Title 2 | 22 / Bold | Sheet titles |
| Headline | 17 / Semibold | Card and row titles |
| Body | 17 / Regular | Prose, list rows |
| Subheadline | 15 / Regular | Supporting copy |
| Footnote | 13 / Regular | Timestamps, captions |
| Caption 1 | 12 / Regular | Legend labels, axis labels |

Monospace survives in exactly one place — tabular numerals for metric values (`142 ms`, `48.3 Mbps`)
so digits don't jitter during a live test. `FontFeature.tabularFigures()`, not a mono family.

**Dynamic Type is mandatory.** Every screen must be usable at `textScaler` 2.0. This forbids the fixed
`h-12` header, `max-h-48` scroll regions, and `w-14 h-14` buttons the web app uses; sizes come from
text metrics, and metric rows reflow from horizontal to vertical past a scale threshold.

### 4.3 Layout, materials, motion

- **Spacing** — 4pt base scale; 16pt screen margins; 44×44pt minimum hit target (the current 12px
  mobile menu icon button and 20px close buttons are below this)
- **Depth** — one thin hairline plus a background-colour step for separation. No glows, no
  `shadow-neon-cyan`. Translucency (`BackdropFilter`) reserved for the nav bar, tab bar, and floating
  map controls, i.e. only where content actually scrolls beneath
- **Radii** — 10pt controls, 14pt cards, 38pt continuous sheet corners. Not the current `rounded-sm`
- **Sheets** — real detented sheets with a grabber, drag-to-dismiss, and background scaling. The area
  sheet opens at medium and expands to large, replacing the fixed `h-[65vh]` Radix sheet
- **Motion** — HIG easing curves, 200–350 ms. Every animation checks
  `MediaQuery.disableAnimations` (Reduce Motion) — the current infinite pulse rings and spinning
  borders have no such guard
- **Haptics** — selection tick on ISP pick and layer toggle, success notification on scan submit,
  warning on test failure. Currently absent entirely

### 4.4 Accessibility

Non-negotiable, and largely missing today:

- Semantic labels on every interactive element, including map markers and layer toggles
- The map exposes an accessible summary ("Lagos area, average latency 68 milliseconds, fair, 42
  scans") so the primary surface isn't opaque to VoiceOver/TalkBack
- Live regions announce test progress and completion
- Focus order follows visual order; sheets trap focus and restore it on dismiss
- Increase Contrast and Bold Text respected via `MediaQuery`

---

## 5. Screen-level redesign notes

**Map** — full-bleed MapLibre under a translucent floating search pill (replacing the sidebar's
`LocationSearch`). Bottom-right: a prominent labelled "Run a scan" button, not a bare `+` FAB.
Bottom-left: locate-me and layers, both with accessibility labels. A collapsed legend chip expands
into a sheet rather than permanently occupying sidebar space. Tapping an aggregated cell opens the
area sheet at medium detent.

**Scan flow** — four pages in a full-screen modal with a HIG page indicator (not the current
four-segment progress bar), a Cancel in the leading nav position, and swipe-back between completed
steps.

1. *Location* — plain-language purpose copy **before** the OS prompt (HIG pre-permission priming; the
   web app can't do this well). Shows a small map preview of the detected point with an accuracy
   radius, and the confirm/reject pair the current step has — but as "This looks right" / "Adjust
   location", where Adjust actually offers a draggable pin instead of just resetting.
2. *ISP* — auto-detected carrier from the OS radio service, cross-checked against the ASN/WHOIS
   lookup. A confirm row when the two agree, a searchable list when they don't. The "LOCKED" badge and
   the amber "does not match our listed providers" scolding both go; unmatched carriers get a neutral
   "Not listed — choose the closest match" affordance.
3. *Testing* — a real measurement with live latency, jitter, download, and upload readouts and an
   honest phase label. Includes an estimated data cost and a cellular-data confirmation (§6).
4. *Result* — the metric grid, a plain-language interpretation, and Submit / Share / Done. Submission
   is optimistic: queued locally, synced in the background, with visible pending state.

**Activity** — grouped inset list of the user's scans, HIG swipe actions for share and delete, and a
detail view that is the native equivalent of `/report/[id]`, sharing via the OS share sheet to the
same public web URL.

**Insights** — ISP rankings from `/v1/isp-rankings` rendered with `fl_chart`, plus a methodology
section stating sample counts and confidence-score meaning. The confidence formula should be explained
in the UI, not just computed.

### 5.1 Area insight summaries — templated, not AI

Worth naming explicitly because the current implementation reads like it's AI-generated and isn't:
[`generateInsightSummary`](src/components/overlays/LocationInsightsPanel.tsx) is a deterministic
template — if/else buckets on latency, scan count, confidence, and tower count, concatenated into a
paragraph. No model call, no server round-trip.

**Decision: keep it deterministic.** It ports to Dart alongside the other domain algorithms as a pure
function over `AreaStats`. Rationale: it's free, instant, offline-capable, and — most importantly —
cannot state a number that contradicts the data it was given. An LLM summarising network-quality
statistics is a plausible-sounding-wrongness risk for zero product gain, since the interesting content
is the numbers themselves.

Three improvements to make during the port, since the template is being touched anyway:

- **Fix the tone.** The current copy editorialises (`"an impressive {n} cell towers"`,
  `"which suggests potential coverage gaps, signal degradation indoors, or reliance on distant
  infrastructure"`) — speculative inference stated as fact, from tower count alone. HIG asks for plain,
  factual language; state what the data shows and stop.
- **Extend to the new metrics.** It currently describes latency only. With real throughput (§6.2) and
  five-tier per-metric ranking (§12.4) it should cover download/upload and the untested-area case.
- **Make it localisable.** String concatenation with inline pluralisation (`towers !== 1 ? 's' : ''`)
  doesn't survive translation. Use Flutter's `intl` plural/select forms from the start.

If an LLM-written variant is ever wanted, the natural shape is a `/v1/insights` endpoint cached per
area per day, layered on top of the same `AreaStats` — the template stays as the offline and fallback
path. Explicitly out of scope for v1.

---

## 6. Native capabilities — the substantive upgrade

### 6.1 Latency

Today: `fetch(HEAD, mode: 'no-cors')` against `google.com/favicon.ico`, eight samples with IQR outlier
removal ([speedtest.ts:25](src/lib/speedtest.ts)). Because `no-cors` responses are opaque and browser
timing includes queueing, DNS, and TLS, the figure overstates network RTT and can't be decomposed.

Flutter: `Socket.connect(host, 443)` from `dart:io`, timed to first ACK — a genuine TCP handshake RTT,
with DNS resolved separately and excluded. Keep the existing sample count, IQR filter, median, and
stddev-as-jitter logic from [latency.ts](src/lib/latency.ts); only the sampling primitive changes. Run
against two or three geographically distinct endpoints and report the median of medians.

### 6.2 Throughput — replacing fabricated numbers

**This is a correctness fix, not a feature.** Today's up/down figures are invented:

```ts
// src/lib/speedtest.ts:233
const variance = 0.8 + Math.random() * 0.4;
downloadSpeed = Math.round(baseDownload * latencyMultiplier * jitterMultiplier * variance);
```

A 50 Mbps baseline scaled by a latency bucket and a random factor. Those values are written to
`ping_logs.download_speed`, surfaced as "Mbps" in the result screen and shared reports, and averaged
into `isp_rankings`. Every speed number the product has ever shown is synthetic, and the existing rows
in the table are not salvageable as measurements.

Replacement: real ramped transfer against a public speed endpoint (Cloudflare's
`__down`/`__up` byte endpoints, or the first-party `/v1/measure/*` endpoints in §7.4) —

- Ramp payload size until the transfer sustains ≥ 2 s, capped by a hard byte budget
- Sample instantaneous throughput, discard the TCP slow-start window, report the 90th percentile of
  the stable region
- Abort on budget, timeout, or user cancel; report partial-with-caveat rather than a fake number
- **Data-cost guard**: default budget ~8 MB down / ~2 MB up on cellular, ~25 MB on Wi-Fi. Show the
  estimate before starting, respect a Data Saver setting, and honour `Low Data Mode`. This matters
  disproportionately for a Nigeria-focused app on metered mobile data — the current app never
  transfers meaningful bytes, so the rewrite introduces a real cost that must be consented to.

Migration: add a `measurement_method` column (see §7) so honest measurements are distinguishable from
legacy heuristic rows, and exclude heuristic rows from ISP rankings.

### 6.3 Carrier and radio data — `mapee_radio` plugin

A first-party Pigeon plugin, because platform capability here is genuinely asymmetric and no
maintained package covers it:

| Capability | Android | iOS |
|---|---|---|
| Carrier name | `TelephonyManager.networkOperatorName` | `CTCarrier` — **deprecated in iOS 16**, returns `--` on modern OS |
| MCC / MNC | Available | Effectively unavailable |
| Cell ID / LAC / TAC | `getAllCellInfo()` with location permission | Not available at all |
| Signal strength (dBm / RSRP) | `SignalStrength` callback | Not available |
| Radio type (LTE / 5G) | `TelephonyManager` + `NetworkCapabilities` | Coarse only, via `NWPathMonitor`-style checks |

Consequences the design must absorb:

- **ISP detection on iOS falls back to the ASN/WHOIS route** — the existing
  `/v1/network/identify` + [isp-verification.ts](src/lib/isp-verification.ts) path
  stays the primary iOS mechanism, with OS data as a bonus on Android. The two-tier confirm UI in step
  2 must therefore work with either source, and label which one it used.
- **Signal strength is an Android-only enrichment.** Don't design a UI that looks broken without it;
  treat it as an additive field, gated on availability.
- **The cell-tower layer stays OpenCelliD-backed** on both platforms — Android's own cell info can
  optionally corroborate the nearest tower, but never becomes the source of the layer.

### 6.4 Location

Port [useLocationWaterfall.ts](src/hooks/useLocationWaterfall.ts) to a `LocationWaterfallService`,
keeping the coarse-then-fine escalation and the silent IP fallback, but with native gains: real
`LocationAccuracy` control, iOS's "Precise Location: Off" handled explicitly, a proper
`whileInUse`-only permission request, and OS-level pre-permission priming copy.

Keep the ~±20 m jitter from [privacy.ts](src/lib/privacy.ts) applied client-side before submission,
and state it plainly in the UI and the App Store privacy card.

---

## 7. Backend separation

### 7.1 The boundary

Everything that touches the database, a secret, or a third-party provider moves behind one HTTP
service. Clients — Flutter, the web app, anything later — get no privileged access and no shared code
path to the data layer.

| Concern | Lives in | Rationale |
|---|---|---|
| Postgres / Supabase access | `apps/api` only | Service-role key never leaves the server |
| Coordinate encryption | `apps/api` only | `ENCRYPTION_KEY` becomes a single-service secret |
| Aggregation (area stats, ISP rankings) | `apps/api` | One implementation for N clients — see §8 |
| Third-party proxies (Nominatim, OpenCelliD, WHOIS, GeoIP) | `apps/api` | Provider keys, caching, and quota in one place |
| Rate limiting / abuse | `apps/api` | Cannot be enforced client-side |
| Domain constants (ISP list, thresholds) | `apps/api`, served via `/v1/config` | Tunable without shipping a binary |
| Measurement execution | client | Must run on the device being measured |
| Presentation, formatting, map rendering | client | — |

The rule that makes this hold: **clients may compute nothing that affects stored or ranked data.** A
client measures and submits; the server validates, stores, and aggregates.

### 7.2 Service shape

**Hono on Node**, deployed as its own service. Reasoning:

- **Node runtime is a hard requirement, not a preference.** `whoiser` imports `node:net` and speaks
  raw TCP on port 43 (`node_modules/whoiser/dist/whoiser.js:1`). That rules out Vercel Edge Functions
  and standard Cloudflare Workers for the ASN route. Either the whole API runs on Node, or that one
  route is carved out onto a Node host — the former is simpler.
- Hono's request/response model is close enough to the current Next.js route handlers that the port is
  mostly mechanical, and `@hono/zod-openapi` gives runtime validation and the OpenAPI spec from one
  schema definition (§7.3).
- Deploy target: Fly.io, Railway, or Render — a long-lived Node process also fixes the in-memory cache
  problem in §9, where `towerCache` and `asnCache` are per-serverless-instance and mostly cold.

Fastify or NestJS are both defensible substitutes; the shape of this plan doesn't change if you swap
them. What matters is Node, versioned routes, and a generated contract.

### 7.3 Contract-first, or the split doesn't hold

With two clients and one of them shipped as an app-store binary, an undocumented API is a liability.
Single source of truth: Zod schemas in `packages/contracts`, from which everything else derives.

```
packages/contracts/src/*.ts   (Zod)
        │
        ├─→ apps/api          request/response validation at runtime (@hono/zod-openapi)
        ├─→ openapi.json      generated spec, committed, diffed in PRs
        │       ├─→ apps/web    generated TS client
        │       └─→ apps/mobile generated Dart/Dio client
        └─→ contract tests    spec ↔ live API asserted in CI
```

Concretely: `pnpm gen` regenerates `openapi.json`, the TS client, and the Dart client. CI fails if the
committed spec differs from the generated one, so a schema change can't land without the clients being
regenerated in the same commit. Serve the spec at `GET /v1/openapi.json` and a browsable reference at
`/docs` — that's what makes the API genuinely usable by a second team.

The generated Dart client is a path dependency of `apps/mobile`, wrapped by `data/api/` for auth
headers, retry, and base-URL selection per flavor. Hand-written models do not appear anywhere.

### 7.4 The v1 surface

Renamed from `ping`/`hexbin` to the domain language the UI already uses. Old paths stay aliased through
one deprecation window.

| Method | Path | From | Notes |
|---|---|---|---|
| `GET` | `/v1/areas?bbox=&zoom=` | `/api/stats` | Aggregated cells. Zoom-aware precision. **The primary map read.** |
| `GET` | `/v1/scans?bbox=&maxAge=` | `/api/pings` | Individual scans, **grid coordinates only** (§7.5) |
| `POST` | `/v1/scans` | `POST /api/pings` | Requires install token. Client-supplied UUID retained |
| `GET` | `/v1/scans/{id}` | `/api/pings/[id]` | Exact coordinates only for the owning install |
| `GET` | `/v1/isp-rankings?region=` | `/api/stats?type=isp` | Split out of the overloaded `type` param |
| `GET` | `/v1/geocode?q=&country=` | `/api/geocode` | Unchanged behaviour |
| `GET` | `/v1/towers?bbox=` | `/api/towers` | Now actually rate-limited (§9) |
| `GET` | `/v1/network/identify` | `/api/asn` | WHOIS + GeoIP dual lookup |
| `GET` | `/v1/config` | *new* | ISP list, thresholds, measurement endpoints, `minSupportedVersion` |
| `POST` | `/v1/installs` | *new* | Anonymous install registration → token |
| `GET`/`DELETE` | `/v1/me/scans` | *new* | Own-data export and deletion (store requirement) |
| `GET` | `/v1/measure/down?bytes=` · `/v1/measure/up` | *new, optional* | First-party throughput endpoints — see note |
| `GET` | `/v1/openapi.json` · `/docs` · `/healthz` | *new* | Contract, reference, liveness |

On `/v1/measure/*`: hosting throughput endpoints yourself gives control over test conditions and
removes a third-party dependency from the core measurement, but it puts real egress on your bill —
roughly 8 MB per cellular scan (§6.2). Start on Cloudflare's public endpoints, keep the first-party
route behind a config flag, and switch only if measurement consistency demands it.

Cross-cutting: consistent error envelope (`{ error: { code, message, details? } }`), `Retry-After` on
429, cursor pagination on collections, `ETag`/`If-None-Match` on `/v1/areas` and `/v1/towers` — mobile
clients re-request the same viewport constantly and a 304 costs nothing.

### 7.5 Behaviour fixes that land with the move

1. **Stop returning exact coordinates from list endpoints.** `GET /api/pings` currently decrypts and
   returns full-precision lat/lng to any caller ([route.ts:107](src/app/api/pings/route.ts)), so the
   AES-256-GCM protects against a database leak but not against anyone who calls the public API. In v1,
   list endpoints return grid coordinates; exact coordinates are served only from `/v1/scans/{id}` to
   the install that submitted it. This is a behaviour change for the current web client too.
2. **Add `measurement_method`** (`'heuristic' | 'measured'`) to `ping_logs`, default existing rows to
   `heuristic`, and filter `isp_rankings` to `measured` (§6.2).
3. **Add nullable radio fields** — `radio_type`, `signal_dbm`, `mcc`, `mnc` (§6.3, Android-mostly).
4. **Server-side outlier rejection** on submit: reject physically implausible combinations rather than
   storing them and letting aggregation absorb the damage.
5. **Trusted-proxy IP resolution.** `getClientIP` reads `request.ip`, which is Vercel-specific and
   undefined elsewhere ([rate-limit.ts:19](src/lib/rate-limit.ts)) — on any other host every caller
   collapses into one `"unknown"` rate-limit bucket. The standalone service must parse
   `X-Forwarded-For` against a configured trusted-proxy list.
6. **Apply the `towers` rate limiter** that is currently defined and never used.

### 7.6 Auth and abuse

There is no auth today and RLS permits anonymous insert, so the dataset is trivially poisonable. Opening
the API to a second client makes that worse. Minimum viable model:

- **Install tokens.** `POST /v1/installs` returns an opaque token; mobile stores it in
  Keychain/Keystore, web in `localStorage`. Required for all writes. This is identity for rate
  limiting and own-data access, *not* a user account — no sign-up, no PII, and the anonymous character
  of the product is preserved.
- **Attestation on mobile.** Bind the install token to App Attest (iOS) / Play Integrity (Android) at
  registration. Raises the cost of automated submission substantially; web keeps a lower trust tier.
- **Rate limits keyed on install token, falling back to IP.** This matters specifically here: limits
  are IP-keyed today, and Nigerian carriers NAT very large user populations behind few addresses, so
  `dataFetch` at 60/min per IP will throttle legitimate users as soon as the app has traction.
- **CORS allowlist** for browser origins, from config. Mobile is unaffected by CORS, which is exactly
  why write authorisation cannot depend on it.
- **Read tier for third parties** (optional, post-v1): the aggregate data is public by design, so
  issuing read-only API keys against `/v1/areas` and `/v1/isp-rankings` costs little and makes the
  dataset useful to others. Keep it behind a separate quota tier.

### 7.7 The web app after the split

`apps/web` keeps its UI and loses `src/app/api/*` entirely. It holds no secrets — no
`SUPABASE_SERVICE_ROLE_KEY`, no `ENCRYPTION_KEY`, no provider keys — only a public API base URL and
its own install token. That has a pleasant side effect: it can be deployed as a static build behind a
CDN, and it becomes a fair test of the API. If a feature is awkward to build in `apps/web` against the
public contract, the contract is wrong.

The existing UI can stay on its current visual language, or adopt a web translation of the HIG design
system from §4. That's a separate decision and this plan doesn't force it.

### 7.8 Migration — strangler, not big bang

1. Restructure into the workspace with `apps/web` unchanged and still serving its own `/api/*`.
2. Stand up `apps/api` with `packages/contracts` and one route ported end to end (`/v1/geocode` — no
   database, no secrets, trivially verifiable). Deploy it. Prove CI, codegen, and observability.
3. Port the remaining routes behind `/v1`, each with contract tests. Read routes first, `POST /v1/scans`
   last — it's the one that writes.
4. **Dual-run**: point `apps/web` at the new API via `NEXT_PUBLIC_API_BASE_URL` while its own `/api/*`
   still exists. Compare responses on real traffic; keep the old routes as the fallback.
5. Delete `src/app/api/*` and move `ENCRYPTION_KEY` and the service-role key out of the web project's
   environment. Rotate both — they've been present in a client-facing deployment's env.
6. Flutter development begins against the deployed API from step 3 onward; it never talks to the
   Next.js routes at all.

Steps 1–3 are the gate for Flutter Phase 0, because the generated Dart client is what Phase 0 builds on.

### 7.9 Operations

- **Environments**: `dev`, `staging`, `prod`, each with its own Supabase project and Redis namespace.
  Mobile flavors map onto them, so a TestFlight build cannot write to production.
- **Observability**: structured request logs with request IDs, error tracking (Sentry), latency and
  error-rate metrics per route, and provider-quota alerts on OpenCelliD and Nominatim. Nominatim's
  usage policy in particular will get you blocked if mobile traffic goes unmetered.
- **Nominatim compliance**: the current 1 req/s courtesy expectation is honoured today mostly by
  accident of low traffic. The API must queue and cache aggressively, or move to a paid geocoder.
- **`minSupportedVersion` gate**: `/v1/config` returns it; the app shows a blocking update prompt
  below it. This is the only lever you have over a binary that's already installed.
- **Contract tests in CI** on every PR touching `packages/contracts`, plus a scheduled smoke suite
  against staging.

---

## 8. Data, offline, and the grid bug

**Local store** — Drift with three tables: `cached_pings` (server data by viewport, TTL'd),
`my_scans`, and `pending_scans` (the outbox). This replaces `localStorage` JSON blobs, which
currently rewrite the entire log array on every change and have no size bound.

**Sync** — a proper outbox: submit optimistically, retry with exponential backoff and jitter, resolve
on the client-generated UUID (already how [`generateId`](src/lib/utils.ts) → `POST /v1/scans` works),
and surface per-item state in Activity. Today's loop iterates `pendingSync` sequentially with no
backoff and drops failures silently.

**The aggregation grid mismatch — fix by deletion.** There are currently two incompatible grids:

- `hexbin_stats` in [schema.sql:50](supabase/schema.sql) buckets by
  `FLOOR(lat_grid / 0.0045)`, `FLOOR(lng_grid / 0.005)` — axis-aligned rectangles, ~500 m
- [`createHexbins`](src/lib/hexbin.ts) buckets by `FLOOR(lng / (radius*2*0.75))`,
  `FLOOR(lat / (radius*√3))` with an odd-column half-row offset

These never produce the same cells, so a client-computed bin and a server-computed bin covering the
same ground disagree on their boundaries, centre, and membership — and `getHexCenter` doesn't even
invert `getHexCoords` consistently. The client hexbin path also degrades with density because it bins
every ping in memory.

This is exactly the class of bug the backend split is meant to prevent: aggregation logic duplicated
per client drifts, and with two clients it drifts twice. Under §7.1's rule, binning is server work —
the Flutter client should **not** reimplement it, and neither should the web app. Make the server the
single source of truth: render aggregated cells from `/v1/areas` (already computed from
`hexbin_stats`), and keep individual ping markers only at high zoom. If real hexagons are wanted later,
adopt H3 on the Postgres side and have the client render returned cell boundaries. Either way
`hexbin.ts` does not get ported. A `domain/grid.dart` holding only the DB's 0.0045/0.005 constants
covers the client's needs.

**Heatmap and clustering** move to MapLibre's native `heatmap` and cluster layers — GPU-side, versus
the current CPU canvas redraw in [HeatmapLayer.tsx](src/components/map/HeatmapLayer.tsx).

---

## 9. Other issues found, to fix in transit

| Issue | Location |
|---|---|
| Fabricated speed values written to the DB and into ISP rankings | [speedtest.ts:233](src/lib/speedtest.ts) |
| Public API returns decrypted exact coordinates | [pings/route.ts:107](src/app/api/pings/route.ts) |
| Client and server aggregation grids are incompatible | [hexbin.ts](src/lib/hexbin.ts) vs [schema.sql:50](supabase/schema.sql) |
| Two hexbin/tower caches unbounded in serverless memory; per-instance, so hit rate is poor without Redis | [towers/route.ts:43](src/app/api/towers/route.ts), [asn/route.ts:20](src/app/api/asn/route.ts) |
| `/api/towers` defines a `towers` rate limiter that is never applied to the route | [rate-limit.ts:81](src/lib/rate-limit.ts) |
| Localhost ASN lookups silently substitute a hardcoded MTN IP — fine for dev, but the fallback is unconditional on any unresolvable IP | [asn/route.ts:39](src/app/api/asn/route.ts) |
| `fetchLogsForBounds` depends on `state.logs`, so the callback identity changes on every insert and the 500 ms debounce in `page.tsx` re-arms continuously | [pingLogStore.tsx:254](src/stores/pingLogStore.tsx), [page.tsx:77](src/app/page.tsx) |
| Two independent location waterfalls run per session (page-level and inside `LocationStep`), duplicating GPS and IP requests | [page.tsx:61](src/app/page.tsx), [LocationStep.tsx:40](src/components/flow/steps/LocationStep.tsx) |
| `next` pinned to `^13.5.6` while `eslint-config-next` is `^14.2.0`; `request.ip` is Vercel-specific and returns undefined elsewhere, collapsing rate limiting to a shared `"unknown"` key | [package.json](package.json), [rate-limit.ts:19](src/lib/rate-limit.ts) |
| No auth, no abuse protection beyond IP limits — trivially poisonable dataset | schema RLS allows anonymous insert |

---

## 10. Phasing

Two tracks. **Track A (backend)** must reach A2 before mobile Phase 0 starts, because the generated
Dart client is what Phase 0 builds on. After that the tracks run in parallel.

### Track A — backend separation

Effort in engineer-weeks for one backend/TypeScript engineer.

| Phase | Deliverable | Est. |
|---|---|---|
| **A0 — Workspace** | pnpm + Turborepo restructure: `apps/web` (unchanged, still serving its own `/api/*`), `packages/core` extracted from `src/lib`, CI wired. No behaviour change, no deploy risk. | 0.5 |
| **A1 — Contract skeleton** | `packages/contracts` with Zod schemas for the existing five routes, OpenAPI generation, TS + Dart client codegen, `pnpm gen` + CI drift check. | 1 |
| **A2 — Service live** | `apps/api` on Hono/Node, deployed to staging + prod, with `/v1/geocode`, `/v1/config`, `/healthz`, `/docs`. Trusted-proxy IP resolution, structured logging, Sentry. **Gate for mobile Phase 0.** | 1.5 |
| **A3 — Read routes** | `/v1/areas`, `/v1/scans`, `/v1/scans/{id}`, `/v1/isp-rankings`, `/v1/towers`, `/v1/network/identify`. Grid-coordinate change (§7.5.1), ETags, tower rate limiter applied. Contract tests per route. | 2 |
| **A4 — Writes, auth, abuse** | `POST /v1/scans`, `POST /v1/installs`, install-token auth, App Attest / Play Integrity, token-keyed rate limits, outlier rejection, `measurement_method` + radio columns, `/v1/me/scans`. | 2 |
| **A5 — Cutover** | Dual-run `apps/web` against the new API, response diffing on real traffic, delete `src/app/api/*`, rotate `ENCRYPTION_KEY` and the service-role key, decommission old paths. | 1 |

**~8 weeks.** A3 and A4 are the substantive ones; A0–A2 are mostly mechanical and worth doing quickly
to unblock mobile.

### Track B — Flutter app

Effort in engineer-weeks for one experienced Flutter engineer; design work runs in parallel from
Phase 0.

| Phase | Deliverable | Est. |
|---|---|---|
| **0 — Foundations** | Flutter project in `apps/mobile`, CI (analyze/test/build), flavors mapped to dev/staging/prod API, generated Dart client wired, Drift schema, Riverpod skeleton. Package compatibility spike: `maplibre_gl`, Cupertino sheet detents, Pigeon plugin scaffold. | 1.5 |
| **1 — Design system** | `design/` complete: colour tokens with contrast tests, type ramp, spacing, primitives (buttons, rows, chips, sheets, metric cells), light/dark MapLibre styles, haptics, Reduce Motion + Dynamic Type harness. Golden tests at 1.0×/1.5×/2.0× text scale in both appearances. | 2 |
| **2 — Map** | MapLibre integration, camera provider, viewport-driven fetch, server-aggregated cell layer, native heatmap, tower layer + spider legs, ping markers, search pill, layers sheet, area sheet at both detents. | 3 |
| **3 — Measurement** | `mapee_radio` plugin (both platforms), TCP latency service, real throughput service with data budgets and cellular consent, location waterfall service, ISP matcher with OS/ASN dual source. Heavy unit + integration testing; this phase carries the most technical risk. | 3 |
| **4 — Scan flow** | Four-page modal, permission priming, draggable location adjust, ISP confirm/select, live test screen, result screen, optimistic submit + outbox. | 2.5 |
| **5 — Activity, Insights, Report, Settings** | My-scans list with swipe actions, native report detail + OS share, ISP rankings charts, methodology copy, settings incl. data saver and delete-my-data. | 2 |
| **6 — Onboarding & polish** | 3-page onboarding, empty and error states throughout, offline states, loading skeletons, motion pass, icon/splash, App Store + Play assets. | 1.5 |
| **7 — Accessibility & QA** | VoiceOver and TalkBack passes, Dynamic Type at 2.0× on every screen, contrast audit, low-end Android profiling, field testing on real Nigerian carriers across MTN/Airtel/Glo/9mobile. | 2 |
| **8 — Release** | TestFlight + Play internal track, privacy manifests and data-safety forms, crash/analytics wiring, staged rollout. | 1 |

**~18.5 weeks** sequential; Phases 2 and 3 parallelise well across two engineers to roughly 14.

### Combined timeline

```
Track A  A0 A1 ── A2 ──┬── A3 ──── A4 ──── A5
                       │
Track B                └── 0 ── 1 ── 2 ── 3 ── 4 ── 5 ── 6 ── 7 ── 8
```

With one engineer per track: **~3 weeks of backend work before mobile starts**, then ~18.5 weeks of
mobile with the remaining ~5 weeks of backend absorbed alongside it. Total **≈22 weeks** to a shipped
app, with a usable public API from week 3.

Two dependencies to respect: mobile Phase 3 (measurement) needs A4's `measurement_method` and radio
columns before it can submit real data, and mobile Phase 4 (scan flow) needs A4's install-token auth.

### Suggested first commits

- **Track A**: A0's workspace restructure alone, as a pure no-op refactor with green CI. Land it before
  anything else so every subsequent change has somewhere to go.
- **Track B**: Phase 0 plus one vertical slice — map renders, viewport fetch populates cells from
  `/v1/areas` through the generated client, one area sheet opens. Proves the whole stack end to end
  before the design system is finished.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| `maplibre_gl` maintenance and platform-view quirks on iOS | Compatibility spike in Phase 0; `flutter_map` is the documented fallback, at a performance cost |
| iOS carrier APIs deprecated — ISP auto-detect is weaker than the design implies | ASN/WHOIS is already the primary path; design step 2 to be fully usable with manual selection |
| Real speed tests consume user data on metered connections | Hard byte budgets, cellular consent, Data Saver setting, visible estimate before starting |
| Legacy `download_speed`/`upload_speed` rows are synthetic | `measurement_method` column; exclude heuristic rows from rankings; consider backfilling as null |
| Background location or background execution triggers App Review scrutiny | Foreground-only, `whileInUse` permission, no background modes in v1 |
| Shipped binaries can't be hot-fixed like the web app | `/v1` prefix, `/v1/config` for remote tuning, `minSupportedVersion` gate |
| Unauthenticated dataset is poisonable at scale once the app is public | Install tokens + attestation (§7.6), plus server-side outlier rejection |
| Two clients against one API doubles the change surface | Generated clients from one contract, CI drift check, contract tests — a schema change can't land without both clients regenerating (§7.3) |
| Backend extraction is a rewrite-inside-a-rewrite; it can absorb the schedule | A0–A2 are mechanical and time-boxed to ~3 weeks; strangler migration means the old routes keep working throughout, so a slip delays mobile start, not the live product |
| Cutover (A5) breaks the live web app | Dual-run with response diffing on real traffic before deletion; old routes stay as fallback until diffs are clean |
| `whoiser` needs a Node runtime (raw TCP :43), constraining hosting | Documented in §7.2 — Node host for the whole API; edge/Workers deployment is not an option without replacing the WHOIS library |
| Secrets have been living in a client-facing deployment's environment | Rotate `ENCRYPTION_KEY` and `SUPABASE_SERVICE_ROLE_KEY` at A5. Note that rotating the encryption key requires re-encrypting existing coordinates — see [migrate-encryption.sql](supabase/migrate-encryption.sql) for the precedent |
| Mobile traffic breaches Nominatim / OpenCelliD usage policy | Server-side queueing, aggressive caching, quota alerts (§7.9); budget for a paid geocoder |

---

## 12. Competitive teardown — Enext Wireless / Emetrics

[metrics.enextwireless.com](https://metrics.enextwireless.com) is a direct Nigerian competitor —
same domain (crowdsourced + drive-test network quality mapping), same visual grammar (Leaflet,
hexbin cells, a five-tier quality legend). Inspected the live map, its bundled `network.js`, the
companion `chart.php` and `speedtest.enextwireless.com`, and the EnextLog product page at
[enextwireless.com/enextlog](https://enextwireless.com/enextlog) to see what a more mature player in
this exact space has built, and what of it belongs in Mapee.

### 12.1 What Enext actually is — five products on one pipeline

Not one app — an ecosystem, all fed by one data-collection tool:

| Product | Audience | Model |
|---|---|---|
| **EnextLog** | Field engineers | Licensed Android drive-test app — the data source |
| **Emetrics** | Public / media / regulators | Free web map — what I inspected |
| **PREMETRICS** | Operators / consultants | Paid web post-processing tool |
| **Enterprise Emetrics** | Operators / regulators | White-label private deployment |
| **Reporting Dashboard**, **Network Charts** | Same | Automated regulatory reports, embeddable chart widgets |

The free public map is the funnel; the paid tiers monetise the same underlying dataset. That
business shape is worth naming because it validates something already in §7.6 — an API read tier
sold to third parties is not a hypothetical, it's what the closest competitor does today.

### 12.2 Emetrics map — what the code actually shows

Reading `network.js` rather than guessing from screenshots:

- **One vector-tile source, four client-side stylings.** `EMETRICS` / `DOWNLOAD` / `UPLOAD` / `PING`
  are not four datasets — they're the same GeoServer MVT tile
  (`enextlog:{network}@EPSG:900913@pbf/{z}/{x}/{-y}.pbf`, served via `Leaflet.VectorGrid`) restyled by
  a different `vectorTileLayerStyles` function per metric, keyed off different properties already
  present in the tile (`average_rsrq`/`average_sinr`, `max_dl`, `max_ul`, `average_ping`). Switching
  the metric dropdown swaps the style function, not the request. A fifth metric, voice quality, is a
  genuinely separate tile source (`vqt_latest:{network}`).
- **Five-tier ranking with per-metric numeric bands** — Excellent/Good/Fair/Usable/Poor, and each
  metric has its own thresholds (download: ≥10 / 5–10 / 1–5 / 0.1–1 / <0.1 Mbps; upload: ≥10 / 4–10 /
  1–4 / 0.1–1 / <0.1; ping: <50 / 50–75 / 75–150 / 150–250 / ≥250 ms; the composite metric additionally
  reads RSRQ + SINR together). Mapee's `getLatencyStatus` has three tiers on one metric.
  [latency.ts](src/lib/latency.ts) has no equivalent for throughput at all, because throughput isn't
  real yet (§6.2).
- **Click-to-inspect popups** per cell: network, qualitative ranking, sample count
  (`point_counts` — Mapee's equivalent of hexbin ping count), the metric's raw value, a **data source
  tag** (`Speedtest` / `Enextlog` / `NEMO` / `NIWBQR` — they fuse drive-test, crowdsourced, and
  regulatory-tool data into one dataset and disclose which contributed), and **two separate freshness
  timestamps** — "Last Updated (RF)" vs "Last Updated (TP)" — because signal-quality samples and
  throughput samples age at different rates and get refreshed on different cadences.
- **An explicit "untested area" state.** Cells with no `max_dl` don't render red or absent — the
  popup literally says *untested area*, distinct from *poor*. Mapee currently just omits hexbins below
  `MIN_PINGS_FOR_DISPLAY`; "no data" and "bad data" look identical (both: nothing rendered).
- **Network is a map-level filter, not just a scan-time choice.** A visitor can browse MTN's coverage,
  then Airtel's, then Glo's, from a single dropdown — 13 networks including three US carriers running
  on the same platform. Mapee's map blends every ISP's pings into one hexbin; there's no way to view
  one operator's coverage in isolation without an ISP filter.
- **Voice quality (MOS via POLQA)** is tracked as a first-class metric alongside data, with
  `call_type`/`call_app` fields distinguishing VoLTE from OTT calling apps. Mapee has no voice-quality
  concept at all.
- **A basemap switcher** (Google Street/Satellite/Hybrid, OpenStreetMap) — small, and Mapee has none.
- **A "Networks Chart" page** for time-series comparison across operators and locations, separate from
  the map — closer to Mapee's planned Insights tab than to `AreaSummarySheet`.
- The standalone `speedtest.enextwireless.com` feeds the same backend and has a copy-link share
  action — the same shape as Mapee's `/report/[id]`, not a new idea, just external confirmation the
  pattern is right.

One thing not to copy: the Google basemaps are pulled directly from `mt1.google.com/vt/...`, an
unauthenticated XYZ endpoint outside Google's terms for production use without a Maps API key. Adopt
the *idea* of a basemap switcher (§4.1's MapLibre light/dark styles already cover this need), not that
mechanism.

### 12.3 EnextLog — the data-collection app, and why most of it doesn't transfer

EnextLog is a **licensed, professional drive-test tool**, not a consumer app, and that distinction
matters more than any individual feature:

- Continuous background capture through screen lock, designed for 8+ hour drive/walk sessions, running
  automated Ping/Speed/Voice test cycles without manual intervention
- Full RF and cell-identity capture: RSRP, RSRQ, SINR, RSSI, CQI, PCI, eNB ID, Cell ID, TAC, MCC, MNC,
  ARFCN, Band, bandwidth, DL/UL centre frequency, timing advance, and a live **neighbour cell list**
- **Device and subscriber identity: IMSI, IMEI, MSISDN** — captured and streamed per record
- Multi-RAT (2G/3G/4G/5G) with global MCC/MNC auto-detection, buffered offline upload

Two of these are disqualifying for a consumer app, not just optional:

1. **IMSI/IMEI/MSISDN capture** is subscriber/device identity, not network-quality data. For a
   licensed field tool operating under an operator/regulator contract this is normal telecom
   engineering; for a public crowdsourced app it's a privacy and regulatory liability with no product
   benefit. **Do not adopt this**, in any form.
2. **Continuous multi-hour background logging through screen lock** is a different risk profile than
   Mapee's foreground, user-initiated scan. It directly conflicts with the foreground-only /
   `whileInUse` decision already made in §6.4 and the Risks table (§11) to avoid App Review scrutiny
   on background execution and background location. Building a "drive test mode" would undo that
   decision for a feature aimed at engineers, not Mapee's users.

The rest — RSRP/RSRQ/SINR capture, multi-RAT detection — is already in scope, just at consumer scale:
§6.3's `mapee_radio` plugin already plans to read what Android's `TelephonyManager`/`CellInfo` expose
without special permissions, foreground, one scan at a time, no IMSI involved. EnextLog validates that
those specific fields are the right ones to capture; it doesn't change how or how often.

### 12.4 What to adopt, and where it lands

| Feature | Lands in | Change |
|---|---|---|
| Metric switcher (Download / Upload / Ping / Composite) | §7.4 `/v1/areas`, §8, new map control | `/v1/areas` cells return the raw aggregate fields (avg latency, avg download, avg upload, sample count) once; the client picks which field drives hex colour. A segmented control on the map screen, not a new endpoint per metric — mirrors Enext's one-tile/many-styles approach and avoids the N-endpoint alternative |
| Five-tier ranking with per-metric thresholds | §4.1, `domain/latency.dart` | Extend `LatencyStatus` from 3 to 5 tiers; add analogous download/upload band tables once real throughput data exists (§6.2) — Enext's exact cut points are a reasonable starting default |
| Per-operator map filter, independent of the scan flow | §3, §5 Map tab | An ISP filter chip/sheet on the map itself, separate from "my ISP" in the scan flow — currently Mapee has no way to view one operator's coverage in isolation |
| "Untested area" as an explicit empty state | §5 | Area sheet and hex tooltip distinguish *no data yet* (with a "be the first to scan here" CTA) from *poor quality* — currently both render as nothing |
| Data source tag + dual freshness (RF vs throughput) | §7.5, §8, area sheet | Natural extension of the already-planned `measurement_method` column — surface it in the UI, and split "last updated" once latency and throughput sampling cadences diverge |
| Basemap style switcher | §4.1, layers sheet | Trivial once the light/dark MapLibre styles exist — add as a style picker, via proper tile providers, not unauthenticated Google XYZ |
| Time-series network comparison | §3 Insights tab | Extend beyond a single ISP-ranking snapshot to a historical/comparative chart, closer to Enext's separate "Networks Chart" page |
| Voice/call quality as a measured metric | New — stretch, post-v1 | Full POLQA requires licensing Enext likely pays for; a lightweight proxy (jitter + packet loss sampled during a short VoIP test burst) gets a directional signal without that dependency. Flag as a v2 candidate, not v1 scope |
| Public read-tier API for aggregate data | §7.6 (already planned) | Enext's paid-tier ecosystem is market evidence this is worth prioritising sooner rather than leaving as an optional post-v1 line item |

### 12.5 What this changes about the plan

Nothing above changes the architecture in §2, §7, or the phase count in §10 — it's additive scope
inside phases that already exist: the metric switcher and five-tier thresholds belong in Phase 2 (Map)
and Track A3 (`/v1/areas`), the ISP filter in Phase 2, "untested area" states in Phase 2/6, and voice
quality is explicitly deferred past v1. The one genuine decision this teardown forces is in §12.3:
confirming that Mapee should *not* chase EnextLog's drive-test feature set, even though a competitor
offers it, because it belongs to a different product (licensed field tool) with a different risk
profile than a public consumer app.
