import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

interface RateLimitConfig {
  interval: number; // Time window in milliseconds
  uniqueTokenPerInterval: number; // Max requests per IP per interval
  namespace: string;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

export function getClientIP(request: NextRequest): string {
  // Use Vercel's securely populated request.ip or fallback to x-real-ip
  return request.ip || request.headers.get("x-real-ip") || "unknown";
}

// In-memory fallback if Redis is not configured
interface RateLimitEntry {
  count: number;
  resetTime: number;
}
const localRateLimitStore = new Map<string, RateLimitEntry>();

export function rateLimit(config: RateLimitConfig) {
  // If we have redis, instantiate upstash ratelimiter
  const upstashLimiter = redis
    ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.uniqueTokenPerInterval, `${Math.ceil(config.interval / 1000)} s` as any),
      prefix: `@upstash/ratelimit/${config.namespace}`,
    })
    : null;

  return async function checkRateLimit(request: NextRequest): Promise<RateLimitResult> {
    const ip = getClientIP(request);

    // 1. Try Redis first
    if (upstashLimiter) {
      try {
        const result = await upstashLimiter.limit(ip);
        return {
          success: result.success,
          remaining: result.remaining,
          reset: result.reset, // timestamp in ms
        };
      } catch (e) {
        console.error("Upstash rate limit error, falling back locally:", e);
      }
    }

    // 2. Local in-memory limit fallback (lazy cleanup)
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
    return { success: true, remaining: config.uniqueTokenPerInterval - entry.count, reset: entry.resetTime };
  };
}

// Pre-configured rate limiters for different endpoints
export const apiRateLimits = {
  geocode: rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 30, namespace: "geocode" }),
  asn: rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 20, namespace: "asn" }),
  pingSubmit: rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 10, namespace: "pingSubmit" }),
  dataFetch: rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 60, namespace: "dataFetch" }),
  towers: rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 20, namespace: "towers" }),
};

export function createRateLimitResponse(reset: number): NextResponse {
  return NextResponse.json(
    {
      error: "Too many requests",
      message: "Rate limit exceeded. Please try again later.",
      retryAfter: Math.ceil((reset - Date.now()) / 1000),
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
        "X-RateLimit-Reset": String(reset),
      },
    }
  );
}
