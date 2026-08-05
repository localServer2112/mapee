import { NextRequest, NextResponse } from "next/server";
import { apiRateLimits, createRateLimitResponse } from "@/lib/rate-limit";
import { redis } from "@/lib/redis";

/**
 * Geocoding API Proxy
 *
 * Proxies requests to OpenStreetMap Nominatim API
 * to avoid CORS issues and add rate limiting.
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// Simple in-memory cache for geocode results
const geocodeCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  // Rate limiting (now async via Redis)
  const rateLimitResult = await apiRateLimits.geocode(request);
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult.reset);
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const countrycodes = searchParams.get("countrycodes");

  if (!query) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required" },
      { status: 400 }
    );
  }

  // Sanitize and validate query
  const sanitizedQuery = query.trim().slice(0, 200);
  if (sanitizedQuery.length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  // Check cache
  const cacheKey = `geocode:${sanitizedQuery}:${countrycodes || ""}`;
  let cachedData = null;

  try {
    if (redis) {
      cachedData = await redis.get(cacheKey);
    } else {
      const cached = geocodeCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        cachedData = cached.data;
      }
    }
  } catch (e) {
    console.error("Redis cache error:", e);
  }

  if (cachedData) {
    return NextResponse.json(cachedData, {
      headers: {
        "X-Cache": "HIT",
        "X-RateLimit-Remaining": String(rateLimitResult.remaining),
      },
    });
  }

  try {
    const params = new URLSearchParams({
      q: sanitizedQuery,
      format: "json",
      limit: "5",
      addressdetails: "1",
    });

    if (countrycodes) {
      params.append("countrycodes", countrycodes);
    }

    const response = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: {
        "User-Agent": "Mapee/1.0 (https://mapee.app)",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = await response.json();

    // Transform to our format
    const results = data.map(
      (item: {
        display_name: string;
        lat: string;
        lon: string;
        boundingbox?: string[];
      }) => ({
        displayName: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        boundingBox: item.boundingbox
          ? item.boundingbox.map(parseFloat)
          : undefined,
      })
    );

    // Cache the results
    try {
      if (redis) {
        await redis.set(cacheKey, results, { ex: 300 }); // 5 minutes
      } else {
        geocodeCache.set(cacheKey, { data: results, timestamp: Date.now() });

        // Clean old cache entries
        if (geocodeCache.size > 100) {
          const now = Date.now();
          for (const [key, value] of geocodeCache.entries()) {
            if (now - value.timestamp > CACHE_TTL) {
              geocodeCache.delete(key);
            }
          }
        }
      }
    } catch (e) {
      console.error("Redis set error:", e);
    }

    return NextResponse.json(results, {
      headers: {
        "X-Cache": "MISS",
        "X-RateLimit-Remaining": String(rateLimitResult.remaining),
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Geocoding error:", error);
    return NextResponse.json(
      { error: "Failed to geocode location" },
      { status: 500 }
    );
  }
}
