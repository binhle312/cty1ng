import { Link, useRouter } from "@tanstack/react-router";
import { Button, buttonVariants } from "../../components/ui/button.tsx";
import { log } from "../../lib/log.ts";

// What a part of the app shows when it fails to render (requirements/app-shell.md, "Errors").
// The router puts it in the place of the failed route, so the shell around it stays. It never
// shows the error itself (AGENTS.md §8). Try again loads the routes again: the router makes new
// matches, so the boundary resets, and a lazy page chunk that failed loads again.
// `level` is the heading level: 1, or 2 where another heading already is the h1 of the page (beside
// the list column of the Skills page; UI-3 A, owner, 2026-11-18).
export function ErrorPage({ level = 1 }: { level?: 1 | 2 }) {
  const router = useRouter();
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <div role="alert" className="px-8 py-6">
      <Heading className="text-xl font-semibold">Something went wrong</Heading>
      <p className="mt-1 text-on-surface-muted">
        The app could not show this page. Try again, or go to Home.
      </p>
      <div className="mt-4 flex gap-2">
        <Button kind="secondary" size="page" onClick={() => void router.invalidate()}>
          Try again
        </Button>
        <Link to="/" className={buttonVariants({ kind: "secondary", size: "page" })}>
          Go to Home
        </Link>
      </div>
    </div>
  );
}

// The log gets the kind of error only: its message can hold the text of a message or a file
// (security.md §2.10).
export function logError(event: string, error: unknown) {
  log.error(event, { name: error instanceof Error ? error.name : typeof error });
}
