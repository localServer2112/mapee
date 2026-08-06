import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { WebSocket } from "ws";

// ws's WebSocket class declares two overloaded constructors (`new (address:
// null)` and `new (address: string | URL, options?)`), and its instance type
// doesn't structurally match @supabase/realtime-js's internal, unexported
// WebSocketLike interface (event-handler signatures differ). Both mismatches
// are type-level only -- ws's two-arg constructor is what actually gets
// called, and it accepts string | URL -- so the return type is deliberately
// widened to `any` here rather than fighting an internal type this package
// has no way to import and match exactly.
const WebSocketTransport = WebSocket as unknown as new (
  address: string | URL,
  subprotocols?: string | string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => any;

// Ported from apps/web/src/lib/supabase.ts, plus one addition apps/web never
// needed: an explicit realtime.transport.
//
// createClient()'s constructor unconditionally builds a RealtimeClient, even
// though this service never subscribes to a realtime channel — there's no
// documented way to skip that construction. RealtimeClient's constructor, in
// turn, eagerly resolves a WebSocket implementation by calling
// WebSocketFactory.getWebSocketConstructor(), which THROWS synchronously if
// it can't find a native `globalThis.WebSocket` (stable only from Node 22 --
// see @supabase/realtime-js's websocket-factory.ts). Since `supabase` below
// is a top-level singleton, that throw happens at module import time, which
// means the entire app fails to boot, not one request failing gracefully.
// CI runs this on Node 20 (see .github/workflows/ci.yml), which genuinely
// lacks a native WebSocket global — confirmed by reproducing the exact throw
// against the real Node 20.20.2 binary directly (not through pnpm/vitest,
// whose own Node resolution can silently differ from a bare `node` on a
// machine with more than one Node install on PATH). Passing an explicit
// transport (the `ws` package) skips the auto-detection call entirely via
// `options?.transport ?? WebSocketFactory.getWebSocketConstructor()`'s
// short-circuit, and it's never actually used to open a connection, since no
// route here ever calls .channel()/.on().
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, { realtime: { transport: WebSocketTransport } })
  : null;

/** Server-side client with the service role key, for admin operations. */
export function createServerClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) {
    return null;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    // eslint-disable-next-line no-console
    console.warn(JSON.stringify({ level: "warn", msg: "SUPABASE_SERVICE_ROLE_KEY is not set" }));
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, { realtime: { transport: WebSocketTransport } });
}

// Row shapes as they actually exist in Postgres — see supabase/schema.sql.
// snake_case here is deliberate: these mirror the database columns exactly,
// and get mapped to the camelCase v1 contract shapes at the route boundary,
// not before.

export interface DBPingLog {
  id: string;
  lat_encrypted: string;
  lng_encrypted: string;
  lat_grid: number;
  lng_grid: number;
  reported_isp: string;
  verified_asn: string | null;
  latency_ms: number;
  jitter: number;
  upload_speed: number;
  download_speed: number;
  device_type: "mobile" | "tablet" | "desktop";
  user_agent: string;
  created_at: string;
  location?: unknown; // PostGIS geography point, computed from grid coordinates
}

export interface DBAggregatedStats {
  hex_id: string;
  center_lat: number;
  center_lng: number;
  avg_latency: number;
  min_latency: number;
  max_latency: number;
  ping_count: number;
  top_isp: string;
  confidence_score: number;
  consistency: number;
  last_updated: string;
}
