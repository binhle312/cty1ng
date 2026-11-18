import {
  useIsMutating,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
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
import { SKILL_QUERIES } from "../../lib/api/operation-queries.ts";
import { refreshQueries } from "../../lib/api/query-reads.ts";
import { cn } from "../../lib/cn.ts";
import { DiffView } from "./diff-view.tsx";
import { VersionPill } from "./pills.tsx";
import type { SkillRow } from "./skill-queries.ts";

type VersionRow = ListSkillVersionsResponse[number];

const restoreKey = (id: string) => ["restore-skill", id];
// The version that a Restore answer made. The query client keeps the answer as `unknown`.
const RestoreAnswer = z.object({ latest_version: z.object({ version: z.number() }) });

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
        {/* The data first: a failed background refresh keeps the versions (skills-page.md,
            "A failed background refresh keeps the list"). */}
        {versions.data === undefined ? (
          versions.isError ? (
            <p className="text-on-surface-muted">The app could not load the versions.</p>
          ) : (
            <SkeletonArea label="Loading versions">
              {[0, 1, 2].map((key) => (
                <Skeleton key={key} className="mb-2 h-12" />
              ))}
            </SkeletonArea>
          )
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
  const queryClient = useQueryClient();
  const router = useRouter();
  // The query client holds each Restore of this skill, so these rules survive a tab change and a
  // return (DQ-073): a Restore and the refresh after it count as one wait, as for Delete.
  const restoring = useIsMutating({ mutationKey: restoreKey(skill.id) }) > 0;
  // The newest version that a Restore made. Until the data shows it, `latest` is old, so the panel
  // would offer a Restore of another version under an old diff. A Restore sends no `row_version`,
  // so after a failed refresh a second click would save one more version (DQ-076): the offer
  // stays hidden until a read shows the new version, or the browser reloads. Versions only go up,
  // so an old answer cannot hide a newer offer.
  const restoredTo = Math.max(
    0,
    ...useMutationState({
      filters: { mutationKey: restoreKey(skill.id), status: "success" },
      select: (mutation) =>
        RestoreAnswer.safeParse(mutation.state.data).data?.latest_version.version ?? 0,
    }),
  );
  const restore = useMutation({
    ...restoreSkillVersionMutation(),
    mutationKey: restoreKey(skill.id),
    // The answers stay for the life of the browser tab, so the rule above has no hidden timer
    // (the default would drop them after 5 minutes). The query client keeps one entry for each
    // Restore of this skill sent in this tab, also a failed one with its error; a success holds one
    // skill row. A reload removes them, and no code removes them before that.
    gcTime: Infinity,
    onSuccess: async (saved) => {
      showToast(`Saved v${String(saved.latest_version.version)} ✨`);
      await refreshQueries(queryClient, { predicate: SKILL_QUERIES });
    },
    onError: (error) => {
      showToast(apiErrorText(error));
    },
  });
  const sendRestore = () => {
    // The query client counts at once, before the page renders again.
    if (queryClient.isMutating({ mutationKey: restoreKey(skill.id) }) > 0) return;
    // The address the Restore was sent from. The answer opens the newest version only while the
    // page still shows it: not after a leave, another tab or another pair (DQ-077). A panel that
    // went gets no callback at all.
    const sentFrom = router.state.location.href;
    restore.mutate(
      { path: { id: skill.id, version: from }, body: {} },
      {
        onSuccess: () => {
          if (router.state.location.href === sentFrom) onRestored();
        },
      },
    );
  };
  const canRestore =
    skill.is_author && !skill.deprecated && to === latest && from < latest && latest >= restoredTo;

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
          <Button size="small" aria-disabled={restoring} onClick={sendRestore}>
            Restore v{from}
          </Button>
        )}
      </div>
      {diff.data === undefined ? (
        diff.isError ? (
          <p className="text-on-surface-muted">The app could not load the changes.</p>
        ) : (
          <SkeletonArea label="Loading the changes">
            <Skeleton className="h-48" />
          </SkeletonArea>
        )
      ) : (
        <>
          {diff.data.description === null ? (
            <p className="text-sm text-on-surface-muted">Description: no change</p>
          ) : (
            <>
              <p className="text-sm text-on-surface-muted">Description</p>
              {/* A key for each pair of each skill: the open folds belong to one diff. */}
              <DiffView
                key={`${skill.id}-${String(from)}-${String(to)}`}
                lines={diff.data.description}
                label="Description changes"
              />
            </>
          )}
          <p className="text-sm text-on-surface-muted">Body</p>
          <DiffView
            key={`${skill.id}-${String(from)}-${String(to)}`}
            lines={diff.data.body}
            label="Body changes"
          />
        </>
      )}
    </div>
  );
}
