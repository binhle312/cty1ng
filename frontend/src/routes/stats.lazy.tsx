import { createLazyRoute } from "@tanstack/react-router";
import { emptyIn, PlaceholderPage } from "../features/placeholder/placeholder-page.tsx";

// The Statistics page, in its own chunk.
export const Route = createLazyRoute("/stats")({
  component: () => <PlaceholderPage title="Statistics" line={emptyIn("M7")} />,
});
