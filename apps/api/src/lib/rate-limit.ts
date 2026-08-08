import type { Context } from "hono";
import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { redis } from "./redis.js";
import { getClientIP } from "./client-ip.js";
import { errorEnvelope } from "./errors.js";

interface RateLimitConfig {
  interval: number; // ms
  uniqueTokenPerInterval: number;
  namespace: string;
  /**
   * Defaults to IP. Pass this for routes with an authenticated install
   * (plan §7.6: "keyed on install token, falling back to IP" -- Nigerian
   * carriers NAT large populations behind few addresses, so an IP-only key
   * throttles legitimate users as soon as the app has traction).
   */
  key?: (c: Context) => string;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number; // ms timestamp
}

// In-memory fallback if Redis is not configured. Ported unchanged from
// apps/web/src/lib/rate-limit.ts — the identity key now comes from the
// trusted-proxy-aware getClientIP in ./client-ip, not the Vercel-specific
// request.ip that made every non-Vercel deployment collapse onto one
// "unknown" bucket (plan §7.5 item 5).
const localRateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(config: RateLimitConfig) {
  const upstashLimiter = redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(
          config.uniqueTokenPerInterval,
          `${Math.ceil(config.interval / 1000)} s` as Duration
        ),
        prefix: `@upstash/ratelimit/${config.namespace}`,
      })
    : null;

  return async function checkRateLimit(c: Context): Promise<RateLimitResult> {
    const identity = config.key ? config.key(c) : getClientIP(c);

    if (upstashLimiter) {
      try {
        const result = await upstashLimiter.limit(identity);
        return { success: result.success, remaining: result.remaining, reset: result.reset };
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(JSON.stringify({ level: "error", msg: "upstash rate limit error, falling back locally", err: String(e) }));
      }
    }

    const key = `${config.namespace}:${identity}`;
    const now = Date.now();
    const entry = localRateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      localRateLimitStore.set(key, { count: 1, resetTime: now + config.interval });
      return { success: true, remaining: config.uniqueTokenPerInterval - 1, reset: now + config.interval };
    }

    if (entry.count >= config.uniqueTokenPerInterval) {
      return { success: false, remaining: 0, reset: entry.resetTime };
    }

    entry.count++;
    return {
      success: true,
      remaining: config.uniqueTokenPerInterval - entry.count,
      reset: entry.resetTime,
    };
  };
}

/**
 * Reads `installId` off context (set by a route that already ran auth
 * resolution — see AuthVariables in ./auth.ts), falling back to IP when
 * absent. Passed as `scanSubmit`'s `key` below since that's the one route
 * A4 actually authenticates; every other limiter here stays IP-keyed.
 */
function installOrIp(c: Context): string {
  return (c.get("installId") as string | undefined) ?? getClientIP(c);
}

// Only `geocode` is wired to a route so far (GET /v1/geocode, this phase).
// The rest are declared ahead of the routes that will use them in A3, so
// the namespaces and limits are settled once rather than invented per-route.
export const apiRateLimits = {
  geocode: rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 30, namespace: "geocode" }),
  // Mint-a-credential endpoint (POST /v1/installs, plan §7.6): unauthenticated
  // by definition — there's no install token yet to key by — so this stays
  // IP-only, and deliberately tighter than every other limiter here.
  installs: rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 5, namespace: "installs" }),
  networkIdentify: rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 20, namespace: "networkIdentify" }),
  scanSubmit: rateLimit({
    interval: 60 * 1000,
    uniqueTokenPerInterval: 10,
    namespace: "scanSubmit",
    key: installOrIp,
  }),
  dataFetch: rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 60, namespace: "dataFetch" }),
  towers: rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 20, namespace: "towers" }),
};

/**
 * Unlike the ported original, this returns the shared error envelope
 * (plan §7.4 — "consistent error envelope" is explicitly cross-cutting)
 * rather than the ad-hoc `{ error, message, retryAfter }` shape
 * createRateLimitResponse used to return. `retryAfter` moves into
 * `details`; the standard `Retry-After` and `X-RateLimit-Reset` headers are
 * unchanged, since those are protocol-level, not body-shape.
 */
export function rateLimitResponse(c: Context, reset: number) {
  const retryAfter = Math.ceil((reset - Date.now()) / 1000);
  return c.json(
    errorEnvelope("rate_limited", "Rate limit exceeded. Please try again later.", { retryAfter }),
    429,
    {
      "Retry-After": String(retryAfter),
      "X-RateLimit-Reset": String(reset),
    }
  );
}
