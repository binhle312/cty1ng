import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeApi, heldAnswer } from "../../../test/fake-api.ts";
import { makeBot, makePin, makeSkill, makeVersions, SKILL_ID } from "../../../test/fixtures.ts";
import { renderApp } from "../../../test/render-app.tsx";

// A failed request is not a missing skill (requirements/README.md: every view has an error
// state): the page says the load failed and offers Try again, never Page not found.
describe("the skill page when the skill list does not load", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the error state with Try again, not Page not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ error: { code: "internal_error", message: "Something failed." } }),
            { status: 500, headers: { "content-type": "application/json" } },
          ),
        ),
      ),
    );
    await renderApp("/skills/write-user-stories");
    const alert = await screen.findByRole("alert", {}, { timeout: 5000 });
    expect(alert.textContent).toContain("The app could not load the skills.");
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByText("Page not found")).toBeNull();
  });
});

// Review of PR #57: the removals share one mutation hook, whose `isPending` follows only the
// last request, so the button came back while a removal was still on its way.
describe("Remove from bots on a deprecated skill", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  it("stays pending until every removal has ended, so a second click sends nothing", async () => {
    const ba = makeBot(1, "BA", [makePin()]);
    const designer = makeBot(2, "Designer", [makePin()]);
    const skill = makeSkill({
      deprecated: true,
      deprecated_at: "2026-10-21T10:00:00.000Z",
      bots_using: 2,
    });
    const baRemoval = heldAnswer();
    const baPath = `/api/bots/${ba.id}/skills/${SKILL_ID}`;
    const designerPath = `/api/bots/${designer.id}/skills/${SKILL_ID}`;
    api = fakeApi({
      "GET /api/skills": () => ({ body: [skill] }),
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: skill }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      "GET /api/bots": () => ({ body: [ba, designer] }),
      [`DELETE ${baPath}`]: () => baRemoval.promise,
      [`DELETE ${designerPath}`]: () => ({ status: 204 }),
    });
    await renderApp("/skills/write-user-stories");
    const click = (element: HTMLElement) => {
      act(() => {
        fireEvent.click(element);
      });
    };
    click(await screen.findByRole("button", { name: "Remove from bots" }, { timeout: 5000 }));
    const dialog = await screen.findByRole("dialog");
    const confirm = await within(dialog).findByRole("button", { name: "Remove from 2 bots" });
    click(confirm);
    await waitFor(() => {
      expect(api?.sent("DELETE", designerPath)).toHaveLength(1);
    });
    await act(async () => {
      await Promise.resolve();
    });
    // Designer's removal has ended; BA's has not, so the button is still off. (Query it again:
    // the button gets its tooltip while pending.)
    const pending = within(dialog).getByRole("button", { name: "Remove from 2 bots" });
    expect(pending.getAttribute("aria-disabled")).toBe("true");
    click(pending);
    expect(api.sent("DELETE", baPath)).toHaveLength(1);
    expect(api.sent("DELETE", designerPath)).toHaveLength(1);
    await baRemoval.answer({ status: 204 });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  // Review of PR #57: a request that ended after its dialog closed wrote into the next dialog.
  it("shows a Deprecate that fails after its dialog closed as a toast, not in the next dialog", async () => {
    const skill = makeSkill();
    const deprecation = heldAnswer();
    api = fakeApi({
      "GET /api/skills": () => ({ body: [skill] }),
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: skill }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      "GET /api/bots": () => ({ body: [] }),
      [`POST /api/skills/${SKILL_ID}/deprecate`]: () => deprecation.promise,
    });
    await renderApp("/skills/write-user-stories");
    const click = (element: HTMLElement) => {
      act(() => {
        fireEvent.click(element);
      });
    };
    const openDeprecate = async () => {
      click(await screen.findByRole("button", { name: "Skill actions" }, { timeout: 5000 }));
      click(await screen.findByRole("menuitem", { name: "Deprecate" }));
      return screen.findByRole("alertdialog");
    };
    const first = await openDeprecate();
    click(await within(first).findByRole("button", { name: "Deprecate" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/deprecate`)).toHaveLength(1);
    });
    click(within(first).getByRole("button", { name: "Cancel" }));
    const second = await openDeprecate();
    await deprecation.answer({
      status: 500,
      body: { error: { code: "internal_error", message: "Something failed." } },
    });
    expect(await screen.findByText("Something failed.")).toBeTruthy();
    expect(within(second).queryByText("Something failed.")).toBeNull();
    expect(screen.getByRole("alertdialog")).toBe(second);
  });
});
