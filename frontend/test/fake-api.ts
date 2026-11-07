import type { QueryClient } from "@tanstack/react-query";
import { act } from "@testing-library/react";
import { z } from "zod";
import { client } from "../src/lib/api/client.ts";

// A fake network for component tests (frontend-conventions.md §1, "Real tests": mock only the
// network). A route is a method and a path; its answer is a status and a body. Every request is
// recorded, so a test can check what the page sent. A success answer that the client's response
// schema refuses fails the test at `restore()`: the page would take it as a failed request, and the
// test would only check the failure path (lesson `fake-answers-match-the-api.md`).
export interface RecordedRequest {
  method: string;
  path: string;
  body: unknown;
  headers: Headers;
}

type Answer = { status?: number; body?: unknown } | undefined;

// The query client of the page under test. `heldAnswer` asks it when the page took an answer.
let pageClient: QueryClient | null = null;
export function watchQueryClient(client: QueryClient) {
  pageClient = client;
}

const nextTimerStep = () => new Promise((resolve) => setTimeout(resolve, 0));
// Longer than the retry delays that tests set. A read that another held answer keeps open ends this
// wait at the limit.
const SETTLE_LIMIT_MS = 500;

// TanStack Query tells the page through its own timer, which starts when the read or the write
// ends. So wait for that end, with its retries, and then for one timer step after it.
async function pageTookTheAnswer() {
  const end = Date.now() + SETTLE_LIMIT_MS;
  while (
    pageClient !== null &&
    pageClient.isFetching() + pageClient.isMutating() > 0 &&
    Date.now() < end
  ) {
    await nextTimerStep();
  }
  await nextTimerStep();
}

// An answer the test gives later, so a request stays open until the test says. `answer` returns
// after the page takes the answer, so a check that something did not happen is real (DQ-110).
export function heldAnswer() {
  let give: (value: Answer) => void = () => undefined;
  const promise = new Promise<Answer>((resolve) => {
    give = resolve;
  });
  return {
    promise,
    answer: async (value: Answer) => {
      await act(async () => {
        give(value);
        await promise;
      });
      await act(pageTookTheAnswer);
    },
  };
}
// A request that fails on the way, as when the server cannot be reached.
export const NETWORK_ERROR = Symbol("network error");

// A handler may answer later (a promise), so a test can hold a request open.
type Handler = (
  request: RecordedRequest,
  search: URLSearchParams,
) => Answer | typeof NETWORK_ERROR | Promise<Answer | typeof NETWORK_ERROR>;

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
      // A file upload (multipart) is kept as its text; every other body is JSON.
      body:
        text === ""
          ? undefined
          : input.headers.get("content-type")?.includes("json") === true
            ? JSON.parse(text)
            : text,
      headers: input.headers,
    };
    requests.push(recorded);
    const answer = await routes[`${input.method} ${url.pathname}`]?.(recorded, url.searchParams);
    if (answer === NETWORK_ERROR) throw new TypeError("Failed to fetch");
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
  // A 2xx answer that the generated response schema refused.
  const refused: string[] = [];
  // The interceptor shape is the client's own, so its arguments come as one rest list.
  const watch = client.interceptors.error.use((error, ...[response, request]) => {
    if (response?.ok === true && request !== undefined && error instanceof z.ZodError) {
      const url = new URL(request.url);
      refused.push(`${request.method} ${url.pathname}: ${error.message}`);
    }
    return error;
  });
  return {
    requests,
    sent: (method: string, path: string) =>
      requests.filter((request) => request.method === method && request.path === path),
    restore: () => {
      client.interceptors.error.eject(watch);
      // The client calls the global fetch when it has none of its own.
      client.setConfig({
        baseUrl: original.baseUrl ?? "",
        fetch: (info, init) => globalThis.fetch(info, init),
      });
      if (refused.length > 0) {
        throw new Error(`A fake answer does not match the API:\n${refused.join("\n")}`);
      }
    },
  };
}
