import { z } from "../zod-setup";

/**
 * Anonymous per-device identity for write auth, rate limiting, and own-data
 * access (plan §7.6) — not a user account. No PII, no sign-up.
 */
export const InstallPlatformSchema = z.enum(["ios", "android", "web"]).openapi("InstallPlatform");

export const CreateInstallRequestSchema = z
  .object({
    platform: InstallPlatformSchema,
  })
  .openapi("CreateInstallRequest");

/**
 * `token` is returned exactly once, at creation. The server only ever
 * stores its hash — losing this value means losing the install's identity
 * (its own-data access and rate-limit bucket), not a security incident.
 */
export const CreateInstallResponseSchema = z
  .object({
    id: z.string().uuid(),
    token: z.string(),
  })
  .openapi("CreateInstallResponse");
