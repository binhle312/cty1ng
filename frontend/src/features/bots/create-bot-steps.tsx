import type { BotLimits } from "@cty1ng/shared/bots";
import type { CatalogModel, CatalogTool } from "@cty1ng/shared/catalog";
import { formatCount } from "@cty1ng/shared/skills";
import { BOT_VALUE_RANGES, HISTORY_STEP_PCT } from "@cty1ng/shared/settings";
import { Plus, Search } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Button } from "../../components/ui/button.tsx";
import { Checkbox } from "../../components/ui/checkbox.tsx";
import { Slider } from "../../components/ui/slider.tsx";
import { Switch } from "../../components/ui/switch.tsx";
import { cn } from "../../lib/cn.ts";
import { BodyField, TextField } from "../skills/skill-fields.tsx";
import { Pill, VersionPill } from "../skills/pills.tsx";
import { BotAvatar } from "./bot-avatar.tsx";
import { EFFORT_LABELS } from "./bot-lines.ts";
import { ColourRow } from "./colour-row.tsx";
import {
  type CreateForm,
  effectiveTools,
  type FormSettings,
  historyLabel,
  toolRows,
  withPairChoice,
} from "./create-bot-form.ts";
import { ToolsList } from "./tools-list.tsx";

// The four steps of the Create bot page (create-bot-page.md §2).

export interface StepProps {
  form: CreateForm;
  update: (change: (form: CreateForm) => CreateForm) => void;
  // While Create is on its way, or its outcome is not known (E4, E5).
  readOnly: boolean;
  // The message under a field, or null.
  errorOf: (field: string) => string | null;
  onLeaveField: (field: string) => void;
}

function counter(value: string, max: number) {
  return {
    text: `${formatCount(value.length)} / ${formatCount(max)}`,
    over: value.length > max,
  };
}

function StepCard({ title, line, children }: { title: string; line: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-outline bg-surface-container p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-on-surface-muted">{line}</p>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function FieldError({ text }: { text: string | null }) {
  if (text === null) return null;
  return (
    <p className="mt-1 text-sm text-danger">
      <span aria-hidden className="font-bold">
        !{" "}
      </span>
      {text}
    </p>
  );
}

// --- Step 1 · Basics (CS1) ---------------------------------------------------------------

export function BasicsStep({
  limits,
  upload,
  uploadError,
  ...props
}: StepProps & {
  limits: BotLimits;
  // Opens the file picker; the crop card follows (bot-avatar.md §6).
  upload: () => void;
  uploadError: string | null;
}) {
  const { form, update, readOnly, errorOf, onLeaveField } = props;
  const field = (name: "name" | "description", max: number) => ({
    value: form[name],
    error: errorOf(name),
    counter: counter(form[name], max),
    readOnly,
    onChange: (value: string) => {
      update((f) => ({ ...f, [name]: value }));
    },
    onLeave: () => {
      onLeaveField(name);
    },
  });
  const flat = {
    avatar_style: "flat" as const,
    avatar_colour: form.avatar_colour,
    avatar_url: null,
  };
  const styleError = uploadError ?? errorOf("avatar_id") ?? errorOf("avatar_style");
  return (
    <StepCard title="Basics" line="Who the bot is and how it looks.">
      <TextField
        label="Name"
        hint="A short role name. You see it in the header, in mentions and in the status."
        {...field("name", limits.nameMax)}
      />
      <TextField
        label="Description"
        hint="What the bot does and when to ask it, in one line. Other bots read it to choose who helps."
        multiline
        {...field("description", limits.descriptionMax)}
      />
      <div>
        <p className="font-semibold">Avatar style</p>
        <div className="mt-1.5 grid grid-cols-4 gap-3" role="radiogroup" aria-label="Avatar style">
          <StyleCard
            label="Flat"
            on={form.avatar_style === "flat"}
            readOnly={readOnly}
            onPick={() => {
              update((f) => ({ ...f, avatar_style: "flat" }));
            }}
          >
            <BotAvatar bot={flat} size="list" />
          </StyleCard>
          {form.avatar === null ? (
            <StyleCard label="Upload image" on={false} readOnly={readOnly} onPick={upload}>
              <span className="flex size-avatar-list items-center justify-center rounded-pill border-dashed-slot border-outline-strong text-on-surface-muted">
                <Plus aria-hidden size={20} />
              </span>
            </StyleCard>
          ) : (
            <StyleCard
              label="Your image"
              on={form.avatar_style === "upload"}
              readOnly={readOnly}
              onPick={() => {
                update((f) => ({ ...f, avatar_style: "upload" }));
              }}
              extra={
                <Button
                  size="small"
                  aria-disabled={readOnly}
                  onClick={readOnly ? undefined : upload}
                >
                  Replace
                </Button>
              }
            >
              <BotAvatar
                bot={{
                  avatar_style: "upload",
                  avatar_colour: form.avatar_colour,
                  avatar_url: form.avatar.url,
                }}
                size="list"
              />
            </StyleCard>
          )}
        </div>
        <FieldError text={styleError} />
      </div>
      <div>
        <p className="font-semibold">Colour</p>
        <p className="text-sm text-on-surface-muted">
          The band, the spinner and the Flow view use it, also with an uploaded image.
        </p>
        <div className="mt-2">
          <ColourRow
            colour={form.avatar_colour}
            disabled={readOnly}
            onChange={(colour) => {
              update((f) => ({ ...f, avatar_colour: colour }));
            }}
          />
        </div>
        <FieldError text={errorOf("avatar_colour")} />
      </div>
    </StepCard>
  );
}

function StyleCard({
  label,
  on,
  readOnly,
  onPick,
  extra,
  children,
}: {
  label: string;
  on: boolean;
  readOnly: boolean;
  onPick: () => void;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-card border p-3",
        on ? "border-primary bg-primary-tint" : "border-outline-strong",
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={on}
        aria-disabled={readOnly}
        onClick={() => {
          if (!readOnly) onPick();
        }}
        className="flex w-full flex-col items-center gap-2 rounded-card outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-disabled:cursor-not-allowed"
      >
        {children}
        <span className={on ? "font-semibold text-primary" : "text-on-surface-muted"}>{label}</span>
      </button>
      {extra}
    </div>
  );
}

// --- Step 2 · Persona (CS2) --------------------------------------------------------------

// The persona template (create-bot-page.md §2, PF4): role, goal, steps, rules with reasons,
// output, example.
const PERSONA_TEMPLATE = `You are the business analyst of a small product team.

## Goal
Turn rough ideas into user stories that a designer can use.

## How you work
1. Ask about the goal and the users first.
2. Write one story for each goal.

## Rules
- Ask before you guess, because a wrong story wastes the designer's time.

## Output
User stories with acceptance criteria, in Markdown.

## Example
As a shopper, I want to save my cart, so that I can buy later.`;

export function PersonaStep({ limits, ...props }: StepProps & { limits: BotLimits }) {
  const { form, update, readOnly, errorOf, onLeaveField } = props;
  return (
    <StepCard title="Persona" line="How the bot thinks and works. It reads this in every run.">
      <BodyField
        label="Persona"
        hint="Who the bot is, its goal, how it works and its rules. The bot reads it in every run. Put long procedures in skills."
        value={form.persona_md}
        error={errorOf("persona_md")}
        counter={counter(form.persona_md, limits.personaMax)}
        readOnly={readOnly}
        placeholder={PERSONA_TEMPLATE}
        warning={null}
        onChange={(value) => {
          update((f) => ({ ...f, persona_md: value }));
        }}
        onLeave={() => {
          onLeaveField("persona_md");
        }}
      />
    </StepCard>
  );
}

// --- Step 3 · Skills (CS3) ---------------------------------------------------------------

export interface SkillChoice {
  id: string;
  name: string;
  description: string;
  // The version a tick pins: the latest, or the copied one in a Clone.
  version: number;
  deprecated: boolean;
}

export function SkillsStep({
  skills,
  ...props
}: StepProps & {
  // The skills to show: every skill that is not deprecated, and the ticked ones.
  skills: readonly SkillChoice[];
}) {
  const { form, update, readOnly, errorOf } = props;
  const [query, setQuery] = useState("");
  const ticked = new Map(form.pins.map((pin, i) => [pin.skill_id, { pin, i }]));
  const needle = query.trim().toLocaleLowerCase();
  const shown = skills
    .filter(
      (skill) =>
        needle === "" ||
        skill.name.toLocaleLowerCase().includes(needle) ||
        skill.description.toLocaleLowerCase().includes(needle),
    )
    // A ticked row moves to the top.
    .sort((a, b) => Number(ticked.has(b.id)) - Number(ticked.has(a.id)));
  const toggle = (skill: SkillChoice, on: boolean) => {
    update((f) => ({
      ...f,
      pins: on
        ? [...f.pins, { skill_id: skill.id, skill_version_id: null, always_load: false }]
        : f.pins.filter((pin) => pin.skill_id !== skill.id),
    }));
  };
  return (
    <StepCard title="Skills" line="What the bot can use. Optional: you can add skills later.">
      <div>
        <div className="flex items-baseline justify-between">
          <p className="font-semibold">Skills</p>
          <span className="text-sm text-on-surface-muted">{form.pins.length} ticked</span>
        </div>
        <p className="text-sm text-on-surface-muted">
          Tick what the bot can use. Each skill gets its latest version.
        </p>
        <label className="mt-2 flex h-control items-center gap-2 rounded-control border border-outline-strong px-2 focus-within:border-primary">
          <Search aria-hidden className="size-3.5 text-on-surface-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setQuery("");
            }}
            placeholder="Search"
            aria-label="Search skills"
            className="min-w-0 grow bg-transparent outline-none placeholder:text-on-surface-muted"
          />
        </label>
        <ul
          aria-label="Skills"
          className="mt-2 flex h-96 flex-col gap-1.5 overflow-y-auto rounded-card border border-outline p-1.5"
        >
          {shown.length === 0 && (
            <li className="px-2 py-3 text-on-surface-muted">
              {skills.length === 0
                ? "No skills yet. You can add skills later."
                : `No skills match "${query.trim()}".`}
            </li>
          )}
          {shown.map((skill) => {
            const pick = ticked.get(skill.id);
            const problem = pick === undefined ? null : errorOf(`pins[${String(pick.i)}]`);
            return (
              <li
                key={skill.id}
                data-skill={skill.id}
                className={cn(
                  "flex items-center gap-3 rounded-card border px-3 py-2",
                  pick !== undefined ? "border-primary bg-primary-tint" : "border-outline",
                  problem !== null && "border-danger",
                )}
              >
                <Checkbox
                  checked={pick !== undefined}
                  disabled={readOnly}
                  onChange={(on) => {
                    toggle(skill, on);
                  }}
                  className="min-w-0 grow"
                >
                  <span className="min-w-0 grow">
                    <span className="flex items-center gap-1.5 font-semibold">
                      {skill.name}
                      {skill.deprecated && <Pill>Deprecated</Pill>}
                    </span>
                    <span className="block truncate text-sm text-on-surface-muted">
                      {skill.description}
                    </span>
                    {problem !== null && (
                      <span className="block text-sm text-danger">! {problem}</span>
                    )}
                  </span>
                </Checkbox>
                {pick !== undefined && (
                  <span className="flex shrink-0 items-center gap-1.5 text-sm text-on-surface-muted">
                    Always load
                    <Switch
                      checked={pick.pin.always_load}
                      label={`Always load ${skill.name}`}
                      disabled={readOnly}
                      onChange={(on) => {
                        update((f) => ({
                          ...f,
                          pins: f.pins.map((pin) =>
                            pin.skill_id === skill.id ? { ...pin, always_load: on } : pin,
                          ),
                        }));
                      }}
                    />
                  </span>
                )}
                <VersionPill version={skill.version} />
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-sm text-on-surface-muted">
          Always load: the bot reads the whole skill in every run. Off: it reads only the
          description and loads the skill when it needs it. Deprecated skills are not in the list.
        </p>
      </div>
    </StepCard>
  );
}

// --- Step 4 · Model (CS4, CS4b, CS4c) ----------------------------------------------------

export function ModelStep({
  models,
  tools,
  settings,
  turnedOff,
  onModel,
  ...props
}: StepProps & {
  models: readonly CatalogModel[];
  tools: readonly CatalogTool[];
  settings: FormSettings;
  // The info line after a model change (§3.0).
  turnedOff: { model: string; tools: string[] } | null;
  onModel: (model: CatalogModel) => void;
}) {
  const { form, update, readOnly, errorOf } = props;
  const modelId = useId();
  const effortId = useId();
  const model = models.find((m) => m.id === form.model_id);
  const providers = [...new Set(models.map((m) => m.provider))];
  const effective = effectiveTools(form, tools, model);
  const history = historyLabel(form.history_share_pct, model?.context_window);
  return (
    <StepCard title="Model" line="Model and effort are fixed after Create. Advanced has defaults.">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor={modelId} className="font-semibold">
            Model
          </label>
          <select
            id={modelId}
            value={form.model_id ?? ""}
            disabled={readOnly}
            aria-invalid={errorOf("model_id") !== null}
            onChange={(event) => {
              const next = models.find((m) => m.id === event.target.value);
              if (next !== undefined) onModel(next);
            }}
            className={cn(SELECT, errorOf("model_id") !== null && "border-danger")}
          >
            {model === undefined && <option value={form.model_id ?? ""}>Pick a model</option>}
            {providers.map((provider) => (
              <optgroup key={provider} label={providerLabel(provider)}>
                {models
                  .filter((m) => m.provider === provider)
                  .map((m) => (
                    <option key={m.id} value={m.id} disabled={!m.available}>
                      {m.available
                        ? m.label
                        : `${m.label} · API key not set: ${m.api_key_env ?? "a key"}`}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <FieldError text={errorOf("model_id")} />
        </div>
        {model !== undefined && model.efforts.length > 0 && (
          <div>
            <label htmlFor={effortId} className="font-semibold">
              Effort
            </label>
            <select
              id={effortId}
              value={form.effort ?? ""}
              disabled={readOnly}
              onChange={(event) => {
                const effort = model.efforts.find((e) => e === event.target.value);
                if (effort !== undefined) update((f) => ({ ...f, effort }));
              }}
              className={SELECT}
            >
              {model.efforts.map((effort) => (
                <option key={effort} value={effort}>
                  {EFFORT_LABELS[effort]}
                </option>
              ))}
            </select>
            <FieldError text={errorOf("effort")} />
          </div>
        )}
      </div>
      <p className="-mt-2 text-sm text-on-surface-muted">
        You cannot change the model or the effort after you create the bot. To use another one
        later, clone the bot.
      </p>
      <div className="rounded-card border border-outline p-4">
        <p className="font-semibold">Tools</p>
        {turnedOff !== null && turnedOff.tools.length > 0 && (
          <p role="status" className="mt-1 text-sm text-on-surface-muted">
            Turned off because {turnedOff.model} does not have them: {turnedOff.tools.join(", ")}.
          </p>
        )}
        <ToolsList
          rows={toolRows(tools, model)}
          effective={effective}
          modelPicked={model !== undefined}
          multimodal={model?.multimodal ?? true}
          readOnly={readOnly}
          problems={{ ...toolProblems(errorOf, tools) }}
          onToggle={(toolId, on) => {
            update((f) => ({ ...f, tool_choices: { ...f.tool_choices, [toolId]: on } }));
          }}
          onPair={(row, choice) => {
            update((f) => withPairChoice(f, row, choice));
          }}
        />
        <FieldError text={errorOf("tool_settings")} />
      </div>
      <div className="rounded-card border border-outline p-4">
        <p className="font-semibold">Advanced</p>
        <div className="mt-3">
          <p className="font-semibold">History: {form.history_share_pct} % of context</p>
          <p className="text-sm text-on-surface-muted">
            How much of the conversation the bot reads before each reply. More history leaves less
            room for files and tools.
          </p>
          <div className="mt-2 flex items-center gap-4">
            <Slider
              label="History share"
              value={form.history_share_pct}
              min={settings.historyMin}
              max={settings.historyMax}
              step={HISTORY_STEP_PCT}
              disabled={readOnly}
              valueText={(v) => `${String(v)} %`}
              onChange={(v) => {
                update((f) => ({ ...f, history_share_pct: v }));
              }}
            />
            <NumberBox
              label="History share in percent"
              unit="%"
              value={form.history_share_pct}
              readOnly={readOnly}
              onChange={(v) => {
                update((f) => ({ ...f, history_share_pct: v }));
              }}
              className="w-20"
            />
          </div>
          {history !== null && <p className="mt-1 text-sm text-on-surface-muted">{history}</p>}
          <FieldError text={errorOf("history_share_pct")} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="font-semibold">Model requests per run</p>
            <p className="text-sm text-on-surface-muted">
              A run stops at this number of model calls.
            </p>
            <NumberBox
              label="Model requests per run"
              value={form.request_limit}
              min={BOT_VALUE_RANGES.request_limit.min}
              max={BOT_VALUE_RANGES.request_limit.max}
              readOnly={readOnly}
              onChange={(v) => {
                update((f) => ({ ...f, request_limit: v }));
              }}
              className="mt-1.5"
            />
            <FieldError text={errorOf("request_limit")} />
          </div>
          <div>
            <p className="font-semibold">Longest reply</p>
            <p className="text-sm text-on-surface-muted">In characters. A longer reply is cut.</p>
            <NumberBox
              label="Longest reply in characters"
              unit="characters"
              value={form.max_reply_chars}
              min={BOT_VALUE_RANGES.max_reply_chars.min}
              max={BOT_VALUE_RANGES.max_reply_chars.max}
              readOnly={readOnly}
              onChange={(v) => {
                update((f) => ({ ...f, max_reply_chars: v }));
              }}
              className="mt-1.5"
            />
            <FieldError text={errorOf("max_reply_chars")} />
          </div>
        </div>
      </div>
    </StepCard>
  );
}

const SELECT =
  "mt-1.5 h-9 w-full rounded-control border border-outline-strong bg-surface px-2 outline-none focus:border-primary disabled:opacity-60";

function providerLabel(provider: string): string {
  if (provider === "fake") return "Fake (tests)";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function toolProblems(errorOf: (field: string) => string | null, tools: readonly CatalogTool[]) {
  const out: Partial<Record<string, string>> = {};
  for (const tool of tools) {
    const problem = errorOf(`tool_settings.${tool.id}`);
    if (problem !== null) out[`tool_settings.${tool.id}`] = problem;
  }
  return out;
}

// A number box with its unit (ui-rules P9). Empty or not a number stays as typed until it is
// a whole number again.
function NumberBox({
  label,
  unit,
  value,
  min,
  max,
  readOnly,
  onChange,
  className,
}: {
  label: string;
  unit?: string;
  value: number;
  min?: number;
  max?: number;
  readOnly: boolean;
  onChange: (value: number) => void;
  className?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <span
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-control border border-outline-strong bg-surface px-2 focus-within:border-primary",
        className,
      )}
    >
      <input
        type="number"
        aria-label={label}
        value={text ?? String(value)}
        min={min}
        max={max}
        readOnly={readOnly}
        onChange={(event) => {
          setText(event.target.value);
          const n = Number(event.target.value);
          if (event.target.value.trim() !== "" && Number.isFinite(n)) onChange(n);
        }}
        onBlur={() => {
          setText(null);
        }}
        className="min-w-0 grow bg-transparent tabular-nums outline-none"
      />
      {unit !== undefined && <span className="text-sm text-on-surface-muted">{unit}</span>}
    </span>
  );
}
