import { createHash } from "node:crypto";
import {
  avatarUrl,
  botNameKey,
  botSlugBase,
  botSlugCandidate,
  BUILT_AVATAR_STYLES,
  cloneNameCandidate,
  isReservedBotSlug,
  normaliseBotName,
  type AvatarStyle,
  type Bot,
  type BotDetail,
  type BotPin,
  type BotTextField,
  type CloneTemplate,
  type CreateBotBody,
  type PatchBotBody,
  type PinState,
} from "@cty1ng/shared/bots";
import { BotId, SkillId, type SkillVersionId } from "@cty1ng/shared/ids";
import { modelAvailability, type Catalog } from "../catalog/catalog.rules.ts";
import { DomainError } from "../errors.ts";
import type { AppendEvent } from "../events/append-event.ts";
import { appendTrashChanged } from "../events/trash-changed.ts";
import type { AvatarFiles } from "../ports/avatar-files.ts";
import type { Clock } from "../ports/clock.ts";
import type { Ids } from "../ports/ids.ts";
import type {
  BotPinView,
  BotRecord,
  BotsReader,
  Readers,
  SettingsReader,
  SkillsReader,
  Tx,
  UnitOfWork,
} from "../ports/repositories.ts";
import { readSettings } from "../settings/settings.service.ts";
import {
  advancedProblem,
  botGuardProblem,
  botHealth,
  botLimitProblem,
  botTextProblem,
  orderBots,
  resolveEffort,
  type AdvancedField,
  type BotProblem,
} from "./bot.rules.ts";
import { effectiveToolSettings, toolSettingsProblem } from "./tool-settings.rules.ts";

// Bots (domain-model.md §2, api.md §4, D7, D19, D50, D55). `model_id` and `effort` are set once,
// at insert. Every change writes its event in the same transaction. Pins and the pinned order
// raise no `row_version`, so they never make an open Profile edit stale.

export interface BotsDeps {
  uow: UnitOfWork;
  readers: Readers;
  appendEvent: AppendEvent;
  clock: Clock;
  ids: Ids;
  catalog: Catalog;
  avatarFiles: AvatarFiles;
}

export interface SkillPinChange {
  botId: BotId;
  // The version the card showed for this bot; null when it had no pin.
  expectedSkillVersionId: SkillVersionId | null;
  alwaysLoad?: boolean | undefined;
}

const ADVANCED: readonly AdvancedField[] = [
  "history_share_pct",
  "request_limit",
  "max_reply_chars",
];

export function avatarPathOf(avatarId: string): string {
  return `avatars/${avatarId}.webp`;
}

export function avatarIdOfPath(path: string): string {
  return path.replace(/^avatars\//, "").replace(/\.webp$/, "");
}

export function createBotsService(deps: BotsDeps) {
  const { uow, readers, clock, catalog, avatarFiles } = deps;

  // --- reading --------------------------------------------------------------------------------

  function shape(bot: BotRecord, pins: readonly BotPinView[]): Bot {
    const model = catalog.model(bot.modelId);
    const availability = modelAvailability(catalog, bot.modelId);
    const avatarId = bot.avatarPath === null ? null : avatarIdOfPath(bot.avatarPath);
    return {
      id: bot.id,
      slug: bot.slug,
      name: bot.name,
      row_version: bot.rowVersion,
      description: bot.description,
      persona_md: bot.personaMd,
      avatar_style: bot.avatarStyle,
      avatar_colour: bot.avatarColour,
      avatar_id: avatarId,
      avatar_url: avatarId === null ? null : avatarUrl(avatarId),
      model_id: bot.modelId,
      model_label: model?.label ?? null,
      effort: bot.effort,
      request_limit: bot.requestLimit,
      max_reply_chars: bot.maxReplyChars,
      history_share_pct: bot.historySharePct,
      tool_settings: effectiveToolSettings(
        bot.toolSettings,
        catalog.tools,
        model ?? { provider_tools: [], multimodal: false },
      ),
      cloned_from_bot_id: bot.clonedFromBotId,
      available: availability.available,
      unavailable_reason: availability.reason,
      pins: pins.map(pinShape),
      pinned_position: bot.pinnedPosition,
      // M2 has no messages or runs (api.md §4).
      last_activity_at: null,
      counts: {
        skills: pins.length,
        skill_updates: pins.filter((pin) => pin.version < pin.latestVersion).length,
        projects: 0,
        conversations: 0,
      },
      status: { state: "idle" },
      health: botHealth(availability, pins),
      created_at: bot.createdAt.toISOString(),
      updated_at: bot.updatedAt.toISOString(),
    };
  }

  async function shapeOf(reader: BotsReader, bot: BotRecord): Promise<Bot> {
    return shape(bot, await reader.pins(bot.id));
  }

  // A bot that a page may show or change: 404, 422 `bot_deleted` in Trash, 410 when purged.
  async function liveBot(reader: BotsReader, id: BotId): Promise<BotRecord> {
    const bot = await reader.byId(id);
    if (bot === null) throw new DomainError("not_found", "No such bot.");
    if (bot.purgedAt !== null)
      throw new DomainError("bot_purged", "This bot was deleted for good.");
    if (bot.deletedAt !== null) {
      throw new DomainError("bot_deleted", "This bot is in Trash. Restore it first.");
    }
    return bot;
  }

  async function emitBot(
    tx: Tx,
    type: "bot.created" | "bot.updated" | "bot.deleted" | "bot.restored",
    id: BotId,
  ): Promise<Bot> {
    const bot = await tx.bots.byId(id);
    if (bot === null) throw new Error(`bot ${id} vanished in its own transaction`);
    const data = { bot: await shapeOf(tx.bots, bot) };
    await deps.appendEvent(tx, { event: { type, data }, conversationId: null });
    return data.bot;
  }

  async function emitReordered(tx: Tx): Promise<void> {
    await deps.appendEvent(tx, {
      event: { type: "bots.reordered", data: { pinned_bot_ids: await tx.bots.pinnedIds() } },
      conversationId: null,
    });
  }

  // --- checks shared by create and update -----------------------------------------------------

  function fail(problem: BotProblem | null): void {
    if (problem !== null) throw new DomainError(problem.code, problem.message, problem.field);
  }

  async function avatarFor(
    style: AvatarStyle,
    avatarId: string | undefined,
    current: string | null,
  ): Promise<string | null> {
    if (!BUILT_AVATAR_STYLES.includes(style)) {
      throw new DomainError("validation_error", "Pick Flat or Upload.", "avatar_style");
    }
    if (style !== "upload") return null;
    if (avatarId === undefined) {
      if (current !== null) return current;
      throw new DomainError("validation_error", "Upload an image first.", "avatar_id");
    }
    // The file must exist when the row that names it commits (domain-model.md §2 Avatar files).
    if (!(await avatarFiles.exists(avatarId))) {
      throw new DomainError("validation_error", "Upload the image again.", "avatar_id");
    }
    return avatarPathOf(avatarId);
  }

  async function assertNameFree(tx: Tx, nameKey: string, self: BotId | null): Promise<void> {
    const holder = await tx.bots.nameKeyHolder(nameKey);
    if (holder !== null && holder.id !== self) {
      throw new DomainError(
        "name_taken",
        `${holder.name} is taken by another bot, maybe one in Trash. Pick another name.`,
        "name",
      );
    }
  }

  async function freeSlug(tx: Tx, name: string): Promise<string> {
    const base = botSlugBase(name);
    for (let n = 1; ; n += 1) {
      const slug = botSlugCandidate(base, n);
      if (!isReservedBotSlug(slug) && !(await tx.bots.slugTaken(slug))) return slug;
    }
  }

  // The pins of a create body, checked inside the transaction (domain-model.md §2: Trash,
  // versions, deprecation, and the clone rule).
  async function pinsFor(
    tx: Tx,
    body: CreateBotBody,
  ): Promise<{ skillId: SkillId; skillVersionId: SkillVersionId; alwaysLoad: boolean }[]> {
    const source =
      body.cloned_from_bot_id === undefined ? null : await tx.bots.byId(body.cloned_from_bot_id);
    const sourcePins =
      source === null || source.deletedAt !== null ? [] : await tx.bots.pins(source.id);
    const seen = new Set<string>();
    const result = [];
    for (const [index, pin] of body.pins.entries()) {
      const field = `pins[${String(index)}]`;
      const skill = await tx.skills.byId(pin.skill_id);
      if (skill === null || skill.trashedAt !== null) {
        throw new DomainError(
          "validation_error",
          "This skill is in Trash. Untick it, or restore the skill first.",
          field,
        );
      }
      if (seen.has(skill.id)) {
        throw new DomainError("validation_error", "This skill is listed twice.", field);
      }
      seen.add(skill.id);
      const version =
        pin.skill_version_id === undefined
          ? await tx.skills.latestVersion(skill.id)
          : await tx.skills.versionById(pin.skill_version_id);
      if (version?.skillId !== skill.id) {
        throw new DomainError(
          "validation_error",
          "This version is not a version of the skill.",
          field,
        );
      }
      if (skill.deprecatedAt !== null) {
        const cloned = sourcePins.some(
          (sourcePin) => sourcePin.skillId === skill.id && sourcePin.skillVersionId === version.id,
        );
        if (!cloned) {
          throw new DomainError(
            "skill_deprecated",
            `${skill.name} is deprecated. Untick it, or make it active again.`,
            field,
          );
        }
      }
      result.push({ skillId: skill.id, skillVersionId: version.id, alwaysLoad: pin.always_load });
    }
    return result;
  }

  // --- the use cases ------------------------------------------------------------------------

  async function list(): Promise<Bot[]> {
    const settings = await readSettings(readers.settings);
    const bots = orderBots(
      (await readers.bots.list()).map((bot) => ({ ...bot, lastActivityAt: null })),
      settings,
    );
    return Promise.all(bots.map((bot) => shapeOf(readers.bots, bot)));
  }

  async function get(id: BotId): Promise<BotDetail> {
    const bot = await liveBot(readers.bots, id);
    return { ...(await shapeOf(readers.bots, bot)), conversations: [] };
  }

  // POST /bots. `key` is the Idempotency-Key; `body` the parsed body before defaults. Returns the
  // bot and whether this call created it (a repeat returns the first bot).
  function create(
    body: CreateBotBody,
    key: string,
    actor: string,
  ): Promise<{ bot: Bot; created: boolean }> {
    const requestHash = createHash("sha256").update(canonicalJson(body)).digest("hex");
    return uow.run(async (tx) => {
      // The key lookup comes before every check of data that can change (domain-model.md §2).
      const earlier = await tx.bots.byCreateKey(key);
      if (earlier !== null) {
        if (earlier.createRequestHash !== requestHash) {
          throw new DomainError(
            "idempotency_key_reused",
            "This request key was used for another bot. Reload the page.",
          );
        }
        return { bot: await shapeOf(tx.bots, earlier), created: false };
      }
      // The checks in the order of the M2 plan §4, so an invalid body always reports the same
      // first error: catalog and key → effort → skills and the clone rule → tool settings →
      // guard → limits; then the avatar file, the name key and the slug.
      const availability = modelAvailability(catalog, body.model_id);
      const model = catalog.model(body.model_id);
      if (model === undefined || !availability.available) {
        throw new DomainError(
          "model_not_available",
          model === undefined
            ? "This model is no longer in the app. Pick another model."
            : `The API key is not set: ${model.api_key_env ?? "unknown"}. Pick another model.`,
          "model_id",
        );
      }
      const effort = resolveEffort(model, body.effort);
      if ("code" in effort) fail(effort);
      if (body.cloned_from_bot_id !== undefined) {
        if ((await tx.bots.byId(body.cloned_from_bot_id)) === null) {
          throw new DomainError(
            "validation_error",
            "The bot to copy does not exist.",
            "cloned_from_bot_id",
          );
        }
      }
      const pins = await pinsFor(tx, body);
      const toolBody = body.tool_settings ?? {};
      fail(toolSettingsProblem(toolBody, {}, catalog.tools, model));
      const name = normaliseBotName(body.name);
      const texts: [BotTextField, string][] = [
        ["name", name],
        ["description", body.description],
        ["persona_md", body.persona_md],
      ];
      for (const [field, value] of texts) fail(botGuardProblem(field, value));
      const settings = await readSettings(tx.settings);
      for (const [field, value] of texts) fail(botLimitProblem(field, value, settings));
      const values = {
        history_share_pct: body.history_share_pct ?? settings.bot_default_history_pct,
        request_limit: body.request_limit ?? settings.bot_default_request_limit,
        max_reply_chars: body.max_reply_chars ?? settings.bot_default_max_reply_chars,
      };
      for (const field of ADVANCED) fail(advancedProblem(field, values[field], settings));
      const avatarPath = await avatarFor(body.avatar_style, body.avatar_id, null);
      const nameKey = botNameKey(name);
      await assertNameFree(tx, nameKey, null);
      const now = clock.now();
      const id = BotId.parse(deps.ids.newId("bot"));
      const inserted = await tx.bots.insertBot({
        id,
        slug: await freeSlug(tx, name),
        name,
        nameKey,
        rowVersion: 1,
        description: body.description,
        personaMd: body.persona_md,
        avatarStyle: body.avatar_style,
        avatarColour: body.avatar_colour,
        avatarPath,
        modelId: model.id,
        effort: "code" in effort ? null : effort.effort,
        requestLimit: values.request_limit,
        maxReplyChars: values.max_reply_chars,
        historySharePct: values.history_share_pct,
        toolSettings: effectiveToolSettings(toolBody, catalog.tools, model),
        clonedFromBotId: body.cloned_from_bot_id ?? null,
        createKey: key,
        createRequestHash: requestHash,
        pinnedPosition: null,
        createdBy: actor,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        purgedAt: null,
      });
      // One writer at a time makes the checks above final; this is the last guard.
      if (!inserted) throw new DomainError("name_taken", "This name or slug is taken.", "name");
      for (const pin of pins) {
        await tx.bots.upsertPin({ botId: id, ...pin, addedAt: now, updatedAt: now });
      }
      return { bot: await emitBot(tx, "bot.created", id), created: true };
    });
  }

  // PATCH /bots/{id}: one save of the Profile or Model tab. Only the fields sent are checked.
  function update(id: BotId, patch: PatchBotBody): Promise<Bot> {
    return uow.run(async (tx) => {
      const bot = await liveBot(tx.bots, id);
      if (bot.rowVersion !== patch.row_version) throw stale();
      const settings = await readSettings(tx.settings);
      const change: Parameters<Tx["bots"]["updateBot"]>[1] = {};
      if (patch.name !== undefined) {
        const name = normaliseBotName(patch.name);
        fail(botTextProblem("name", name, settings));
        const nameKey = botNameKey(name);
        await assertNameFree(tx, nameKey, id);
        Object.assign(change, { name, nameKey });
      }
      if (patch.description !== undefined) {
        fail(botTextProblem("description", patch.description, settings));
        change.description = patch.description;
      }
      if (patch.persona_md !== undefined) {
        fail(botTextProblem("persona_md", patch.persona_md, settings));
        change.personaMd = patch.persona_md;
      }
      if (patch.avatar_colour !== undefined) change.avatarColour = patch.avatar_colour;
      if (patch.avatar_style !== undefined || patch.avatar_id !== undefined) {
        const style = patch.avatar_style ?? bot.avatarStyle;
        change.avatarStyle = style;
        change.avatarPath = await avatarFor(style, patch.avatar_id, bot.avatarPath);
      }
      for (const field of ADVANCED) {
        const value = patch[field];
        if (value === undefined) continue;
        fail(advancedProblem(field, value, settings));
      }
      if (patch.history_share_pct !== undefined) change.historySharePct = patch.history_share_pct;
      if (patch.request_limit !== undefined) change.requestLimit = patch.request_limit;
      if (patch.max_reply_chars !== undefined) change.maxReplyChars = patch.max_reply_chars;
      if (patch.tool_settings !== undefined) {
        // With its model gone from the catalog, the bot's tools are unknown: a save would store
        // every provider tool off and lose the owner's choices if the model comes back.
        const model = catalog.model(bot.modelId);
        if (model === undefined) {
          throw new DomainError(
            "model_not_available",
            "This bot's model is no longer in the app, so its tools cannot change. Clone the bot to pick another model.",
            "tool_settings",
          );
        }
        fail(toolSettingsProblem(patch.tool_settings, bot.toolSettings, catalog.tools, model));
        change.toolSettings = effectiveToolSettings(
          { ...bot.toolSettings, ...patch.tool_settings },
          catalog.tools,
          model,
        );
      }
      const now = clock.now();
      change.updatedAt = now;
      if (!(await tx.bots.updateBot(id, change, patch.row_version))) throw stale();
      await touchIfUnused(tx, bot.avatarPath, change.avatarPath, now);
      return emitBot(tx, "bot.updated", id);
    });
  }

  // A save that drops the last row naming a file starts its grace period again (domain-model.md
  // §2 Avatar files), in the same write lock.
  async function touchIfUnused(
    tx: Tx,
    before: string | null,
    after: string | null | undefined,
    now: Date,
  ): Promise<void> {
    if (before === null || after === undefined || after === before) return;
    if ((await tx.bots.avatarPaths()).has(before)) return;
    await avatarFiles.touch(avatarIdOfPath(before), now);
  }

  // DELETE /bots/{id}: the move to Trash (D50). Unpins the bot and closes the gap.
  function trash(id: BotId): Promise<Bot> {
    return uow.run(async (tx) => trashInTx(tx, await liveBot(tx.bots, id)));
  }

  async function trashInTx(tx: Tx, bot: BotRecord): Promise<Bot> {
    const now = clock.now();
    const wasPinned = bot.pinnedPosition !== null;
    const pinned = (await tx.bots.pinnedIds()).filter((other) => other !== bot.id);
    await tx.bots.updateBot(bot.id, { deletedAt: now, updatedAt: now, pinnedPosition: null });
    if (wasPinned) await tx.bots.setPinnedOrder(pinned);
    const shaped = await emitBot(tx, "bot.deleted", bot.id);
    if (wasPinned) await emitReordered(tx);
    await appendTrashChanged(tx, deps.appendEvent);
    return shaped;
  }

  // `bots restore <slug>` (D50): out of Trash, not pinned. Always works: the name and the slug
  // stayed taken.
  function restoreBySlug(slug: string): Promise<Bot> {
    return uow.run(async (tx) => {
      const bot = await tx.bots.bySlug(slug);
      if (bot?.deletedAt == null || bot.purgedAt !== null) {
        throw new DomainError("not_found", `No bot in Trash has the slug ${slug}.`);
      }
      await tx.bots.updateBot(bot.id, { deletedAt: null, updatedAt: clock.now() });
      const shaped = await emitBot(tx, "bot.restored", bot.id);
      await appendTrashChanged(tx, deps.appendEvent);
      return shaped;
    });
  }

  // PUT /bots/pins: the whole pinned list (domain-model.md §2 Concurrency).
  function setPinned(botIds: readonly BotId[], expectedBotIds: readonly BotId[]): Promise<BotId[]> {
    return uow.run(async (tx) => {
      const current = await tx.bots.pinnedIds();
      const changed = () =>
        new DomainError("bot_list_changed", "The bot list changed. It was loaded again.");
      if (!sameList(current, expectedBotIds)) throw changed();
      if (new Set(botIds).size !== botIds.length) throw changed();
      for (const id of botIds) {
        const bot = await tx.bots.byId(id);
        if (bot === null || bot.deletedAt !== null) throw changed();
      }
      await tx.bots.setPinnedOrder(botIds);
      await emitReordered(tx);
      return tx.bots.pinnedIds();
    });
  }

  // GET /bots/{id}/clone-template (domain-model.md §2 Clone). A bot in Trash or purged has no
  // clone template: both get 422 `bot_deleted`, not the 410 that `liveBot` gives a purged bot.
  async function cloneTemplate(id: BotId): Promise<CloneTemplate> {
    const bot = await readers.bots.byId(id);
    if (bot === null) throw new DomainError("not_found", "No such bot.");
    if (bot.deletedAt !== null || bot.purgedAt !== null) {
      throw new DomainError(
        "bot_deleted",
        "This bot is in Trash or deleted, so it cannot be cloned.",
      );
    }
    const settings = await readSettings(readers.settings);
    let n = 1;
    let name = cloneNameCandidate(bot.name, n, settings.bot_name_max);
    while ((await readers.bots.nameKeyHolder(botNameKey(name))) !== null) {
      n += 1;
      name = cloneNameCandidate(bot.name, n, settings.bot_name_max);
    }
    const pins = await readers.bots.pins(bot.id);
    const avatarId = bot.avatarPath === null ? undefined : avatarIdOfPath(bot.avatarPath);
    const model = catalog.model(bot.modelId);
    return {
      name,
      description: bot.description,
      persona_md: bot.personaMd,
      avatar_style: bot.avatarStyle,
      ...(avatarId === undefined ? {} : { avatar_id: avatarId }),
      model_id: bot.modelId,
      effort: bot.effort,
      history_share_pct: bot.historySharePct,
      request_limit: bot.requestLimit,
      max_reply_chars: bot.maxReplyChars,
      tool_settings: effectiveToolSettings(
        bot.toolSettings,
        catalog.tools,
        model ?? { provider_tools: [], multimodal: false },
      ),
      pins: pins.map((pin) => ({
        skill_id: pin.skillId,
        skill_version_id: pin.skillVersionId,
        always_load: pin.alwaysLoad,
      })),
      cloned_from_bot_id: bot.id,
    };
  }

  // PUT /bots/{id}/skills/{skill_id}: assign, upgrade, downgrade, toggle.
  function setPin(
    botId: BotId,
    skillId: SkillId,
    body: { skill_version_id: SkillVersionId; always_load: boolean; expected: PinState | null },
  ): Promise<Bot> {
    return uow.run(async (tx) => {
      await liveBot(tx.bots, botId);
      const skill = await liveSkill(tx.skills, skillId);
      const current = (await tx.bots.pins(botId)).find((pin) => pin.skillId === skillId);
      const currentState: PinState | null =
        current === undefined
          ? null
          : { skill_version_id: current.skillVersionId, always_load: current.alwaysLoad };
      if (!samePin(currentState, body.expected)) {
        throw new DomainError(
          "stale_write",
          "This skill changed on the bot since you opened the page.",
          undefined,
          currentState,
        );
      }
      const version = await tx.skills.versionById(body.skill_version_id);
      if (version?.skillId !== skillId) {
        throw new DomainError(
          "validation_error",
          "This version is not a version of the skill.",
          "skill_version_id",
        );
      }
      if (current === undefined && skill.deprecatedAt !== null) throw deprecated(skill.name);
      const now = clock.now();
      await tx.bots.upsertPin({
        botId,
        skillId,
        skillVersionId: version.id,
        alwaysLoad: body.always_load,
        addedAt: current?.addedAt ?? now,
        updatedAt: now,
      });
      return emitBot(tx, "bot.updated", botId);
    });
  }

  // DELETE /bots/{id}/skills/{skill_id}: 204 also when the pin is already gone.
  function removePin(botId: BotId, skillId: SkillId): Promise<void> {
    return uow.run(async (tx) => {
      await liveBot(tx.bots, botId);
      if (await tx.bots.deletePin(botId, skillId)) await emitBot(tx, "bot.updated", botId);
    });
  }

  // POST /skills/{id}/bots: the upgrade and assign cards (api.md §2). All or nothing.
  function pinSkillToBots(
    skillId: SkillId,
    skillVersionId: SkillVersionId,
    changes: readonly SkillPinChange[],
  ): Promise<Bot[]> {
    return uow.run(async (tx) => {
      const skill = await liveSkill(tx.skills, skillId);
      const version = await tx.skills.versionById(skillVersionId);
      if (version?.skillId !== skillId) {
        throw new DomainError(
          "validation_error",
          "This version is not a version of the skill.",
          "skill_version_id",
        );
      }
      const now = clock.now();
      const result: Bot[] = [];
      for (const [index, change] of changes.entries()) {
        const field = `bots[${String(index)}]`;
        const bot = await tx.bots.byId(change.botId);
        if (bot === null || bot.purgedAt !== null) {
          throw new DomainError("validation_error", "No such bot.", field);
        }
        if (bot.deletedAt !== null) {
          throw new DomainError("place_in_trash", `${bot.name} is in Trash.`, field);
        }
        const current = (await tx.bots.pins(bot.id)).find((pin) => pin.skillId === skillId);
        if ((current?.skillVersionId ?? null) !== change.expectedSkillVersionId) {
          throw new DomainError(
            "stale_write",
            `${bot.name} changed since the card was shown. Nothing moved.`,
            field,
          );
        }
        if (current === undefined && skill.deprecatedAt !== null) throw deprecated(skill.name);
        await tx.bots.upsertPin({
          botId: bot.id,
          skillId,
          skillVersionId,
          alwaysLoad: change.alwaysLoad ?? current?.alwaysLoad ?? false,
          addedAt: current?.addedAt ?? now,
          updatedAt: now,
        });
        result.push(await emitBot(tx, "bot.updated", bot.id));
      }
      return result;
    });
  }

  // Emits `bot.updated` for a bot whose pins a skill endpoint changed (deprecate, skill Trash).
  async function emitPinsChanged(tx: Tx, botIds: readonly BotId[]): Promise<void> {
    for (const botId of new Set(botIds)) {
      const bot = await tx.bots.byId(botId);
      if (bot !== null && bot.purgedAt === null) await emitBot(tx, "bot.updated", botId);
    }
  }

  // The purge (D50): the bot becomes a tombstone. The avatar file stays: old messages show it.
  async function purgeInTx(tx: Tx, id: BotId): Promise<void> {
    await tx.bots.tombstone(id, clock.now());
    await deps.appendEvent(tx, {
      event: { type: "bot.purged", data: { bot_id: id } },
      conversationId: null,
    });
    await appendTrashChanged(tx, deps.appendEvent);
  }

  // The purge job (architecture.md §6.1): each bot whose `deleted_at + trash_days` is at or
  // before now, one per transaction.
  async function purgeDue(): Promise<number> {
    const now = clock.now();
    const cutoff = async (reader: SettingsReader): Promise<Date> =>
      new Date(now.getTime() - (await readSettings(reader)).trash_days * 86_400_000);
    let purged = 0;
    for (const id of await readers.bots.trashedUntil(await cutoff(readers.settings))) {
      const done = await uow.run(async (tx) => {
        const bot = await tx.bots.byId(id);
        if (bot?.deletedAt == null || bot.purgedAt !== null) return false;
        if (bot.deletedAt > (await cutoff(tx.settings))) return false;
        await purgeInTx(tx, id);
        return true;
      });
      if (done) purged += 1;
    }
    return purged;
  }

  return {
    list,
    get,
    create,
    update,
    trash,
    restoreBySlug,
    setPinned,
    cloneTemplate,
    setPin,
    removePin,
    pinSkillToBots,
    emitPinsChanged,
    purgeDue,
  };
}

export type BotsService = ReturnType<typeof createBotsService>;

async function liveSkill(reader: SkillsReader, id: SkillId) {
  const skill = await reader.byId(id);
  if (skill === null || skill.trashedAt !== null) {
    throw new DomainError("not_found", "No such skill.");
  }
  return skill;
}

function pinShape(pin: BotPinView): BotPin {
  return {
    skill_id: pin.skillId,
    skill_slug: pin.skillSlug,
    skill_name: pin.skillName,
    description: pin.description,
    skill_version_id: pin.skillVersionId,
    version: pin.version,
    latest_version: pin.latestVersion,
    always_load: pin.alwaysLoad,
    deprecated: pin.deprecated,
  };
}

function samePin(a: PinState | null, b: PinState | null): boolean {
  if (a === null || b === null) return a === b;
  return a.skill_version_id === b.skill_version_id && a.always_load === b.always_load;
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function deprecated(name: string): DomainError {
  return new DomainError(
    "skill_deprecated",
    `${name} is deprecated. Make it active again before you add it to a bot.`,
  );
}

function stale(): DomainError {
  return new DomainError("stale_write", "The bot changed since you opened it. Reload it.");
}

// JSON with sorted keys and no spaces (domain-model.md §2 Idempotency).
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
