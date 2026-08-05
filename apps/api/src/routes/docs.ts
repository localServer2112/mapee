import { Hono } from "hono";
import { Scalar } from "@scalar/hono-api-reference";

/**
 * A browsable HTML UI for the OpenAPI document app.ts already serves at
 * /v1/openapi.json. Plain Hono, not OpenAPIHono, like health.ts — this isn't
 * a versioned business endpoint with a request/response contract of its own,
 * just an HTML page that points a client-side renderer at the live spec.
 *
 * Picked @scalar/hono-api-reference over @hono/swagger-ui: it's built
 * specifically for Hono (one middleware call, no manual HTML/CDN wiring to
 * hand-assemble) and is the more actively maintained of the two — as of this
 * writing its latest release shipped within the week, versus @hono/swagger-ui's
 * last release several months prior.
 */
export const docs = new Hono();

docs.get(
  "/docs",
  Scalar({
    // A relative URL is enough — /docs and /v1/openapi.json are served by
    // this same app, so there's no cross-origin spec fetch to configure.
    url: "/v1/openapi.json",
  })
);
