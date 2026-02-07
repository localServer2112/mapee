import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { decryptCoordinate } from "@/lib/encryption";

export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Invalid report ID" }, { status: 400 });
  }

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("ping_logs")
      .select(
        "id, lat_encrypted, lng_encrypted, lat_grid, lng_grid, reported_isp, verified_asn, latency_ms, jitter, upload_speed, download_speed, device_type, created_at"
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    let lat: number;
    let lng: number;
    try {
      lat = decryptCoordinate(data.lat_encrypted);
      lng = decryptCoordinate(data.lng_encrypted);
    } catch {
      lat = data.lat_grid;
      lng = data.lng_grid;
    }

    return NextResponse.json({
      id: data.id,
      lat,
      lng,
      reportedISP: data.reported_isp,
      verifiedASN: data.verified_asn,
      latencyMs: data.latency_ms,
      jitter: data.jitter,
      uploadSpeed: Number(data.upload_speed),
      downloadSpeed: Number(data.download_speed),
      deviceType: data.device_type,
      userAgent: "",
      timestamp: new Date(data.created_at).getTime(),
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Error fetching ping:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
