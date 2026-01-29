import { NextRequest, NextResponse } from "next/server";
import { CellTower } from "@/types";

/**
 * Cell Tower API Proxy
 *
 * Proxies requests to OpenCelliD API for cell tower data.
 * Requires OPENCELLID_API_KEY environment variable.
 *
 * Note: OpenCelliD has usage limits. For production,
 * consider caching tower data or using a different provider.
 */

const OPENCELLID_URL = "https://opencellid.org/cell/getInArea";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const bbox = searchParams.get("bbox");

  if (!bbox) {
    return NextResponse.json(
      { error: "Query parameter 'bbox' is required (sw_lat,sw_lng,ne_lat,ne_lng)" },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENCELLID_API_KEY;

  // If no API key, return mock data for development
  if (!apiKey) {
    console.warn("OPENCELLID_API_KEY not set, returning mock tower data");
    return NextResponse.json(generateMockTowers(bbox));
  }

  try {
    const [swLat, swLng, neLat, neLng] = bbox.split(",").map(parseFloat);

    const params = new URLSearchParams({
      token: apiKey,
      BBOX: `${swLng},${swLat},${neLng},${neLat}`,
      format: "json",
      limit: "100",
    });

    const response = await fetch(`${OPENCELLID_URL}?${params}`);

    if (!response.ok) {
      throw new Error(`OpenCelliD API error: ${response.status}`);
    }

    const data = await response.json();

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

    return NextResponse.json(towers);
  } catch (error) {
    console.error("Tower API error:", error);
    // Return mock data as fallback
    return NextResponse.json(generateMockTowers(bbox));
  }
}

/**
 * Generate mock tower data for development/demo purposes
 */
function generateMockTowers(bbox: string): CellTower[] {
  const [swLat, swLng, neLat, neLng] = bbox.split(",").map(parseFloat);

  // Generate a few random towers within the bounding box
  const towers: CellTower[] = [];
  const count = Math.min(10, Math.floor(Math.random() * 5) + 3);

  for (let i = 0; i < count; i++) {
    const lat = swLat + Math.random() * (neLat - swLat);
    const lng = swLng + Math.random() * (neLng - swLng);

    towers.push({
      id: `mock-${i}-${Date.now()}`,
      lat,
      lng,
      type: Math.random() > 0.7 ? "5G" : "4G",
      mcc: 310,
      mnc: Math.floor(Math.random() * 999),
      lac: Math.floor(Math.random() * 65535),
      cellId: Math.floor(Math.random() * 268435455),
    });
  }

  return towers;
}
