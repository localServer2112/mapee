import { OpenAPIHono } from "@hono/zod-openapi";
import { AreaSchema, getAreasRoute, type Area } from "@mapee/contracts";
import { validationErrorHook, errorEnvelope } from "../lib/errors.js";
import { apiRateLimits, rateLimitResponse } from "../lib/rate-limit.js";
import { jsonWithETag } from "../lib/etag.js";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";

/**
 * Ported from apps/web/src/app/api/stats/route.ts (the hexbin-stats half —
 * see routes/isp-rankings.ts for the other half of that overloaded ?type=
 * route). Same get_hexbin_stats_in_bounds RPC, same "not configured"
 * degradation (200 + empty array + a status header, not an error — this
 * route's whole reason to exist is serving map data even when the database
 * isn't reachable). New: an ETag on the response, per plan §7.4.
 *
 * `id` is the raw hex_id string, deliberately NOT parsed into numeric x/y the
 * way the legacy route does — see AreaSchema's comment. The binning scheme
 * is a server-internal detail (plan §8); v1 doesn't expose it as a
 * client-parseable coordinate pair.
 */
export const areas = new OpenAPIHono({ defaultHook: validationErrorHook });

interface HexbinStatsRow {
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
}

function toArea(row: HexbinStatsRow): Area {
  return {
    id: row.hex_id,
    centerLat: row.center_lat,
    centerLng: row.center_lng,
    avgLatency: row.avg_latency,
    minLatency: row.min_latency,
    maxLatency: row.max_latency,
    scanCount: row.ping_count,
    topISP: row.top_isp,
    confidence: row.confidence_score,
    consistency: row.consistency,
  };
}

areas.openapi(getAreasRoute, async (c) => {
  const rateLimitResult = await apiRateLimits.dataFetch(c);
  if (!rateLimitResult.success) {
    return rateLimitResponse(c, rateLimitResult.reset);
  }

  if (!isSupabaseConfigured || !supabase) {
    return jsonWithETag(c, [], {
      "X-Database-Status": "not-configured",
      "X-RateLimit-Remaining": String(rateLimitResult.remaining),
    });
  }

  const { bbox } = c.req.valid("query");
  const [south, west, north, east] = bbox.split(",").map(Number);

  const { data, error } = await supabase.rpc("get_hexbin_stats_in_bounds", {
    north,
    south,
    east,
    west,
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: "error", msg: "areas database error", err: error.message }));
    return c.json(errorEnvelope("database_error", "Failed to fetch statistics"), 500);
  }

  const rows = (data ?? []) as HexbinStatsRow[];
  const parsedAreas: Area[] = [];
  for (const row of rows) {
    const candidate = toArea(row);
    const result = AreaSchema.safeParse(candidate);
    if (result.success) {
      parsedAreas.push(result.data);
    } else {
      // eslint-disable-next-line no-console
      console.warn(JSON.stringify({ level: "warn", msg: "dropped malformed area result", issues: result.error.issues }));
    }
  }

  return jsonWithETag(c, parsedAreas, {
    "X-RateLimit-Remaining": String(rateLimitResult.remaining),
  });
});
