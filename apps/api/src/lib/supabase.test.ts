import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// supabase.ts reads process.env at module-load time — unchanged from
// apps/web/src/lib/supabase.ts, not something introduced by this port. That
// means isSupabaseConfigured/supabase can't be toggled by mutating
// process.env after import; each scenario here uses vi.resetModules() to
// force a fresh module evaluation under a different env state instead.

const originalEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

function restoreEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.url;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalEnv.anonKey;
  process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.serviceKey;
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  restoreEnv();
});

describe("with no Supabase env vars set", () => {
  it("degrades to unconfigured/null rather than throwing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const { isSupabaseConfigured, supabase } = await import("./supabase.js");
    expect(isSupabaseConfigured).toBe(false);
    expect(supabase).toBeNull();
  });

  it("createServerClient returns null", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const { createServerClient } = await import("./supabase.js");
    expect(createServerClient()).toBeNull();
  });
});

describe("with URL and anon key set", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  it("isSupabaseConfigured is true and supabase is a real client, not null", async () => {
    const { isSupabaseConfigured, supabase } = await import("./supabase.js");
    expect(isSupabaseConfigured).toBe(true);
    expect(supabase).not.toBeNull();
  });

  it("createServerClient returns null when SUPABASE_SERVICE_ROLE_KEY is missing, rather than a client built with the anon key", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { createServerClient } = await import("./supabase.js");
    expect(createServerClient()).toBeNull();
  });

  it("createServerClient returns a real client when the service role key is present", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    const { createServerClient } = await import("./supabase.js");
    expect(createServerClient()).not.toBeNull();
  });
});
