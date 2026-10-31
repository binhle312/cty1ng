import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../../components/ui/button.tsx";
import { Checkbox } from "../../components/ui/checkbox.tsx";
import { Skeleton, SkeletonArea } from "../../components/ui/skeleton.tsx";
import { showToast } from "../../components/ui/toast.tsx";
import { TimeText } from "../../components/ui/time-text.tsx";
import {
  getSkillDiffOptions,
  listSkillVersionsOptions,
  restoreSkillVersionMutation,
} from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import type { ListSkillVersionsResponse } from "../../lib/api/generated/types.gen.ts";
import { apiErrorText } from "../../lib/api/api-error.ts";
import { cn } from "../../lib/cn.ts";
import { DiffView } from "./diff-view.tsx";
import { VersionPill } from "./pills.tsx";
import type { SkillRow } from "./skill-queries.ts";

type VersionRow = ListSkillVersionsResponse[number];

// The pair the diff shows. With no pair in the URL, the newest change: v{n-1} → v{n}. A pair
// that does not exist (an edited URL) falls back to that too.
export function comparePair(
  latest: number,
  from: number | undefined,
  to: number | undefined,
): { from: number; to: number } {
  const fallback = { from: Math.max(1, latest - 1), to: latest };
  const pickedTo = to ?? latest;
  if (from === undefined || from > latest || pickedTo > latest) return fallback;
  return from <= pickedTo ? { from, to: pickedTo } : { from: pickedTo, to: from };
}

// The History tab (skills-page.md §13, UI-7.5): versions newest first at the left; at the right
// the diff of the selected version to the latest, or of any two versions after Compare;
// Restore v{k} makes a new version with the old text.
export function SkillHistory({
  skill,
  from,
  to,
  onPick,
}: {
  skill: SkillRow;
  from: number | undefined;
  to: number | undefined;
  onPick: (pair: { from: number; to: number } | null) => void;
}) {
  const latest = skill.latest_version.version;
  const pair = comparePair(latest, from, to);
  const versions = useQuery(listSkillVersionsOptions({ path: { id: skill.id } }));
  const [comparing, setComparing] = useState(false);
  const [ticked, setTicked] = useState<number[]>([]);

  const pick = (version: VersionRow) => {
    if (!comparing) {
      onPick(version.version === latest ? null : { from: version.version, to: latest });
      return;
    }
    const next = ticked.includes(version.version)
      ? ticked.filter((v) => v !== version.version)
      : [...ticked, version.version].slice(-2);
    setTicked(next);
    const [a, b] = next;
    if (a !== undefined && b !== undefined) {
      onPick({ from: Math.min(a, b), to: Math.max(a, b) });
    }
  };

  return (
    <div className="flex min-h-0 grow gap-6 overflow-y-auto px-8 py-5">
      <div className="w-list-column shrink-0">
        {versions.isPending ? (
          <SkeletonArea label="Loading versions">
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className="mb-2 h-12" />
            ))}
          </SkeletonArea>
        ) : versions.isError ? (
          <p className="text-on-surface-muted">The app could not load the versions.</p>
        ) : (
          <ol aria-label="Versions" className="flex flex-col gap-1">
            {versions.data.map((version) => (
              <li key={version.id}>
                <VersionItem
                  version={version}
                  skill={skill}
                  latest={latest}
                  comparing={comparing}
                  ticked={ticked.includes(version.version)}
                  selected={
                    !comparing &&
                    (version.version === pair.from ||
                      (pair.to !== latest && version.version === pair.to))
                  }
                  onPick={() => {
                    pick(version);
                  }}
                />
              </li>
            ))}
          </ol>
        )}
        {latest > 1 && (
          <div className="mt-3 flex items-center gap-3">
            <Button
              size="small"
              onClick={() => {
                setComparing(!comparing);
                setTicked([]);
              }}
            >
              {comparing ? "Stop comparing" : "Compare"}
            </Button>
            {comparing && <span className="text-sm text-on-surface-muted">Tick two versions.</span>}
          </div>
        )}
      </div>
      <div className="min-w-0 grow">
        {pair.from === pair.to ? (
          <p className="text-on-surface-muted">
            {latest === 1
              ? "This skill has one version. Each save adds a version here."
              : "Pick an older version to see what changed."}
          </p>
        ) : (
          <DiffPanel
            skill={skill}
            from={pair.from}
            to={pair.to}
            onRestored={() => {
              onPick(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

function VersionItem({
  version,
  skill,
  latest,
  comparing,
  ticked,
  selected,
  onPick,
}: {
  version: VersionRow;
  skill: SkillRow;
  latest: number;
  comparing: boolean;
  ticked: boolean;
  selected: boolean;
  onPick: () => void;
}) {
  const who = skill.is_author && version.created_by === skill.author_id ? "You" : "Another author";
  const head = (
    <span className="flex min-w-0 grow items-start gap-2 text-left">
      <VersionPill version={version.version} />
      <span className="min-w-0 grow">
        {version.changelog ?? (version.version === 1 ? "First version" : "No note")}
      </span>
    </span>
  );
  // The row's control covers the whole row (its ::after), so a click anywhere picks the
  // version. The time sits above it and is outside the control, so it can take focus for its
  // tooltip.
  const cover = "after:absolute after:inset-0 after:rounded-control";
  return (
    <div
      className={cn(
        "relative flex flex-col gap-0.5 rounded-control border border-transparent px-3 py-2 hover:bg-surface-raised",
        (selected || ticked) && "border-primary bg-primary-tint hover:bg-primary-tint",
      )}
    >
      {comparing ? (
        <Checkbox checked={ticked} onChange={onPick} className={cover}>
          {head}
        </Checkbox>
      ) : (
        <button
          type="button"
          aria-pressed={selected}
          className={cn(
            "flex w-full outline-none focus-visible:after:outline-2 focus-visible:after:outline-primary",
            cover,
          )}
          onClick={onPick}
        >
          {head}
        </button>
      )}
      <span className="flex gap-2 text-sm text-on-surface-muted">
        <span className="grow">
          {who} · <TimeText iso={version.created_at} className="relative z-10" />
        </span>
        {version.version === latest && <span>latest</span>}
        {version.bots_using > 0 && (
          <span>{version.bots_using === 1 ? "1 bot" : `${String(version.bots_using)} bots`}</span>
        )}
      </span>
    </div>
  );
}

function DiffPanel({
  skill,
  from,
  to,
  onRestored,
}: {
  skill: SkillRow;
  from: number;
  to: number;
  onRestored: () => void;
}) {
  const latest = skill.latest_version.version;
  const diff = useQuery(getSkillDiffOptions({ path: { id: skill.id }, query: { from, to } }));
  const restore = useMutation({
    ...restoreSkillVersionMutation(),
    onSuccess: (saved) => {
      showToast(`Saved v${String(saved.latest_version.version)} ✨`);
      onRestored();
    },
    onError: (error) => {
      showToast(apiErrorText(error));
    },
  });
  const canRestore = skill.is_author && !skill.deprecated && to === latest && from < latest;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <VersionPill version={from} />
        <span aria-hidden>→</span>
        <VersionPill version={to} />
        <span className="grow text-sm text-on-surface-muted">
          <span className="sr-only">
            v{from} to v{to}
          </span>
          · Read-only
        </span>
        {canRestore && (
          <Button
            size="small"
            aria-disabled={restore.isPending}
            onClick={() => {
              if (restore.isPending) return;
              restore.mutate({ path: { id: skill.id, version: from }, body: {} });
            }}
          >
            Restore v{from}
          </Button>
        )}
      </div>
      {diff.isPending ? (
        <SkeletonArea label="Loading the changes">
          <Skeleton className="h-48" />
        </SkeletonArea>
      ) : diff.isError ? (
        <p className="text-on-surface-muted">The app could not load the changes.</p>
      ) : (
        <>
          {diff.data.description === null ? (
            <p className="text-sm text-on-surface-muted">Description: no change</p>
          ) : (
            <>
              <p className="text-sm text-on-surface-muted">Description</p>
              <DiffView lines={diff.data.description} label="Description changes" />
            </>
          )}
          <p className="text-sm text-on-surface-muted">Body</p>
          <DiffView lines={diff.data.body} label="Body changes" />
        </>
      )}
    </div>
  );
}
