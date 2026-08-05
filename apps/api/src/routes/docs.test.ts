import { describe, it, expect } from "vitest";
import { docs } from "./docs";

// docs.ts isn't mounted into the main app yet — that wiring lands separately
// in app.ts — so this exercises the sub-app directly via its own `.request`,
// the same way the other route tests exercise the assembled `app`.
describe("GET /docs", () => {
  it("returns a 200 HTML response", async () => {
    const res = await docs.request("/docs");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
  });

  it("renders a page that points at the live OpenAPI document", async () => {
    const res = await docs.request("/docs");
    const body = await res.text();
    expect(body).toContain("/v1/openapi.json");
  });
});
