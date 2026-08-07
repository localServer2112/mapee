import { OpenAPIHono } from "@hono/zod-openapi";
import { postInstallsRoute } from "@mapee/contracts";
import { validationErrorHook, errorEnvelope } from "../lib/errors.js";
import { apiRateLimits, rateLimitResponse } from "../lib/rate-limit.js";
import { generateInstallToken, hashInstallToken } from "../lib/auth.js";
import { createServerClient } from "../lib/supabase.js";

/**
 * POST /v1/installs — the first route in the write/auth path (plan §7.6).
 * No auth required: this is how a client gets a token at all. Everything
 * else in A4 depends on this existing; this depends on nothing.
 *
 * Uses the service-role client, not the anon `supabase` export, because RLS
 * grants anon nothing on `installs` by design (see supabase/schema.sql) —
 * an anonymous caller must be able to mint a row it could never otherwise
 * read or write.
 */
export const installs = new OpenAPIHono({ defaultHook: validationErrorHook });

interface InstallRow {
  id: string;
}

installs.openapi(postInstallsRoute, async (c) => {
  const rateLimitResult = await apiRateLimits.installs(c);
  if (!rateLimitResult.success) {
    return rateLimitResponse(c, rateLimitResult.reset);
  }

  const { platform } = c.req.valid("json");

  const serverClient = createServerClient();
  const token = generateInstallToken();
  const tokenHash = hashInstallToken(token);

  const { data, error } = serverClient
    ? await serverClient
        .from("installs")
        .insert({ token_hash: tokenHash, platform })
        .select("id")
        .single()
    : { data: null, error: { message: "Supabase not configured (missing service role key)" } };

  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: "error", msg: "installs database error", err: error?.message }));
    return c.json(errorEnvelope("database_error", "Failed to register install"), 500);
  }

  const row = data as InstallRow;

  return c.json({ id: row.id, token }, 201, {
    "X-RateLimit-Remaining": String(rateLimitResult.remaining),
  });
});
