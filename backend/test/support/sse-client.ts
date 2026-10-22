import { StreamEvent } from "@cty1ng/shared";

export interface SseFrame {
  id?: string;
  event?: string;
  data?: string;
  comment?: string;
  retry?: string;
}

/**
 * Reads SSE frames from a response body, as EventSource would, for tests that check the wire
 * format. `events()` yields only the decoded stream events (frames with an `event:` line).
 */
export class SseReader {
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly decoder = new TextDecoder();
  private buffer = "";
  readonly frames: SseFrame[] = [];

  constructor(response: Response) {
    if (response.body === null) throw new Error("response has no body");
    this.reader = response.body.getReader();
  }

  async nextFrame(timeoutMs = 3000): Promise<SseFrame> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const end = this.buffer.indexOf("\n\n");
      if (end !== -1) {
        const raw = this.buffer.slice(0, end);
        this.buffer = this.buffer.slice(end + 2);
        const frame = parseFrame(raw);
        this.frames.push(frame);
        return frame;
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error("timed out waiting for an SSE frame");
      const chunk = await Promise.race([
        this.reader.read(),
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), remaining)),
      ]);
      if (chunk === "timeout") throw new Error("timed out waiting for an SSE frame");
      if (chunk.done) throw new Error("stream ended");
      this.buffer += this.decoder.decode(chunk.value, { stream: true });
    }
  }

  /** The next frame that carries an event, decoded and checked against the shared schema. */
  async nextEvent(timeoutMs = 3000): Promise<StreamEvent> {
    for (;;) {
      const frame = await this.nextFrame(timeoutMs);
      if (frame.event === undefined) continue;
      const seq = frame.id === undefined ? {} : { seq: Number(frame.id) };
      const data: unknown = JSON.parse(frame.data ?? "null");
      return StreamEvent.parse({ type: frame.event, ...seq, data });
    }
  }

  async close(): Promise<void> {
    await this.reader.cancel();
  }
}

function parseFrame(raw: string): SseFrame {
  const frame: SseFrame = {};
  for (const line of raw.split("\n")) {
    if (line.startsWith(":")) {
      frame.comment = line.slice(1).trim();
      continue;
    }
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "id" || field === "event" || field === "data" || field === "retry")
      frame[field] = value;
  }
  return frame;
}
