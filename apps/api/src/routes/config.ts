import { OpenAPIHono } from "@hono/zod-openapi";
import {
  ISP_LIST,
  LATENCY_THRESHOLDS,
  DATA_FRESHNESS,
} from "@mapee/core";
import { getConfigRoute, type Config } from "@mapee/contracts";
import { validationErrorHook } from "../lib/errors";

export const config = new OpenAPIHono({ defaultHook: validationErrorHook });

// Public, unauthenticated third-party throughput endpoints. Not a
// Mapee-hosted /v1/measure/* route — that doesn't exist yet (plan §6.2/§7.4).
// Cloudflare's speed-test endpoints are what the plan names as the starting
// point before a first-party one is worth building.
const MEASUREMENT_ENDPOINTS = {
  download: "https://speed.cloudflare.com/__down",
  upload: "https://speed.cloudflare.com/__up",
};

// No mobile client exists yet (Track B), so there is nothing this actually
// gates today. Tracks this package's own version until a real client
// version scheme exists to floor.
const MIN_SUPPORTED_VERSION = "0.1.0";

config.openapi(getConfigRoute, (c) => {
  const body: Config = {
    ispList: [...ISP_LIST],
    latencyThresholds: {
      good: LATENCY_THRESHOLDS.GOOD,
      fair: LATENCY_THRESHOLDS.FAIR,
    },
    dataFreshness: {
      freshDays: DATA_FRESHNESS.FRESH_DAYS,
      staleDays: DATA_FRESHNESS.STALE_DAYS,
      expiredDays: DATA_FRESHNESS.EXPIRED_DAYS,
    },
    measurementEndpoints: MEASUREMENT_ENDPOINTS,
    minSupportedVersion: MIN_SUPPORTED_VERSION,
  };
  return c.json(body, 200);
});
