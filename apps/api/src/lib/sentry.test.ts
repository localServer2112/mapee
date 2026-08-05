import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// SENTRY_DSN must be read (or absent) before the module under test is
// imported, since ./sentry.ts captures `process.env.SENTRY_DSN` into a
// module-level const at import time — mirroring ./redis.ts, which does the
// same for UPSTASH_REDIS_REST_URL/TOKEN. Each test resets modules so its own
// env manipulation is picked up fresh.
describe("sentry — degrades to a no-op when SENTRY_DSN is unset", () => {
  const ORIGINAL_DSN = process.env.SENTRY_DSN;

  beforeEach(() => {
    delete process.env.SENTRY_DSN;
  });

  afterEach(() => {
    if (ORIGINAL_DSN === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = ORIGINAL_DSN;
    }
  });

  it("captureError does not throw and requires no network access when unconfigured", async () => {
    vi.resetModules();
    const { captureError } = await import("./sentry");
    expect(() => captureError(new Error("test error"))).not.toThrow();
  });

  it("captureError accepts non-Error values without throwing", async () => {
    vi.resetModules();
    const { captureError } = await import("./sentry");
    expect(() => captureError("a plain string failure")).not.toThrow();
    expect(() => captureError(undefined)).not.toThrow();
    expect(() => captureError({ some: "object" })).not.toThrow();
  });

  it("initSentry does not throw when unconfigured", async () => {
    vi.resetModules();
    const { initSentry } = await import("./sentry");
    expect(() => initSentry()).not.toThrow();
  });

  it("initSentry is safe to call more than once", async () => {
    vi.resetModules();
    const { initSentry } = await import("./sentry");
    expect(() => {
      initSentry();
      initSentry();
    }).not.toThrow();
  });
});

describe("sentry — conditional activation contract", () => {
  const ORIGINAL_DSN = process.env.SENTRY_DSN;

  afterEach(() => {
    if (ORIGINAL_DSN === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = ORIGINAL_DSN;
    }
  });

  it("initSentry() does not throw even when SENTRY_DSN is set to a non-network-reachable value", async () => {
    // Not a real project DSN — this only proves init() doesn't blow up on a
    // syntactically-plausible DSN. It deliberately avoids asserting that
    // anything is actually sent over the network.
    process.env.SENTRY_DSN = "https://public@o0.ingest.sentry.io/0";
    vi.resetModules();
    const { initSentry } = await import("./sentry");
    expect(() => initSentry()).not.toThrow();
  });
});
