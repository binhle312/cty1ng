import type { CatalogModel } from "@cty1ng/shared/catalog";
import { formatCount } from "@cty1ng/shared/skills";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.ts";
import { BotAvatar } from "./bot-avatar.tsx";
import { BotBand } from "./bot-band.tsx";
import { EFFORT_LABELS } from "./bot-lines.ts";
import { type CreateForm, type Step, STEP_LABELS, STEPS } from "./create-bot-form.ts";
import type { SkillChoice } from "./create-bot-steps.tsx";

// The live preview card (create-bot-page.md §4): the top is how the bot looks in the header, the
// lists and conversations; then one section per step. It is the review: there is no Review step.

export type SectionState = "current" | "done" | "not_reached" | "error";

export type PreviewPill = "not_created" | "ready" | "creating";

const PILL: Record<PreviewPill, { text: string; className: string }> = {
  not_created: {
    text: "Not created yet",
    className: "border-outline-strong text-on-surface-muted",
  },
  ready: { text: "Ready to create", className: "border-success text-success" },
  creating: { text: "Creating", className: "border-outline-strong text-on-surface" },
};

export function CreatePreview({
  form,
  states,
  pill,
  models,
  skills,
  onEdit,
}: {
  form: CreateForm;
  states: Record<Step, SectionState>;
  pill: PreviewPill;
  models: readonly CatalogModel[];
  skills: readonly SkillChoice[];
  // Null while Create is on its way: no Edit links (E4).
  onEdit: ((step: Step) => void) | null;
}) {
  const avatar = {
    avatar_style: form.avatar_style,
    avatar_colour: form.avatar_colour,
    avatar_url: form.avatar_style === "upload" ? (form.avatar?.url ?? null) : null,
  };
  const model = models.find((m) => m.id === form.model_id);
  const values: Record<Step, ReactNode> = {
    basics: (
      <Row label="Avatar">
        <span className="flex items-center gap-1.5">
          {form.avatar_style === "upload" ? "Your image" : "Flat"}
          <span
            aria-hidden
            className="size-2.5 rounded-pill"
            style={{ backgroundColor: form.avatar_colour }}
          />
        </span>
      </Row>
    ),
    persona: <p className="line-clamp-3 whitespace-pre-line">{form.persona_md}</p>,
    skills: (
      <Row label="Skills">
        {form.pins.length === 0
          ? "None"
          : form.pins
              .map((pin) => {
                const skill = skills.find((s) => s.id === pin.skill_id);
                const name =
                  skill === undefined ? "A skill" : `${skill.name} v${String(skill.version)}`;
                return pin.always_load ? `${name} (always load)` : name;
              })
              .join(", ")}
      </Row>
    ),
    model: (
      <>
        <Row label="Model">
          {model === undefined
            ? "Not picked"
            : form.effort === null
              ? model.label
              : `${model.label} · ${EFFORT_LABELS[form.effort]}`}
        </Row>
        <Row label="Advanced">
          History {form.history_share_pct} % · {formatCount(form.request_limit)} requests ·{" "}
          {formatCount(form.max_reply_chars)} characters
        </Row>
      </>
    ),
  };
  const pillLook = PILL[pill];
  return (
    <aside
      aria-label="Preview"
      className="sticky top-6 w-preview shrink-0 overflow-hidden rounded-card border border-outline bg-surface-container"
    >
      <div className="relative flex flex-col items-center px-4 pt-5 pb-4 text-center">
        <BotBand colour={form.avatar_colour} className="h-20" />
        <BotAvatar bot={avatar} size="list" className="mt-2" />
        <p className="mt-3 w-full truncate text-lg font-semibold">
          {form.name.trim() === "" ? "New bot" : form.name}
        </p>
        <span
          data-testid="preview-pill"
          className={cn(
            "mt-1 rounded-pill border px-2 py-0.5 text-xs font-semibold",
            pillLook.className,
          )}
        >
          {pillLook.text}
        </span>
        {form.description.trim() !== "" && (
          <p className="mt-2 line-clamp-3 text-on-surface-muted">{form.description}</p>
        )}
      </div>
      {STEPS.map((step) => (
        <Section
          key={step}
          step={step}
          state={states[step]}
          onEdit={
            onEdit === null
              ? null
              : () => {
                  onEdit(step);
                }
          }
        >
          {values[step]}
        </Section>
      ))}
      <p className="border-t border-outline px-4 py-3 text-sm text-on-surface-muted">
        The top part is how the bot looks in the header, the lists and conversations.
      </p>
    </aside>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="flex gap-3">
      <span className="w-16 shrink-0 text-on-surface-muted">{label}</span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}

function Section({
  step,
  state,
  onEdit,
  children,
}: {
  step: Step;
  state: SectionState;
  onEdit: (() => void) | null;
  children: ReactNode;
}) {
  return (
    <section
      data-section={step}
      data-state={state}
      className={cn(
        "border-t border-outline px-4 py-3 text-sm",
        state === "current" && "border-l-2 border-l-primary bg-primary-container",
        state === "not_reached" && "opacity-50",
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{STEP_LABELS[step]}</h3>
        {state === "current" && (
          <span className="text-xs font-semibold text-primary">Filling in</span>
        )}
        {state === "not_reached" && (
          <span className="text-xs text-on-surface-muted">Not filled yet</span>
        )}
        {state === "error" && (
          <span
            role="img"
            aria-label="Has an error"
            className="flex size-4 items-center justify-center rounded-pill bg-danger text-badge font-bold text-on-primary"
          >
            !
          </span>
        )}
        {state === "done" && onEdit !== null && (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
          >
            Edit<span className="sr-only"> {STEP_LABELS[step]}</span>
          </button>
        )}
      </div>
      {state !== "not_reached" && <div className="mt-1.5 flex flex-col gap-1">{children}</div>}
    </section>
  );
}
