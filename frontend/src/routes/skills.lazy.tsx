import { createLazyRoute } from "@tanstack/react-router";
import { ImportPage } from "../features/skills/import-page.tsx";
import { NewSkillPage } from "../features/skills/new-skill-page.tsx";
import { SkillPage } from "../features/skills/skill-page.tsx";
import { SkillsIndexPage } from "../features/skills/skills-index-page.tsx";
import { SkillsLayout } from "../features/skills/skills-layout.tsx";

// The Skills page, in its own chunk (skills.tsx).
export const LayoutRoute = createLazyRoute("/skills")({ component: SkillsLayout });
export const IndexRoute = createLazyRoute("/skills/")({ component: SkillsIndexPage });
export const NewRoute = createLazyRoute("/skills/new")({ component: NewSkillPage });
export const ImportRoute = createLazyRoute("/skills/import")({ component: ImportPage });
export const SkillRoute = createLazyRoute("/skills/$slug")({ component: SkillPage });
