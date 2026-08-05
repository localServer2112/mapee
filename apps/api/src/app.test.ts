import { describe, it, expect } from "vitest";
import { app } from "./app";

describe("app skeleton", () => {
  it("GET /healthz returns 200 without touching a database", async () => {
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("an unknown path returns the shared error envelope, not Hono's default 404 body", async () => {
    const res = await app.request("/nonexistent");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: "not_found", message: "No route matches this path" },
    });
  });

  it("serves a valid OpenAPI 3.1 document at /v1/openapi.json", async () => {
    const res = await app.request("/v1/openapi.json");
    expect(res.status).toBe(200);
    const doc = (await res.json()) as { openapi: string; info: { title: string } };
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.title).toBe("Mapee API");
  });

  it("/healthz does not appear in the served OpenAPI document", async () => {
    // Deliberate: a liveness probe isn't a versioned business endpoint (see
    // the comment in routes/health.ts). Pinning this so it isn't
    // accidentally exposed if health.ts is ever migrated to OpenAPIHono.
    const res = await app.request("/v1/openapi.json");
    const doc = (await res.json()) as { paths?: Record<string, unknown> };
    expect(Object.keys(doc.paths ?? {})).not.toContain("/healthz");
  });
});
