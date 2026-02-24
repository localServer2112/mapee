import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { apiRateLimits, createRateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/stats
 * Fetch aggregated hexbin statistics for a bounding box
 *
 * Query params:
 * - north, south, east, west: Bounding box coordinates
 * - type: Optional, "isp" to get ISP rankings instead
 */
export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await apiRateLimits.dataFetch(request);
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult.reset);
  }

  // Check if Supabase is configured
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json([], {
      headers: {
        "X-Database-Status": "not-configured",
        "X-RateLimit-Remaining": String(rateLimitResult.remaining),
      },
    });
  }

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type");

  // Handle ISP rankings request
  if (type === "isp") {
    return getISPRankings(rateLimitResult.remaining);
  }

  // Handle hexbin stats request
  const north = parseFloat(searchParams.get("north") || "");
  const south = parseFloat(searchParams.get("south") || "");
  const east = parseFloat(searchParams.get("east") || "");
  const west = parseFloat(searchParams.get("west") || "");

  // Validate bounds
  if (
    isNaN(north) || isNaN(south) || isNaN(east) || isNaN(west) ||
    north < -90 || north > 90 ||
    south < -90 || south > 90 ||
    east < -180 || east > 180 ||
    west < -180 || west > 180
  ) {
    return NextResponse.json(
      { error: "Invalid bounding box coordinates" },
      { status: 400 }
    );
  }

  try {
    // Fetch hexbin stats from materialized view
    const { data, error } = await supabase.rpc("get_hexbin_stats_in_bounds", {
      north,
      south,
      east,
      west,
    });

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch statistics" },
        { status: 500 }
      );
    }

    // Transform to frontend HexBin format
    const hexbins = (data || []).map((row: {
      hex_id: string;
      center_lat: number;
      center_lng: number;
      avg_latency: number;
      min_latency: number;
      max_latency: number;
      ping_count: number;
      top_isp: string;
      confidence_score: number;
      consistency: number;
    }) => ({
      id: row.hex_id,
      x: parseInt(row.hex_id.split("_")[0] || "0", 10),
      y: parseInt(row.hex_id.split("_")[1] || "0", 10),
      centerLat: row.center_lat,
      centerLng: row.center_lng,
      avgLatency: row.avg_latency,
      minLatency: row.min_latency,
      maxLatency: row.max_latency,
      pingCount: row.ping_count,
      topISP: row.top_isp,
      confidence: row.confidence_score,
      consistency: row.consistency,
      pings: [], // Individual pings not included for performance
    }));

    return NextResponse.json(hexbins, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "X-RateLimit-Remaining": String(rateLimitResult.remaining),
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Get ISP rankings
 */
async function getISPRankings(remaining: number) {
  if (!supabase) {
    return NextResponse.json([], {
      headers: {
        "X-Database-Status": "not-configured",
        "X-RateLimit-Remaining": String(remaining),
      },
    });
  }

  try {
    const { data, error } = await supabase
      .from("isp_rankings")
      .select("*")
      .limit(20);

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch ISP rankings" },
        { status: 500 }
      );
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "X-RateLimit-Remaining": String(remaining),
      },
    });
  } catch (error) {
    console.error("Error fetching ISP rankings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
