import { createHash, randomBytes } from "node:crypto";
import type { Context } from "hono";
import { createServerClient } from "./supabase.js";
import { errorEnvelope } from "./errors.js";

/**
 * Install tokens (plan §7.6): opaque, anonymous, no PII. The token itself
 * is returned exactly once at creation (POST /v1/installs); only its hash
 * is ever stored, so a DB leak doesn't yield usable tokens -- same
 * reasoning as password storage.
 */
export function generateInstallToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashInstallToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface AuthenticatedInstall {
  installId: string;
}

/** See LoggingVariables (./logging.ts) for why this is typed through Hono's
 * `Env` generic rather than left as an untyped `c.set`/`c.get`. Routes that
 * resolve auth should `c.set("installId", auth.installId)` so rate-limit's
 * key function (./rate-limit.ts) can read it back synchronously. */
export type AuthVariables = {
  installId?: string;
};

/**
 * Resolves the `Authorization: Bearer <token>` header against the
 * `installs` table using the service-role client (RLS grants anon nothing
 * on this table by design -- see supabase/schema.sql). Returns `null` for
 * any failure mode (missing header, malformed header, unknown token,
 * database unavailable) -- callers decide whether that's fatal.
 */
export async function resolveInstallAuth(c: Context): Promise<AuthenticatedInstall | null> {
  const header = c.req.header("authorization");
  const match = header?.match(/^Bearer (.+)$/);
  if (!match) return null;

  const serverClient = createServerClient();
  if (!serverClient) return null;

  const tokenHash = hashInstallToken(match[1]);
  const { data, error } = await serverClient
    .from("installs")
    .select("id")
    .eq("token_hash", tokenHash)
    .single();

  if (error || !data) return null;

  // Best-effort -- a failed touch of last_seen_at should never fail the
  // request it's piggybacking on.
  void serverClient
    .from("installs")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return { installId: data.id as string };
}

/**
 * For routes where auth is mandatory (POST /v1/scans, /v1/me/scans). Use
 * [resolveInstallAuth] directly for routes where it's optional (GET
 * /v1/scans/{id}'s ownership check, which degrades gracefully rather than
 * 401ing a non-owner).
 */
export async function requireInstallAuth(c: Context): Promise<AuthenticatedInstall | Response> {
  const auth = await resolveInstallAuth(c);
  if (!auth) {
    return c.json(errorEnvelope("unauthorized", "Missing or invalid install token"), 401);
  }
  return auth;
}
