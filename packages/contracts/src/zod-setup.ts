import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

// Adds `.openapi(...)` to every zod schema. Must run before any schema file
// calls `.openapi(...)`, and must run exactly once against the single `z`
// instance every schema file imports — mixing an unextended `z` with an
// extended one silently drops metadata rather than erroring.
extendZodWithOpenApi(z);

export { z };
