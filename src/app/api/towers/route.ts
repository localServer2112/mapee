import { NextRequest, NextResponse } from "next/server";
import { CellTower } from "@/types";
import { redis } from "@/lib/redis";

/**
 * Cell Tower API Proxy
 *
 * Proxies requests to OpenCelliD API for cell tower data.
 * Requires OPENCELLID_API_KEY environment variable.
 *
 * OpenCelliD has a strict 4 sq km area limit per request,
 * so we clamp the bbox to a ~2km box around the center.
 */

const OPENCELLID_URL = "https://opencellid.org/cell/getInArea";

// Max side length in degrees (~1.8km at equator)
const MAX_BBOX_DEGREES = 0.016;

/**
 * Clamp a bounding box to OpenCelliD's 4 sq km limit
 * by centering a small box on the midpoint.
 */
function clampBBox(
  swLat: number,
  swLng: number,
  neLat: number,
  neLng: number
): [number, number, number, number] {
  const centerLat = (swLat + neLat) / 2;
  const centerLng = (swLng + neLng) / 2;
  const halfDeg = MAX_BBOX_DEGREES / 2;

  return [
    centerLat - halfDeg,
    centerLng - halfDeg,
    centerLat + halfDeg,
    centerLng + halfDeg,
  ];
}

// Cache tower data to reduce API calls (keyed by rounded center)
const towerCache = new Map<string, { data: CellTower[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(lat: number, lng: number): string {
  // Round to ~500m grid to increase cache hits
  return `${(Math.round(lat * 200) / 200).toFixed(3)},${(Math.round(lng * 200) / 200).toFixed(3)}`;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const bbox = searchParams.get("bbox");

  if (!bbox) {
    return NextResponse.json(
      { error: "Query parameter 'bbox' is required (sw_lat,sw_lng,ne_lat,ne_lng)" },
      { status: 400 }
    );
  }

  const [swLat, swLng, neLat, neLng] = bbox.split(",").map(parseFloat);

  if ([swLat, swLng, neLat, neLng].some(isNaN)) {
    return NextResponse.json(
      { error: "Invalid bbox coordinates" },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENCELLID_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENCELLID_API_KEY not configured" },
      { status: 503 }
    );
  }

  // Clamp bbox to API limits
  const [cSwLat, cSwLng, cNeLat, cNeLng] = clampBBox(swLat, swLng, neLat, neLng);
  const cacheKey = getCacheKey((cSwLat + cNeLat) / 2, (cSwLng + cNeLng) / 2);

  // Check cache
  const redisKey = `towers:${cacheKey}`;
  let cachedData = null;

  try {
    if (redis) {
      cachedData = await redis.get(redisKey);
    } else {
      const cached = towerCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        cachedData = cached.data;
      }
    }
  } catch (e) {
    console.error("Redis cache error:", e);
  }

  if (cachedData) {
    return NextResponse.json(cachedData, {
      headers: { "X-Cache": "HIT" },
    });
  }

  try {
    // OpenCelliD BBOX format: lon1,lat1,lon2,lat2
    const params = new URLSearchParams({
      token: apiKey,
      BBOX: `${cSwLng},${cSwLat},${cNeLng},${cNeLat}`,
      format: "json",
      limit: "200",
    });

    const response = await fetch(`${OPENCELLID_URL}?${params}`);

    if (!response.ok) {
      return NextResponse.json(
        { error: `OpenCelliD API returned ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();

    // OpenCelliD returns { error, code } on errors even with 200 status
    if (data.error) {
      // "No cells found" is normal — just means no towers in this area
      if (data.error === "No cells found") {
        try {
          if (redis) {
            await redis.set(redisKey, [], { ex: 300 }); // 5 mins
          } else {
            towerCache.set(cacheKey, { data: [], timestamp: Date.now() });
          }
        } catch (e) { console.error("Redis set error:", e); }
        return NextResponse.json([], { headers: { "X-Cache": "MISS" } });
      }
      return NextResponse.json(
        { error: data.error },
        { status: 502 }
      );
    }

    // Transform to our format
    const cells = Array.isArray(data?.cells) ? data.cells : [];
    const towers: CellTower[] = cells.map(
      (cell: {
        cellid: number;
        lat: number;
        lon: number;
        mcc: number;
        mnc: number;
        lac: number;
        radio: string;
      }) => ({
        id: `${cell.mcc}-${cell.mnc}-${cell.lac}-${cell.cellid}`,
        lat: cell.lat,
        lng: cell.lon,
        type: cell.radio === "NR" ? "5G" : "4G",
        mcc: cell.mcc,
        mnc: cell.mnc,
        lac: cell.lac,
        cellId: cell.cellid,
      })
    );

    // Cache result
    try {
      if (redis) {
        await redis.set(redisKey, towers, { ex: 300 }); // 5 minutes
      } else {
        towerCache.set(cacheKey, { data: towers, timestamp: Date.now() });

        // Clean stale entries
        if (towerCache.size > 100) {
          const now = Date.now();
          for (const [key, value] of towerCache.entries()) {
            if (now - value.timestamp > CACHE_TTL) {
              towerCache.delete(key);
            }
          }
        }
      }
    } catch (e) {
      console.error("Redis set error:", e);
    }

    return NextResponse.json(towers, {
      headers: { "X-Cache": "MISS" },
    });
  } catch (error) {
    console.error("Tower API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tower data" },
      { status: 500 }
    );
  }
}
