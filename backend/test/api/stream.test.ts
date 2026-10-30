import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { collect, readFrames, sleep, testServer, type SseFrame } from "../helpers.ts";

// M0 AC4 over a real HTTP server: the test endpoint appends an event, a connected SSE client
// receives it with the right id, a reconnect with Last-Event-ID replays what it missed, and an
// old cursor gets `reset` (realtime-events.md §2).
let server: Awaited<ReturnType<typeof testServer>>;
let abort: AbortController;
beforeEach(async () => {
  server = await testServer();
  abort = new AbortController();
});
afterEach(async () => {
  abort.abort();
  await server.close();
});

async function connect(lastEventId?: string) {
  const response = await fetch(`${server.url}/api/stream`, {
    headers: lastEventId === undefined ? {} : { "last-event-id": lastEventId },
    signal: abort.signal,
  });
  if (response.body === null) throw new Error("no body");
  return { response, frames: collect(readFrames(response.body)) };
}

const events = (frames: SseFrame[]) =>
  frames
    .filter((frame) => frame.event !== undefined)
    .map((f) => `${f.id ?? "-"} ${f.event ?? ""} ${f.data ?? ""}`);

async function append(note: string): Promise<number> {
  const response = await fetch(`${server.url}/api/_test/events`, {
    method: "POST",
    headers: { origin: server.url, "content-type": "application/json" },
    body: JSON.stringify({ note }),
  });
  expect(response.status).toBe(201);
  const body: unknown = await response.json();
  return typeof body === "object" && body !== null && "seq" in body ? Number(body.seq) : -1;
}

async function waitForEvents(stream: Awaited<ReturnType<typeof connect>>, count: number) {
  for (let i = 0; i < 100 && events(stream.frames.items).length < count; i++) await sleep(20);
  return events(stream.frames.items);
}

describe("GET /api/stream", () => {
  it("is an event stream with no caching, and tells the browser to retry after 2 s", async () => {
    const { response, frames } = await connect();
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect((await frames.waitFor(1))[0]).toEqual({ retry: "2000" });
  });

  it("sends an appended event to a connected client with its seq as the id", async () => {
    const stream = await connect();
    expect(await waitForEvents(stream, 1)).toEqual(['0 ready {"max_seq":0}']);
    expect(await append("hello")).toBe(1);
    expect(await waitForEvents(stream, 2)).toEqual([
      '0 ready {"max_seq":0}',
      '1 test.ping {"note":"hello"}',
    ]);
  });

  it("replays the missed events after Last-Event-ID, then sends live ones", async () => {
    const first = await connect();
    await append("one");
    await waitForEvents(first, 2);
    abort.abort();

    await append("two");
    await append("three");
    abort = new AbortController();
    const second = await connect("1");
    expect(await waitForEvents(second, 3)).toEqual([
      '1 ready {"max_seq":3}',
      '2 test.ping {"note":"two"}',
      '3 test.ping {"note":"three"}',
    ]);
    await append("four");
    expect((await waitForEvents(second, 4)).at(-1)).toBe('4 test.ping {"note":"four"}');
  });

  it("sends `reset` with the newest seq as the id for a cursor older than the kept events", async () => {
    for (const note of ["a", "b", "c"]) await append(note);
    const sqlite = new Database(server.config.databaseFile);
    sqlite.prepare("DELETE FROM events WHERE seq < ?").run(3);
    sqlite.close();
    const stream = await connect("1");
    expect(await waitForEvents(stream, 2)).toEqual(['1 ready {"max_seq":3}', "3 reset {}"]);
  });

  it("sends `: ping` heartbeats", async () => {
    const { frames } = await connect();
    await sleep(150);
    expect(frames.items.some((frame) => frame.comment === "ping")).toBe(true);
  });

  it("refuses a Last-Event-ID that is not a sequence number", async () => {
    const response = await fetch(`${server.url}/api/stream`, {
      headers: { "last-event-id": "abc" },
    });
    expect(response.status).toBe(400);
  });
});

describe("POST /api/_test/events", () => {
  it("does not exist unless APP_ENV=test", async () => {
    for (const appEnv of ["dev", "prod"]) {
      const other = await testServer({ APP_ENV: appEnv });
      const response = await fetch(`${other.url}/api/_test/events`, {
        method: "POST",
        headers: { origin: other.url, "content-type": "application/json" },
        body: JSON.stringify({ note: "x" }),
      });
      expect(response.status).toBe(404);
      await other.close();
    }
  });

  it("is not in the OpenAPI schema", async () => {
    const schema: unknown = await (await fetch(`${server.url}/api/openapi.json`)).json();
    const paths =
      typeof schema === "object" && schema !== null && "paths" in schema ? schema.paths : {};
    expect(Object.keys(paths ?? {})).toEqual(["/api/health", "/api/stream"]);
  });
});
