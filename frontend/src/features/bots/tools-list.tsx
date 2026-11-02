import type { CatalogTool } from "@cty1ng/shared/catalog";
import { TriangleAlert } from "lucide-react";
import { Switch } from "../../components/ui/switch.tsx";
import { cn } from "../../lib/cn.ts";
import type { ToolRow } from "./create-bot-form.ts";

// The Tools list (create-bot-page.md §3, CS4b, CS4c): one row per tool, with a switch, the name,
// a badge (Internal, or the provider), what it does and what changes when it is off. A job that
// both can do is one row with Off · Internal · {Provider}. A provider tool that waits for a later
// milestone, or the locked MCP connector, stays off and says so (D53, D55). The bot page's Model
// tab uses it too (M2c).

export function providerName(provider: string | null): string {
  if (provider === null) return "Provider";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function gateText(tool: CatalogTool): string | null {
  if (tool.switch === "later") return "later milestone";
  if (tool.switch === "locked") return "Needs a decision";
  return null;
}

export function ToolsList({
  rows,
  effective,
  modelPicked,
  multimodal,
  readOnly,
  problems,
  onToggle,
  onPair,
}: {
  rows: readonly ToolRow[];
  effective: Readonly<Record<string, boolean>>;
  modelPicked: boolean;
  multimodal: boolean;
  readOnly: boolean;
  // Server problems by field, for example `tool_settings.web_fetch`.
  problems: Partial<Record<string, string>>;
  onToggle: (toolId: string, on: boolean) => void;
  onPair: (
    row: Extract<ToolRow, { kind: "pair" }>,
    choice: "off" | "internal" | "provider",
  ) => void;
}) {
  return (
    <ul aria-label="Tools" className="flex flex-col divide-y divide-outline">
      {rows.map((row) =>
        row.kind === "single" ? (
          <SingleRow
            key={row.tool.id}
            tool={row.tool}
            on={effective[row.tool.id] === true}
            readOnly={readOnly}
            imagesOff={row.tool.id === "view_images" && !multimodal}
            problem={problems[`tool_settings.${row.tool.id}`]}
            onToggle={onToggle}
          />
        ) : (
          <PairRow
            key={row.job}
            row={row}
            effective={effective}
            readOnly={readOnly}
            problem={
              problems[`tool_settings.${row.internal.id}`] ??
              problems[`tool_settings.${row.provider.id}`]
            }
            onPair={onPair}
          />
        ),
      )}
      {!modelPicked && (
        <li className="py-2.5 text-on-surface-muted">
          Provider tools show here after you pick a model.
        </li>
      )}
    </ul>
  );
}

function Badge({ children }: { children: string }) {
  return (
    <span className="rounded-pill border border-outline-strong px-1.5 text-xs text-on-surface-muted">
      {children}
    </span>
  );
}

function ToolText({ tool, on, extra }: { tool: CatalogTool; on: boolean; extra?: string }) {
  return (
    <div className="min-w-0 grow">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold">{tool.label}</span>
        <Badge>{tool.kind === "internal" ? "Internal" : providerName(tool.provider)}</Badge>
      </div>
      <p className="mt-0.5 text-on-surface-muted">{tool.line}</p>
      {tool.off_line !== null && (
        <p className={cn("text-on-surface-muted", on && "opacity-70")}>Off: {tool.off_line}</p>
      )}
      {extra !== undefined && <p className="text-on-surface-muted">{extra}</p>}
      {tool.sends_data_out && (
        <p className="mt-0.5 flex items-center gap-1 text-primary">
          <TriangleAlert aria-hidden size={12} />
          It can send data out of the app.
        </p>
      )}
    </div>
  );
}

function SingleRow({
  tool,
  on,
  readOnly,
  imagesOff,
  problem,
  onToggle,
}: {
  tool: CatalogTool;
  on: boolean;
  readOnly: boolean;
  imagesOff: boolean;
  problem: string | undefined;
  onToggle: (toolId: string, on: boolean) => void;
}) {
  const gate = gateText(tool);
  return (
    <li data-tool={tool.id} className="flex items-start gap-3 py-2.5">
      <ToolText
        tool={tool}
        on={on}
        {...(imagesOff ? { extra: "Off: this model does not read images." } : {})}
      />
      {gate !== null && <Badge>{gate}</Badge>}
      <Switch
        checked={on}
        label={tool.label}
        disabled={readOnly || gate !== null || imagesOff}
        onChange={(next) => {
          onToggle(tool.id, next);
        }}
        className="mt-0.5"
      />
      {problem !== undefined && <p className="text-sm text-danger">{problem}</p>}
    </li>
  );
}

// A job that an internal and a provider tool both do (§3.1): Off · Internal · {Provider}. A
// provider tool that waits for its milestone cannot be picked.
function PairRow({
  row,
  effective,
  readOnly,
  problem,
  onPair,
}: {
  row: Extract<ToolRow, { kind: "pair" }>;
  effective: Readonly<Record<string, boolean>>;
  readOnly: boolean;
  problem: string | undefined;
  onPair: (
    row: Extract<ToolRow, { kind: "pair" }>,
    choice: "off" | "internal" | "provider",
  ) => void;
}) {
  const choice =
    effective[row.provider.id] === true
      ? "provider"
      : effective[row.internal.id] === true
        ? "internal"
        : "off";
  const options = [
    { value: "off", label: "Off", off: false },
    { value: "internal", label: "Internal", off: row.internal.switch !== "open" },
    {
      value: "provider",
      label: providerName(row.provider.provider),
      off: row.provider.switch !== "open",
    },
  ] as const;
  return (
    <li data-tool={row.job} className="flex items-start gap-3 py-2.5">
      <div className="min-w-0 grow">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold">{row.internal.label}</span>
          <Badge>Internal</Badge>
          <Badge>{providerName(row.provider.provider)}</Badge>
        </div>
        <p className="mt-0.5 text-on-surface-muted">
          {row.internal.line} Two tools do this job: pick the one the bot uses.
        </p>
        {problem !== undefined && <p className="text-sm text-danger">{problem}</p>}
      </div>
      <div
        role="radiogroup"
        aria-label={row.internal.label}
        className="flex shrink-0 rounded-control border border-outline-strong p-0.5"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={choice === option.value}
            aria-disabled={readOnly || option.off}
            onClick={() => {
              if (!readOnly && !option.off) onPair(row, option.value);
            }}
            className={cn(
              "h-6 rounded-xs px-2 text-xs outline-none focus-visible:outline-2 focus-visible:outline-primary aria-disabled:cursor-not-allowed aria-disabled:opacity-40",
              choice === option.value
                ? "bg-primary-tint font-semibold text-primary"
                : "text-on-surface-muted",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </li>
  );
}
