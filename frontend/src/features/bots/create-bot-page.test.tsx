import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeApi, NETWORK_ERROR, type RecordedRequest } from "../../../test/fake-api.ts";
import { BOT_SETTINGS, FAKE_SCRIPTED, makeBot, makeModel } from "../../../test/fixtures.ts";
import { renderApp } from "../../../test/render-app.tsx";

// Create with an Idempotency-Key (create-bot-page.md E3, E5; api.md §4): when the outcome is
// not known, Try again sends the same request with the same key, so a retry never makes two
// bots; after an answer, the next Create is a new request with a new key.
type Answer = { status: number; body: unknown } | typeof NETWORK_ERROR;

function api(answers: Answer[]) {
  let call = 0;
  return fakeApi({
    "GET /api/settings": () => ({ body: BOT_SETTINGS }),
    "GET /api/models": () => ({ body: [makeModel(), FAKE_SCRIPTED] }),
    "GET /api/tools": () => ({ body: [] }),
    "GET /api/skills": () => ({ body: [] }),
    "GET /api/bots": () => ({ body: [] }),
    "POST /api/bots": () => {
      const answer = answers[call] ?? answers[answers.length - 1];
      call += 1;
      return answer;
    },
  });
}

function click(element: HTMLElement) {
  act(() => {
    fireEvent.click(element);
  });
}

function type(label: string, text: string) {
  act(() => {
    fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value: text } });
  });
}

async function fillToModelStep(name = "BA") {
  type("Name", name);
  type("Description", "Writes stories.");
  click(screen.getByRole("button", { name: "Next" }));
  type("Persona", "You are the BA.");
  click(screen.getByRole("button", { name: "Next" }));
  click(await screen.findByRole("button", { name: "Next" }));
  const model = await screen.findByLabelText("Model", { exact: true });
  act(() => {
    fireEvent.change(model, { target: { value: FAKE_SCRIPTED.id } });
  });
}

const keyOf = (request: RecordedRequest | undefined) => request?.headers.get("idempotency-key");

describe("Create on the Create bot page", () => {
  let fake: ReturnType<typeof api> | null = null;
  afterEach(() => {
    fake?.restore();
    fake = null;
  });

  it("retries an unknown outcome with the same key and body (E5)", async () => {
    fake = api([NETWORK_ERROR, { status: 201, body: makeBot(1, "BA") }]);
    await renderApp("/bots/new");
    await screen.findByRole("heading", { name: "New bot" }, { timeout: 5000 });
    await fillToModelStep();
    click(screen.getByRole("button", { name: "Create" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Could not create the bot. The app could not reach the server. Your input is kept.",
    );
    // The form is read-only while the outcome is not known.
    expect(screen.getByRole("button", { name: "Create" }).getAttribute("aria-disabled")).toBe(
      "true",
    );
    click(within(alert).getByRole("button", { name: "Try again" }));
    await waitFor(() => {
      expect(fake?.sent("POST", "/api/bots")).toHaveLength(2);
    });
    const [first, second] = fake.sent("POST", "/api/bots");
    expect(keyOf(first)).toBeTruthy();
    expect(keyOf(second)).toBe(keyOf(first));
    expect(second?.body).toEqual(first?.body);
    expect(await screen.findByText("Created BA ✨")).toBeTruthy();
  });

  it("shows a taken name on Basics and sends the next Create with a new key (E1, E3)", async () => {
    fake = api([
      {
        status: 409,
        body: { error: { code: "name_taken", message: "The name is taken.", field: "name" } },
      },
      { status: 201, body: makeBot(2, "QA") },
    ]);
    await renderApp("/bots/new");
    await screen.findByRole("heading", { name: "New bot" }, { timeout: 5000 });
    await fillToModelStep();
    click(screen.getByRole("button", { name: "Create" }));
    // The error belongs to Name, on step 1: the stepper marks it.
    expect(
      await screen.findByRole("button", { name: /Basics, has an error/ }, { timeout: 5000 }),
    ).toBeTruthy();
    click(
      within(screen.getByRole("list", { name: "Steps" })).getByRole("button", { name: /Basics/ }),
    );
    expect(
      await screen.findByText("BA is taken by another bot, maybe one in Trash. Pick another name."),
    ).toBeTruthy();
    type("Name", "QA");
    click(
      within(screen.getByRole("list", { name: "Steps" })).getByRole("button", { name: /Model/ }),
    );
    click(await screen.findByRole("button", { name: "Create" }));
    await waitFor(() => {
      expect(fake?.sent("POST", "/api/bots")).toHaveLength(2);
    });
    const [first, second] = fake.sent("POST", "/api/bots");
    expect(keyOf(second)).not.toBe(keyOf(first));
    expect(second?.body).toMatchObject({ name: "QA" });
  });
});
