import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button.tsx";
import { Checkbox } from "../../components/ui/checkbox.tsx";
import { Skeleton, SkeletonArea } from "../../components/ui/skeleton.tsx";
import { showToast } from "../../components/ui/toast.tsx";
import { apiErrorText, readApiError } from "../../lib/api/api-error.ts";
import {
  applySkillImportMutation,
  previewSkillImportMutation,
} from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import type { PreviewSkillImportResponse } from "../../lib/api/generated/types.gen.ts";
import { cn } from "../../lib/cn.ts";
import { DiffView } from "./diff-view.tsx";
import { Pill } from "./pills.tsx";
import { SaveBarFrame, SaveButton } from "./save-bar.tsx";
import { useSkillsPage } from "./skills-context.tsx";

type Preview = PreviewSkillImportResponse;
type ImportRow = Preview["rows"][number];

// `/skills/import` (skills-page.md §15, UI-7.7): the preview of a zip, in four groups. The app
// writes nothing until Apply, and Apply writes only the ticked rows.
export function ImportPage() {
  const { importFile, chooseImportFile } = useSkillsPage();
  const preview = useMutation(previewSkillImportMutation());
  const { mutate } = preview;

  useEffect(() => {
    if (importFile !== null) mutate({ body: { file: importFile } });
  }, [importFile, mutate]);

  const header = (line: string) => (
    <header className="flex shrink-0 items-start gap-4 px-8 pt-6">
      <div className="grow">
        <h2 className="text-title font-semibold">Import skills</h2>
        <p className="mt-1 text-sm text-on-surface-muted">{line}</p>
      </div>
      <Button size="small" onClick={chooseImportFile}>
        {importFile === null ? "Choose a file" : "Choose another file"}
      </Button>
    </header>
  );

  if (importFile === null) {
    return header("Choose a zip of SKILL.md folders. The app changes nothing until you apply.");
  }
  if (preview.isError) {
    return (
      <>
        {header(importFile.name)}
        <p role="alert" className="px-8 py-5 text-danger">
          {apiErrorText(preview.error)}
        </p>
      </>
    );
  }
  if (preview.data === undefined) {
    return (
      <>
        {header(importFile.name)}
        <SkeletonArea label="Reading the zip">
          <div className="flex flex-col gap-2 px-8 py-5">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        </SkeletonArea>
      </>
    );
  }
  const folders = preview.data.rows.length;
  return (
    <>
      {header(
        `${preview.data.file} · ${folders === 1 ? "1 folder" : `${String(folders)} folders`}. The app changes nothing until you apply.`,
      )}
      <ImportPreview
        key={preview.data.preview_id}
        preview={preview.data}
        onPreviewAgain={() => {
          mutate({ body: { file: importFile } });
        }}
      />
    </>
  );
}

const GROUPS = [
  { title: "New skills", statuses: ["new"] },
  { title: "New versions of your skills", statuses: ["changed"] },
  { title: "No change", statuses: ["unchanged"] },
  { title: "Skipped", statuses: ["invalid", "conflict"] },
] as const satisfies { title: string; statuses: ImportRow["status"][] }[];

const canApply = (row: ImportRow) => row.status === "new" || row.status === "changed";

function ImportPreview({
  preview,
  onPreviewAgain,
}: {
  preview: Preview;
  onPreviewAgain: () => void;
}) {
  const navigate = useNavigate();
  const { clearImportFile } = useSkillsPage();
  const leave = () => {
    clearImportFile();
    void navigate({ to: "/skills" });
  };
  const good = preview.rows.filter(canApply);
  // Every good row starts ticked.
  const [picked, setPicked] = useState(() => new Set(good.map((row) => row.slug)));
  const [stale, setStale] = useState<string | null>(null);
  const apply = useMutation({
    ...applySkillImportMutation(),
    onSuccess: (result) => {
      const total = result.created + result.new_versions;
      showToast(
        `Imported ${total === 1 ? "1 change" : `${String(total)} changes`} ✨ ${plural(result.created, "new skill")}, ${plural(result.new_versions, "new version")}.`,
      );
      leave();
    },
    onError: (error) => {
      const code = readApiError(error)?.code;
      setStale(
        code === "stale_write"
          ? "A skill changed after the preview. The app applied nothing. Preview again."
          : code === "preview_expired"
            ? "The preview is too old. The app applied nothing. Preview again."
            : apiErrorText(error),
      );
    },
  });
  const count = picked.size;

  return (
    <>
      <div className="min-h-0 grow overflow-y-auto px-8 py-5">
        {stale !== null && (
          <div
            role="alert"
            className="mb-4 flex items-center gap-4 rounded-card border border-danger px-4 py-3"
          >
            <p className="grow">{stale}</p>
            <Button size="small" onClick={onPreviewAgain}>
              Preview again
            </Button>
          </div>
        )}
        {GROUPS.map((group) => {
          const statuses: readonly ImportRow["status"][] = group.statuses;
          const rows = preview.rows.filter((row) => statuses.includes(row.status));
          return (
            <section key={group.title} aria-label={group.title} className="mb-5">
              <h3 className="mb-2 font-semibold">
                {group.title} <span className="text-on-surface-muted">{rows.length}</span>
              </h3>
              {rows.length === 0 ? (
                <p className="text-sm text-on-surface-muted">None.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {rows.map((row) => (
                    <ImportRowView
                      key={row.slug}
                      row={row}
                      picked={picked.has(row.slug)}
                      onPick={(on) => {
                        setPicked((current) => {
                          const next = new Set(current);
                          if (on) next.add(row.slug);
                          else next.delete(row.slug);
                          return next;
                        });
                      }}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
        <p className="text-sm text-on-surface-muted">
          Import never changes the version that a bot uses. Skills that are not in the file stay as
          they are.
        </p>
      </div>
      <SaveBarFrame>
        <span className="grow text-on-surface-muted">
          {count} of {good.length} picked. Rows with a problem are skipped.
        </span>
        <Button onClick={leave}>Cancel</Button>
        <SaveButton
          label={`Apply ${count === 1 ? "1 change" : `${String(count)} changes`}`}
          disabledReason={apply.isPending ? "Saving." : count === 0 ? "Tick a row to apply." : null}
          onClick={() => {
            setStale(null);
            apply.mutate({ body: { preview_id: preview.preview_id, slugs: [...picked] } });
          }}
        />
      </SaveBarFrame>
    </>
  );
}

function plural(n: number, word: string): string {
  return n === 1 ? `1 ${word}` : `${String(n)} ${word}s`;
}

const STATUS_PILL = {
  new: { text: "New", tone: "success" },
  changed: { text: "Changed", tone: "primary" },
  unchanged: { text: "Unchanged", tone: "neutral" },
  invalid: { text: "Invalid", tone: "danger" },
  conflict: { text: "Conflict", tone: "danger" },
} as const;

// "v4 → v5 · body changed", "Same as v3", "becomes v1 · named {slug}", or the reason.
function rowLine(row: ImportRow): string {
  switch (row.status) {
    case "new":
      return `becomes v1 · named ${row.name}`;
    case "changed": {
      const description = row.diff?.description != null;
      const body = row.diff?.body.some((line) => line.op !== "same") ?? false;
      const what =
        description && body
          ? "description and body changed"
          : description
            ? "description changed"
            : "body changed";
      return `v${String(row.from_version)} → v${String(row.to_version)} · ${what}`;
    }
    case "unchanged":
      return `Same as v${String(row.to_version ?? row.from_version)}`;
    case "invalid":
    case "conflict":
      return row.reason ?? "";
    default: {
      const _exhaustive: never = row.status;
      return _exhaustive;
    }
  }
}

function ImportRowView({
  row,
  picked,
  onPick,
}: {
  row: ImportRow;
  picked: boolean;
  onPick: (on: boolean) => void;
}) {
  const [showDiff, setShowDiff] = useState(false);
  const good = canApply(row);
  const pill = STATUS_PILL[row.status];
  return (
    <li
      className={cn(
        "rounded-control border border-outline px-3 py-2",
        good && picked && "border-primary",
      )}
    >
      <div className="flex items-center gap-3">
        <Checkbox
          checked={good && picked}
          disabled={!good}
          onChange={onPick}
          label={`Import ${row.slug}`}
        />
        <Pill tone={pill.tone}>{pill.text}</Pill>
        <span className="font-mono">{row.slug}</span>
        <span className="min-w-0 grow truncate text-sm text-on-surface-muted">{rowLine(row)}</span>
        {row.status === "changed" && row.diff !== null && (
          <button
            type="button"
            className="text-sm text-on-surface-muted underline hover:text-on-surface"
            onClick={() => {
              setShowDiff(!showDiff);
            }}
          >
            {showDiff ? "Hide changes" : "Show changes"}
          </button>
        )}
      </div>
      {row.skipped_files.length > 0 && (
        <p className="mt-1 text-sm text-waiting">
          Only SKILL.md is imported.{" "}
          {row.skipped_files.length === 1
            ? "1 file is"
            : `${String(row.skipped_files.length)} files are`}{" "}
          skipped: {row.skipped_files.join(", ")}. Bots cannot run scripts.
        </p>
      )}
      {showDiff && row.diff !== null && (
        <div className="mt-2 flex flex-col gap-2">
          {row.diff.description === null ? (
            <p className="text-sm text-on-surface-muted">Description: no change</p>
          ) : (
            <DiffView lines={row.diff.description} label={`Description changes of ${row.slug}`} />
          )}
          <DiffView lines={row.diff.body} label={`Body changes of ${row.slug}`} />
        </div>
      )}
    </li>
  );
}
