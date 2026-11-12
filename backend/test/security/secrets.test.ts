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

const Row = z.looseObject({ id: z.string(), row_version: z.number() });

// The backend of the scan test, with three ways to an answer and no other (DQ-154): the test
// cannot get an answer that the scan did not read. The headers of each answer are scanned, and
// its body too. The body of the stream never ends, so `stream` leaves it to the test, which
// scans the frames that it reads.
function scannedBackend(env: NodeJS.ProcessEnv) {
  const backend = testBackend(env);
  const texts: string[] = [];
  const scan = async (response: Response, body: "scanned" | "left to the test") => {
    texts.push(JSON.stringify([...response.headers]));
    if (body === "scanned") texts.push(await response.clone().text());
    return response;
  };
  return {
    texts,
    lines: backend.lines,
    secrets: backend.config.secrets,
    close: backend.close,
    request: async (path: string, init?: RequestInit) =>
      scan(await backend.request(path, init), "scanned"),
    stream: async (path: string, init?: RequestInit) =>
      scan(await backend.request(path, init), "left to the test"),
    postTestEvent: async (note: string) => scan(await backend.postTestEvent(note), "scanned"),
  };
}

describe("API keys", () => {
  // The scan reads error answers (part 1, an empty body) and success answers (part 2, real
  // requests), so it sees what the services give (audit 2026-11-05, row 9). The success check at
  // the end of part 2 names each operation that never succeeded.
  it("never appear in an answer, in the stream frames, or in the log", async () => {
    const backend = scannedBackend({
      FAKE_MODEL: "1",
      OPENAI_API_KEY: SENTINEL,
      ANTHROPIC_API_KEY: `${SENTINEL}-2`,
    });
    const { texts } = backend;
    const succeeded = new Set<string>();
    // `operation` is the method and the path as the API document writes it, for example
    // `GET /api/skills/{id}`.
    const call = async (
      operation: string,
      options: {
        ids?: Record<string, string>;
        query?: string;
        body?: unknown;
        form?: FormData;
      } = {},
    ) => {
      const [method = "", template = ""] = operation.split(" ");
      const path = template.replace(/\{(\w+)\}/g, (_, name: string) => options.ids?.[name] ?? "");
      const json = options.body !== undefined;
      const response = await backend.request(
        options.query === undefined ? path : `${path}?${options.query}`,
        {
          method,
          headers: {
            origin: ORIGIN,
            "idempotency-key": crypto.randomUUID(),
            ...(json ? { "content-type": "application/json" } : {}),
          },
          body: options.form ?? (json ? JSON.stringify(options.body) : null),
        },
      );
      if (response.ok) succeeded.add(operation);
      return response;
    };
    const ok = async (...args: Parameters<typeof call>) => {
      const response = await call(...args);
      expect(response.ok, `${args[0]}: ${String(response.status)}`).toBe(true);
      return response;
    };
    const rowOf = async (template: string, id: string) =>
      Row.parse(await (await ok(`GET ${template}`, { ids: { id } })).json());

    // Real rows for the path ids: a skill, a bot with its pin, and an avatar file.
    const skill = Row.parse(
      await (
        await ok("POST /api/skills", {
          body: {
            slug: "notes",
            name: "Notes",
            description: "Use it when you write notes.",
            body_md: "## Steps",
          },
        })
      ).json(),
    );
    const bot = Row.parse(
      await (
        await ok("POST /api/bots", {
          body: {
            name: "BA",
            description: "Writes user stories.",
            persona_md: "You are a business analyst.",
            avatar_style: "flat",
            avatar_colour: "#336699",
            model_id: "fake:effort",
            pins: [{ skill_id: skill.id, always_load: false }],
          },
        })
      ).json(),
    );
    const image = new FormData();
    image.append("file", new File([new Uint8Array(PNG)], "a.png", { type: "image/png" }));
    const avatar = z
      .object({ url: z.string() })
      .parse(await (await ok("POST /api/avatars", { form: image })).json());
    const ids = {
      skill: { id: skill.id },
      bot: { id: bot.id },
      pin: { id: bot.id, skill_id: skill.id },
      file: { file: avatar.url.split("/").pop() ?? "" },
    };

    // 1. The operations of the document with an empty body, except the stream (part 3) and a
    // DELETE (it has no body; part 2 sends it). No answer may be a 500 (the check in the loop).
    const doc = ApiDocument.parse(await (await ok("GET /api/openapi.json")).json());
    const operations = Object.entries(doc.paths).flatMap(([path, methods]) =>
      Object.entries(methods).map(([method, operation]) => ({
        path,
        method: method.toUpperCase(),
        operation,
      })),
    );
    // The current OpenAPI document has 37 operations. If it lost some, this test would check
    // less, so a change of this number needs a look.
    expect(operations).toHaveLength(37);
    for (const { path, method, operation } of operations) {
      if (path === "/api/stream" || method === "DELETE") continue;
      const content = Object.keys(operation.requestBody?.content ?? {});
      const query = (operation.parameters ?? [])
        .filter((parameter) => parameter.in === "query" && parameter.required === true)
        .map((parameter) => `${parameter.name}=1`)
        .join("&");
      const answer = await call(`${method} ${path}`, {
        ids: path.startsWith("/api/bots")
          ? { ...ids.pin }
          : { id: skill.id, skill_id: skill.id, version: "1", ...ids.file },
        ...(query === "" ? {} : { query }),
        ...(content.includes("multipart/form-data")
          ? { form: new FormData() }
          : content.length > 0
            ? { body: {} }
            : {}),
      });
      expect(answer.status, `${method} ${path}`).toBeLessThan(500);
    }

    // 2. A real request to the operations, in an order where they succeed. The success check at
    // the end of this part names each operation that did not.
    for (const template of [
      "/api/health",
      "/api/settings",
      "/api/models",
      "/api/tools",
      "/api/skills",
      "/api/bots",
      "/api/avatars/limits",
    ]) {
      await ok(`GET ${template}`);
    }
    await ok("GET /api/avatars/{file}", { ids: ids.file });
    await ok("PATCH /api/settings", { body: {} });
    for (const template of [
      "/api/skills/{id}",
      "/api/skills/{id}/versions",
      "/api/skills/{id}/upgrade-candidates",
    ]) {
      await ok(`GET ${template}`, { ids: ids.skill });
    }
    await ok("GET /api/skills/{id}/versions/{version}", { ids: { ...ids.skill, version: "1" } });
    await ok("GET /api/skills/{id}/diff", { ids: ids.skill, query: "from=1&to=1" });
    await ok("GET /api/bots/{id}", { ids: ids.bot });
    await ok("GET /api/bots/{id}/clone-template", { ids: ids.bot });
    const zip = await (
      await ok("GET /api/skills/export", { query: `ids=${skill.id}` })
    ).arrayBuffer();

    await ok("PATCH /api/skills/{id}", {
      ids: ids.skill,
      body: {
        name: "Meeting notes",
        row_version: (await rowOf("/api/skills/{id}", skill.id)).row_version,
      },
    });
    // Part 1 restored version 1 once (an empty body is a valid restore), so the base is the
    // newest version.
    const latest = z
      .array(z.object({ version: z.number() }))
      .parse(await (await ok("GET /api/skills/{id}/versions", { ids: ids.skill })).json())[0];
    await ok("POST /api/skills/{id}/versions", {
      ids: ids.skill,
      body: {
        base_version: latest?.version,
        description: "Use it.",
        body_md: "## Steps, version 2",
      },
    });
    // The export holds version 1, so its import is a change now.
    const archive = new FormData();
    archive.append("file", new File([zip], "skills.zip", { type: "application/zip" }));
    const preview = z
      .object({ preview_id: z.string() })
      .parse(await (await ok("POST /api/skills/import/preview", { form: archive })).json());
    await ok("POST /api/skills/import/apply", {
      body: { preview_id: preview.preview_id, slugs: ["notes"] },
    });
    await ok("POST /api/skills/{id}/versions/{version}/restore", {
      ids: { ...ids.skill, version: "1" },
      body: {},
    });
    const versions = z
      .array(z.object({ id: z.string() }))
      .parse(await (await ok("GET /api/skills/{id}/versions", { ids: ids.skill })).json());
    const pins = z
      .object({ pins: z.array(z.object({ skill_version_id: z.string() })) })
      .parse(await (await ok("GET /api/bots/{id}", { ids: ids.bot })).json()).pins;
    const newest = versions[0]?.id ?? "";
    await ok("POST /api/skills/{id}/bots", {
      ids: ids.skill,
      body: {
        skill_version_id: newest,
        bots: [{ bot_id: bot.id, expected_skill_version_id: pins[0]?.skill_version_id ?? null }],
      },
    });
    await ok("PUT /api/bots/{id}/skills/{skill_id}", {
      ids: ids.pin,
      body: {
        skill_version_id: newest,
        always_load: true,
        expected: { skill_version_id: newest, always_load: false },
      },
    });
    await ok("PUT /api/bots/pins", { body: { bot_ids: [bot.id], expected_bot_ids: [] } });
    await ok("PATCH /api/bots/{id}", {
      ids: ids.bot,
      body: {
        row_version: (await rowOf("/api/bots/{id}", bot.id)).row_version,
        description: "Writes stories.",
      },
    });
    await ok("DELETE /api/bots/{id}/skills/{skill_id}", { ids: ids.pin });
    const skillVersion = async () => (await rowOf("/api/skills/{id}", skill.id)).row_version;
    await ok("POST /api/skills/{id}/deprecate", {
      ids: ids.skill,
      body: { remove_bot_ids: [], row_version: await skillVersion() },
    });
    await ok("POST /api/skills/{id}/undeprecate", {
      ids: ids.skill,
      body: { row_version: await skillVersion() },
    });
    await ok("POST /api/skills/{id}/deprecate", {
      ids: ids.skill,
      body: { remove_bot_ids: [], row_version: await skillVersion() },
    });
    const trash = async () =>
      ok("POST /api/skills/{id}/trash", {
        ids: ids.skill,
        body: { row_version: await skillVersion() },
      });
    await trash();
    await ok("POST /api/skills/{id}/restore", { ids: ids.skill });
    await trash();
    await ok("DELETE /api/skills/{id}", { ids: ids.skill });
    await ok("DELETE /api/bots/{id}", { ids: ids.bot });

    // Each operation answered with success at least once (the stream has its own part).
    expect(
      operations
        .map(({ method, path }) => `${method} ${path}`)
        .filter((operation) => operation !== "GET /api/stream" && !succeeded.has(operation)),
    ).toEqual([]);

    await call("GET /api/nope");
    await backend.request("/api/health", { headers: { host: "evil.com" } });

    // 3. The stream: read until the test event comes, so that the check reads real frames.
    const abort = new AbortController();
    const stream = await backend.stream("/api/stream", { signal: abort.signal });
    if (stream.body === null) throw new Error("The stream has no body.");
    const frames = collect(readFrames(stream.body));
    await backend.postTestEvent("note-for-the-key-test");
    const deadline = Date.now() + 2000;
    while (!frames.items.some((frame) => frame.data?.includes("note-for-the-key-test") === true)) {
      if (Date.now() > deadline) throw new Error("The test event did not come on the stream.");
      await sleep(10);
    }
    abort.abort();
    texts.push(JSON.stringify(frames.items));

    expect(backend.secrets).toContain(SENTINEL);
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
