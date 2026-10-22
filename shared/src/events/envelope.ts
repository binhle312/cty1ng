import { z } from "zod";

/** Payloads of the events that are written to the `events` table (realtime-events.md §4). */
export const PERSISTED_EVENT_DATA = {
  "test.ping": z.object({ note: z.string().max(200) }).strict(),
} as const;

/** Payloads of the events the stream sends without persisting them. */
export const EPHEMERAL_EVENT_DATA = {
  ready: z.object({ max_seq: z.number().int().nonnegative() }).strict(),
  reset: z.object({}).strict(),
} as const;

export type PersistedEventType = keyof typeof PERSISTED_EVENT_DATA;
export type EphemeralEventType = keyof typeof EPHEMERAL_EVENT_DATA;
export type EventType = PersistedEventType | EphemeralEventType;

export type PersistedEventData<T extends PersistedEventType> = z.infer<
  (typeof PERSISTED_EVENT_DATA)[T]
>;

const Seq = z.number().int().positive();

/** The transport-neutral envelope (realtime-events.md §1a): `{seq, type, data}`. */
export const TestPingEvent = z
  .object({
    seq: Seq,
    type: z.literal("test.ping"),
    data: PERSISTED_EVENT_DATA["test.ping"],
  })
  .strict();
export const ReadyEvent = z
  .object({ type: z.literal("ready"), data: EPHEMERAL_EVENT_DATA.ready })
  .strict();
export const ResetEvent = z
  .object({ type: z.literal("reset"), data: EPHEMERAL_EVENT_DATA.reset })
  .strict();

export const PersistedEvent = z.discriminatedUnion("type", [TestPingEvent]);
export type PersistedEvent = z.infer<typeof PersistedEvent>;

export const StreamEvent = z.discriminatedUnion("type", [TestPingEvent, ReadyEvent, ResetEvent]);
export type StreamEvent = z.infer<typeof StreamEvent>;

export const PERSISTED_EVENT_TYPES = Object.keys(PERSISTED_EVENT_DATA);
export const EVENT_TYPES = [...PERSISTED_EVENT_TYPES, ...Object.keys(EPHEMERAL_EVENT_DATA)];

export function isPersistedEventType(value: string): value is PersistedEventType {
  return Object.hasOwn(PERSISTED_EVENT_DATA, value);
}
