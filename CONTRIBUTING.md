# Contributing

## Setup

Node 20+ and pnpm 9. pnpm comes via corepack, pinned by `packageManager` in the
root `package.json`:

```bash
corepack enable
pnpm install
```

Do not use npm or yarn in this repository — the lockfile is pnpm's, and
`workspace:*` dependencies will not resolve.

## Layout rules

The workspace boundary is the point of the structure, so it is worth stating
plainly what may depend on what:

```
apps/web  ──▶  packages/core
apps/api  ──▶  packages/core        (once it exists)
```

- `packages/core` depends on nothing in the workspace and must stay free of
  React, Flutter, browser, and Node-server APIs.
- Apps never import another app.
- Nothing imports *into* core from an app. If an app needs core to know
  something, the type or constant moves into core.

Deciding where code goes: if the API service and the mobile app would both need
to compute it identically, it belongs in `packages/core`. If it produces a colour,
a class name, a URL path, or a piece of client state, it belongs to the app.

## Commands

| From root | Effect |
|---|---|
| `pnpm build` / `pnpm lint` / `pnpm test` / `pnpm typecheck` | Across all packages |
| `pnpm --filter @mapee/core test:watch` | One package, watch mode |
| `pnpm web dev` | Shorthand for `pnpm --filter @mapee/web dev` |

Turborepo caches task output. If a result looks stale, `pnpm build --force`.

## Tests

`packages/core` is unit-tested with vitest and should stay that way — it is pure
functions, so there is no excuse for uncovered branches.

Two things to test whenever you touch domain logic:

1. **Boundary conditions.** Empty arrays, single elements, values exactly on a
   threshold. Most of the bugs found in this codebase were at boundaries.
2. **The Dart port's contract.** Core's tests are the specification for the
   mobile port. A test that pins a tie-break rule or an inclusive bound is doing
   double duty; write it that way.

`apps/web` has no test setup yet. Adding one is welcome.

## Commits and PRs

Conventional-commit prefixes (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).

Explain the *why* in the body — the diff already shows the what. If a change
alters behaviour, say so explicitly; if it is a pure move or rename, say that too
so reviewers know they can skim it.

Keep planning changes out of functional PRs and vice versa.

## Database changes

Schema lives in `supabase/schema.sql`. When changing it, remember:

- `hexbin_stats` is a materialized view; new columns need the refresh function
  considered too.
- The aggregation grid constants in `packages/core/src/constants.ts` (`GRID`)
  mirror the `FLOOR(... / 0.0045)` and `FLOOR(... / 0.005)` buckets in that view.
  Changing one without the other silently misaligns every cell.
- `ping_logs` is append-only by RLS policy — updates and deletes are blocked.

## Secrets

Never commit `.env.local` or any real key. `.env.example` holds placeholders
only. If a secret is exposed — in a commit, a log, a screenshot, or a chat —
rotate it in the provider dashboard rather than assuming it went unnoticed.
