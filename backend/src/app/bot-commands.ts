import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { botNameKey } from "@cty1ng/shared/bots";
import { parse } from "yaml";
import { z } from "zod";
import { OWNER_ID } from "../core/owner.ts";
import type { compose } from "./compose.ts";

// The `bots` CLI commands (api.md §2). `trash` (the list) and `restore` are temporary: the M5b Trash page
// replaces them, and M5b removes them. `seed` creates the example bots of `seed/bots.yaml`
// (seed/README.md); it never changes a bot that exists.

type Backend = Pick<ReturnType<typeof compose>, "bots" | "readers" | "catalog">;
type Out = (line: string) => void;

const SeedBots = z.array(
  z
    .object({
      name: z.string(),
      description: z.string(),
      avatar_colour: z.string(),
      persona: z.string(),
      pins: z.array(z.object({ skill: z.string(), always_load: z.boolean() }).strict()),
    })
    .strict(),
);

export async function seedBots(backend: Backend, file: string, out: Out): Promise<number> {
  const bots = SeedBots.parse(parse(readFileSync(file, "utf8")));
  // The first model in catalog order that can run (M2 plan, decision 11).
  const model = backend.catalog.models.find((candidate) => candidate.available);
  if (model === undefined) {
    out("Set a key to seed the bots.");
    return 0;
  }
  for (const bot of bots) {
    if ((await backend.readers.bots.nameKeyHolder(botNameKey(bot.name))) !== null) {
      out(`${bot.name} already exists.`);
      continue;
    }
    const pins = [];
    for (const pin of bot.pins) {
      const skill = await backend.readers.skills.bySlug(pin.skill);
      if (skill === null || skill.trashedAt !== null) {
        out(`${bot.name}: the skill ${pin.skill} is missing. Import the seed skills first.`);
        return 1;
      }
      pins.push({ skill_id: skill.id, always_load: pin.always_load });
    }
    const { bot: created } = await backend.bots.create(
      {
        name: bot.name,
        description: bot.description,
        persona_md: bot.persona,
        avatar_style: "flat",
        avatar_colour: bot.avatar_colour,
        model_id: model.id,
        pins,
      },
      randomUUID(),
      OWNER_ID,
    );
    out(`Created ${created.name} (${created.slug}) with ${model.label}.`);
  }
  return 0;
}

export async function listBotTrash(backend: Backend, out: Out): Promise<number> {
  const trashed = await backend.readers.bots.trashed();
  if (trashed.length === 0) out("Trash has no bots.");
  for (const bot of trashed) {
    out(`${bot.slug}  ${bot.name}  (in Trash since ${bot.deletedAt?.toISOString() ?? "?"})`);
  }
  return 0;
}

export async function restoreBot(backend: Backend, slug: string, out: Out): Promise<number> {
  const bot = await backend.bots.restoreBySlug(slug);
  out(`Restored ${bot.name}. It is not pinned.`);
  return 0;
}
