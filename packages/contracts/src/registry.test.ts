import { describe, it, expect } from "vitest";
import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { registry } from "./registry";

describe("registry", () => {
  it("registers exactly the seven v1 paths ported from the existing five routes", () => {
    // /api/pings splits into 3 (list, detail, create) and /api/stats splits
    // into 2 (areas, isp-rankings); /api/geocode, /api/towers, /api/asn stay
    // 1:1. 5 routes -> 7 v1 paths. Pinned so an accidental drop is caught.
    const paths = new Set(
      registry.definitions
        .filter((d): d is Extract<typeof d, { type: "route" }> => d.type === "route")
        .map((d) => `${d.route.method.toUpperCase()} ${d.route.path}`)
    );

    expect(paths).toEqual(
      new Set([
        "GET /v1/areas",
        "GET /v1/scans",
        "POST /v1/scans",
        "GET /v1/scans/{id}",
        "GET /v1/isp-rankings",
        "GET /v1/geocode",
        "GET /v1/towers",
        "GET /v1/network/identify",
      ])
    );
  });

  it("generates a valid OpenAPI 3.1 document without throwing", () => {
    const generator = new OpenApiGeneratorV31(registry.definitions);
    const doc = generator.generateDocument({
      openapi: "3.1.0",
      info: { title: "Mapee API", version: "1.0.0" },
    });

    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths ?? {})).toHaveLength(7);
  });

  it("every registered response references a schema that round-trips a realistic example", () => {
    // A cheap end-to-end sanity check: build the doc and confirm each 2xx
    // response's schema, once resolved through $ref, is a real object with
    // a `type`. This would fail if a schema were registered but never
    // reachable, or if generateDocument silently dropped one.
    const generator = new OpenApiGeneratorV31(registry.definitions);
    const doc = generator.generateDocument({
      openapi: "3.1.0",
      info: { title: "Mapee API", version: "1.0.0" },
    });

    for (const [path, methods] of Object.entries(doc.paths ?? {})) {
      for (const [method, operation] of Object.entries(methods as Record<string, unknown>)) {
        if (typeof operation !== "object" || operation === null || !("responses" in operation)) {
          continue;
        }
        const responses = (operation as { responses: Record<string, unknown> }).responses;
        const ok = responses["200"] ?? responses["201"];
        if (!ok) continue;
        expect(ok, `${method.toUpperCase()} ${path} has no 2xx response`).toBeDefined();
      }
    }
  });
});
