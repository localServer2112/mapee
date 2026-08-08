import { OpenAPIHono } from "@hono/zod-openapi";
import { health } from "./routes/health.js";
import { config } from "./routes/config.js";
import { geocode } from "./routes/geocode.js";
import { towers } from "./routes/towers.js";
import { networkIdentify } from "./routes/network-identify.js";
import { areas } from "./routes/areas.js";
import { ispRankings } from "./routes/isp-rankings.js";
import { scans } from "./routes/scans.js";
import { scanDetail } from "./routes/scan-detail.js";
import { installs } from "./routes/installs.js";
import { meScans } from "./routes/me-scans.js";
import { docs } from "./routes/docs.js";
import { errorEnvelope, validationErrorHook } from "./lib/errors.js";
import { requestLogger, type LoggingVariables } from "./lib/logging.js";
import { captureError } from "./lib/sentry.js";

/**
 * The Hono app, separated from the Node server bootstrap in index.ts so
 * tests can exercise it via `app.fetch(request)` without opening a real
 * socket. This is the file to look at to see every route the API exposes.
 */
export const app = new OpenAPIHono<{ Variables: LoggingVariables }>({
  defaultHook: validationErrorHook,
});

app.use(requestLogger);

app.route("/", health);
app.route("/", config);
app.route("/", geocode);
app.route("/", towers);
app.route("/", networkIdentify);
app.route("/", areas);
app.route("/", ispRankings);
app.route("/", scans);
app.route("/", scanDetail);
app.route("/", installs);
app.route("/", meScans);
app.route("/", docs);

app.notFound((c) =>
  c.json(errorEnvelope("not_found", "No route matches this path"), 404)
);

app.onError((err, c) => {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ level: "error", msg: "unhandled error", err: String(err) }));
  captureError(err);
  return c.json(errorEnvelope("internal_error", "Something went wrong"), 500);
});

// The spec served here is generated the same way packages/contracts/openapi.json
// is (same OpenAPIHono registry, same info block) — but from THIS app's live
// route registrations, not from packages/contracts' standalone registry.
// The two are expected to converge as routes get ported in A3; until then,
// this one only describes what apps/api actually implements today.
app.doc31("/v1/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "Mapee API",
    version: "1.0.0",
    description: "Crowdsourced network-quality data.",
  },
});
