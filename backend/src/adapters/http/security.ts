import type { MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { HttpEnv } from "./context";
import { errorResponse } from "./errors";

/** Request body limit for JSON (security.md §2.7). */
export const JSON_BODY_LIMIT_BYTES = 1024 * 1024;

/**
 * Response headers (security.md §2.1). Registered first, so error responses from the checks
 * below carry them too. HSTS is off: phase 1 is plain HTTP on loopback; M9 adds TLS.
 */
export function securityHeaders(): MiddlewareHandler<HttpEnv> {
  return secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
    referrerPolicy: "no-referrer",
    xContentTypeOptions: true,
    strictTransportSecurity: false,
  });
}

const LOOPBACK_NAMES = ["127.0.0.1", "localhost"];
const DEFAULT_HTTP_PORT = 80;

/** `127.0.0.1:<port>` and `localhost:<port>`; browsers leave out `:80`, so allow that too. */
function ownHosts(port: number): string[] {
  return LOOPBACK_NAMES.flatMap((name) =>
    port === DEFAULT_HTTP_PORT ? [name, `${name}:${port}`] : [`${name}:${port}`],
  );
}

/** Blocks DNS rebinding: the Host header must name this server on loopback. */
export function hostCheck(input: { port: number }): MiddlewareHandler<HttpEnv> {
  const allowed = new Set(ownHosts(input.port));
  return async (c, next) => {
    const host = c.req.header("host");
    if (host === undefined || !allowed.has(host.toLowerCase())) {
      c.get("log").warn({ event: "http.host_rejected" }, "host rejected");
      return errorResponse(c, { status: 403, code: "host_rejected", message: "Host not allowed." });
    }
    await next();
  };
}

const SAFE_METHODS = new Set(["GET", "HEAD"]);

/**
 * Non-GET requests need an allowed Origin; GET requests are checked when they send one
 * (security.md §2.1). Allowed: the app's own origin and ALLOWED_ORIGINS.
 */
export function originCheck(input: {
  port: number;
  allowedOrigins: readonly string[];
}): MiddlewareHandler<HttpEnv> {
  const allowed = new Set([
    ...ownHosts(input.port).map((host) => `http://${host}`),
    ...input.allowedOrigins,
  ]);
  return async (c, next) => {
    const origin = c.req.header("origin");
    const needsOrigin = !SAFE_METHODS.has(c.req.method);
    if ((origin === undefined && needsOrigin) || (origin !== undefined && !allowed.has(origin))) {
      c.get("log").warn({ event: "http.origin_rejected" }, "origin rejected");
      return errorResponse(c, {
        status: 403,
        code: "origin_rejected",
        message: "Origin not allowed.",
      });
    }
    await next();
  };
}

/** CORS only for ALLOWED_ORIGINS; no wildcard (security.md §2.1). */
export function corsForAllowedOrigins(input: {
  allowedOrigins: readonly string[];
}): MiddlewareHandler<HttpEnv> {
  return cors({
    origin: (origin) => (input.allowedOrigins.includes(origin) ? origin : null),
  });
}

export function jsonBodyLimit(): MiddlewareHandler<HttpEnv> {
  // Built per request so `onError` answers with this request's typed context.
  return (c, next) =>
    bodyLimit({
      maxSize: JSON_BODY_LIMIT_BYTES,
      onError: () =>
        errorResponse(c, { status: 413, code: "too_large", message: "Request body too large." }),
    })(c, next);
}
