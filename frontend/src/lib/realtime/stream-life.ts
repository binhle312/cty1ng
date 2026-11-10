// When the tab holds a stream (realtime-events.md §3, "Stream life"). The browser allows six
// connections for each host, so only a visible tab holds one. Pure: start.ts gives the events
// and does the actions.
//
// `streams` counts the streams that this tab opened; the newest stream has that number. An
// event carries the number of its stream, so a late event of an older stream changes nothing.
export type StreamLife =
  // The tab is hidden: no stream and no timer.
  | { kind: "idle"; streams: number }
  // `readOnReady`: the tab reads all data again at the first `ready` of this stream.
  | { kind: "live"; streams: number; readOnReady: boolean }
  // The browser stopped the stream for good; the timer for a new one runs.
  | { kind: "waiting"; streams: number };

export type LifeEvent =
  | { type: "hidden" }
  | { type: "visible" }
  // The browser stopped this stream and does not try again.
  | { type: "stopped"; stream: number }
  // The timer that started when this stream stopped.
  | { type: "timer"; stream: number }
  | { type: "ready"; stream: number };

export type LifeAction =
  | { type: "open"; stream: number }
  | { type: "close" }
  | { type: "startTimer"; stream: number }
  | { type: "cancelTimer" }
  | { type: "readAll" };

export interface LifeStep {
  state: StreamLife;
  actions: LifeAction[];
}

const stay = (state: StreamLife): LifeStep => ({ state, actions: [] });

function open(streams: number, readOnReady: boolean): LifeStep {
  const stream = streams + 1;
  return {
    state: { kind: "live", streams: stream, readOnReady },
    actions: [{ type: "open", stream }],
  };
}

// The stream of page start does not read all: the page reads its data at that time. A page that
// starts hidden can show old data when it becomes visible, so its first stream reads.
export function startLife(visible: boolean): LifeStep {
  return visible ? open(0, false) : stay({ kind: "idle", streams: 0 });
}

export function stepLife(state: StreamLife, event: LifeEvent): LifeStep {
  switch (state.kind) {
    case "idle":
      return event.type === "visible" ? open(state.streams, true) : stay(state);
    case "live":
      switch (event.type) {
        case "hidden":
          return { state: { kind: "idle", streams: state.streams }, actions: [{ type: "close" }] };
        case "stopped":
          if (event.stream !== state.streams) return stay(state);
          return {
            state: { kind: "waiting", streams: state.streams },
            actions: [{ type: "close" }, { type: "startTimer", stream: state.streams }],
          };
        case "ready":
          if (event.stream !== state.streams || !state.readOnReady) return stay(state);
          return { state: { ...state, readOnReady: false }, actions: [{ type: "readAll" }] };
        case "visible":
        case "timer":
          return stay(state);
        default: {
          const _exhaustive: never = event;
          return _exhaustive;
        }
      }
    case "waiting":
      switch (event.type) {
        case "hidden":
          return {
            state: { kind: "idle", streams: state.streams },
            actions: [{ type: "cancelTimer" }],
          };
        case "timer":
          return event.stream === state.streams ? open(state.streams, true) : stay(state);
        case "visible":
        case "stopped":
        case "ready":
          return stay(state);
        default: {
          const _exhaustive: never = event;
          return _exhaustive;
        }
      }
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
