import { createRoute, z } from "@hono/zod-openapi";
import { ApiFailure } from "../errors.ts";
import { createRouter } from "../router.ts";

const route = createRoute({
  method: "get",
  path: "/stream",
  operationId: "getStream",
  description: "The app's one event stream (realtime-events.md §2), as server-sent events.",
  request: {
    headers: z.object({ "last-event-id": z.string().optional() }),
  },
  responses: {
    200: {
      description: "Server-sent events",
      content: { "text/event-stream": { schema: z.string() } },
    },
  },
});

// The SSE adapter writes the body; the app wires it in (adapters never import each other, D35).
export type OpenStream = (
  afterSeq: number | null,
  signal: AbortSignal,
  onError: (error: unknown) => void,
) => ReadableStream<Uint8Array>;

export function streamRoutes(openStream: OpenStream) {
  return createRouter().openapi(route, (c) => {
    const lastEventId = c.req.valid("header")["last-event-id"];
    let afterSeq: number | null = null;
    if (lastEventId !== undefined && lastEventId !== "") {
      // The browser sends back an id this server wrote, so anything else is a bad request.
      if (!/^\d{1,15}$/.test(lastEventId)) {
        throw new ApiFailure(
          "bad_request",
          "Last-Event-ID must be a sequence number.",
          "last-event-id",
        );
      }
      afterSeq = Number(lastEventId);
    }
    const headers = {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    };
    // Hono answers HEAD with this GET handler and drops the body without cancelling it, so a
    // stream opened here would never end. HEAD gets the headers only.
    if (c.req.method === "HEAD") return new Response(null, { status: 200, headers });
    const log = c.get("log");
    const body = openStream(afterSeq, c.req.raw.signal, (error) => {
      log.error({ err: error }, "event stream failed");
    });
    return new Response(body, { status: 200, headers });
  });
}
