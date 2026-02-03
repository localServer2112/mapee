import { NextRequest, NextResponse } from "next/server";
import { CellTower } from "@/types";

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

  // If no API key, return mock data
  if (!apiKey) {
    console.warn("OPENCELLID_API_KEY not set, returning mock tower data");
    return NextResponse.json(generateMockTowers(swLat, swLng, neLat, neLng));
  }

  // Clamp bbox to API limits
  const [cSwLat, cSwLng, cNeLat, cNeLng] = clampBBox(swLat, swLng, neLat, neLng);
  const cacheKey = getCacheKey((cSwLat + cNeLat) / 2, (cSwLng + cNeLng) / 2);

  // Check cache
  const cached = towerCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data, {
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
      throw new Error(`OpenCelliD API error: ${response.status}`);
    }

    const data = await response.json();

    // OpenCelliD returns { error, code } on errors even with 200 status
    if (data.error) {
      console.warn("OpenCelliD API error:", data.error);
      throw new Error(data.error);
    }

    // Transform to our format
    const towers: CellTower[] = (data.cells || []).map(
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

    return NextResponse.json(towers, {
      headers: { "X-Cache": "MISS" },
    });
  } catch (error) {
    console.error("Tower API error:", error);
    // Return mock data as fallback
    return NextResponse.json(generateMockTowers(cSwLat, cSwLng, cNeLat, cNeLng));
  }
}

/**
 * Generate mock tower data for development/demo/fallback
 */
function generateMockTowers(
  swLat: number,
  swLng: number,
  neLat: number,
  neLng: number
): CellTower[] {
  const towers: CellTower[] = [];
  const count = Math.floor(Math.random() * 5) + 5;

  for (let i = 0; i < count; i++) {
    const lat = swLat + Math.random() * (neLat - swLat);
    const lng = swLng + Math.random() * (neLng - swLng);

    towers.push({
      id: `mock-${i}-${Date.now()}`,
      lat,
      lng,
      type: Math.random() > 0.7 ? "5G" : "4G",
      mcc: 621, // Nigeria MCC
      mnc: Math.floor(Math.random() * 99) + 1,
      lac: Math.floor(Math.random() * 65535),
      cellId: Math.floor(Math.random() * 268435455),
    });
  }

  return towers;
}
