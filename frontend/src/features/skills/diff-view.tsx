import type { DiffLine } from "@cty1ng/shared/skills";
import { useState } from "react";
import { cn } from "../../lib/cn.ts";
import { foldDiff } from "./diff-fold.ts";

// A read-only line diff (skills-page.md §13): added lines in `success`, removed lines in
// `danger` with a strike, long unchanged runs folded as "{n} lines with no change · Show".
// The +/− marks keep the meaning without colour.
export function DiffView({ lines, label }: { lines: DiffLine[]; label: string }) {
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  const chunks = foldDiff(lines);
  return (
    <div
      aria-label={label}
      className="overflow-hidden rounded-control border border-outline-strong bg-surface py-1.5 font-mono text-sm"
    >
      {chunks.map((chunk, index) => {
        if (chunk.kind === "lines" || open.has(chunk.key)) {
          return chunk.lines.map((line, k) => (
            <Line key={`${String(index)}-${String(k)}`} line={line} />
          ));
        }
        return (
          <p
            key={`fold-${String(chunk.key)}`}
            className="px-3 py-1 font-sans text-on-surface-muted"
          >
            {chunk.lines.length} lines with no change ·{" "}
            <button
              type="button"
              className="underline hover:text-on-surface"
              onClick={() => {
                setOpen((current) => new Set(current).add(chunk.key));
              }}
            >
              Show
            </button>
          </p>
        );
      })}
    </div>
  );
}

function Line({ line }: { line: DiffLine }) {
  const mark = line.op === "add" ? "+" : line.op === "del" ? "−" : " ";
  return (
    <div
      data-op={line.op}
      className={cn(
        "flex gap-2 px-3 whitespace-pre-wrap",
        line.op === "add" && "bg-success/15 text-success",
        line.op === "del" && "bg-danger/15 text-danger line-through",
      )}
    >
      <span aria-hidden className="w-2 shrink-0 no-underline select-none">
        {mark}
      </span>
      <span className="min-w-0 grow break-words">
        {line.op === "add" && <span className="sr-only">Added: </span>}
        {line.op === "del" && <span className="sr-only">Removed: </span>}
        {line.text === "" ? " " : line.text}
      </span>
    </div>
  );
}
