import createClient, { type ClientOptions } from "openapi-fetch";
import type { paths } from "../generated/api";

// Typed HTTP client for the Mapee v1 API, built on top of `openapi-fetch`
// and the types generated (via `pnpm gen` / `generate:client`) from
// packages/contracts/openapi.json. The generated `../generated/api.d.ts`
// file is a build artifact (git-ignored) — do not hand-edit it, and do not
// import from it anywhere except this factory.
export function createApiClient(options: ClientOptions) {
  return createClient<paths>(options);
}

export type { paths } from "../generated/api";
