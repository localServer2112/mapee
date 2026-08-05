import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { registry } from "./registry";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Independent of any running server — this is the "contract-first" part of
// plan §7.3: the OpenAPI spec is derived from the Zod schemas directly, not
// from apps/api, which doesn't exist yet. apps/api reuses these same schemas
// at runtime via @hono/zod-openapi once A2 stands it up.
const generator = new OpenApiGeneratorV31(registry.definitions);

const document = generator.generateDocument({
  openapi: "3.1.0",
  info: {
    title: "Mapee API",
    version: "1.0.0",
    description:
      "Crowdsourced network-quality data. Generated from packages/contracts/src — do not hand-edit openapi.json.",
  },
  servers: [{ url: "https://api.mapee.app", description: "Production (planned)" }],
});

const outPath = resolve(__dirname, "../openapi.json");
writeFileSync(outPath, JSON.stringify(document, null, 2) + "\n");

// eslint-disable-next-line no-console
console.log(`Wrote ${outPath}`);
