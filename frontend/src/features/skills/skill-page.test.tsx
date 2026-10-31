import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
