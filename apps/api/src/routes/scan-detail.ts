import { OpenAPIHono } from "@hono/zod-openapi";
import { ScanDetailSchema, getScanDetailRoute } from "@mapee/contracts";
import { validationErrorHook, errorEnvelope } from "../lib/errors.js";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";
import { decryptCoordinate } from "../lib/encryption.js";

/**
 * Ported from apps/web/src/app/api/pings/[id]/route.ts. The one endpoint
 * that returns exact coordinates, per plan §7.5 item 1 — everything else
 * (GET /v1/scans, GET /v1/areas) returns grid-snapped values only. Not yet
 * restricted to the submitting install; see getScanDetailRoute's
 * description for why that's an honest gap rather than an oversight.
 *
 * Same graceful decrypt-or-fall-back-to-grid behavior as the legacy route,
 * surfaced explicitly as isLocationExact rather than silently swallowed.
 */
export const scanDetail = new OpenAPIHono({ defaultHook: validationErrorHook });

interface PingLogRow {
  id: string;
  lat_encrypted: string;
  lng_encrypted: string;
  lat_grid: number;
  lng_grid: number;
  reported_isp: string;
  verified_asn: string | null;
  latency_ms: number;
  jitter: number;
  upload_speed: number | string;
  download_speed: number | string;
  device_type: "mobile" | "tablet" | "desktop";
  measurement_method: "heuristic" | "measured";
  created_at: string;
}

scanDetail.openapi(getScanDetailRoute, async (c) => {
  if (!isSupabaseConfigured || !supabase) {
    return c.json(errorEnvelope("database_not_configured", "Database not configured"), 503);
  }

  const { id } = c.req.valid("param");

  const { data, error } = await supabase
    .from("ping_logs")
    .select(
      "id, lat_encrypted, lng_encrypted, lat_grid, lng_grid, reported_isp, verified_asn, latency_ms, jitter, upload_speed, download_speed, device_type, measurement_method, created_at"
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return c.json(errorEnvelope("not_found", "Scan not found"), 404);
  }

  const row = data as PingLogRow;

  let lat: number;
  let lng: number;
  let isLocationExact = true;
  try {
    lat = await decryptCoordinate(row.lat_encrypted);
    lng = await decryptCoordinate(row.lng_encrypted);
  } catch {
    lat = row.lat_grid;
    lng = row.lng_grid;
    isLocationExact = false;
  }

  // A loose candidate, not a trusted ScanDetail — reported_isp is whatever
  // string is actually stored; safeParse is what asserts it's one of the
  // canonical ISP_LIST values, same reasoning as isp-rankings.ts's row
  // mapping. A stored row that fails this indicates data that predates a
  // stricter ISP_LIST, not something to paper over with a type assertion.
  const candidate: Record<string, unknown> = {
    id: row.id,
    lat,
    lng,
    reportedISP: row.reported_isp,
    verifiedASN: row.verified_asn,
    latencyMs: row.latency_ms,
    jitter: row.jitter,
    uploadSpeed: Number(row.upload_speed),
    downloadSpeed: Number(row.download_speed),
    measurementMethod: row.measurement_method,
    deviceType: row.device_type,
    timestamp: new Date(row.created_at).getTime(),
    isLocationExact,
  };

  const parsed = ScanDetailSchema.safeParse(candidate);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: "error", msg: "stored scan failed contract validation", id, issues: parsed.error.issues }));
    return c.json(errorEnvelope("data_integrity_error", "This scan's stored data doesn't match the expected shape"), 500);
  }

  return c.json(parsed.data, 200, {
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  });
});
