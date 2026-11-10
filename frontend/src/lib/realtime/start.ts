import { STREAM_RETRY_MS } from "@cty1ng/shared/events";
import type { QueryClient } from "@tanstack/react-query";
import { createEventReducer } from "./reducer.ts";
import { connectSse } from "./sse.ts";
import {
  isLiveStream,
  type LifeAction,
  type LifeEvent,
  startLife,
  stepLife,
} from "./stream-life.ts";
import type { Connect } from "./transport.ts";

// The part of `document` that tells if the tab is visible.
export type Page = Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;

export interface RealtimeOptions {
  connect?: Connect;
  page?: Page;
  retryMs?: number;
}

// Holds the app's stream while the tab is visible and feeds the reducer, for the life of the
// page. stream-life.ts owns the rules and the state; this is its boundary: it gives the events
// and does the actions.
export function startRealtime(
  queryClient: QueryClient,
  { connect = connectSse, page = document, retryMs = STREAM_RETRY_MS }: RealtimeOptions = {},
): void {
  let closeStream: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const act = (action: LifeAction) => {
    switch (action.type) {
      case "open": {
        const stream = action.stream;
        // A new stream has no Last-Event-ID, so the server starts it at the newest event. A
        // new reducer takes its cursor from that stream's `ready`; the cursor of the stream
        // before can be higher than a new database gives.
        const reducer = createEventReducer(queryClient);
        closeStream = connect({
          afterSeq: null,
          onEvent: (event) => {
            // A late event of a stream that is not the live one does not reach the reducer.
            if (!isLiveStream(state, stream)) return;
            reducer.apply(event);
            // After the reducer: the stream is live at `ready`, so a read that starts now
            // misses no change.
            if (event.type === "ready") send({ type: "ready", stream });
          },
          onStatus: (status) => {
            // Live indicators never outlive the stream (realtime-events.md §3). M0 has none;
            // M3 clears its "typing" and "working" states here when the status is not "open".
            // A stream that this tab closed reports "closed" too (the close function of
            // sse.ts). The state table ignores that one: the tab is hidden or waits by then.
            if (status === "closed") send({ type: "stopped", stream });
          },
        });
        return;
      }
      case "close": {
        const close = closeStream;
        closeStream = null;
        close?.();
        return;
      }
      case "startTimer": {
        const stream = action.stream;
        timer = setTimeout(() => {
          timer = null;
          send({ type: "timer", stream });
        }, retryMs);
        return;
      }
      case "cancelTimer":
        if (timer !== null) clearTimeout(timer);
        timer = null;
        return;
      case "readAll":
        void queryClient.invalidateQueries();
        return;
      default: {
        const _exhaustive: never = action;
        return _exhaustive;
      }
    }
  };

  const visible = () => page.visibilityState === "visible";
  const first = startLife(visible());
  let state = first.state;
  function send(event: LifeEvent) {
    const step = stepLife(state, event);
    state = step.state;
    step.actions.forEach(act);
  }
  first.actions.forEach(act);

  const onVisibility = () => {
    send({ type: visible() ? "visible" : "hidden" });
  };
  page.addEventListener("visibilitychange", onVisibility);
}
