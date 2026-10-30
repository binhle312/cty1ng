import { createLazyRoute } from "@tanstack/react-router";
import { emptyIn, PlaceholderPage } from "../features/placeholder/placeholder-page.tsx";

// The skill editor page, in its own chunk.
export const Route = createLazyRoute("/skills/$slug")({
  component: () => <PlaceholderPage title="Skill" line={emptyIn("M1")} />,
});
