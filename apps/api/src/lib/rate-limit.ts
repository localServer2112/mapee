import type { Context } from "hono";
import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { redis } from "./redis.js";
import { getClientIP } from "./client-ip.js";
import { errorEnvelope } from "./errors.js";

interface RateLimitConfig {
  interval: number; // ms
  uniqueTokenPerInterval: number;
  namespace: string;
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
    const ip = getClientIP(c);

    if (upstashLimiter) {
      try {
        const result = await upstashLimiter.limit(ip);
        return { success: result.success, remaining: result.remaining, reset: result.reset };
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(JSON.stringify({ level: "error", msg: "upstash rate limit error, falling back locally", err: String(e) }));
      }
    }

    const key = `${config.namespace}:${ip}`;
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

// Only `geocode` is wired to a route so far (GET /v1/geocode, this phase).
// The rest are declared ahead of the routes that will use them in A3, so
// the namespaces and limits are settled once rather than invented per-route.
export const apiRateLimits = {
  geocode: rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 30, namespace: "geocode" }),
  networkIdentify: rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 20, namespace: "networkIdentify" }),
  scanSubmit: rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 10, namespace: "scanSubmit" }),
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
