import { Link } from "@tanstack/react-router";
import { buttonVariants } from "../../components/ui/button.tsx";

// Any address that has no page. `level` is the heading level: 2 beside the list column of the
// Skills page, which has the h1 (UI-3 A, owner, 2026-11-18).
export function NotFoundPage({ level = 1 }: { level?: 1 | 2 }) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <div className="px-8 py-6">
      <Heading className="text-xl font-semibold">Page not found</Heading>
      <p className="mt-1 text-on-surface-muted">This address has no page.</p>
      <Link to="/" className={`mt-4 ${buttonVariants({ kind: "secondary", size: "page" })}`}>
        Go to Home
      </Link>
    </div>
  );
}
