import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { apiRateLimits, createRateLimitResponse } from "@/lib/rate-limit";
import { encryptCoordinate, decryptCoordinate, computeGridCoordinates } from "@/lib/encryption";
import { PingLog } from "@/types";

export const dynamic = "force-dynamic";

// Validation helpers
function isValidLatitude(lat: number): boolean {
  return typeof lat === "number" && lat >= -90 && lat <= 90;
}

function isValidLongitude(lng: number): boolean {
  return typeof lng === "number" && lng >= -180 && lng <= 180;
}

function isValidLatency(ms: number): boolean {
  return typeof ms === "number" && ms >= 0 && ms <= 10000;
}

function isValidSpeed(speed: number): boolean {
  return typeof speed === "number" && speed >= 0 && speed <= 10000;
}

function isValidDeviceType(type: string): type is "mobile" | "tablet" | "desktop" {
  return ["mobile", "tablet", "desktop"].includes(type);
}

function sanitizeString(str: string, maxLength: number = 100): string {
  return String(str).slice(0, maxLength).trim();
}

/**
 * GET /api/pings
 * Fetch ping logs within a bounding box
 */
export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = apiRateLimits.dataFetch(request);
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult.reset);
  }

  // Check if Supabase is configured
  if (!isSupabaseConfigured || !supabase) {
    // Return empty array if database not configured (offline mode)
    return NextResponse.json([], {
      headers: {
        "X-Database-Status": "not-configured",
        "X-RateLimit-Remaining": String(rateLimitResult.remaining),
      },
    });
  }

  const searchParams = request.nextUrl.searchParams;
  const north = parseFloat(searchParams.get("north") || "");
  const south = parseFloat(searchParams.get("south") || "");
  const east = parseFloat(searchParams.get("east") || "");
  const west = parseFloat(searchParams.get("west") || "");
  const maxAge = parseInt(searchParams.get("maxAge") || "30", 10);

  // Validate bounds
  if (
    !isValidLatitude(north) ||
    !isValidLatitude(south) ||
    !isValidLongitude(east) ||
    !isValidLongitude(west)
  ) {
    return NextResponse.json(
      { error: "Invalid bounding box coordinates" },
      { status: 400 }
    );
  }

  if (north < south) {
    return NextResponse.json(
      { error: "North must be greater than south" },
      { status: 400 }
    );
  }

  try {
    // Use the database function for optimized geographic query
    const { data, error } = await supabase.rpc("get_pings_in_bounds", {
      north,
      south,
      east,
      west,
      max_age_days: Math.min(maxAge, 90), // Cap at 90 days
    });

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch ping data" },
        { status: 500 }
      );
    }

    // Transform to frontend format (decrypt coordinates)
    const pings: PingLog[] = (data || []).map((row: {
      id: string;
      lat_encrypted: string;
      lng_encrypted: string;
      lat_grid: number;
      lng_grid: number;
      reported_isp: string;
      verified_asn: string | null;
      latency_ms: number;
      jitter: number;
      upload_speed: number;
      download_speed: number;
      device_type: string;
      created_at: string;
    }) => {
      let lat: number;
      let lng: number;
      try {
        lat = decryptCoordinate(row.lat_encrypted);
        lng = decryptCoordinate(row.lng_encrypted);
      } catch {
        // Fallback to grid coordinates (legacy or key-mismatched data)
        lat = row.lat_grid;
        lng = row.lng_grid;
      }

      return {
        id: row.id,
        lat,
        lng,
        reportedISP: row.reported_isp,
        verifiedASN: row.verified_asn,
        latencyMs: row.latency_ms,
        jitter: row.jitter,
        uploadSpeed: Number(row.upload_speed),
        downloadSpeed: Number(row.download_speed),
        deviceType: row.device_type as "mobile" | "tablet" | "desktop",
        userAgent: "",
        timestamp: new Date(row.created_at).getTime(),
      };
    });

    return NextResponse.json(pings, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        "X-RateLimit-Remaining": String(rateLimitResult.remaining),
      },
    });
  } catch (error) {
    console.error("Error fetching pings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pings
 * Submit a new ping log
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = apiRateLimits.pingSubmit(request);
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult.reset);
  }

  // Check if Supabase is configured
  if (!isSupabaseConfigured || !supabase) {
    // Accept the data but don't persist (offline mode)
    // Client will store locally and sync later
    return NextResponse.json(
      {
        success: true,
        id: `local-${Date.now()}`,
        timestamp: Date.now(),
        offline: true,
      },
      {
        status: 202, // Accepted but not persisted
        headers: {
          "X-Database-Status": "not-configured",
          "X-RateLimit-Remaining": String(rateLimitResult.remaining),
        },
      }
    );
  }

  try {
    const body = await request.json();

    // Validate required fields
    const { lat, lng, reportedISP, latencyMs, jitter, uploadSpeed, downloadSpeed, deviceType } = body;

    if (!isValidLatitude(lat)) {
      return NextResponse.json({ error: "Invalid latitude" }, { status: 400 });
    }

    if (!isValidLongitude(lng)) {
      return NextResponse.json({ error: "Invalid longitude" }, { status: 400 });
    }

    if (!isValidLatency(latencyMs)) {
      return NextResponse.json({ error: "Invalid latency" }, { status: 400 });
    }

    if (!isValidLatency(jitter)) {
      return NextResponse.json({ error: "Invalid jitter" }, { status: 400 });
    }

    if (!isValidSpeed(uploadSpeed)) {
      return NextResponse.json({ error: "Invalid upload speed" }, { status: 400 });
    }

    if (!isValidSpeed(downloadSpeed)) {
      return NextResponse.json({ error: "Invalid download speed" }, { status: 400 });
    }

    if (!isValidDeviceType(deviceType)) {
      return NextResponse.json({ error: "Invalid device type" }, { status: 400 });
    }

    if (!reportedISP || typeof reportedISP !== "string") {
      return NextResponse.json({ error: "ISP is required" }, { status: 400 });
    }

    // Encrypt exact coordinates and compute grid coordinates for spatial queries
    const { lat_grid, lng_grid } = computeGridCoordinates(Number(lat), Number(lng));
    const lat_encrypted = encryptCoordinate(Number(lat));
    const lng_encrypted = encryptCoordinate(Number(lng));

    // Accept optional client-provided UUID for shareable report links
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const clientId = body.id && typeof body.id === "string" && UUID_REGEX.test(body.id)
      ? body.id
      : undefined;

    const pingData = {
      ...(clientId && { id: clientId }),
      lat_encrypted,
      lng_encrypted,
      lat_grid,
      lng_grid,
      reported_isp: sanitizeString(reportedISP),
      verified_asn: body.verifiedASN ? sanitizeString(body.verifiedASN) : null,
      latency_ms: Math.round(latencyMs),
      jitter: Math.round(jitter),
      upload_speed: Number(uploadSpeed.toFixed(2)),
      download_speed: Number(downloadSpeed.toFixed(2)),
      device_type: deviceType,
      user_agent: body.userAgent ? sanitizeString(body.userAgent, 500) : null,
    };

    // Insert into database
    const { data, error } = await supabase
      .from("ping_logs")
      .insert(pingData)
      .select("id, created_at")
      .single();

    if (error) {
      console.error("Database insert error:", error);
      return NextResponse.json(
        { error: "Failed to save ping data" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        id: data.id,
        timestamp: new Date(data.created_at).getTime(),
      },
      {
        status: 201,
        headers: {
          "X-RateLimit-Remaining": String(rateLimitResult.remaining),
        },
      }
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    console.error("Error saving ping:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
