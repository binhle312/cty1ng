import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createLogger, redactingStream } from "../../src/adapters/log/pino-logger.ts";
import { collect, ORIGIN, readFrames, sleep, testBackend } from "../helpers.ts";

// security.md §2.6 and §3: no response and no log line ever contains the value of a
// `*_API_KEY` variable.
const SENTINEL = "sk-test-SENTINEL-4f9a2c71e0b3";

// A 40 × 30 PNG of one colour (the same bytes as the e2e avatar tests).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACgAAAAeCAMAAABpA6zvAAAAA1BMVEUzZv+f8kW/AAAACXBIWXMAAAPoAAAD6AG1e1Jr" +
    "AAAAEklEQVQ4y2NgGAWjYBSMguEAAATOAAHHK9RWAAAAAElFTkSuQmCC",
  "base64",
);

const Operation = z.object({
  parameters: z
    .array(z.object({ in: z.string(), name: z.string(), required: z.boolean().optional() }))
    .optional(),
  requestBody: z.object({ content: z.record(z.string(), z.unknown()) }).optional(),
});
const ApiDocument = z.object({
  paths: z.record(z.string(), z.record(z.string(), Operation)),
});

describe("API keys", () => {
  // Every operation of the API document gets one request, with real ids, so that a new
  // operation is checked with no change here (audit 2026-11-05, row 9).
  it("never appear in an answer of any operation, in the stream, or in the log", async () => {
    const backend = testBackend({
      FAKE_MODEL: "1",
      OPENAI_API_KEY: SENTINEL,
      ANTHROPIC_API_KEY: `${SENTINEL}-2`,
    });
    const texts: string[] = [];
    const record = async (response: Response) => {
      texts.push(JSON.stringify([...response.headers]), await response.clone().text());
      return response;
    };
    const created = async (response: Response) =>
      z.looseObject({ id: z.string() }).parse(await (await record(response)).json());
    const write = (path: string, body: unknown) =>
      backend.request(path, {
        method: "POST",
        headers: {
          origin: ORIGIN,
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      });

    // Real rows for the path ids: a skill, a bot with its pin, and an avatar file.
    const skill = await created(
      await write("/api/skills", {
        slug: "notes",
        name: "Notes",
        description: "Use it when you write notes.",
        body_md: "## Steps",
      }),
    );
    const bot = await created(
      await write("/api/bots", {
        name: "BA",
        description: "Writes user stories.",
        persona_md: "You are a business analyst.",
        avatar_style: "flat",
        avatar_colour: "#336699",
        model_id: "fake:effort",
        pins: [{ skill_id: skill.id, always_load: false }],
      }),
    );
    const form = new FormData();
    form.append("file", new File([new Uint8Array(PNG)], "a.png", { type: "image/png" }));
    const uploaded = await record(
      await backend.request("/api/avatars", {
        method: "POST",
        headers: { origin: ORIGIN },
        body: form,
      }),
    );
    const avatar = z
      .object({ avatar_id: z.string(), url: z.string() })
      .parse(await uploaded.json());
    const values: Record<string, string> = {
      skill_id: skill.id,
      version: "1",
      file: avatar.url.split("/").pop() ?? "",
    };

    const doc = ApiDocument.parse(
      await (await record(await backend.request("/api/openapi.json"))).json(),
    );
    const operations = Object.entries(doc.paths).flatMap(([path, methods]) =>
      Object.entries(methods).map(([method, operation]) => ({ path, method, operation })),
    );
    // A DELETE goes last, so the other operations still find the rows.
    operations.sort((a, b) => Number(a.method === "delete") - Number(b.method === "delete"));
    const called: string[] = [];
    for (const { path, method, operation } of operations) {
      called.push(`${method.toUpperCase()} ${path}`);
      if (path === "/api/stream") continue;
      const id = path.startsWith("/api/bots") ? bot.id : skill.id;
      const query = new URLSearchParams();
      for (const parameter of operation.parameters ?? []) {
        if (parameter.in === "query" && parameter.required === true) query.set(parameter.name, "1");
      }
      if (path === "/api/skills/export") query.set("ids", skill.id);
      const filled = path.replace(/\{(\w+)\}/g, (_, name: string) =>
        name === "id" ? id : (values[name] ?? ""),
      );
      const url = query.size > 0 ? `${filled}?${query.toString()}` : filled;
      const content = Object.keys(operation.requestBody?.content ?? {});
      const json = content.includes("application/json");
      const answer = await record(
        await backend.request(url, {
          method: method.toUpperCase(),
          headers: {
            origin: ORIGIN,
            "idempotency-key": crypto.randomUUID(),
            ...(json ? { "content-type": "application/json" } : {}),
          },
          body: content.includes("multipart/form-data") ? new FormData() : json ? "{}" : null,
        }),
      );
      // A 500 would hide the answer that the operation gives with good input.
      expect(answer.status, `${method} ${url}`).toBeLessThan(500);
    }
    // The 37 operations of api.md: if the document lost some, this test would check less.
    expect(called).toHaveLength(37);
    expect(called).toContain("GET /api/stream");

    await record(await backend.request("/api/nope"));
    await record(await backend.request("/api/health", { headers: { host: "evil.com" } }));

    // The stream: read until the test event comes, so that the check reads real frames.
    const abort = new AbortController();
    const stream = await backend.request("/api/stream", { signal: abort.signal });
    if (stream.body === null) throw new Error("The stream has no body.");
    const frames = collect(readFrames(stream.body));
    await record(await backend.postTestEvent("note-for-the-key-test"));
    const deadline = Date.now() + 2000;
    while (!frames.items.some((frame) => frame.data?.includes("note-for-the-key-test") === true)) {
      if (Date.now() > deadline) throw new Error("The test event did not come on the stream.");
      await sleep(10);
    }
    abort.abort();
    texts.push(JSON.stringify(frames.items));

    expect(backend.config.secrets).toContain(SENTINEL);
    for (const text of [...texts, ...backend.lines]) expect(text).not.toContain("SENTINEL");
    backend.close();
  });

  it("are redacted from log messages, fields, child bindings and JSON-escaped text", () => {
    const lines: string[] = [];
    const quoted = 'key-with-"quote"-and-\\slash';
    const log = createLogger({
      level: "info",
      secrets: [SENTINEL, quoted],
      destination: { write: (line: string) => void lines.push(line) },
    });
    log.info(`message ${SENTINEL}`);
    log.info({ header: `Bearer ${SENTINEL}`, nested: { key: SENTINEL } }, "field");
    log.child({ api_key: SENTINEL }).info("child");
    log.info({ value: quoted }, "escaped");
    log.error({ err: new Error(`provider said ${SENTINEL}`) }, "error");
    expect(lines).toHaveLength(5);
    for (const line of lines) {
      expect(line).not.toContain("SENTINEL");
      expect(line).not.toContain("quote");
      expect(() => {
        JSON.parse(line);
      }).not.toThrow();
    }
    expect(lines.join()).toContain("[REDACTED]");
  });

  it("leaves the log untouched when no key is set", () => {
    const destination = { write: () => undefined };
    expect(redactingStream(destination, [])).toBe(destination);
  });

  it("keep newlines escaped, so text cannot forge a log line", () => {
    const lines: string[] = [];
    const log = createLogger({
      level: "info",
      secrets: [],
      destination: { write: (l: string) => void lines.push(l) },
    });
    log.info({ text: 'reply\n{"level":50,"msg":"forged"}' }, "model output");
    expect(lines).toHaveLength(1);
    expect(lines[0]?.trimEnd().split("\n")).toHaveLength(1);
  });
});
