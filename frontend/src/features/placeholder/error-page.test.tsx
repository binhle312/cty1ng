import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { type ComponentProps, useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { fakeApi, heldAnswer } from "../../../test/fake-api.ts";
import { BOT_SETTINGS, makeSkill, makeVersions, SKILL_ID } from "../../../test/fixtures.ts";
import { renderApp } from "../../../test/render-app.tsx";
import { SKILL_OR_BOT_QUERIES } from "../../lib/api/operation-queries.ts";
import { log } from "../../lib/log.ts";

// The error screen keeps the shell (requirements/app-shell.md, "Errors"; P3 list item 65). No real
// page throws on purpose, so these tests make one component throw with `vi.mock`; the router, the
// shell, the query client and the fake network stay real (the exception to "Real tests" in
// docs/plans/p3-shell-error-boundary.md, part 5).
const THROWN = "The thrown message 4711";

const fault = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  return {
    index: false,
    history: false,
    fields: false,
    header: false,
    indexRenders: 0,
    listeners,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

vi.mock("../skills/skills-index-page.tsx", async (importOriginal) => {
  const real = await importOriginal<typeof import("../skills/skills-index-page.tsx")>();
  function FaultyIndexPage() {
    fault.indexRenders += 1;
    if (fault.index) throw new Error(THROWN);
    return <real.SkillsIndexPage />;
  }
  return { ...real, SkillsIndexPage: FaultyIndexPage };
});

vi.mock("../skills/skill-history.tsx", async (importOriginal) => {
  const real = await importOriginal<typeof import("../skills/skill-history.tsx")>();
  function FaultyHistory(props: ComponentProps<typeof real.SkillHistory>) {
    if (fault.history) throw new Error(THROWN);
    return <real.SkillHistory {...props} />;
  }
  return { ...real, SkillHistory: FaultyHistory };
});

// The skill fields throw when the test says, while the editor is open.
vi.mock("../skills/skill-fields.tsx", async (importOriginal) => {
  const real = await importOriginal<typeof import("../skills/skill-fields.tsx")>();
  function FaultyFields(props: ComponentProps<typeof real.SkillFields>) {
    const broken = useSyncExternalStore(fault.subscribe, () => fault.fields);
    if (broken) throw new Error(THROWN);
    return <real.SkillFields {...props} />;
  }
  return { ...real, SkillFields: FaultyFields };
});

vi.mock("../shell/top-header.tsx", async (importOriginal) => {
  const real = await importOriginal<typeof import("../shell/top-header.tsx")>();
  function FaultyHeader() {
    if (fault.header) throw new Error(THROWN);
    return <real.TopHeader />;
  }
  return { ...real, TopHeader: FaultyHeader };
});

const pause = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

const rail = () => screen.queryByRole("navigation", { name: "Projects" });
const header = () => screen.queryByRole("banner", { name: "Bots" });
const errorHeading = () => screen.findByRole("heading", { name: "Something went wrong" });

let api: ReturnType<typeof fakeApi> | null = null;
let consoleSpies: MockInstance[] = [];

beforeEach(() => {
  // React and the router report each caught error on the console; these tests throw on purpose.
  consoleSpies = [
    vi.spyOn(console, "error").mockImplementation(() => undefined),
    vi.spyOn(console, "warn").mockImplementation(() => undefined),
  ];
});

afterEach(() => {
  api?.restore();
  api = null;
  for (const spy of consoleSpies) spy.mockRestore();
  vi.restoreAllMocks();
  fault.index = false;
  fault.history = false;
  fault.fields = false;
  fault.header = false;
  fault.indexRenders = 0;
});

function noSkills() {
  api = fakeApi({
    "GET /api/settings": () => ({ body: BOT_SETTINGS }),
    "GET /api/skills": () => ({ body: [] }),
    "GET /api/bots": () => ({ body: [] }),
  });
}

function oneSkill() {
  const skill = makeSkill();
  api = fakeApi({
    "GET /api/settings": () => ({ body: BOT_SETTINGS }),
    "GET /api/skills": () => ({ body: [skill] }),
    [`GET /api/skills/${SKILL_ID}`]: () => ({ body: skill }),
    [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(1) }),
    [`GET /api/skills/${SKILL_ID}/upgrade-candidates`]: () => ({ body: [] }),
    "GET /api/bots": () => ({ body: [] }),
  });
}

describe("the error screen of a page", () => {
  it("shows the error screen inside the shell when a page throws", async () => {
    noSkills();
    fault.index = true;
    await renderApp("/skills");
    const alert = await screen.findByRole("alert", {}, { timeout: 5000 });
    expect(within(alert).getByRole("heading", { name: "Something went wrong" })).toBeTruthy();
    expect(
      within(alert).getByText("The app could not show this page. Try again, or go to Home."),
    ).toBeTruthy();
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(within(alert).getByRole("link", { name: "Go to Home" })).toBeTruthy();
    expect(rail(), "the rail").not.toBeNull();
    expect(header(), "the header").not.toBeNull();
  });

  it("never shows the error message", async () => {
    noSkills();
    fault.index = true;
    await renderApp("/skills");
    await errorHeading();
    expect(document.body.textContent, "the thrown message").not.toContain(THROWN);
  });

  it("writes a caught error to the log", async () => {
    noSkills();
    fault.index = true;
    const logError = vi.spyOn(log, "error");
    await renderApp("/skills");
    await errorHeading();
    expect(logError).toHaveBeenCalledWith("page_error", { name: "Error" });
  });

  it("keeps the error message out of the log", async () => {
    noSkills();
    fault.index = true;
    const logError = vi.spyOn(log, "error");
    await renderApp("/skills");
    await errorHeading();
    expect(JSON.stringify(logError.mock.calls), "the log fields").not.toContain(THROWN);
  });

  it("renders the page again on Try again", async () => {
    noSkills();
    fault.index = true;
    await renderApp("/skills");
    await errorHeading();
    fault.index = false;
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(await screen.findByRole("heading", { name: "No skills yet" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Something went wrong" })).toBeNull();
  });

  it("shows the error screen again, with no loop, when the page still throws on Try again", async () => {
    noSkills();
    fault.index = true;
    await renderApp("/skills");
    await errorHeading();
    const beforeClick = fault.indexRenders;
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    await pause(100);
    expect(fault.indexRenders, "renders of the page on Try again").toBeGreaterThan(beforeClick);
    expect(await errorHeading()).toBeTruthy();
    const settled = fault.indexRenders;
    await pause(300);
    expect(fault.indexRenders, "renders of the page after the error screen came back").toBe(
      settled,
    );
  });

  it("ends on the page after a double click on Try again", async () => {
    noSkills();
    fault.index = true;
    await renderApp("/skills");
    await errorHeading();
    fault.index = false;
    const tryAgain = screen.getByRole("button", { name: "Try again" });
    act(() => {
      fireEvent.click(tryAgain);
      fireEvent.click(tryAgain);
    });
    expect(await screen.findByRole("heading", { name: "No skills yet" })).toBeTruthy();
    await pause(100);
    expect(screen.queryByRole("heading", { name: "Something went wrong" })).toBeNull();
  });

  it("leaves the error screen on Go to Home", async () => {
    noSkills();
    fault.index = true;
    const { router } = await renderApp("/skills");
    await errorHeading();
    act(() => {
      fireEvent.click(screen.getByRole("link", { name: "Go to Home" }));
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    expect(screen.queryByRole("heading", { name: "Something went wrong" })).toBeNull();
  });

  it("leaves the error screen on a rail link, and shows the page on the way back", async () => {
    noSkills();
    fault.index = true;
    const { router } = await renderApp("/skills");
    await errorHeading();
    act(() => {
      fireEvent.click(screen.getByRole("link", { name: "Home" }));
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    expect(screen.queryByRole("heading", { name: "Something went wrong" })).toBeNull();
    fault.index = false;
    await act(() => router.navigate({ to: "/skills" }));
    expect(await screen.findByRole("heading", { name: "No skills yet" })).toBeTruthy();
  });

  it("keeps the error screen, with no new render, when a list answer comes while it shows", async () => {
    const held: ReturnType<typeof heldAnswer>[] = [];
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () => {
        if (api?.sent("GET", "/api/skills").length === 1) return { body: [] };
        const answer = heldAnswer();
        held.push(answer);
        return answer.promise;
      },
      "GET /api/bots": () => ({ body: [] }),
    });
    fault.index = true;
    const { queryClient } = await renderApp("/skills");
    await errorHeading();
    act(() => {
      void queryClient.invalidateQueries({ predicate: SKILL_OR_BOT_QUERIES });
    });
    await waitFor(() => {
      expect(held).toHaveLength(1);
    });
    const before = fault.indexRenders;
    await held[0]?.answer({ body: [] });
    await pause(100);
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeTruthy();
    expect(fault.indexRenders, "renders of the page after the answer").toBe(before);
  });
});

describe("the error screen in the Skills page", () => {
  it("keeps the Skills list column when the skill page throws", async () => {
    oneSkill();
    fault.history = true;
    await renderApp("/skills/write-user-stories?tab=history");
    await errorHeading();
    expect(screen.queryByRole("navigation", { name: "Skills" }), "the list column").not.toBeNull();
  });

  it("drops unsaved text with no leave question when the skill page throws", async () => {
    oneSkill();
    const { router } = await renderApp("/skills/write-user-stories");
    await screen.findByRole("heading", { name: "Write user stories" }, { timeout: 5000 });
    act(() => {
      fireEvent.click(screen.getByRole("tab", { name: "Write" }));
    });
    act(() => {
      fireEvent.change(screen.getByLabelText("Body", { exact: true }), {
        target: { value: "Text that is not saved" },
      });
    });
    act(() => {
      fault.fields = true;
      for (const listener of fault.listeners) listener();
    });
    await errorHeading();
    act(() => {
      fireEvent.click(screen.getByRole("link", { name: "Home" }));
    });
    // A leave question that stayed would stop the move.
    await waitFor(() => {
      expect(router.state.location.pathname, "moved with no leave question").toBe("/");
    });
    expect(screen.queryByRole("alertdialog"), "a leave question").toBeNull();
  });
});

describe("the error screen of the shell", () => {
  it("fills the window when the shell throws", async () => {
    noSkills();
    fault.header = true;
    await renderApp("/");
    await errorHeading();
    expect(rail(), "the rail").toBeNull();
  });
});

// The route error boundaries let the router's own not-found pass (plan part 8, probe 1).
describe("Page not found with the route error boundaries", () => {
  it("shows Page not found inside the shell for an unknown address", async () => {
    noSkills();
    await renderApp("/nothing");
    expect(await screen.findByText("Page not found")).toBeTruthy();
    expect(rail(), "the rail").not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Something went wrong" })).toBeNull();
  });

  it("shows Page not found inside the shell for a conversation id that is not valid", async () => {
    noSkills();
    await renderApp("/c/bad-id");
    expect(await screen.findByText("Page not found")).toBeTruthy();
    expect(rail(), "the rail").not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Something went wrong" })).toBeNull();
  });
});

// UI-3 A (owner, 2026-11-18, #123): inside the Skills page the list column has the h1 "Skills", so
// the error screen and Page not found beside it are h2. They show in the same place as before:
// beside the list column, inside the shell. Everywhere else they are h1.
describe("the headings of the error screen and Page not found", () => {
  const h1 = () => screen.getAllByRole("heading", { level: 1 }).map((node) => node.textContent);
  const listColumn = () => screen.queryByRole("navigation", { name: "Skills" });

  it("makes the error screen of a Skills page an h2 beside the list column", async () => {
    noSkills();
    fault.index = true;
    await renderApp("/skills");
    const heading = await screen.findByRole("heading", { name: "Something went wrong", level: 2 });
    expect(listColumn(), "the list column").not.toBeNull();
    expect(listColumn()?.contains(heading), "the screen is not in the list column").toBe(false);
    expect(rail(), "the rail").not.toBeNull();
    expect(h1(), "the h1 headings").toEqual(["Skills"]);
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to Home" })).toBeTruthy();
  });

  it("makes Page not found of an unknown skill an h2 beside the list column", async () => {
    noSkills();
    await renderApp("/skills/nothing-here");
    expect(await screen.findByRole("heading", { name: "Page not found", level: 2 })).toBeTruthy();
    expect(listColumn(), "the list column").not.toBeNull();
    expect(h1(), "the h1 headings").toEqual(["Skills"]);
  });

  it("makes Page not found of a Clone with no source an h2 beside the list column", async () => {
    noSkills();
    await renderApp("/skills/new?from=nothing-here");
    expect(await screen.findByRole("heading", { name: "Page not found", level: 2 })).toBeTruthy();
    expect(h1(), "the h1 headings").toEqual(["Skills"]);
  });

  it("keeps the h1 of Page not found outside the Skills page", async () => {
    noSkills();
    await renderApp("/nothing");
    expect(await screen.findByRole("heading", { name: "Page not found", level: 1 })).toBeTruthy();
  });

  it("keeps the h1 of the error screen outside the Skills page", async () => {
    noSkills();
    fault.header = true;
    await renderApp("/");
    expect(
      await screen.findByRole("heading", { name: "Something went wrong", level: 1 }),
    ).toBeTruthy();
  });
});
