// Moved to @mapee/core so the API service and mobile match a carrier name to
// the canonical ISP list identically. Re-exported so existing
// `@/lib/isp-verification` imports keep working.
export { detectISP } from "@mapee/core";
