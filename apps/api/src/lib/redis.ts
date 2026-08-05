import { Redis } from "@upstash/redis";

// Ported unchanged from apps/web/src/lib/redis.ts. Only instantiated if the
// environment variables are present, so local development and CI stay
// operational without an Upstash account.
export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;
