import { Navigate, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button, buttonVariants } from "../../components/ui/button.tsx";
import { SkillEditorSkeleton } from "./skill-editor-skeleton.tsx";
import { useAllSkills } from "./skill-queries.ts";
import { useSkillsPage } from "./skills-context.tsx";

// `/skills` opens the skill changed last, the top of the list (skills-page.md §1), or the empty
// state before the first skill (§3). A deprecated skill at the top opens only when nothing
// else is there.
export function SkillsIndexPage() {
  const { data: skills, isPending, isError } = useAllSkills();
  if (isPending) return <SkillEditorSkeleton />;
  if (isError) {
    return <p className="px-8 py-6 text-on-surface-muted">The app could not load the skills.</p>;
  }
  const top = skills.find((skill) => !skill.deprecated) ?? skills[0];
  if (top !== undefined) {
    return <Navigate to="/skills/$slug" params={{ slug: top.slug }} replace />;
  }
  return <EmptyState />;
}

function EmptyState() {
  const { chooseImportFile } = useSkillsPage();
  return (
    <div className="flex grow flex-col items-center justify-center px-8 text-center">
      <div aria-hidden className="text-4xl">
        📚
      </div>
      <h2 className="mt-3 text-xl font-semibold">No skills yet</h2>
      <p className="mt-2 max-w-md text-on-surface-muted">
        A skill tells a bot how to do one task, for example "Write user stories". Write one here, or
        import SKILL.md folders.
      </p>
      <div className="mt-5 flex gap-2">
        <Button onClick={chooseImportFile}>Import</Button>
        <Link to="/skills/new" className={buttonVariants({ kind: "primary" })}>
          <Plus aria-hidden className="size-4" />
          Create skill
        </Link>
      </div>
    </div>
  );
}
