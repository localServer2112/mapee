import { Hono } from "hono";

/**
 * Plain Hono, not OpenAPIHono — a liveness probe isn't a versioned business
 * endpoint, and most load balancers/orchestrators expect it unauthenticated
 * and dependency-free. It deliberately does not check the database or Redis:
 * this answers "is the process up", not "is everything downstream healthy".
 */
export const health = new Hono();

health.get("/healthz", (c) => c.json({ status: "ok" }));
