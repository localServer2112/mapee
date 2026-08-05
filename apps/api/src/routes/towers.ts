import { OpenAPIHono } from "@hono/zod-openapi";
import { CellTowerSchema, getTowersRoute, type CellTower } from "@mapee/contracts";
import { validationErrorHook, errorEnvelope } from "../lib/errors.js";
import { apiRateLimits, rateLimitResponse } from "../lib/rate-limit.js";
import { redis } from "../lib/redis.js";

/**
 * Ported from apps/web/src/app/api/towers/route.ts. Same OpenCelliD proxy,
 * same bbox-clamping and cache shape. One real behaviour change: rate
 * limiting is now actually applied. `apiRateLimits.towers` existed in the
 * legacy `lib/rate-limit.ts` and was never called from this route — plan §9
 * flags it explicitly as dead code. It isn't dead here.
 */
export const towers = new OpenAPIHono({ defaultHook: validationErrorHook });

const OPENCELLID_URL = "https://opencellid.org/cell/getInArea";

// ~1.8km at the equator — OpenCelliD's hard 4 sq km per-request limit.
const MAX_BBOX_DEGREES = 0.016;

function clampBBox(
  swLat: number,
  swLng: number,
  neLat: number,
  neLng: number
): [number, number, number, number] {
  const centerLat = (swLat + neLat) / 2;
  const centerLng = (swLng + neLng) / 2;
  const halfDeg = MAX_BBOX_DEGREES / 2;
  return [centerLat - halfDeg, centerLng - halfDeg, centerLat + halfDeg, centerLng + halfDeg];
}

interface TowerCacheEntry {
  data: CellTower[];
  timestamp: number;
}

const towerCache = new Map<string, TowerCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCacheKey(lat: number, lng: number): string {
  // Rounds to a ~500m grid so nearby viewports share a cache entry.
  return `${(Math.round(lat * 200) / 200).toFixed(3)},${(Math.round(lng * 200) / 200).toFixed(3)}`;
}

interface OpenCelliDCell {
  cellid: number;
  lat: number;
  lon: number;
  mcc: number;
  mnc: number;
  lac: number;
  radio: string;
}

function toCellTower(cell: OpenCelliDCell): CellTower {
  return {
    id: `${cell.mcc}-${cell.mnc}-${cell.lac}-${cell.cellid}`,
    lat: cell.lat,
    lng: cell.lon,
    type: cell.radio === "NR" ? "5G" : "4G",
    mcc: cell.mcc,
    mnc: cell.mnc,
    lac: cell.lac,
    cellId: cell.cellid,
  };
}

towers.openapi(getTowersRoute, async (c) => {
  const rateLimitResult = await apiRateLimits.towers(c);
  if (!rateLimitResult.success) {
    return rateLimitResponse(c, rateLimitResult.reset);
  }

  const { bbox } = c.req.valid("query");
  const [swLat, swLng, neLat, neLng] = bbox.split(",").map(Number);

  const apiKey = process.env.OPENCELLID_API_KEY;
  if (!apiKey) {
    return c.json(errorEnvelope("provider_not_configured", "OPENCELLID_API_KEY not configured"), 503);
  }

  const [cSwLat, cSwLng, cNeLat, cNeLng] = clampBBox(swLat, swLng, neLat, neLng);
  const cacheKey = getCacheKey((cSwLat + cNeLat) / 2, (cSwLng + cNeLng) / 2);
  const redisKey = `towers:${cacheKey}`;

  let cached: CellTower[] | null = null;
  try {
    if (redis) {
      cached = await redis.get<CellTower[]>(redisKey);
    } else {
      const entry = towerCache.get(cacheKey);
      if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
        cached = entry.data;
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: "error", msg: "tower cache read failed", err: String(e) }));
  }

  if (cached) {
    return c.json(cached, 200, {
      "X-Cache": "HIT",
      "X-RateLimit-Remaining": String(rateLimitResult.remaining),
    });
  }

  const params = new URLSearchParams({
    token: apiKey,
    BBOX: `${cSwLat},${cSwLng},${cNeLat},${cNeLng}`,
    format: "json",
    limit: "200",
  });

  const upstream = await fetch(`${OPENCELLID_URL}?${params}`);
  if (!upstream.ok) {
    return c.json(
      errorEnvelope("upstream_error", `OpenCelliD API returned ${upstream.status}`),
      502
    );
  }

  const data = (await upstream.json()) as { error?: string; cells?: OpenCelliDCell[] };

  // OpenCelliD returns { error, code } on errors even with a 200 status.
  if (data.error) {
    if (data.error === "No cells found") {
      // Not a failure — just an area with no known towers. Cache the empty
      // result the same as a real one, so we don't hammer the provider for
      // a genuinely empty area on every request.
      try {
        if (redis) {
          await redis.set(redisKey, [], { ex: 300 });
        } else {
          towerCache.set(cacheKey, { data: [], timestamp: Date.now() });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(JSON.stringify({ level: "error", msg: "tower cache write failed", err: String(e) }));
      }
      return c.json([], 200, { "X-Cache": "MISS" });
    }
    return c.json(errorEnvelope("upstream_error", data.error), 502);
  }

  const cells = Array.isArray(data.cells) ? data.cells : [];
  const parsed: CellTower[] = [];
  for (const cell of cells) {
    const candidate = toCellTower(cell);
    const result = CellTowerSchema.safeParse(candidate);
    if (result.success) {
      parsed.push(result.data);
    } else {
      // eslint-disable-next-line no-console
      console.warn(JSON.stringify({ level: "warn", msg: "dropped malformed tower result", issues: result.error.issues }));
    }
  }

  try {
    if (redis) {
      await redis.set(redisKey, parsed, { ex: 300 });
    } else {
      towerCache.set(cacheKey, { data: parsed, timestamp: Date.now() });
      if (towerCache.size > 100) {
        const now = Date.now();
        for (const [key, entry] of towerCache.entries()) {
          if (now - entry.timestamp > CACHE_TTL_MS) towerCache.delete(key);
        }
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: "error", msg: "tower cache write failed", err: String(e) }));
  }

  return c.json(parsed, 200, {
    "X-Cache": "MISS",
    "X-RateLimit-Remaining": String(rateLimitResult.remaining),
  });
});
