import { OpenAPIHono } from "@hono/zod-openapi";
import { ScanSchema, getScansRoute, type Scan } from "@mapee/contracts";
import { validationErrorHook, errorEnvelope } from "../lib/errors.js";
import { apiRateLimits, rateLimitResponse } from "../lib/rate-limit.js";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";

/**
 * Ported from apps/web/src/app/api/pings/route.ts's GET handler — with the
 * fix from plan §7.5 item 1 actually applied, not just documented in the
 * schema. The legacy route decrypts lat_encrypted/lng_encrypted for every
 * row and only falls back to the grid coordinate if decryption fails,
 * meaning it returns each submitter's exact location to any caller. This
 * route never decrypts at all: it reads lat_grid/lng_grid directly, the
 * same ~500m-snapped values ScanSchema commits to. Exact coordinates are
 * only ever available from GET /v1/scans/{id} (routes/scan-detail.ts).
 *
 * One consequence worth naming: this also means the list endpoint no
 * longer needs the encryption module at all, which is both the privacy fix
 * and a performance win — no AES-GCM per row on every map-viewport query.
 */
export const scans = new OpenAPIHono({ defaultHook: validationErrorHook });

interface PingsInBoundsRow {
  id: string;
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

function toScanCandidate(row: PingsInBoundsRow): Record<string, unknown> {
  return {
    id: row.id,
    lat: row.lat_grid,
    lng: row.lng_grid,
    reportedISP: row.reported_isp,
    verifiedASN: row.verified_asn,
    latencyMs: row.latency_ms,
    jitter: row.jitter,
    uploadSpeed: Number(row.upload_speed),
    downloadSpeed: Number(row.download_speed),
    measurementMethod: row.measurement_method,
    deviceType: row.device_type,
    timestamp: new Date(row.created_at).getTime(),
  };
}

scans.openapi(getScansRoute, async (c) => {
  const rateLimitResult = await apiRateLimits.dataFetch(c);
  if (!rateLimitResult.success) {
    return rateLimitResponse(c, rateLimitResult.reset);
  }

  if (!isSupabaseConfigured || !supabase) {
    return c.json([], 200, {
      "X-Database-Status": "not-configured",
      "X-RateLimit-Remaining": String(rateLimitResult.remaining),
    });
  }

  const { bbox, maxAge } = c.req.valid("query");
  const [south, west, north, east] = bbox.split(",").map(Number);

  if (north < south) {
    return c.json(errorEnvelope("invalid_bbox", "north must be greater than south"), 400);
  }

  // maxAge is already guaranteed <= 90 by ScanListQuerySchema's .max(90) --
  // a request over that limit never reaches this handler at all (400 at the
  // validation layer). No Math.min clamp needed here.
  const { data, error } = await supabase.rpc("get_pings_in_bounds", {
    north,
    south,
    east,
    west,
    max_age_days: maxAge,
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: "error", msg: "scans database error", err: error.message }));
    return c.json(errorEnvelope("database_error", "Failed to fetch scan data"), 500);
  }

  const rows = (data ?? []) as PingsInBoundsRow[];
  const parsedScans: Scan[] = [];
  for (const row of rows) {
    const candidate = toScanCandidate(row);
    const result = ScanSchema.safeParse(candidate);
    if (result.success) {
      parsedScans.push(result.data);
    } else {
      // eslint-disable-next-line no-console
      console.warn(JSON.stringify({ level: "warn", msg: "dropped malformed scan result", issues: result.error.issues }));
    }
  }

  return c.json(parsedScans, 200, {
    "X-RateLimit-Remaining": String(rateLimitResult.remaining),
  });
});
