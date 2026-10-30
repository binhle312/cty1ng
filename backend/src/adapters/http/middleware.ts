import { randomUUID } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { Logger } from "pino";
import type { HttpEnv } from "./context.ts";
import { ApiFailure } from "./errors.ts";

// The request path of security.md §2.1, in order (M0b plan §4).

// First: every response and log line of a request has the same id (security.md §2.10). The id
// is always made here; a client-sent X-Request-Id is ignored.
export function requestId(log: Logger): MiddlewareHandler<HttpEnv> {
  return async (c, next) => {
    const id = randomUUID();
    c.set("requestId", id);
    c.set("log", log.child({ request_id: id }));
    c.header("X-Request-Id", id);
    await next();
  };
}

// One line per request. The path only: a query string can hold user text.
export function accessLog(): MiddlewareHandler<HttpEnv> {
  return async (c, next) => {
    const start = performance.now();
    await next();
    c.get("log").info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        ms: Math.round(performance.now() - start),
      },
      "request",
    );
  };
}

// `host[:port]`: a name or IPv4 address, or an IPv6 address in brackets. Two Host headers reach
// here joined by ", ", so they fail this test too.
const HOST_SYNTAX = /^(?:\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::\d{1,5})?$/;

// Blocks DNS rebinding (security.md §2.1). A missing, duplicate or malformed Host is a bad
// request; a well-formed Host that is not ours is refused.
export function hostCheck(allowedHosts: readonly string[]): MiddlewareHandler<HttpEnv> {
  const allowed = new Set(allowedHosts);
  return async (c, next) => {
    const host = c.req.header("host")?.toLowerCase();
    if (host === undefined || !HOST_SYNTAX.test(host)) {
      throw new ApiFailure("bad_request", "The Host header is missing or malformed.");
    }
    if (!allowed.has(host)) {
      throw new ApiFailure("host_rejected", "This server answers only on its own address.");
    }
    await next();
  };
}

// security.md §2.1: every non-GET request needs an allowed Origin; a GET is checked when it
// sends one. The stream is a GET, so it gets the same check.
export function originCheck(allowedOrigins: readonly string[]): MiddlewareHandler<HttpEnv> {
  const allowed = new Set(allowedOrigins);
  return async (c, next) => {
    const origin = c.req.header("origin");
    const safe = c.req.method === "GET" || c.req.method === "HEAD";
    if (origin === undefined ? !safe : !allowed.has(origin)) {
      throw new ApiFailure("origin_rejected", "Requests from this origin are not allowed.");
    }
    await next();
  };
}

// The headers of security.md §2.1. HSTS is off: the app runs on plain http on loopback.
export function securityHeaders(): MiddlewareHandler<HttpEnv> {
  return secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
    xContentTypeOptions: true,
    referrerPolicy: "no-referrer",
    strictTransportSecurity: false,
  });
}

// No permissive CORS: Access-Control-Allow-Origin only for the allowed origins.
export function corsForAllowedOrigins(
  allowedOrigins: readonly string[],
): MiddlewareHandler<HttpEnv> {
  const allowed = new Set(allowedOrigins);
  return cors({
    origin: (origin) => (allowed.has(origin) ? origin : null),
    exposeHeaders: ["X-Request-Id"],
  });
}

// security.md §3: a body over 1 MB gets 413. A security check, so fixed in code. Uploads (M2)
// get their own limit on their route.
export const MAX_BODY_BYTES = 1024 * 1024;

export function maxBody(): MiddlewareHandler<HttpEnv> {
  return bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: () => {
      throw new ApiFailure("too_large", "The request body is too large.");
    },
  });
}
