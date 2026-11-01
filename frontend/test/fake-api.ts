import { client } from "../src/lib/api/client.ts";

// A fake network for component tests (frontend-conventions.md §1, "Real tests": mock only the
// network). A route is a method and a path; its answer is a status and a body. Every request is
// recorded, so a test can check what the page sent.
export interface RecordedRequest {
  method: string;
  path: string;
  body: unknown;
}

type Answer = { status?: number; body?: unknown } | undefined;
type Handler = (request: RecordedRequest, search: URLSearchParams) => Answer;

export function fakeApi(routes: Record<string, Handler>) {
  const requests: RecordedRequest[] = [];
  const original = client.getConfig();
  // The relative URLs of the app need a base in Node.
  client.setConfig({ baseUrl: "http://localhost" });
  const fetchFake = async (info: URL | RequestInfo, init?: RequestInit): Promise<Response> => {
    const input = new Request(info, init);
    const url = new URL(input.url);
    const text = input.method === "GET" || input.method === "DELETE" ? "" : await input.text();
    const recorded: RecordedRequest = {
      method: input.method,
      path: url.pathname,
      body: text === "" ? undefined : JSON.parse(text),
    };
    requests.push(recorded);
    const answer = routes[`${input.method} ${url.pathname}`]?.(recorded, url.searchParams);
    if (answer === undefined) {
      return Response.json(
        { error: { code: "not_found", message: `No route for ${input.method} ${url.pathname}` } },
        { status: 404 },
      );
    }
    const status = answer.status ?? 200;
    if (status === 204) return new Response(null, { status });
    return Response.json(answer.body, { status });
  };
  client.setConfig({ fetch: fetchFake });
  return {
    requests,
    sent: (method: string, path: string) =>
      requests.filter((request) => request.method === method && request.path === path),
    restore: () => {
      // The client calls the global fetch when it has none of its own.
      client.setConfig({
        baseUrl: original.baseUrl ?? "",
        fetch: (info, init) => globalThis.fetch(info, init),
      });
    },
  };
}
