import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { initSentry } from "./lib/sentry.js";

initSentry();

const port = Number(process.env.PORT) || 8787;

serve({ fetch: app.fetch, port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ level: "info", msg: "listening", port: info.port }));
});
