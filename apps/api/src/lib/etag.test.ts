import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { jsonWithETag } from "./etag.js";

function testApp(body: unknown) {
  const app = new Hono();
  app.get("/thing", (c) => jsonWithETag(c, body));
  return app;
}

describe("jsonWithETag", () => {
  it("returns 200 with the body and an ETag header when there's no If-None-Match", async () => {
    const app = testApp({ hello: "world" });
    const res = await app.request("/thing");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hello: "world" });
    expect(res.headers.get("etag")).toBeTruthy();
  });

  it("computes the same ETag for the same body across separate requests", async () => {
    const app = testApp({ hello: "world" });
    const first = await app.request("/thing");
    const second = await app.request("/thing");
    expect(first.headers.get("etag")).toBe(second.headers.get("etag"));
  });

  it("computes a different ETag for a different body", async () => {
    const a = await testApp({ value: 1 }).request("/thing");
    const b = await testApp({ value: 2 }).request("/thing");
    expect(a.headers.get("etag")).not.toBe(b.headers.get("etag"));
  });

  it("returns a bodyless 304 when If-None-Match matches the current ETag", async () => {
    const app = testApp({ hello: "world" });
    const first = await app.request("/thing");
    const etag = first.headers.get("etag")!;

    const second = await app.request("/thing", { headers: { "If-None-Match": etag } });
    expect(second.status).toBe(304);
    expect(await second.text()).toBe("");
  });

  it("returns a full 200 when If-None-Match is present but stale", async () => {
    const app = testApp({ hello: "world" });
    const res = await app.request("/thing", { headers: { "If-None-Match": '"stale-value"' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hello: "world" });
  });
});
