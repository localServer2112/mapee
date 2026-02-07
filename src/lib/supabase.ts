import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Check if Supabase is configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Create client only if configured
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Server-side client with service role key for admin operations
export function createServerClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) {
    return null;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY is not set");
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

// Database types
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
  // PostGIS geography point (computed from grid coordinates)
  location?: unknown;
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
