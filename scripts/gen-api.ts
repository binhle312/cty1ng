// `pnpm gen:api`: the typed API client in frontend/src/lib/api/generated/ (AGENTS.md §5 rule 4),
// from the OpenAPI document of the backend app. The app is composed in this process on a
// temporary data folder, so no server or port is needed and the document is exactly the app's.
// CI runs this and fails when the result
// differs from the committed files (M0 AC5).
//
// Generator: Hey API (M0c plan, decision H). Its TanStack Query plugin makes query and mutation
// *options* (`getHealthOptions()`) that our code passes to TanStack's own hooks
// (`useQuery(getHealthOptions())`); it does not make hooks. Its Zod plugin makes the schemas
// that the SDK uses to check every response; requests are checked by the server only.
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@hey-api/openapi-ts";
import { createLogger } from "../backend/src/adapters/log/pino-logger.ts";
import { compose } from "../backend/src/app/compose.ts";
import { loadConfig } from "../backend/src/app/config.ts";

const REPO = resolve(import.meta.dirname, "..");
export const GENERATED = join(REPO, "frontend/src/lib/api/generated");
const HOST = "127.0.0.1:8000";

// The runtime that Hey API copies into the output (client/, core/) does not pass our
// `exactOptionalPropertyTypes` flag. Those files are not checked; everything made from our
// OpenAPI document is (owner, 2026-10-30).
const UNCHECKED_RUNTIME = ["client", "core"];

async function openApiDocument(): Promise<unknown> {
  const dataDir = mkdtempSync(join(tmpdir(), "gen-api-data-"));
  // APP_ENV=prod: no test routes and no docs page in the document.
  const backend = compose(
    loadConfig({ DATA_DIR: dataDir, APP_ENV: "prod" }),
    createLogger({ level: "silent", secrets: [] }),
  );
  try {
    const response = await backend.app.request(`http://${HOST}/api/openapi.json`, {
      headers: { host: HOST },
    });
    if (!response.ok) throw new Error(`/api/openapi.json answered ${String(response.status)}`);
    return await response.json();
  } finally {
    backend.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
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
        {
          name: "zod",
          // `format: binary` (a zip upload or download) is a Blob or File, as the generated
          // types say; the plugin's default `z.string()` refuses the File before it is sent
          // (M1 plan, probe P6).
          $resolvers: {
            string: (ctx) =>
              ctx.schema.format === "binary"
                ? ctx.$(ctx.plugin.imports.z).attr("instanceof").call(ctx.$("Blob"))
                : undefined,
          },
        },
        // Responses only. The SDK checks a request after it has merged the headers into a
        // `Headers` object, so a required header (the Idempotency-Key of POST /bots) always
        // reads as missing and the call never leaves. The server checks every request anyway
        // (review of PR #57, owner 2026-11-01).
        { name: "@hey-api/sdk", validator: { request: false, response: true } },
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
