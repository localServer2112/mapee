import { describe, it, expect, vi, afterEach } from "vitest";
import { Hono } from "hono";
import { requestLogger, type LoggingVariables } from "./logging";

function buildApp() {
  const app = new Hono<{ Variables: LoggingVariables }>();
  app.use(requestLogger);
  app.get("/ping", (c) => c.json({ pong: true }));
  app.get("/boom", () => {
    throw new Error("boom");
  });
  app.onError((err, c) => c.json({ error: String(err) }, 500));
  return app;
}

describe("requestLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs exactly one structured JSON line per request", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = buildApp();

    const res = await app.request("/ping");
    expect(res.status).toBe(200);

    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("logs a valid JSON line containing method/path/status/duration/requestId", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = buildApp();

    await app.request("/ping?x=1");

    const line = logSpy.mock.calls[0][0] as string;
    expect(() => JSON.parse(line)).not.toThrow();

    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({
      level: "info",
      msg: "request",
      method: "GET",
      path: "/ping",
      status: 200,
    });
    expect(typeof parsed.requestId).toBe("string");
    expect(parsed.requestId.length).toBeGreaterThan(0);
    expect(typeof parsed.durationMs).toBe("number");
    expect(parsed.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("still logs (with the error's status) when a downstream handler throws", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = buildApp();

    const res = await app.request("/boom");
    expect(res.status).toBe(500);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed.status).toBe(500);
    expect(parsed.path).toBe("/boom");
  });

  it("attaches the request ID to the context so downstream handlers can read it back", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    let seenInHandler: string | undefined;

    const app = new Hono<{ Variables: LoggingVariables }>();
    app.use(requestLogger);
    app.get("/whoami", (c) => {
      seenInHandler = c.get("requestId");
      return c.json({ ok: true });
    });

    await app.request("/whoami");

    const logged = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(seenInHandler).toBe(logged.requestId);
  });

  it("generates a different request ID on each request", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = buildApp();

    await app.request("/ping");
    await app.request("/ping");

    const first = JSON.parse(logSpy.mock.calls[0][0] as string).requestId;
    const second = JSON.parse(logSpy.mock.calls[1][0] as string).requestId;
    expect(first).not.toBe(second);
  });
});
