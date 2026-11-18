import { createLazyRoute } from "@tanstack/react-router";
import { ErrorPage } from "../features/placeholder/error-page.tsx";
import { ImportPage } from "../features/skills/import-page.tsx";
import { NewSkillPage } from "../features/skills/new-skill-page.tsx";
import { SkillPage } from "../features/skills/skill-page.tsx";
import { SkillsIndexPage } from "../features/skills/skills-index-page.tsx";
import { SkillsLayout } from "../features/skills/skills-layout.tsx";

// The Skills page, in its own chunk (skills.tsx).
// A page that fails shows the error screen beside the list column, as the router's default does.
// The column has the h1 "Skills", so the screen is an h2 (UI-3 A, owner, 2026-11-18). The layout
// route keeps the default: when it fails, no list column is there.
function SkillsPageError() {
  return <ErrorPage level={2} />;
}

export const LayoutRoute = createLazyRoute("/skills")({ component: SkillsLayout });
export const IndexRoute = createLazyRoute("/skills/")({
  component: SkillsIndexPage,
  errorComponent: SkillsPageError,
});
export const NewRoute = createLazyRoute("/skills/new")({
  component: NewSkillPage,
  errorComponent: SkillsPageError,
});
export const ImportRoute = createLazyRoute("/skills/import")({
  component: ImportPage,
  errorComponent: SkillsPageError,
});
export const SkillRoute = createLazyRoute("/skills/$slug")({
  component: SkillPage,
  errorComponent: SkillsPageError,
});
