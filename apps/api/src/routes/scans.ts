import { OpenAPIHono } from "@hono/zod-openapi";
import type { z } from "zod";
import {
  ScanSchema,
  getScansRoute,
  postScansRoute,
  CreateScanRequestSchema,
  type Scan,
} from "@mapee/contracts";
import { validationErrorHook, errorEnvelope } from "../lib/errors.js";
import { apiRateLimits, rateLimitResponse } from "../lib/rate-limit.js";
import { supabase, isSupabaseConfigured, createServerClient } from "../lib/supabase.js";
import { requireInstallAuth, type AuthVariables } from "../lib/auth.js";
import { encryptCoordinate, computeGridCoordinates } from "../lib/encryption.js";

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
export const scans = new OpenAPIHono<{ Variables: AuthVariables }>({
  defaultHook: validationErrorHook,
});

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

type CreateScanRequestBody = z.infer<typeof CreateScanRequestSchema>;

/**
 * Plan §7.5 item 4: reject physically implausible measurement combinations
 * at submission time rather than storing them and letting aggregation
 * absorb the damage — a single wildly wrong row skews a small-sample hex
 * cell for as long as it takes enough real scans to dilute it back out.
 *
 * Two checks, both judgment calls calibrated to be defensible without being
 * so aggressive they'd reject a genuine fast/lucky result:
 *
 * 1. Latency under 1ms together with any nonzero throughput. A TCP round
 *    trip to anything off-device — even the same-region endpoints
 *    TestEndpoints (mobile, lib/domain/constants.dart) hits — takes
 *    measurable time; sub-millisecond latency paired with a real transfer
 *    is a stopwatch/unit bug or a fabricated report, not a fast network. A
 *    reported 0ms latency with 0 Mbps speeds is left alone: that's a
 *    plausible "no connectivity at all" heuristic report, not an outlier.
 * 2. Download/upload speed above a device-class ceiling. Split by
 *    deviceType because the achievable ceiling genuinely differs: mobile
 *    radio access, even a strong 5G NR carrier, tops out far below what a
 *    desktop/tablet on a wired or enterprise fixed link (Starlink, MainOne,
 *    Spectranet fibre) can legitimately report. 1000 Mbps for mobile is
 *    the plan's own example figure — comfortably above any real mmWave 5G
 *    result achievable in Nigeria today, while still catching an obviously
 *    fabricated number. 2000 Mbps for non-mobile leaves headroom for
 *    genuine multi-gigabit wired links without waving through arbitrarily
 *    large fabricated values.
 */
const IMPLAUSIBLE_LATENCY_CEILING_MS = 1;
const MOBILE_SPEED_CEILING_MBPS = 1000;
const NON_MOBILE_SPEED_CEILING_MBPS = 2000;

function findOutlierReason(body: CreateScanRequestBody): string | null {
  if (
    body.latencyMs < IMPLAUSIBLE_LATENCY_CEILING_MS &&
    (body.downloadSpeed > 0 || body.uploadSpeed > 0)
  ) {
    return `${body.latencyMs}ms latency with nonzero throughput (down ${body.downloadSpeed} Mbps, up ${body.uploadSpeed} Mbps) is not physically plausible for an off-device round trip`;
  }

  const speedCeiling =
    body.deviceType === "mobile" ? MOBILE_SPEED_CEILING_MBPS : NON_MOBILE_SPEED_CEILING_MBPS;

  if (body.downloadSpeed > speedCeiling) {
    return `Download speed of ${body.downloadSpeed} Mbps exceeds the plausible ceiling for a ${body.deviceType} scan (${speedCeiling} Mbps)`;
  }
  if (body.uploadSpeed > speedCeiling) {
    return `Upload speed of ${body.uploadSpeed} Mbps exceeds the plausible ceiling for a ${body.deviceType} scan (${speedCeiling} Mbps)`;
  }

  return null;
}

interface InsertedScanRow {
  id: string;
  created_at: string;
}

/**
 * Ported from apps/web/src/app/api/pings/route.ts's POST handler, with
 * plan §7.6's install-token auth actually enforced (the legacy route had
 * none — anonymous insert was open to anyone) and §7.5 item 4's outlier
 * rejection actually implemented, not just documented.
 */
scans.openapi(postScansRoute, async (c) => {
  const auth = await requireInstallAuth(c);
  // requireInstallAuth's 401 is a plain, already-built Response (it's shared
  // across routes with different typed response shapes, so it can't return
  // one of *this* route's branded TypedResponse types) -- `as never` is a
  // pure compile-time cast, `never` being assignable to anything, and
  // doesn't change what's actually returned at runtime.
  if (auth instanceof Response) return auth as never;
  c.set("installId", auth.installId);

  const rateLimitResult = await apiRateLimits.scanSubmit(c);
  if (!rateLimitResult.success) {
    return rateLimitResponse(c, rateLimitResult.reset);
  }

  const body = c.req.valid("json");

  const outlierReason = findOutlierReason(body);
  if (outlierReason) {
    return c.json(
      errorEnvelope("outlier_rejected", "Measurement rejected as physically implausible", {
        reason: outlierReason,
      }),
      400
    );
  }

  const serverClient = createServerClient();
  if (!isSupabaseConfigured || !serverClient) {
    return c.json(errorEnvelope("database_not_configured", "Database not configured"), 503);
  }

  const [lat_encrypted, lng_encrypted] = await Promise.all([
    encryptCoordinate(body.lat),
    encryptCoordinate(body.lng),
  ]);
  const { lat_grid, lng_grid } = computeGridCoordinates(body.lat, body.lng);

  const pingData = {
    ...(body.id ? { id: body.id } : {}),
    lat_encrypted,
    lng_encrypted,
    lat_grid,
    lng_grid,
    reported_isp: body.reportedISP,
    verified_asn: body.verifiedASN ?? null,
    latency_ms: Math.round(body.latencyMs),
    jitter: Math.round(body.jitter),
    upload_speed: Number(body.uploadSpeed.toFixed(2)),
    download_speed: Number(body.downloadSpeed.toFixed(2)),
    device_type: body.deviceType,
    measurement_method: body.measurementMethod,
    owner_install_id: auth.installId,
    radio_type: body.radioType ?? null,
    signal_dbm: body.signalDbm ?? null,
    mcc: body.mcc ?? null,
    mnc: body.mnc ?? null,
  };

  const { data, error } = await serverClient
    .from("ping_logs")
    .insert(pingData)
    .select("id, created_at")
    .single();

  if (error) {
    // Unique-violation (Postgres SQLSTATE 23505) on the id primary key means
    // the client retried a submission whose response was dropped before it
    // arrived — exactly the idempotency case CreateScanRequestSchema's `id`
    // doc comment calls out. Treat it as a success and hand back the row
    // that's already there, not a 500. Only reachable when the client
    // actually supplied an id: Postgres-generated ids don't collide.
    if (error.code === "23505" && body.id) {
      const existing = await serverClient
        .from("ping_logs")
        .select("id, created_at")
        .eq("id", body.id)
        .single();

      if (existing.error || !existing.data) {
        // eslint-disable-next-line no-console
        console.error(
          JSON.stringify({
            level: "error",
            msg: "duplicate scan insert but could not fetch the existing row",
            id: body.id,
            err: existing.error?.message,
          })
        );
        return c.json(errorEnvelope("database_error", "Failed to save scan data"), 500);
      }

      const existingRow = existing.data as InsertedScanRow;
      return c.json(
        {
          success: true as const,
          id: existingRow.id,
          timestamp: new Date(existingRow.created_at).getTime(),
        },
        201
      );
    }

    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: "error", msg: "scan insert error", err: error.message }));
    return c.json(errorEnvelope("database_error", "Failed to save scan data"), 500);
  }

  const row = data as InsertedScanRow;
  return c.json(
    {
      success: true as const,
      id: row.id,
      timestamp: new Date(row.created_at).getTime(),
    },
    201
  );
});
