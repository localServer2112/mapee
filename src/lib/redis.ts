import { Redis } from "@upstash/redis";

// Only instantiate Redis if the environment variables are present
// This ensures local development stays operational without requiring Upstash setup immediately.
export const redis =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        })
        : null;
