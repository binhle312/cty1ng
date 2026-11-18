import { focusManager } from "@tanstack/react-query";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { fakeApi } from "../../../test/fake-api.ts";
import { type Bot, BOT_SETTINGS, makeBot } from "../../../test/fixtures.ts";
import { renderApp } from "../../../test/render-app.tsx";
import { log } from "../../lib/log.ts";

// The code of the header roster fails to load (requirements/app-shell.md, "Errors"): the header
// keeps the avatars, with nothing to press, and the rest of the app works. The import of the
// roster chunk fails because its module cannot load.
vi.mock("./header-roster.tsx", () => {
  throw new Error("The roster chunk did not load");
});

const BA = makeBot(1, "BA");
const QA = makeBot(2, "QA");
const UX = makeBot(3, "UX");

const header = () => screen.getByRole("banner", { name: "Bots" });
// A bot avatar is decoration (an SVG slime) inside the header; the failed roster has no other
// SVG, because it drops the slot with the pin icon.
const avatarsShown = () => header().querySelectorAll("svg").length;

let api: ReturnType<typeof fakeApi> | null = null;
let consoleSpies: MockInstance[] = [];

beforeEach(() => {
  // React reports the caught error on the console; this test makes it on purpose.
  consoleSpies = [
    vi.spyOn(console, "error").mockImplementation(() => undefined),
    vi.spyOn(console, "warn").mockImplementation(() => undefined),
  ];
});

afterEach(() => {
  api?.restore();
  api = null;
  focusManager.setFocused(undefined);
  for (const spy of consoleSpies) spy.mockRestore();
  vi.restoreAllMocks();
});

function serve(lists: Bot[][]) {
  let call = 0;
  api = fakeApi({
    "GET /api/settings": () => ({ body: BOT_SETTINGS }),
    "GET /api/skills": () => ({ body: [] }),
    "GET /api/bots": () => {
      const list = lists[Math.min(call, lists.length - 1)];
      call += 1;
      return { body: list };
    },
  });
  return api;
}

async function failedRoster() {
  await waitFor(
    () => {
      expect(avatarsShown()).toBeGreaterThan(0);
      expect(header().querySelector("[aria-busy]")).toBeNull();
    },
    { timeout: 5000 },
  );
}

describe("the header when the roster chunk fails to load", () => {
  it("shows the avatars with no busy flag and no drag text", async () => {
    serve([[BA, QA]]);
    await renderApp("/");
    await failedRoster();
    expect(avatarsShown(), "the avatars").toBe(2);
    expect(screen.queryByText("Drag a bot here to pin it"), "the drag slot").toBeNull();
  });

  it("writes one log line", async () => {
    serve([[BA, QA]]);
    const logError = vi.spyOn(log, "error");
    await renderApp("/");
    await failedRoster();
    expect(logError.mock.calls).toEqual([["roster_load_failed", { name: "Error" }]]);
  });

  it("keeps the rail links working", async () => {
    serve([[BA, QA]]);
    const { router } = await renderApp("/skills");
    await failedRoster();
    act(() => {
      fireEvent.click(screen.getByRole("link", { name: "Home" }));
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    expect(screen.queryByRole("heading", { name: "Something went wrong" })).toBeNull();
  });

  it("follows a new bot list with no second log line", async () => {
    const fake = serve([
      [BA, QA],
      [BA, QA, UX],
    ]);
    const logError = vi.spyOn(log, "error");
    await renderApp("/");
    await failedRoster();
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => {
      expect(fake.sent("GET", "/api/bots").length).toBeGreaterThanOrEqual(2);
    });
    await waitFor(() => {
      expect(avatarsShown()).toBe(3);
    });
    expect(header().querySelector("[aria-busy]")).toBeNull();
    expect(logError.mock.calls, "the log lines").toHaveLength(1);
  });
});
