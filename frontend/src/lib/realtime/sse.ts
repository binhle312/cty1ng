import { EVENT_TYPES, StreamEvent, type EventType } from "@cty1ng/shared/events";
import { log } from "../log.ts";
import type { Connect } from "./transport.ts";

export const STREAM_URL = "/api/stream";

// Control events are not persisted, so they have no seq; their SSE id is only the cursor.
const CONTROL: ReadonlySet<EventType> = new Set(["ready", "reset"]);

// One SSE frame to an event. The frame is outside data until the schema parses it
// (frontend-conventions.md §1, "unknown at boundaries"); a frame that does not parse is
// dropped and logged by its seq only.
export function parseFrame(type: EventType, id: string, data: string): StreamEvent | null {
  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    return null;
  }
  const candidate = CONTROL.has(type)
    ? { type, data: payload }
    : { type, seq: Number(id), data: payload };
  const parsed = StreamEvent.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

// The SSE transport: one EventSource for the app (realtime-events.md §3). A frame with an
// event name that the app does not know yet has no listener, so it is ignored.
export const connectSse: Connect = ({ onEvent, onStatus }) => {
  const source = new EventSource(STREAM_URL);
  onStatus("connecting");
  source.addEventListener("open", () => {
    onStatus("open");
  });
  source.addEventListener("error", () => {
    // EventSource retries by itself unless the server refused the stream.
    onStatus(source.readyState === EventSource.CLOSED ? "closed" : "connecting");
  });
  for (const type of EVENT_TYPES) {
    source.addEventListener(type, (frame) => {
      const event = parseFrame(type, frame.lastEventId, String(frame.data));
      if (event === null) {
        log.warn("stream.invalid_frame", { type, id: frame.lastEventId });
        return;
      }
      onEvent(event);
    });
  }
  return () => {
    source.close();
    onStatus("closed");
  };
};
