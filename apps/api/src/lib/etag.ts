import type { Context } from "hono";

/**
 * ETag / If-None-Match support for GET /v1/areas and /v1/towers, per plan
 * §7.4's cross-cutting requirement. Mobile clients re-request the same
 * viewport constantly as a user pans a map; a 304 with no body costs
 * meaningfully less than re-sending the same JSON payload every time.
 *
 * The tag is a straightforward SHA-1 of the serialized body — this only
 * needs to be a stable fingerprint of "did the response change", not a
 * security property, so a fast, weak hash is the right tool.
 */
async function computeETag(body: unknown): Promise<string> {
  const json = JSON.stringify(body);
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(json));
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `"${hex}"`;
}

/**
 * Sends `body` as JSON with an ETag header, or a bodyless 304 if the
 * request's If-None-Match already matches. Use in place of `c.json(...)`
 * for cacheable GET responses.
 */
export async function jsonWithETag(
  c: Context,
  body: unknown,
  extraHeaders: Record<string, string> = {}
) {
  const etag = await computeETag(body);
  const ifNoneMatch = c.req.header("if-none-match");

  if (ifNoneMatch === etag) {
    return c.body(null, 304, { ETag: etag, ...extraHeaders });
  }

  return c.json(body, 200, { ETag: etag, ...extraHeaders });
}
