import type { CatalogModel } from "@cty1ng/shared/catalog";
import { avatarUrl } from "@cty1ng/shared/bots";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button.tsx";
import { showToast } from "../../components/ui/toast.tsx";
import { readApiError } from "../../lib/api/api-error.ts";
import {
  getBotCloneTemplateOptions,
  getSettingsOptions,
  listModelsOptions,
  listSkillsOptions,
  listToolsOptions,
} from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import { createBot } from "../../lib/api/generated/sdk.gen.ts";
import type {
  GetBotCloneTemplateResponse,
  GetSettingsResponse,
  ListSkillsResponse,
  ListToolsResponse,
} from "../../lib/api/generated/types.gen.ts";
import { PIN_QUERIES } from "../../lib/api/operation-queries.ts";
import { cn } from "../../lib/cn.ts";
import { PageSkeleton } from "../placeholder/page-skeleton.tsx";
import { useLeaveGuard } from "../skills/leave-guard.tsx";
import { LoadError } from "../skills/load-error.tsx";
import { SaveButton } from "../skills/save-bar.tsx";
import { defaultBotColour } from "./bot-colours.ts";
import { type BotRow, useBots } from "./bot-queries.ts";
import {
  type CreateBotBody,
  type CreateForm,
  createBody,
  emptyForm,
  type FormContext,
  type FormSettings,
  hasInput,
  hasProblems,
  type Problems,
  STEP_LABELS,
  STEPS,
  type Step,
  stepOfField,
  stepProblems,
  toolsTurnedOff,
  withModel,
} from "./create-bot-form.ts";
import { CreatePreview, type PreviewPill, type SectionState } from "./create-bot-preview.tsx";
import {
  BasicsStep,
  ModelStep,
  PersonaStep,
  type SkillChoice,
  SkillsStep,
} from "./create-bot-steps.tsx";
import { useAvatarUpload } from "./crop-card.tsx";

// `/bots/new` and `/bots/new?from={bot id}` (create-bot-page.md, UI-5): four steps and a live
// preview card. Clone fills the form from `GET /bots/{id}/clone-template` and opens on Model.
// The page waits for its data once: the settings (limits, defaults), the catalog, the bots and
// the skills. After the first answer it never shows the skeleton again
// (frontend-conventions.md §5, "Waiting on a query that keeps failing").
export function CreateBotPage() {
  const { from } = useSearch({ from: "/bots/new" });
  const settings = useQuery(getSettingsOptions());
  const models = useQuery(listModelsOptions());
  const tools = useQuery(listToolsOptions());
  const skills = useQuery(listSkillsOptions());
  const bots = useBots();
  const template = useQuery({
    ...getBotCloneTemplateOptions({ path: { id: from ?? "" } }),
    enabled: from !== undefined,
    retry: false,
  });
  const queries = [settings, models, tools, skills, bots];
  const failed = queries.find((q) => q.data === undefined && q.isError);
  if (failed !== undefined) {
    return (
      <LoadError
        text="The app could not load what the Create page needs."
        onRetry={() => {
          for (const q of queries) if (q.isError) void q.refetch();
        }}
      />
    );
  }
  if (from !== undefined && template.data === undefined) {
    if (template.isError) {
      const code = readApiError(template.error)?.code;
      return code === undefined || code === "internal_error" ? (
        <LoadError
          text="The app could not load the bot to copy."
          onRetry={() => void template.refetch()}
        />
      ) : (
        <div role="alert" className="flex items-center gap-4 px-8 py-6">
          <p className="text-on-surface-muted">The app could not find the bot to copy.</p>
          <Link to="/bots" className="text-primary hover:underline">
            ← Back
          </Link>
        </div>
      );
    }
    return <PageSkeleton />;
  }
  if (
    settings.data === undefined ||
    models.data === undefined ||
    tools.data === undefined ||
    skills.data === undefined ||
    bots.data === undefined
  ) {
    return <PageSkeleton />;
  }
  return (
    <CreateBotView
      key={from ?? "new"}
      settings={settings.data}
      models={models.data}
      tools={tools.data}
      skills={skills.data}
      bots={bots.data}
      template={from === undefined ? null : (template.data ?? null)}
    />
  );
}

function formSettings(settings: GetSettingsResponse): FormSettings {
  return {
    limits: {
      nameMax: settings.bot_name_max,
      descriptionMax: settings.bot_description_max,
      personaMax: settings.bot_persona_max,
    },
    historyMin: settings.bot_history_min_pct,
    historyMax: settings.bot_history_max_pct,
    defaultHistory: settings.bot_default_history_pct,
    defaultRequestLimit: settings.bot_default_request_limit,
    defaultMaxReplyChars: settings.bot_default_max_reply_chars,
  };
}

// The first form: empty with the first available model, or a Clone (§6).
function startForm({
  template,
  settings,
  models,
  bots,
}: {
  template: GetBotCloneTemplateResponse | null;
  settings: FormSettings;
  models: readonly CatalogModel[];
  bots: readonly BotRow[];
}): CreateForm {
  const colour = defaultBotColour(
    bots.map((bot) => bot.avatar_colour),
    Math.random,
  );
  const empty = emptyForm(colour, settings);
  if (template === null) return empty;
  const model = models.find((m) => m.id === template.model_id);
  const upload = template.avatar_style === "upload" && template.avatar_id !== undefined;
  return {
    ...empty,
    name: template.name,
    description: template.description,
    persona_md: template.persona_md,
    avatar_style: upload ? "upload" : "flat",
    avatar:
      upload && template.avatar_id !== undefined
        ? { id: template.avatar_id, url: avatarUrl(template.avatar_id) }
        : null,
    pins: template.pins.map((pin) => ({
      skill_id: pin.skill_id,
      skill_version_id: pin.skill_version_id,
      always_load: pin.always_load,
    })),
    // CL2: a model that left the catalog starts empty. A model with no key stays (§6).
    model_id: model === undefined ? null : model.id,
    effort: model === undefined ? null : template.effort,
    tool_choices: { ...template.tool_settings },
    history_share_pct: template.history_share_pct,
    request_limit: template.request_limit,
    max_reply_chars: template.max_reply_chars,
    cloned_from_bot_id: template.cloned_from_bot_id,
  };
}

// The request Create sent, while its outcome is not known: Try again resends it unchanged, with
// the same Idempotency-Key, so a retry never makes two bots (E5, api.md §4).
type Send =
  | { kind: "idle" }
  | { kind: "sending"; key: string; body: CreateBotBody }
  | { kind: "unknown"; key: string; body: CreateBotBody };

const LEAVE_WORDS = { title: "Leave without creating?", leave: "Leave", stay: "Stay" };

function CreateBotView({
  settings: rawSettings,
  models,
  tools,
  skills,
  bots,
  template,
}: {
  settings: GetSettingsResponse;
  models: readonly CatalogModel[];
  tools: ListToolsResponse;
  skills: ListSkillsResponse;
  bots: readonly BotRow[];
  template: GetBotCloneTemplateResponse | null;
}) {
  const settings = formSettings(rawSettings);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const source =
    template === null ? undefined : bots.find((b) => b.id === template.cloned_from_bot_id);
  const [start] = useState(() => startForm({ template, settings, models, bots }));
  const [form, setForm] = useState(start);
  // The model that left the catalog, for the CL2 error.
  const [goneModel] = useState(() =>
    template !== null && !models.some((m) => m.id === template.model_id) ? template.model_id : null,
  );
  const [step, setStep] = useState<Step>(template === null ? "basics" : "model");
  const [visited, setVisited] = useState<ReadonlySet<Step>>(
    () => new Set(template === null ? ["basics"] : STEPS),
  );
  // Steps where Next or Create was pressed with errors: their errors show.
  const [tried, setTried] = useState<ReadonlySet<Step>>(
    () => new Set(goneModel === null ? [] : ["model"]),
  );
  const [left, setLeft] = useState<ReadonlySet<string>>(new Set());
  const [serverProblems, setServerProblems] = useState<Problems>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [send, setSend] = useState<Send>({ kind: "idle" });
  const [uploadError, setUploadError] = useState<string | null>(null);
  // The info line after a model change on step 4 (§3.0).
  const [turnedOff, setTurnedOff] = useState<{ model: string; tools: string[] } | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const readOnly = send.kind !== "idle";
  const ctx: FormContext = {
    settings,
    models,
    botNames: bots.map((b) => b.name),
    missingSkillIds: new Set(
      form.pins.map((p) => p.skill_id).filter((id) => !skills.some((s) => s.id === id)),
    ),
  };
  const problems: Record<Step, Problems> = {
    basics: stepProblems("basics", form, ctx),
    persona: stepProblems("persona", form, ctx),
    skills: stepProblems("skills", form, ctx),
    model: stepProblems("model", form, ctx),
  };
  const localOk = (s: Step) => !hasProblems(problems[s]);
  const serverIn = (s: Step) =>
    Object.entries(serverProblems).some(
      ([field, p]) => p !== undefined && stepOfField(field) === s,
    );
  const stepError = (s: Step) => serverIn(s) || (tried.has(s) && !localOk(s));

  const update = (change: (f: CreateForm) => CreateForm) => {
    if (readOnly) return;
    const next = change(form);
    setForm(next);
    // A server error goes when the owner changes its field (E3).
    setServerProblems((old) => keepUnchanged(old, form, next));
  };

  const errorOf = (field: string): string | null => {
    const server = serverProblems[field];
    if (server !== undefined) return server;
    const s = stepOfField(field);
    const local = problems[s][field];
    if (local === undefined) return null;
    if (field === "model_id" && form.model_id === null && goneModel !== null) {
      return `${goneModel} is no longer offered. Pick another model.`;
    }
    // A size error shows at once; an empty field or a taken name after the owner leaves it.
    return isTooLong(form, field, settings) || left.has(field) || tried.has(s) ? local : null;
  };

  const upload = useAvatarUpload({
    onUploaded: (avatar) => {
      update((f) => ({ ...f, avatar, avatar_style: "upload" }));
    },
    onError: setUploadError,
  });

  const nameText = form.name.trim() === "" ? "The bot" : form.name.trim();
  const leave = useLeaveGuard({
    dirty: hasInput(form, start),
    text: `${nameText} is not created. What you typed in the 4 steps is lost.`,
    words: LEAVE_WORDS,
  });

  const index = STEPS.indexOf(step);
  const canOpen = (target: Step) => STEPS.slice(0, STEPS.indexOf(target)).every(localOk);
  const open = (target: Step) => {
    if (readOnly || !canOpen(target)) return;
    if (step === "model" && target !== "model") setTurnedOff(null);
    setStep(target);
    setVisited((v) => new Set(v).add(target));
  };
  const focusFirstError = () => {
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("#create-form [aria-invalid='true']")?.focus();
    });
  };
  const next = () => {
    if (!localOk(step)) {
      setTried((t) => new Set(t).add(step));
      focusFirstError();
      return;
    }
    const target = STEPS[index + 1];
    if (target !== undefined) open(target);
  };
  const back = () => {
    if (readOnly) return;
    if (index === 0) {
      void leaveToPrevious();
      return;
    }
    const target = STEPS[index - 1];
    if (target !== undefined) open(target);
  };
  const leaveToPrevious = async () => {
    if (router.history.length > 1) router.history.back();
    else await navigate({ to: "/bots" });
  };

  const modelOf = (id: string | null) => models.find((m) => m.id === id);
  const modelReady = modelOf(form.model_id)?.available === true;
  const anyServer = Object.values(serverProblems).some((p) => p !== undefined);
  const createOff =
    send.kind === "sending"
      ? "Creating the bot."
      : send.kind === "unknown"
        ? "Use Try again above: the app does not know yet if the bot was created."
        : anyServer
          ? "Fix the problems marked with ! first."
          : !modelReady
            ? "Pick a model that can run."
            : null;

  // A double click, or a second Try again, sends one request (UI-5.6): state alone is not set
  // until the next render.
  const inFlight = useRef(false);
  const sendRequest = (request: { key: string; body: CreateBotBody }) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSend({ kind: "sending", ...request });
    setGeneralError(null);
    createBot({
      body: request.body,
      headers: { "idempotency-key": request.key },
      throwOnError: true,
    })
      .then(async ({ data: bot }) => {
        leave.allowLeave();
        // The bot page finds the bot in the list, so the list is fresh before it opens
        // (frontend-conventions.md §5).
        await queryClient.invalidateQueries({ predicate: PIN_QUERIES });
        showToast(`Created ${bot.name} ✨`);
        if (mounted.current) {
          await navigate({
            to: "/bots/$slug",
            params: { slug: bot.slug },
            search: { tab: "profile" },
          });
        }
      })
      .catch((error: unknown) => {
        inFlight.current = false;
        if (!mounted.current) return;
        const api = readApiError(error);
        if (api === null || api.code === "internal_error") {
          // E5: the outcome is not known. The form stays read-only with the same request.
          setSend({ kind: "unknown", ...request });
          return;
        }
        // E3: an input error unlocks the form; the next Create is a new request.
        setSend({ kind: "idle" });
        if (api.field === undefined) {
          setGeneralError(api.message);
          return;
        }
        const message =
          api.code === "name_taken"
            ? `${form.name.trim()} is taken by another bot, maybe one in Trash. Pick another name.`
            : api.message;
        setServerProblems({ [api.field]: message });
      });
  };

  const create = () => {
    if (createOff !== null) return;
    const bad = STEPS.find((s) => !localOk(s));
    if (bad !== undefined) {
      setTried(new Set(STEPS.filter((s) => !localOk(s))));
      setStep(bad);
      setVisited((v) => new Set(v).add(bad));
      focusFirstError();
      return;
    }
    sendRequest({ key: crypto.randomUUID(), body: createBody(form, tools, models) });
  };

  const sectionState = (s: Step): SectionState => {
    if (stepError(s)) return "error";
    if (s === step && send.kind === "idle") return "current";
    return visited.has(s) ? "done" : "not_reached";
  };
  const pill: PreviewPill =
    send.kind !== "idle"
      ? "creating"
      : STEPS.every(localOk) && !anyServer && modelReady
        ? "ready"
        : "not_created";

  const skillChoices = skillChoicesOf({ skills, form: start, source });

  const stepProps = {
    form,
    update,
    readOnly,
    errorOf,
    onLeaveField: (field: string) => {
      setLeft((l) => new Set(l).add(field));
    },
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col px-8 py-6">
      <button
        type="button"
        onClick={() => void leaveToPrevious()}
        aria-disabled={readOnly}
        className="flex w-fit items-center gap-1 text-on-surface-muted hover:text-on-surface aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
      >
        <ArrowLeft aria-hidden size={14} />
        Back
      </button>
      <h1 className="mt-2 text-title font-semibold">New bot</h1>
      <Stepper
        current={step}
        done={(s) => visited.has(s) && localOk(s) && !serverIn(s) && s !== step}
        error={stepError}
        canOpen={(s) => !readOnly && canOpen(s)}
        onOpen={open}
      />
      {template !== null && (
        <CloneBanner
          name={source?.name ?? template.name.replace(/ \(copy( \d+)?\)$/, "")}
          slug={source?.slug ?? null}
          modelGone={goneModel !== null}
        />
      )}
      {send.kind === "unknown" && (
        <div
          role="alert"
          className="mt-4 flex items-center gap-4 rounded-card border border-danger px-4 py-3"
        >
          <p className="grow text-danger">
            Could not create the bot. The app could not reach the server. Your input is kept.
          </p>
          <Button
            size="small"
            onClick={() => {
              sendRequest(send);
            }}
          >
            Try again
          </Button>
        </div>
      )}
      <div className="mt-5 flex items-start gap-6">
        <div id="create-form" className="min-w-0 grow">
          {step === "basics" && (
            <BasicsStep
              {...stepProps}
              limits={settings.limits}
              upload={() => {
                if (!readOnly) upload.choose();
              }}
              uploadError={uploadError}
            />
          )}
          {step === "persona" && <PersonaStep {...stepProps} limits={settings.limits} />}
          {step === "skills" && <SkillsStep {...stepProps} skills={skillChoices} />}
          {step === "model" && (
            <ModelStep
              {...stepProps}
              models={models}
              tools={tools}
              settings={settings}
              turnedOff={turnedOff}
              onModel={(model) => {
                const before = modelOf(form.model_id);
                const off = toolsTurnedOff(form, tools, before, model);
                setTurnedOff(off.length === 0 ? null : { model: model.label, tools: off });
                update((f) => withModel(f, model));
              }}
            />
          )}
        </div>
        <CreatePreview
          form={form}
          states={{
            basics: sectionState("basics"),
            persona: sectionState("persona"),
            skills: sectionState("skills"),
            model: sectionState("model"),
          }}
          pill={pill}
          models={models}
          skills={skillChoices}
          onEdit={readOnly ? null : open}
        />
      </div>
      <div className="sticky bottom-0 mt-6 flex items-center gap-3 border-t border-outline bg-surface py-3">
        <p className="grow text-on-surface-muted">
          Step {index + 1} of {STEPS.length}.
          {step === "model" ? " Check the card on the right, then Create." : ""}
        </p>
        {generalError !== null && <p className="text-sm text-danger">{generalError}</p>}
        <Button aria-disabled={readOnly} onClick={back}>
          {index === 0 ? "Cancel" : "Back"}
        </Button>
        {step === "model" ? (
          <SaveButton
            label={send.kind === "sending" ? "Creating" : "Create"}
            busy={send.kind === "sending"}
            disabledReason={createOff}
            onClick={create}
          />
        ) : (
          <Button kind="primary" aria-disabled={readOnly} onClick={readOnly ? undefined : next}>
            Next
          </Button>
        )}
      </div>
      {upload.picker}
      {upload.card}
      {leave.dialog}
    </div>
  );
}

// What a server error's field depends on, to drop the error when it changes.
function fieldSnapshot(form: CreateForm, head: string): string {
  switch (head) {
    case "name":
      return form.name;
    case "description":
      return form.description;
    case "persona_md":
      return form.persona_md;
    case "avatar_colour":
      return form.avatar_colour;
    case "avatar_id":
    case "avatar_style":
      return JSON.stringify([form.avatar_style, form.avatar]);
    case "pins":
      return JSON.stringify(form.pins);
    case "model_id":
    case "effort":
      return JSON.stringify([form.model_id, form.effort]);
    case "tool_settings":
      return JSON.stringify([form.model_id, form.tool_choices]);
    case "history_share_pct":
      return String(form.history_share_pct);
    case "request_limit":
      return String(form.request_limit);
    case "max_reply_chars":
      return String(form.max_reply_chars);
    default:
      return JSON.stringify(form);
  }
}

function keepUnchanged(problems: Problems, before: CreateForm, after: CreateForm): Problems {
  const kept: Problems = {};
  for (const [field, message] of Object.entries(problems)) {
    const head = field.split(/[.[]/)[0] ?? field;
    if (fieldSnapshot(before, head) === fieldSnapshot(after, head)) kept[field] = message;
  }
  return kept;
}

function isTooLong(form: CreateForm, field: string, settings: FormSettings): boolean {
  const { limits } = settings;
  switch (field) {
    case "name":
      return form.name.trim().length > limits.nameMax;
    case "description":
      return form.description.length > limits.descriptionMax;
    case "persona_md":
      return form.persona_md.length > limits.personaMax;
    default:
      return false;
  }
}

// The rows of step 3: every skill that is not deprecated, and the ticked ones of a Clone (with
// the copied version, deprecated or in Trash).
function skillChoicesOf({
  skills,
  form,
  source,
}: {
  skills: ListSkillsResponse;
  form: CreateForm;
  source: BotRow | undefined;
}): SkillChoice[] {
  const copied = new Map((source?.pins ?? []).map((pin) => [pin.skill_id, pin]));
  const ticked = new Set(form.pins.map((pin) => pin.skill_id));
  const rows: SkillChoice[] = skills
    .filter((skill) => !skill.deprecated || ticked.has(skill.id))
    .map((skill) => {
      const pin = copied.get(skill.id);
      return {
        id: skill.id,
        name: skill.name,
        description: pin?.description ?? skill.latest_version.description,
        version: pin?.version ?? skill.latest_version.version,
        deprecated: skill.deprecated,
      };
    });
  // A copied skill that is not in the list any more is in Trash.
  for (const pin of form.pins) {
    if (rows.some((row) => row.id === pin.skill_id)) continue;
    const from = copied.get(pin.skill_id);
    rows.push({
      id: pin.skill_id,
      name: from?.skill_name ?? "A skill in Trash",
      description: from?.description ?? "",
      version: from?.version ?? 1,
      deprecated: from?.deprecated ?? false,
    });
  }
  return rows;
}

function Stepper({
  current,
  done,
  error,
  canOpen,
  onOpen,
}: {
  current: Step;
  done: (step: Step) => boolean;
  error: (step: Step) => boolean;
  canOpen: (step: Step) => boolean;
  onOpen: (step: Step) => void;
}) {
  return (
    <ol aria-label="Steps" className="mt-4 flex items-center">
      {STEPS.map((s, i) => {
        const isCurrent = s === current;
        const bad = error(s);
        const ok = !bad && done(s);
        const reachable = canOpen(s);
        return (
          <li key={s} className={cn("flex items-center", i > 0 && "grow")}>
            {i > 0 && <span aria-hidden className="mx-3 h-px grow bg-outline-strong" />}
            <button
              type="button"
              aria-current={isCurrent ? "step" : undefined}
              aria-disabled={!reachable && !isCurrent}
              onClick={() => {
                onOpen(s);
              }}
              className="flex items-center gap-2 rounded-control outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-disabled:cursor-not-allowed"
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-pill border text-xs font-semibold",
                  bad
                    ? "border-danger bg-danger text-on-primary"
                    : isCurrent
                      ? "border-primary bg-primary text-on-primary"
                      : ok
                        ? "border-success text-success"
                        : "border-outline-strong text-on-surface-muted",
                )}
              >
                {bad ? "!" : ok ? <Check aria-hidden size={14} strokeWidth={3} /> : i + 1}
              </span>
              <span className={isCurrent ? "font-semibold" : "text-on-surface-muted"}>
                {STEP_LABELS[s]}
                {bad && <span className="sr-only">, has an error</span>}
                {ok && <span className="sr-only">, done</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// The Clone banner (CL1, CL2) under the stepper.
function CloneBanner({
  name,
  slug,
  modelGone,
}: {
  name: string;
  slug: string | null;
  modelGone: boolean;
}) {
  return (
    <div
      role="status"
      className={cn(
        "mt-4 flex items-start gap-4 rounded-card border px-4 py-3",
        modelGone ? "border-danger" : "border-outline-strong bg-surface-container",
      )}
    >
      <div className="grow">
        {modelGone ? (
          <p>
            {name} cannot run: its model is no longer offered. Pick a new model. Everything else is
            copied.
          </p>
        ) : (
          <>
            <p className="font-semibold">Cloning {name}</p>
            <p className="text-on-surface-muted">
              Everything is copied, with the same skill versions and tools. Two things are new: bot
              memory starts empty, and the colour is a free one.
            </p>
          </>
        )}
      </div>
      {slug !== null && (
        <Link to="/bots/$slug" params={{ slug }} className="shrink-0 text-primary hover:underline">
          Open {name}
        </Link>
      )}
    </div>
  );
}
