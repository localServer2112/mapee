import type { MiddlewareHandler } from "hono";

/**
 * Context variables this middleware attaches via `c.set`/`c.get`. Typed
 * through Hono's `Env` generic (the `Variables` field) rather than left
 * untyped, so downstream handlers that read `c.get("requestId")` get a
 * `string`, not `unknown`.
 */
export type LoggingVariables = {
  requestId: string;
};

/**
 * Structured per-request logger, in the same `{ level, msg, ... }` JSON-line
 * shape already used elsewhere in this package (see the console.error calls
 * in ./rate-limit.ts and app.ts's onError handler) — this doesn't invent a
 * second logging convention, it extends the existing one to the request
 * lifecycle.
 *
 * Request ID: minted with the platform's `crypto.randomUUID()` (a Node 20
 * global, typed via @types/node) rather than composing in Hono's separate
 * `hono/request-id` middleware. That middleware would still need its own
 * `app.use()` mount plus a second read of `c.get("requestId")` in here to
 * get the ID into the log line — for a single global that's already
 * available with no new dependency, hand-rolling one line is simpler than
 * wiring two middlewares together to do it. `X-Request-Id` is echoed back
 * as a response header on the same convention `hono/request-id` uses, so a
 * client or proxy can correlate a response with this log line.
 *
 * Logs after `await next()` resolves, so `c.res.status` reflects the real
 * response status (including one produced by app.ts's `onError`/`notFound`
 * handlers) rather than a pre-response guess.
 */
export const requestLogger: MiddlewareHandler<{ Variables: LoggingVariables }> = async (
  c,
  next
) => {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("X-Request-Id", requestId);

  await next();

  const durationMs = Date.now() - start;
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      level: "info",
      msg: "request",
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs,
    })
  );
};
