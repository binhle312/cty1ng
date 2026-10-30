import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderApp } from "../../../test/render-app.tsx";
import { TooltipProvider } from "../../components/ui/tooltip.tsx";
import { AppShell } from "./app-shell.tsx";
import { SHELL_KEY } from "./bar-two-state.ts";

const barTwo = () => screen.queryByRole("region", { name: "Home Sweet Home" });
const ctrlB = (): void => {
  act(() => {
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
  });
};

// left-bar.md §4; M0c plan, decisions E and F.
describe("bar 2", () => {
  it("shows by default, and Ctrl+B hides and shows it", async () => {
    await renderApp("/");
    expect(barTwo()).not.toBeNull();
    ctrlB();
    expect(barTwo()).toBeNull();
    ctrlB();
    expect(barTwo()).not.toBeNull();
  });

  it("can be hidden from its ⋯ menu", async () => {
    const user = userEvent.setup();
    await renderApp("/");
    await user.click(screen.getByRole("button", { name: "Home menu" }));
    await user.click(await screen.findByRole("menuitem", { name: /Hide bar/ }));
    expect(barTwo()).toBeNull();
  });

  it("keeps the owner's choice in this browser, and the Home tile shows the bar again", async () => {
    const first = await renderApp("/");
    ctrlB();
    expect(window.localStorage.getItem(SHELL_KEY)).toBe('{"barTwoHidden":true}');
    first.unmount();

    const user = userEvent.setup();
    await renderApp("/bots");
    expect(barTwo()).toBeNull();
    await user.click(screen.getByRole("link", { name: "Home" }));
    expect(barTwo()).not.toBeNull();
    expect(window.localStorage.getItem(SHELL_KEY)).toBe('{"barTwoHidden":false}');
  });

  it.each([
    [
      "saved data that does not parse",
      () => {
        window.localStorage.setItem(SHELL_KEY, "{oops");
      },
    ],
    [
      "saved data of another shape",
      () => {
        window.localStorage.setItem(SHELL_KEY, '{"x":1}');
      },
    ],
    [
      "storage that throws",
      () =>
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
          throw new Error("SecurityError");
        }),
    ],
  ])("falls back to a visible bar on %s", async (_label, breakStorage) => {
    breakStorage();
    await renderApp("/");
    expect(barTwo()).not.toBeNull();
    vi.restoreAllMocks();
  });

  it.each([
    ["an input", '<input aria-label="x" />'],
    ["a text area", '<textarea aria-label="x"></textarea>'],
    ["a Markdown editor", '<div contenteditable="true" aria-label="x"><p>t</p></div>'],
  ])("leaves Ctrl+B alone in %s", async (_label, html) => {
    await renderApp("/");
    const box = document.createElement("div");
    box.innerHTML = html;
    document.body.append(box);
    const target = box.querySelector("[aria-label='x']") ?? box;
    const event = new KeyboardEvent("keydown", {
      key: "b",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      target.dispatchEvent(event);
    });
    expect(barTwo()).not.toBeNull();
    // The key keeps its own job there (bold in a Markdown box).
    expect(event.defaultPrevented).toBe(false);
    box.remove();
  });

  it("hides on a page that asks for it without changing the owner's choice", async () => {
    const root = createRootRoute({
      component: () => (
        <AppShell>
          <Outlet />
        </AppShell>
      ),
    });
    const tree = root.addChildren([
      createRoute({ getParentRoute: () => root, path: "/" }),
      createRoute({
        getParentRoute: () => root,
        path: "/new-project",
        staticData: { hidesBarTwo: true },
      }),
    ]);
    const router = createRouter({
      routeTree: tree,
      history: createMemoryHistory({ initialEntries: ["/new-project"] }),
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    await act(() => router.load());
    expect(barTwo()).toBeNull();
    await act(() => router.navigate({ to: "/" }));
    expect(barTwo()).not.toBeNull();
    expect(window.localStorage.getItem(SHELL_KEY)).toBeNull();
  });
});
