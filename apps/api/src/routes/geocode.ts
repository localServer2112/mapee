import { OpenAPIHono } from "@hono/zod-openapi";
import { GeocodeResultSchema, getGeocodeRoute, type GeocodeResult } from "@mapee/contracts";
import { validationErrorHook, errorEnvelope } from "../lib/errors.js";
import { apiRateLimits, rateLimitResponse } from "../lib/rate-limit.js";
import { redis } from "../lib/redis.js";

/**
 * Ported from apps/web/src/app/api/geocode/route.ts. Behaviour is unchanged
 * except: the query param `countrycodes` is now `country` (GeocodeQuerySchema,
 * decided when the contract was written), the 429 body uses the shared error
 * envelope instead of the old ad-hoc shape, and rate limiting now keys on the
 * trusted-proxy-aware getClientIP instead of the Vercel-only request.ip.
 */
export const geocode = new OpenAPIHono({ defaultHook: validationErrorHook });

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

interface GeocodeCacheEntry {
  data: GeocodeResult[];
  timestamp: number;
}

// In-memory fallback when Redis isn't configured, same as every other cache
// in this codebase (apps/web's geocode/towers/asn routes). Ported unchanged.
const geocodeCache = new Map<string, GeocodeCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: string[];
}

function toGeocodeResult(item: NominatimResult): GeocodeResult {
  return {
    displayName: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    boundingBox: item.boundingbox
      ? (item.boundingbox.map(parseFloat) as [number, number, number, number])
      : undefined,
  };
}

geocode.openapi(getGeocodeRoute, async (c) => {
  const rateLimitResult = await apiRateLimits.geocode(c);
  if (!rateLimitResult.success) {
    return rateLimitResponse(c, rateLimitResult.reset);
  }

  // q is already trimmed and length-checked by GeocodeQuerySchema — see the
  // comment on its `.trim().min(2)` chain for why that lives in the schema
  // rather than here.
  const { q, country } = c.req.valid("query");
  const cacheKey = `geocode:${q}:${country ?? ""}`;

  let cached: GeocodeResult[] | null = null;
  try {
    if (redis) {
      cached = await redis.get<GeocodeResult[]>(cacheKey);
    } else {
      const entry = geocodeCache.get(cacheKey);
      if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
        cached = entry.data;
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: "error", msg: "geocode cache read failed", err: String(e) }));
  }

  if (cached) {
    return c.json(cached, 200, {
      "X-Cache": "HIT",
      "X-RateLimit-Remaining": String(rateLimitResult.remaining),
    });
  }

  const params = new URLSearchParams({
    q,
    format: "json",
    limit: "5",
    addressdetails: "1",
  });
  if (country) params.append("countrycodes", country);

  const upstream = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { "User-Agent": "Mapee/1.0 (https://mapee.app)", Accept: "application/json" },
  });

  if (!upstream.ok) {
    return c.json(errorEnvelope("upstream_error", "Failed to geocode location"), 500);
  }

  const raw = (await upstream.json()) as NominatimResult[];

  // Validate each item against our own contract rather than trusting
  // Nominatim's response shape unconditionally. A malformed individual
  // result is dropped (with a logged warning), not treated as a reason to
  // fail the whole request — one bad row shouldn't sink four good ones.
  const results: GeocodeResult[] = [];
  for (const item of raw) {
    const candidate = toGeocodeResult(item);
    const parsed = GeocodeResultSchema.safeParse(candidate);
    if (parsed.success) {
      results.push(parsed.data);
    } else {
      // eslint-disable-next-line no-console
      console.warn(JSON.stringify({ level: "warn", msg: "dropped malformed geocode result", issues: parsed.error.issues }));
    }
  }

  try {
    if (redis) {
      await redis.set(cacheKey, results, { ex: 300 });
    } else {
      geocodeCache.set(cacheKey, { data: results, timestamp: Date.now() });
      if (geocodeCache.size > 100) {
        const now = Date.now();
        for (const [key, entry] of geocodeCache.entries()) {
          if (now - entry.timestamp > CACHE_TTL_MS) geocodeCache.delete(key);
        }
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: "error", msg: "geocode cache write failed", err: String(e) }));
  }

  return c.json(results, 200, {
    "X-Cache": "MISS",
    "X-RateLimit-Remaining": String(rateLimitResult.remaining),
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
  });
});
