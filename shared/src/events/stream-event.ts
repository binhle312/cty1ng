import { z } from "zod";
import { Bot } from "../bots.ts";
import { BotId, SkillId } from "../ids.ts";
import { Settings } from "../settings.ts";
import { Skill } from "../skills.ts";

// The event envelope and the event types that are built so far (realtime-events.md §1a, §4).
// A persisted event carries `seq` (the SSE `id:`); `ready` and `reset` are stream control
// events and are never persisted, so they have no `seq`.
export const Seq = z.number().int().positive();

// `max_seq` is the high mark: the highest seq ever given, kept or pruned (realtime-events.md §2).
export const ReadyData = z.object({ max_seq: z.number().int().nonnegative() }).strict();
export const ResetData = z.object({}).strict();
export const TestPingData = z.object({ note: z.string().max(200) }).strict();
export const SkillData = z.object({ skill: Skill }).strict();
export const SkillRefData = z.object({ skill_id: SkillId }).strict();
export const BotData = z.object({ bot: Bot }).strict();
export const BotRefData = z.object({ bot_id: BotId }).strict();
export const BotsReorderedData = z.object({ pinned_bot_ids: z.array(BotId) }).strict();
// One count per Trash kind that exists so far (D62): skills (M1) and bots (M2).
export const TrashChangedData = z
  .object({
    counts: z
      .object({ skill: z.number().int().nonnegative(), bot: z.number().int().nonnegative() })
      .strict(),
  })
  .strict();
export const SettingsUpdatedData = z.object({ settings: Settings }).strict();

export const ReadyEvent = z.object({ type: z.literal("ready"), data: ReadyData }).strict();
export const ResetEvent = z.object({ type: z.literal("reset"), data: ResetData }).strict();
// Test only: appended by `POST /api/_test/events` when `APP_ENV=test`.
export const TestPingEvent = z
  .object({ type: z.literal("test.ping"), seq: Seq, data: TestPingData })
  .strict();

const persisted = <const T extends string, D extends z.ZodType>(type: T, data: D) =>
  z.object({ type: z.literal(type), seq: Seq, data }).strict();

// Skills (M1). `skill.updated` covers a rename, a new version, a version restore and
// undeprecate; `skill.trashed` and `skill.purged` carry only the id, because the skill leaves
// every list.
export const SkillCreatedEvent = persisted("skill.created", SkillData);
export const SkillUpdatedEvent = persisted("skill.updated", SkillData);
export const SkillDeprecatedEvent = persisted("skill.deprecated", SkillData);
export const SkillTrashedEvent = persisted("skill.trashed", SkillRefData);
export const SkillRestoredEvent = persisted("skill.restored", SkillData);
export const SkillPurgedEvent = persisted("skill.purged", SkillRefData);
// Bots (M2). `bot.updated` covers a Profile or Model save and every pin change, also pins that a
// skill endpoint moves or removes (one event per bot).
export const BotCreatedEvent = persisted("bot.created", BotData);
export const BotUpdatedEvent = persisted("bot.updated", BotData);
export const BotDeletedEvent = persisted("bot.deleted", BotData);
export const BotRestoredEvent = persisted("bot.restored", BotData);
export const BotPurgedEvent = persisted("bot.purged", BotRefData);
export const BotsReorderedEvent = persisted("bots.reordered", BotsReorderedData);
export const TrashChangedEvent = persisted("trash.changed", TrashChangedData);
export const SettingsUpdatedEvent = persisted("settings.updated", SettingsUpdatedData);

// Every event a client can receive. Adding a type: realtime-events.md §4 first, then here, then
// the frontend reducer; `pnpm check:events` checks the first two agree.
export const StreamEvent = z.discriminatedUnion("type", [
  ReadyEvent,
  ResetEvent,
  TestPingEvent,
  SkillCreatedEvent,
  SkillUpdatedEvent,
  SkillDeprecatedEvent,
  SkillTrashedEvent,
  SkillRestoredEvent,
  SkillPurgedEvent,
  BotCreatedEvent,
  BotUpdatedEvent,
  BotDeletedEvent,
  BotRestoredEvent,
  BotPurgedEvent,
  BotsReorderedEvent,
  TrashChangedEvent,
  SettingsUpdatedEvent,
]);
export type StreamEvent = z.infer<typeof StreamEvent>;
export type EventType = StreamEvent["type"];

export const EVENT_TYPES = StreamEvent.options.map((option) => option.shape.type.value);
