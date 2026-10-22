import { afterEach, describe, expect, it } from "vitest";
import { lte } from "drizzle-orm";
import { events } from "../../src/adapters/db/schema";
import { DEV_ORIGIN, makeTestApp, OWN_ORIGIN, ping, type TestApp } from "../support/test-app";
import { SseReader } from "../support/sse-client";

let app: TestApp | undefined;
const readers: SseReader[] = [];

function open(env: Record<string, string> = {}): TestApp {
  app = makeTestApp(env);
  return app;
}

async function connect(target: TestApp, lastEventId?: string): Promise<SseReader> {
  const response = await target.request("/api/stream", {
    headers: {
      origin: DEV_ORIGIN,
      ...(lastEventId === undefined ? {} : { "last-event-id": lastEventId }),
    },
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("text/event-stream");
  expect(response.headers.get("cache-control")).toBe("no-cache");
  const reader = new SseReader(response);
  readers.push(reader);
  return reader;
}

afterEach(async () => {
  await Promise.allSettled(readers.splice(0).map((reader) => reader.close()));
  app?.dispose();
  app = undefined;
});

describe("AC4: test endpoint, SSE delivery, replay and reset (realtime-events.md §2)", () => {
  it("AC4: an appended event reaches a connected client with id = seq", async () => {
    const target = open();
    const reader = await connect(target);
    expect(await reader.nextFrame()).toEqual({ retry: "2000" });
    expect(await reader.nextFrame()).toEqual({ event: "ready", data: '{"max_seq":0}' });

    const seq = await ping(target, "hello");
    expect(await reader.nextFrame()).toEqual({
      id: String(seq),
      event: "test.ping",
      data: '{"note":"hello"}',
    });
  });

  it("AC4: reconnecting with Last-Event-ID replays the missed events", async () => {
    const target = open();
    const first = await ping(target, "seen");
    const missed = [await ping(target, "missed 1"), await ping(target, "missed 2")];
    const reader = await connect(target, String(first));
    expect((await reader.nextEvent()).type).toBe("ready");
    const replayed = [await reader.nextEvent(), await reader.nextEvent()];
    expect(replayed).toEqual([
      { type: "test.ping", seq: missed[0], data: { note: "missed 1" } },
      { type: "test.ping", seq: missed[1], data: { note: "missed 2" } },
    ]);
  });

  it("AC4: an old cursor gets reset", async () => {
    const target = open();
    await ping(target, "1");
    const second = await ping(target, "2");
    await ping(target, "3");
    target.connections.write.db.delete(events).where(lte(events.seq, second)).run();
    const reader = await connect(target, "1");
    expect(await reader.nextFrame()).toEqual({ retry: "2000" });
    expect(await reader.nextFrame()).toEqual({ event: "reset", data: "{}" });
  });

  it("sends a `: ping` heartbeat while idle", async () => {
    const reader = await connect(open());
    await reader.nextFrame();
    await reader.nextFrame();
    expect(await reader.nextFrame()).toEqual({ comment: "ping" });
  });

  it("a note with newlines or injection text is stored and sent literally (security.md §2.8)", async () => {
    const target = open();
    const reader = await connect(target);
    await reader.nextEvent();
    const notes = ["' OR 1=1 --", '"; DROP TABLE events; --', "line\n\nid: 999\nevent: forged"];
    for (const note of notes) {
      const seq = await ping(target, note);
      expect(await reader.nextEvent()).toEqual({ type: "test.ping", seq, data: { note } });
    }
  });
});

describe("test endpoint rules (owner, PR #10)", () => {
  it("is not mounted outside APP_ENV=test", async () => {
    for (const appEnv of ["dev", "prod"]) {
      const target = open({ APP_ENV: appEnv });
      const response = await target.request("/api/_test/events", {
        method: "POST",
        headers: { origin: OWN_ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ note: "x" }),
      });
      expect(response.status).toBe(404);
      target.dispose();
      app = undefined;
    }
  });

  it("logs one warn line at startup when enabled", () => {
    const target = open();
    const warnings = target.logs.filter((line) => line.includes('"app.test_endpoints"'));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"level":40');
  });

  it("is not in the OpenAPI schema", async () => {
    const response = await open().request("/api/openapi.json");
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("/api/health");
    expect(text).not.toContain("_test");
  });

  it("rejects a note over 200 characters with 422", async () => {
    const response = await open().request("/api/_test/events", {
      method: "POST",
      headers: { origin: OWN_ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ note: "x".repeat(201) }),
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { code: "validation_error", field: "note" },
    });
  });

  it("rejects malformed JSON with 400 bad_request", async () => {
    const response = await open().request("/api/_test/events", {
      method: "POST",
      headers: { origin: OWN_ORIGIN, "content-type": "application/json" },
      body: "{not json",
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "bad_request" } });
  });
});
