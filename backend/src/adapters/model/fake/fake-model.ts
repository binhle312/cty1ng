import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import type { ModelCatalogEntry, ModelProvider } from "../../../core/ports/model";

/** The catalog entry `FAKE_MODEL=1` adds (testing.md §2): always available, no key. */
export const FAKE_CATALOG_ENTRY: ModelCatalogEntry = {
  id: "fake:scripted",
  label: "Fake (scripted)",
  available: true,
  efforts: [],
};

/** One scripted turn. Tool calls are kept as data until the agent exists (M3). */
const ScriptStep = z
  .object({
    when_contains: z.string().min(1).optional(),
    tool_calls: z.array(z.record(z.string(), z.unknown())).optional(),
    reply: z.string(),
  })
  .strict();

/** A script file: bot slug → turns, tried in order (testing.md §2). */
export const FakeScript = z.record(z.string().regex(/^[a-z0-9-]+$/), z.array(ScriptStep));
export type FakeScript = z.infer<typeof FakeScript>;

/** Reads and validates every `*.yaml` script in a folder, merged by bot slug. */
export function loadFakeScripts(dir: string): FakeScript {
  const merged: FakeScript = {};
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".yaml"))
    .sort();
  for (const name of files) {
    const parsed = FakeScript.safeParse(parse(readFileSync(join(dir, name), "utf8")));
    if (!parsed.success) {
      throw new Error(`fake model script ${name} is invalid: ${z.prettifyError(parsed.error)}`);
    }
    for (const [slug, steps] of Object.entries(parsed.data)) {
      merged[slug] = [...(merged[slug] ?? []), ...steps];
    }
  }
  return merged;
}

/** The fake model provider. M0 has the catalog entry and the scripts; replies come in M3. */
export function createFakeModel(input: { scriptsDir: string }): ModelProvider & {
  scripts: FakeScript;
} {
  return { catalog: [FAKE_CATALOG_ENTRY], scripts: loadFakeScripts(input.scriptsDir) };
}
