import type { SkillTextField } from "@cty1ng/shared/skills";
import { useId, useState, type ReactNode } from "react";
import { Markdown } from "../../components/ui/markdown.tsx";
import { Tab, TabsList, TabsPanel, TabsRoot } from "../../components/ui/tabs.tsx";
import { cn } from "../../lib/cn.ts";
import { bodyLinesWarning, counter, type SkillForm } from "./skill-form.ts";
import type { EditorSettings } from "./skill-queries.ts";

// The editor fields of the Skill tab (skills-page.md §2, §4, §6): Name, Slug (a new skill
// only), Description and Body, each with its counter. Only the field in focus gets a `primary`
// border. An empty field shows its error after the owner leaves it; a field over its limit, a
// bad slug or an error from the server shows at once. Read-only fields are real read-only
// controls, not disabled ones: they take focus, so the owner can select and copy the text from
// the keyboard (owner, 2026-10-31).

const BODY_PLACEHOLDER = `## Steps
1. Read the brief and the open questions.
2. Write one user story for each goal.
3. Add acceptance criteria to each story.

## Format
- As a <role>, I want <goal>, so that <reason>.`;

interface SkillFieldsProps {
  form: SkillForm;
  onChange: (field: SkillTextField, value: string) => void;
  settings: EditorSettings;
  problems: Record<SkillTextField, string | null>;
  // A field error from the last save (slug taken, a likely secret).
  serverError: { field: SkillTextField; message: string } | null;
  readOnly: boolean;
}

export function SkillFields({
  form,
  onChange,
  settings,
  problems,
  serverError,
  readOnly,
}: SkillFieldsProps) {
  const [left, setLeft] = useState<ReadonlySet<SkillTextField>>(new Set());
  const errorOf = (field: SkillTextField): string | null => {
    if (serverError?.field === field) return serverError.message;
    const problem = problems[field];
    if (problem === null) return null;
    // "Type a name." waits until the owner leaves the empty field.
    const empty = form.current[field].trim() === "";
    return empty && !left.has(field) ? null : problem;
  };
  const field = (name: SkillTextField) => ({
    value: form.current[name],
    error: errorOf(name),
    counter: counter(name, form.current[name], settings.limits),
    readOnly,
    onChange: (value: string) => {
      onChange(name, value);
    },
    onLeave: () => {
      setLeft((current) => new Set(current).add(name));
    },
  });

  return (
    <div className="flex flex-col gap-3.5">
      <TextField label="Name" {...field("name")} />
      {form.isNew && (
        <TextField
          label="Slug"
          hint="Made from the name. Fixed after you create it."
          mono
          {...field("slug")}
        />
      )}
      <TextField
        label="Description"
        hint="Say when a bot must use this skill. Bots read it in every prompt, so keep it short."
        placeholder={
          form.isNew
            ? "Example: Use this skill when the owner asks for user stories. It writes each story in Given / When / Then."
            : undefined
        }
        multiline
        {...field("description")}
      />
      <BodyField
        label="Body"
        {...field("body_md")}
        placeholder={form.isNew ? BODY_PLACEHOLDER : undefined}
        warning={bodyLinesWarning(form.current.body_md, settings.warnLines)}
      />
    </div>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  value: string;
  error: string | null;
  counter: { text: string; over: boolean };
  readOnly: boolean;
  placeholder?: string | undefined;
  onChange: (value: string) => void;
  onLeave: () => void;
}

function FieldFrame({
  label,
  hint,
  counter: count,
  error,
  inputId,
  children,
  warning,
}: Pick<FieldProps, "label" | "hint" | "counter" | "error"> & {
  inputId: string;
  children: ReactNode;
  warning?: string | null;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between">
        <label htmlFor={inputId} className="font-semibold">
          {label}
        </label>
        <span
          className={cn(
            "text-sm text-on-surface-muted tabular-nums",
            count.over && "font-semibold text-danger",
          )}
        >
          {count.text}
        </span>
      </div>
      {hint !== undefined && <p className="text-sm text-on-surface-muted">{hint}</p>}
      <div className="mt-1.5">{children}</div>
      {error !== null && (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-danger">
          <span aria-hidden className="font-bold">
            !{" "}
          </span>
          {error}
        </p>
      )}
      {warning != null && <p className="mt-1 text-sm text-waiting">{warning}</p>}
    </div>
  );
}

const BOX =
  "w-full rounded-control border border-outline-strong bg-surface px-2.5 py-1.5 outline-none placeholder:text-on-surface-muted focus:border-primary read-only:bg-surface-raised";

function TextField({
  multiline = false,
  mono = false,
  ...props
}: FieldProps & { multiline?: boolean; mono?: boolean }) {
  const id = useId();
  const common = {
    id,
    value: props.value,
    readOnly: props.readOnly,
    placeholder: props.placeholder,
    "aria-invalid": props.error !== null,
    "aria-describedby": props.error === null ? undefined : `${id}-error`,
    onBlur: props.onLeave,
    className: cn(BOX, mono && "font-mono", props.error !== null && "border-danger"),
  };
  return (
    <FieldFrame {...props} inputId={id}>
      {multiline ? (
        <textarea
          {...common}
          rows={2}
          className={cn(common.className, "field-sizing-content min-h-16 resize-none")}
          onChange={(event) => {
            props.onChange(event.target.value);
          }}
        />
      ) : (
        <input
          {...common}
          className={cn(common.className, "h-9")}
          onChange={(event) => {
            props.onChange(event.target.value);
          }}
        />
      )}
    </FieldFrame>
  );
}

// The Body box with Write and Preview on top (§2): it opens in Preview when it has text, and in
// Write when it is empty or has an error. Preview renders Markdown with raw HTML off.
function BodyField(props: FieldProps & { warning: string | null }) {
  const id = useId();
  const [tab, setTab] = useState<"write" | "preview">(() =>
    props.value.trim() === "" || props.error !== null ? "write" : "preview",
  );
  const shown = props.error !== null ? "write" : tab;
  return (
    <FieldFrame
      {...props}
      hint="The steps a bot follows for this task. Bots read it only when they load the skill."
      inputId={id}
    >
      <TabsRoot
        value={shown}
        onValueChange={(value) => {
          setTab(value === "preview" ? "preview" : "write");
        }}
        className={cn(
          "rounded-control border border-outline-strong focus-within:border-primary",
          props.error !== null && "border-danger",
        )}
      >
        <div className="flex items-center justify-between border-b border-outline-strong px-3">
          <TabsList className="gap-4">
            <Tab value="write" className="h-8 text-sm">
              Write
            </Tab>
            <Tab value="preview" className="h-8 text-sm">
              Preview
            </Tab>
          </TabsList>
          <span className="text-sm text-on-surface-muted">Markdown</span>
        </div>
        <TabsPanel value="write">
          <textarea
            id={id}
            value={props.value}
            readOnly={props.readOnly}
            placeholder={props.placeholder}
            aria-label={props.label}
            aria-invalid={props.error !== null}
            aria-describedby={props.error === null ? undefined : `${id}-error`}
            onBlur={props.onLeave}
            onChange={(event) => {
              props.onChange(event.target.value);
            }}
            className="field-sizing-content block min-h-72 w-full resize-none bg-transparent px-3 py-2.5 font-mono outline-none placeholder:text-on-surface-muted read-only:bg-surface-raised"
          />
        </TabsPanel>
        <TabsPanel value="preview">
          <Markdown className="markdown min-h-72 px-4 py-3">{props.value}</Markdown>
        </TabsPanel>
      </TabsRoot>
    </FieldFrame>
  );
}
