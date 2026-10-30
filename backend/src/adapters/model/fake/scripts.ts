import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";

// Fake model scripts (testing.md §2): YAML files keyed by bot slug, plus the reserved `_titles`
// key for title requests (D46). M0 has the loader only; the fake model that plays the scripts
// comes with the agent (M3).

// A tool call is one tool name with its arguments. `force` makes the agent test helper return
// an error or an empty result instead of running the tool.
const Force = z.union([z.literal("empty"), z.object({ error: z.string().min(1) }).strict()]);
const ToolCall = z
  .record(z.string().regex(/^[a-z_]+$/), z.looseObject({ force: Force.optional() }))
  .refine((call) => Object.keys(call).length === 1, "A tool call names exactly one tool");

const BotTurn = z
  .object({
    when_contains: z.string().min(1).optional(),
    tool_calls: z.array(ToolCall).optional(),
    reply: z.string().optional(),
  })
  .strict();

const TitleTurn = z
  .object({
    when_contains: z.string().min(1).optional(),
    title: z.string().optional(),
    fail: z.enum(["error", "timeout", "empty"]).optional(),
    delay_ms: z.number().int().nonnegative().optional(),
  })
  .strict()
  .refine(
    (turn) => (turn.title === undefined) !== (turn.fail === undefined),
    "Give a title or a fail",
  );

// Bot slugs are kebab case and never contain `_` (D19), so `_titles` never collides.
const BOT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const FakeScript = z
  .object({ _titles: z.array(TitleTurn).optional() })
  .catchall(z.array(BotTurn))
  .superRefine((script, ctx) => {
    for (const key of Object.keys(script)) {
      if (key !== "_titles" && !BOT_SLUG.test(key)) {
        ctx.addIssue({ code: "custom", path: [key], message: "Not a bot slug" });
      }
    }
  });
export type FakeScript = z.infer<typeof FakeScript>;

export function parseFakeScript(text: string, source: string): FakeScript {
  const result = FakeScript.safeParse(parse(text));
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(
      `${source}: ${issue?.path.map(String).join(".") ?? ""} ${issue?.message ?? ""}`.trim(),
    );
  }
  return result.data;
}

// Reads every `*.yaml` file of a folder, keyed by file name without the extension.
export function loadFakeScripts(folder: string): Map<string, FakeScript> {
  const scripts = new Map<string, FakeScript>();
  for (const name of readdirSync(folder)
    .filter((file) => file.endsWith(".yaml"))
    .sort()) {
    scripts.set(
      name.slice(0, -".yaml".length),
      parseFakeScript(readFileSync(join(folder, name), "utf8"), name),
    );
  }
  return scripts;
}
