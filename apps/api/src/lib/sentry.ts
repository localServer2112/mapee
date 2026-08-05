import * as Sentry from "@sentry/node";

/**
 * Same "no-op unless configured" shape as ./redis.ts's `redis` export:
 * `export const redis = process.env.UPSTASH_REDIS_REST_URL && ... ? new Redis(...) : null`.
 * There is no real Sentry project for Mapee yet — this is wired and ready,
 * not live. It stays fully inactive (no network calls, no throws) until a
 * real SENTRY_DSN is set in the environment.
 */
const dsn = process.env.SENTRY_DSN;

let initialized = false;

/**
 * Safe to call unconditionally at process startup (intended call site:
 * index.ts, before `serve(...)`). No-ops if SENTRY_DSN isn't set.
 *
 * The current @sentry/node docs recommend initializing from a file that's
 * preloaded via `node --import ./instrument.mjs` (or NODE_OPTIONS) so that
 * auto-instrumentation of built-in modules (http, etc.) attaches before
 * anything else in the process loads — "call Sentry.init before you
 * require any other modules, otherwise auto-instrumentation ... will not
 * work." apps/api's `start` script runs `tsx src/index.ts` directly, with
 * no preload hook, so that early-preload path isn't available here.
 * Calling Sentry.init() as a plain function from within index.ts (as this
 * is designed to be used) forgoes automatic http/tracing instrumentation;
 * it's still sufficient for this module's actual contract — manual error
 * reporting via captureError below, not automatic tracing.
 */
export function initSentry(): void {
  if (!dsn || initialized) {
    return;
  }
  try {
    Sentry.init({ dsn });
    initialized = true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: "error", msg: "sentry init failed", err: String(e) }));
  }
}

/**
 * Reports an error to Sentry if configured; no-ops otherwise. Additive to
 * the console.error logging app.ts's onError handler already does
 * unconditionally — this doesn't replace that, it's a second destination
 * for the same failure when Sentry is actually configured.
 */
export function captureError(err: unknown): void {
  if (!dsn) {
    return;
  }
  try {
    Sentry.captureException(err);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({ level: "error", msg: "sentry captureException failed", err: String(e) })
    );
  }
}
