import { OpenAPIHono } from "@hono/zod-openapi";
import { ScanDetailSchema, getMyScansRoute, deleteMyScansRoute, type ScanDetail } from "@mapee/contracts";
import { validationErrorHook, errorEnvelope } from "../lib/errors.js";
import { createServerClient } from "../lib/supabase.js";
import { requireInstallAuth } from "../lib/auth.js";
import { decryptCoordinate } from "../lib/encryption.js";

/**
 * GET/DELETE /v1/me/scans (plan §7.4, §7.6) — own-data export and deletion,
 * a store-compliance requirement (App Store / Play Store both require an
 * in-app way to delete your own data). Both routes require a valid install
 * token; there's no "optional auth, degrade gracefully" case here unlike
 * GET /v1/scans/{id} (routes/scan-detail.ts) — an install with no token has
 * no "own data" to speak of.
 *
 * Uses the service-role client (lib/supabase.ts's createServerClient), not
 * the anon `supabase` export, because these routes filter by
 * `owner_install_id` -- that's *this route's* WHERE clause, not something
 * RLS enforces (ping_logs' current RLS allows public SELECT on everything;
 * see supabase/schema.sql).
 *
 * GET reuses scan-detail.ts's decrypt-or-fall-back-to-grid-coordinate
 * pattern (surfaced as isLocationExact) and scans.ts's drop-malformed-rows
 * pattern (warn-log and omit, rather than 500ing the whole response) -- it's
 * the same per-row mapping as scan-detail.ts, just for every row this
 * install owns instead of one row by id, and re-derived inline here rather
 * than imported since scan-detail.ts doesn't export it.
 *
 * ping_logs.owner_install_id is nullable (rows that predate A4, or reached
 * this table via any path that doesn't set it). Rows with a NULL
 * owner_install_id can never be returned or deleted by either route, for
 * anyone -- correct, since nobody "owns" them in a way these endpoints can
 * prove.
 */
export const meScans = new OpenAPIHono({ defaultHook: validationErrorHook });

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

async function toScanDetailCandidate(row: PingLogRow): Promise<Record<string, unknown>> {
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
    measurementMethod: row.measurement_method,
    deviceType: row.device_type,
    timestamp: new Date(row.created_at).getTime(),
    isLocationExact,
  };
}

meScans.openapi(getMyScansRoute, async (c) => {
  const auth = await requireInstallAuth(c);
  // requireInstallAuth's 401 is a plain, already-built Response (it's shared
  // across routes with different typed response shapes, so it can't return
  // one of *this* route's branded TypedResponse types) -- `as never` is a
  // pure compile-time cast, `never` being assignable to anything, and
  // doesn't change what's actually returned at runtime. Same pattern as
  // routes/scans.ts's postScansRoute handler.
  if (auth instanceof Response) return auth as never;

  // getMyScansRoute's contract only declares 200/401 (own-data reads aren't
  // expected to hit 500/503 in the happy-path spec) -- the `as never` casts
  // below are the same "runtime-correct, contract-untyped" pattern as the
  // auth Response above, for the same reason: these error envelopes don't
  // structurally match the route's branded 200 TypedResponse type.
  const serverClient = createServerClient();
  if (!serverClient) {
    return c.json(errorEnvelope("database_not_configured", "Database not configured"), 503) as never;
  }

  const { data, error } = await serverClient
    .from("ping_logs")
    .select(
      "id, lat_encrypted, lng_encrypted, lat_grid, lng_grid, reported_isp, verified_asn, latency_ms, jitter, upload_speed, download_speed, device_type, measurement_method, created_at"
    )
    .eq("owner_install_id", auth.installId)
    .order("created_at", { ascending: false });

  if (error) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: "error", msg: "me-scans database error", err: error.message }));
    return c.json(errorEnvelope("database_error", "Failed to fetch scans"), 500) as never;
  }

  const rows = (data ?? []) as PingLogRow[];
  const results: ScanDetail[] = [];
  for (const row of rows) {
    const candidate = await toScanDetailCandidate(row);
    const parsed = ScanDetailSchema.safeParse(candidate);
    if (parsed.success) {
      results.push(parsed.data);
    } else {
      // eslint-disable-next-line no-console
      console.warn(JSON.stringify({ level: "warn", msg: "dropped malformed scan result", id: row.id, issues: parsed.error.issues }));
    }
  }

  return c.json(results, 200);
});

meScans.openapi(deleteMyScansRoute, async (c) => {
  const auth = await requireInstallAuth(c);
  if (auth instanceof Response) return auth as never;

  // deleteMyScansRoute's contract only declares 200/401 -- same "runtime-
  // correct, contract-untyped" `as never` pattern as above.
  const serverClient = createServerClient();
  if (!serverClient) {
    return c.json(errorEnvelope("database_not_configured", "Database not configured"), 503) as never;
  }

  // .select() on a delete() makes PostgREST return the deleted rows, so
  // deletedCount below is the actual number of rows removed, not a guess --
  // see @supabase/postgrest-js's PostgrestQueryBuilder.delete() docs ("Delete
  // a record and return it").
  const { data, error } = await serverClient
    .from("ping_logs")
    .delete()
    .eq("owner_install_id", auth.installId)
    .select("id");

  if (error) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: "error", msg: "me-scans delete database error", err: error.message }));
    return c.json(errorEnvelope("database_error", "Failed to delete scans"), 500) as never;
  }

  return c.json({ deletedCount: (data ?? []).length }, 200);
});
