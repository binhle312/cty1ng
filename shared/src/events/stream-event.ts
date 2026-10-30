import { z } from "zod";

// The event envelope and the event types that are built so far (realtime-events.md §1a, §4).
// A persisted event carries `seq` (the SSE `id:`); `ready` and `reset` are stream control
// events and are never persisted, so they have no `seq`.
export const Seq = z.number().int().positive();

export const ReadyData = z.object({ max_seq: z.number().int().nonnegative() }).strict();
export const ResetData = z.object({}).strict();
export const TestPingData = z.object({ note: z.string().max(200) }).strict();

export const ReadyEvent = z.object({ type: z.literal("ready"), data: ReadyData }).strict();
export const ResetEvent = z.object({ type: z.literal("reset"), data: ResetData }).strict();
// Test only: appended by `POST /api/_test/events` when `APP_ENV=test`.
export const TestPingEvent = z
  .object({ type: z.literal("test.ping"), seq: Seq, data: TestPingData })
  .strict();

// Every event a client can receive. Adding a type: realtime-events.md §4 first, then here, then
// the frontend reducer; `pnpm check:events` checks the first two agree.
export const StreamEvent = z.discriminatedUnion("type", [ReadyEvent, ResetEvent, TestPingEvent]);
export type StreamEvent = z.infer<typeof StreamEvent>;
export type EventType = StreamEvent["type"];

export const EVENT_TYPES = StreamEvent.options.map((option) => option.shape.type.value);
