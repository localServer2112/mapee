import { NextRequest, NextResponse } from "next/server";

/**
 * Geocoding API Proxy
 *
 * Proxies requests to OpenStreetMap Nominatim API
 * to avoid CORS issues and add rate limiting.
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required" },
      { status: 400 }
    );
  }

  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      limit: "5",
      addressdetails: "1",
    });

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

    return NextResponse.json(results);
  } catch (error) {
    console.error("Geocoding error:", error);
    return NextResponse.json(
      { error: "Failed to geocode location" },
      { status: 500 }
    );
  }
}
