import { NextRequest, NextResponse } from "next/server";

interface RateLimitConfig {
  interval: number; // Time window in milliseconds
  uniqueTokenPerInterval: number; // Max requests per IP per interval
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute

export function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  return forwardedFor?.split(",")[0].trim() || realIp || "unknown";
}

export function rateLimit(config: RateLimitConfig) {
  return function checkRateLimit(request: NextRequest): {
    success: boolean;
    remaining: number;
    reset: number;
  } {
    const ip = getClientIP(request);
    const key = `${ip}`;
    const now = Date.now();

    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      // First request or window expired
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + config.interval,
      });
      return {
        success: true,
        remaining: config.uniqueTokenPerInterval - 1,
        reset: now + config.interval,
      };
    }

    if (entry.count >= config.uniqueTokenPerInterval) {
      // Rate limit exceeded
      return {
        success: false,
        remaining: 0,
        reset: entry.resetTime,
      };
    }

    // Increment counter
    entry.count++;
    return {
      success: true,
      remaining: config.uniqueTokenPerInterval - entry.count,
      reset: entry.resetTime,
    };
  };
}

// Pre-configured rate limiters for different endpoints
export const apiRateLimits = {
  // Geocode: 30 requests per minute
  geocode: rateLimit({
    interval: 60 * 1000,
    uniqueTokenPerInterval: 30,
  }),

  // ASN lookup: 20 requests per minute
  asn: rateLimit({
    interval: 60 * 1000,
    uniqueTokenPerInterval: 20,
  }),

  // Ping submission: 10 requests per minute (prevent spam)
  pingSubmit: rateLimit({
    interval: 60 * 1000,
    uniqueTokenPerInterval: 10,
  }),

  // Data fetch: 60 requests per minute
  dataFetch: rateLimit({
    interval: 60 * 1000,
    uniqueTokenPerInterval: 60,
  }),

  // Towers: 20 requests per minute
  towers: rateLimit({
    interval: 60 * 1000,
    uniqueTokenPerInterval: 20,
  }),
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
