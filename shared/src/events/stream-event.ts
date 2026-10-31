import { z } from "zod";
import { SkillId } from "../ids.ts";
import { Settings } from "../settings.ts";
import { Skill } from "../skills.ts";

// The event envelope and the event types that are built so far (realtime-events.md §1a, §4).
// A persisted event carries `seq` (the SSE `id:`); `ready` and `reset` are stream control
// events and are never persisted, so they have no `seq`.
export const Seq = z.number().int().positive();

export const ReadyData = z.object({ max_seq: z.number().int().nonnegative() }).strict();
export const ResetData = z.object({}).strict();
export const TestPingData = z.object({ note: z.string().max(200) }).strict();
export const SkillData = z.object({ skill: Skill }).strict();
export const SkillRefData = z.object({ skill_id: SkillId }).strict();
// One count per Trash kind that exists so far (D62); M1 has only skills.
export const TrashChangedData = z
  .object({ counts: z.object({ skill: z.number().int().nonnegative() }).strict() })
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
  TrashChangedEvent,
  SettingsUpdatedEvent,
]);
export type StreamEvent = z.infer<typeof StreamEvent>;
export type EventType = StreamEvent["type"];

export const EVENT_TYPES = StreamEvent.options.map((option) => option.shape.type.value);
