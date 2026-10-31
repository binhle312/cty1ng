import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { buttonVariants } from "../../components/ui/button.tsx";
import { Checkbox } from "../../components/ui/checkbox.tsx";
import { Skeleton, SkeletonArea } from "../../components/ui/skeleton.tsx";
import { cn } from "../../lib/cn.ts";
import { readStored, writeStored } from "../../lib/storage.ts";
import { ExportCard } from "./export-card.tsx";
import { Pill, VersionPill } from "./pills.tsx";
import { type SkillRow, useAllSkills } from "./skill-queries.ts";
import { useSkillsPage } from "./skills-context.tsx";

// The list column (skills-page.md §2, UI-7.1): Create, search, Show deprecated, Import and
// Export, then one row per skill, last change first (the API's order).
const SHOW_DEPRECATED_KEY = "cty1ng.skills.showDeprecated";

export function SkillList() {
  const { data: skills, isPending, isError } = useAllSkills();
  const { dirtySlug, chooseImportFile } = useSkillsPage();
  const params = useParams({ strict: false });
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [query, setQuery] = useState("");
  // The tick is kept for this browser only (§10.2).
  const [showDeprecated, setShowDeprecated] = useState(() =>
    readStored(SHOW_DEPRECATED_KEY, z.boolean(), false),
  );
  const [exportOpen, setExportOpen] = useState(false);

  const needle = query.trim().toLowerCase();
  const rows = (skills ?? []).filter(
    (skill) =>
      (showDeprecated || !skill.deprecated) &&
      (needle === "" || skill.name.toLowerCase().includes(needle) || skill.slug.includes(needle)),
  );
  const creating = pathname === "/skills/new";

  return (
    <nav
      aria-label="Skills"
      className="flex h-full w-list-column shrink-0 flex-col border-r border-outline bg-surface-container"
    >
      <div className="flex items-center justify-between px-4 pt-4">
        <h1 className="text-xl font-semibold">Skills</h1>
        <Link to="/skills/new" className={buttonVariants({ kind: "primary", size: "small" })}>
          <Plus aria-hidden className="size-3.5" />
          Create
        </Link>
      </div>
      <label className="mx-4 mt-3 flex h-control items-center gap-2 rounded-control border border-outline-strong px-2 focus-within:border-primary">
        <Search aria-hidden className="size-3.5 text-on-surface-muted" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="Search skills"
          aria-label="Search skills"
          className="min-w-0 grow bg-transparent outline-none placeholder:text-on-surface-muted"
        />
      </label>
      <div className="mx-4 mt-2 flex items-center justify-between text-sm">
        <Checkbox
          checked={showDeprecated}
          onChange={(checked) => {
            setShowDeprecated(checked);
            writeStored(SHOW_DEPRECATED_KEY, checked);
          }}
          className="text-on-surface-muted"
        >
          Show deprecated
        </Checkbox>
        <div className="flex gap-3">
          <button
            type="button"
            className="text-on-surface-muted hover:text-on-surface"
            onClick={chooseImportFile}
          >
            Import
          </button>
          <button
            type="button"
            className="text-on-surface-muted hover:text-on-surface"
            onClick={() => {
              setExportOpen(true);
            }}
          >
            Export
          </button>
        </div>
      </div>
      <div className="mt-3 min-h-0 grow overflow-y-auto px-2 pb-4">
        {creating && <NewSkillRow />}
        {isPending ? (
          <SkeletonArea label="Loading skills">
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className="mx-2 mb-2 h-12" />
            ))}
          </SkeletonArea>
        ) : isError ? (
          <p className="px-2 text-on-surface-muted">The app could not load the skills.</p>
        ) : (
          <ul>
            {rows.map((skill) => (
              <li key={skill.id}>
                <SkillListRow
                  skill={skill}
                  selected={skill.slug === params.slug}
                  dirty={skill.slug === dirtySlug}
                />
              </li>
            ))}
          </ul>
        )}
        {!isPending && rows.length === 0 && needle !== "" && (
          <p className="px-2 text-on-surface-muted">No skill matches "{query.trim()}".</p>
        )}
      </div>
      <ExportCard
        open={exportOpen}
        onClose={() => {
          setExportOpen(false);
        }}
        skills={(skills ?? []).filter((skill) => !skill.deprecated)}
      />
    </nav>
  );
}

const ROW =
  "relative mb-0.5 flex flex-col gap-0.5 rounded-control px-3 py-2 hover:bg-surface-raised";

function SelectedMark() {
  return (
    <span aria-hidden className="absolute top-0 bottom-0 left-0 w-0.75 rounded-pill bg-primary" />
  );
}

function SkillListRow({
  skill,
  selected,
  dirty,
}: {
  skill: SkillRow;
  selected: boolean;
  dirty: boolean;
}) {
  return (
    <Link
      to="/skills/$slug"
      params={{ slug: skill.slug }}
      aria-current={selected ? "page" : undefined}
      className={cn(ROW, selected && "bg-primary-tint hover:bg-primary-tint")}
    >
      {selected && <SelectedMark />}
      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            "min-w-0 truncate font-medium",
            skill.deprecated && "text-on-surface-muted",
          )}
        >
          {skill.name}
        </span>
        {dirty && (
          <span
            aria-label="Unsaved changes"
            className="size-1.5 shrink-0 rounded-pill bg-primary"
          />
        )}
        <span className="grow" />
        {skill.deprecated && <Pill>Deprecated</Pill>}
        <VersionPill version={skill.latest_version.version} />
      </span>
      <span className="flex items-center gap-2 text-sm text-on-surface-muted">
        <span className="min-w-0 grow truncate font-mono">{skill.slug}</span>
        <BotsCount skill={skill} />
      </span>
    </Link>
  );
}

// "3 bots · 1 older", or "Not used" (UI-7.1).
function BotsCount({ skill }: { skill: SkillRow }) {
  if (skill.bots_using === 0) return <span className="shrink-0">Not used</span>;
  return (
    <span className="shrink-0">
      {skill.bots_using === 1 ? "1 bot" : `${String(skill.bots_using)} bots`}
      {skill.bots_outdated > 0 && (
        <span className="text-waiting"> · {skill.bots_outdated} older</span>
      )}
    </span>
  );
}

// While a new skill is open, it is the first row, with the pill "not saved" (§4).
function NewSkillRow() {
  return (
    <div aria-current="page" className={cn(ROW, "bg-primary-tint")}>
      <SelectedMark />
      <span className="flex items-center gap-1.5">
        <span className="grow font-medium">New skill</span>
        <Pill tone="primary">not saved</Pill>
      </span>
    </div>
  );
}
