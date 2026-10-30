// `pnpm gen:api`: the typed API client in frontend/src/lib/api/generated/ (AGENTS.md §5 rule 4),
// from the OpenAPI document of the backend app. The app is built in this process with stub
// services, so no server, port or database is needed. CI runs this and fails when the result
// differs from the committed files (M0 AC5).
//
// Generator: Hey API (M0c plan, decision H). Its TanStack Query plugin makes query and mutation
// *options* (`getHealthOptions()`) that our code passes to TanStack's own hooks
// (`useQuery(getHealthOptions())`); it does not make hooks. Its Zod plugin makes the schemas
// that the SDK uses to check every response.
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@hey-api/openapi-ts";
import { createHttpApp } from "../backend/src/adapters/http/app.ts";
import { createLogger } from "../backend/src/adapters/log/pino-logger.ts";

const REPO = resolve(import.meta.dirname, "..");
export const GENERATED = join(REPO, "frontend/src/lib/api/generated");
const HOST = "127.0.0.1:8000";

// The runtime that Hey API copies into the output (client/, core/) does not pass our
// `exactOptionalPropertyTypes` flag. Those files are not checked; everything made from our
// OpenAPI document is (owner, 2026-10-30).
const UNCHECKED_RUNTIME = ["client", "core"];

async function openApiDocument(): Promise<unknown> {
  const app = createHttpApp({
    log: createLogger({ level: "silent", secrets: [] }),
    allowedHosts: [HOST],
    allowedOrigins: [],
    health: () => Promise.reject(new Error("not used")),
    openStream: () => new ReadableStream(),
    testPing: null,
    apiDocs: false,
    frontendDir: null,
  });
  const response = await app.request(`http://${HOST}/api/openapi.json`, {
    headers: { host: HOST },
  });
  if (!response.ok) throw new Error(`/api/openapi.json answered ${String(response.status)}`);
  return response.json();
}

async function main(): Promise<void> {
  const temp = mkdtempSync(join(tmpdir(), "gen-api-"));
  try {
    const input = join(temp, "openapi.json");
    writeFileSync(input, JSON.stringify(await openApiDocument(), null, 2));
    rmSync(GENERATED, { recursive: true, force: true });
    await createClient({
      input,
      output: GENERATED,
      logs: { level: "silent" },
      plugins: [
        "@hey-api/client-fetch",
        "zod",
        { name: "@hey-api/sdk", validator: true },
        "@tanstack/react-query",
      ],
    });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  for (const folder of UNCHECKED_RUNTIME) {
    for (const name of readdirSync(join(GENERATED, folder))) {
      const file = join(GENERATED, folder, name);
      writeFileSync(file, `// @ts-nocheck\n${readFileSync(file, "utf8")}`);
    }
  }
  console.log(`gen:api: wrote ${GENERATED}`);
}

await main();
