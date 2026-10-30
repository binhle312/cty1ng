import { Link } from "@tanstack/react-router";
import { buttonVariants } from "../../components/ui/button.tsx";

// Any address that has no page.
export function NotFoundPage() {
  return (
    <div className="px-8 py-6">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-1 text-on-surface-muted">This address has no page.</p>
      <Link to="/" className={`mt-4 ${buttonVariants({ kind: "secondary", size: "page" })}`}>
        Go to Home
      </Link>
    </div>
  );
}
