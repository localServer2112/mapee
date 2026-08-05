import type { Context } from "hono";
import type { ZodError } from "zod";

/**
 * The one error shape every route returns, matching ErrorEnvelopeSchema in
 * @mapee/contracts. Nothing here is contract-checked against that schema at
 * compile time (Hono's error path isn't typed the way its success path is),
 * so keep this in sync with schemas/common.ts by hand.
 */
export function errorEnvelope(code: string, message: string, details?: Record<string, unknown>) {
  return { error: { code, message, ...(details ? { details } : {}) } };
}

/** Flattens a Zod validation failure into { field: [messages] }. */
export function zodErrorDetails(error: ZodError): Record<string, unknown> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "(root)";
    (details[path] ??= []).push(issue.message);
  }
  return details;
}

/**
 * Passed as `defaultHook` to `new OpenAPIHono({ defaultHook })`. Runs after
 * every route's request validation; only acts on failure, since a successful
 * validation has nothing to override.
 */
export function validationErrorHook(
  result: { success: boolean; error?: ZodError },
  c: Context
) {
  if (!result.success && result.error) {
    return c.json(
      errorEnvelope("validation_failed", "Request did not match the expected shape", {
        issues: zodErrorDetails(result.error),
      }),
      400
    );
  }
}
