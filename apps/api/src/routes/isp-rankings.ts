import { OpenAPIHono } from "@hono/zod-openapi";
import { ISPRankingSchema, getIspRankingsRoute, type ISPRanking } from "@mapee/contracts";
import { validationErrorHook, errorEnvelope } from "../lib/errors.js";
import { apiRateLimits, rateLimitResponse } from "../lib/rate-limit.js";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";

/**
 * Ported from apps/web/src/app/api/stats/route.ts's `?type=isp` branch — the
 * other half of that overloaded route, now its own endpoint (plan §7.4).
 * Same isp_rankings view query, same 20-row limit. No ETag here: rankings
 * are a small, already-aggregated dataset refreshed on the view's own
 * schedule, not something a client re-polls on every viewport change the
 * way /v1/areas is — the caching benefit an ETag buys is much smaller.
 *
 * Field names are normalised to camelCase (ISPRankingSchema) — the
 * isp_rankings view returns its raw snake_case columns unchanged; that's a
 * wart in the legacy route's response, not a shape worth carrying into v1
 * (this exact call was made when the schema was written in A1).
 */
export const ispRankings = new OpenAPIHono({ defaultHook: validationErrorHook });

interface IspRankingRow {
  isp: string;
  avg_latency: number;
  median_latency: number;
  avg_jitter: number;
  sample_count: number;
  avg_download: number | string;
  avg_upload: number | string;
}

/**
 * Returns a candidate, not a trusted ISPRanking — `isp` is whatever string
 * the database groups by (reported_isp), typed loosely here on purpose so
 * ISPRankingSchema.safeParse (below) is the thing actually asserting it's
 * one of the canonical ISP_LIST values, not a cast pretending it already is.
 */
function toIspRankingCandidate(row: IspRankingRow): Record<string, unknown> {
  return {
    isp: row.isp,
    avgLatency: row.avg_latency,
    medianLatency: row.median_latency,
    avgJitter: row.avg_jitter,
    sampleCount: row.sample_count,
    // Postgres NUMERIC/DECIMAL columns come back through supabase-js as
    // strings to avoid float precision loss — avg_download/avg_upload are
    // DECIMAL(10,2) in schema.sql (see the isp_rankings view definition).
    avgDownload: Number(row.avg_download),
    avgUpload: Number(row.avg_upload),
  };
}

ispRankings.openapi(getIspRankingsRoute, async (c) => {
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

  const { data, error } = await supabase.from("isp_rankings").select("*").limit(20);

  if (error) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: "error", msg: "isp-rankings database error", err: error.message }));
    return c.json(errorEnvelope("database_error", "Failed to fetch ISP rankings"), 500);
  }

  const rows = (data ?? []) as IspRankingRow[];
  const rankings: ISPRanking[] = [];
  for (const row of rows) {
    const candidate = toIspRankingCandidate(row);
    const result = ISPRankingSchema.safeParse(candidate);
    if (result.success) {
      rankings.push(result.data);
    } else {
      // eslint-disable-next-line no-console
      console.warn(JSON.stringify({ level: "warn", msg: "dropped malformed isp-ranking result", issues: result.error.issues }));
    }
  }

  return c.json(rankings, 200, {
    "X-RateLimit-Remaining": String(rateLimitResult.remaining),
  });
});
