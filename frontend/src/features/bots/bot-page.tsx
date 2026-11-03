import type { CatalogModel } from "@cty1ng/shared/catalog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { Activity, ChartColumn, Cpu, Puzzle, UserRound } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Skeleton, SkeletonArea } from "../../components/ui/skeleton.tsx";
import { Tab, TabsList, TabsPanel, TabsRoot } from "../../components/ui/tabs.tsx";
import { showToast } from "../../components/ui/toast.tsx";
import { readApiError } from "../../lib/api/api-error.ts";
import {
  getSettingsOptions,
  listBotsQueryKey,
  listModelsOptions,
  listToolsOptions,
  updateBotMutation,
} from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import type { GetSettingsResponse, ListToolsResponse } from "../../lib/api/generated/types.gen.ts";
import { PIN_QUERIES } from "../../lib/api/operation-queries.ts";
import { LoadError } from "../skills/load-error.tsx";
import {
  avatarChanged,
  changedFields,
  type EditField,
  type EditTab,
  editFormOf,
  editProblems,
  leaveText,
  mergeTab,
  patchBody,
  tabOfField,
  withTab,
} from "./bot-edit-form.ts";
import { useBotLeaveGuard } from "./bot-leave-guard.tsx";
import { BotNotFound, BotPageTop } from "./bot-page-top.tsx";
import { type BotRow, useBots } from "./bot-queries.ts";
import { BotSaveBar, type BotSaveBarState } from "./bot-save-bar.tsx";
import { BotSideList } from "./bot-side-list.tsx";
import { BOT_TABS, type BotTab } from "./bot-tabs.ts";
import { BotSkillsTab } from "./bot-skills-tab.tsx";
import {
  type CreateForm,
  effectiveTools,
  formSettings,
  isTooLong,
  keepUnchanged,
  type Problems,
  takenNameText,
} from "./create-bot-form.ts";
import {
  AdvancedSection,
  AppearanceFields,
  NameFields,
  PersonaField,
  type StepProps,
  ToolsSection,
} from "./create-bot-steps.tsx";
import { useAvatarUpload } from "./crop-card.tsx";
import { useDeleteBot } from "./delete-bot-dialog.tsx";

const EDIT_TABS: readonly EditTab[] = ["profile", "model"];

// `/bots/{slug}` (bot-page.md, UI-6): the edit layout, with the bot list on the left and the bot
// page on the right. The page finds the bot id from the slug in `GET /bots`; a slug that no live
// bot has (unknown, or in Trash) says so, and a list that does not load says that.
export function BotPage() {
  const { slug } = useParams({ from: "/bots/$slug" });
  const bots = useBots();
  if (bots.data === undefined) {
    if (bots.isError) {
      return (
        <LoadError text="The app could not load the bots." onRetry={() => void bots.refetch()} />
      );
    }
    return <BotPageSkeleton />;
  }
  const bot = bots.data.find((b) => b.slug === slug);
  // A refresh on its way may bring the bot (a Create or a rename moves here first): "could not
  // find" waits for the newest list, as the skill page does.
  if (bot === undefined && bots.isFetching) return <BotPageSkeleton />;
  // A refresh that failed is not a missing bot: the list did not load (bot-page.md, URLs).
  if (bot === undefined && bots.isError) {
    return (
      <LoadError text="The app could not load the bots." onRetry={() => void bots.refetch()} />
    );
  }
  return (
    <div className="flex h-full min-h-0">
      <BotSideList bots={bots.data} currentId={bot?.id ?? null} />
      <section className="flex h-full min-w-0 grow flex-col">
        {bot === undefined ? <BotNotFound /> : <BotData key={bot.id} bot={bot} bots={bots.data} />}
      </section>
    </div>
  );
}

// The Profile and Model tabs need the settings (limits, ranges) and the catalog (the bot's model
// and its tools). They load once; a failed load says so with Try again.
function BotData({ bot, bots }: { bot: BotRow; bots: BotRow[] }) {
  const settings = useQuery(getSettingsOptions());
  const models = useQuery(listModelsOptions());
  const tools = useQuery(listToolsOptions());
  const queries = [settings, models, tools];
  if (queries.some((q) => q.data === undefined && q.isError)) {
    return (
      <LoadError
        text="The app could not load what the bot page needs."
        onRetry={() => {
          for (const q of queries) if (q.isError) void q.refetch();
        }}
      />
    );
  }
  if (settings.data === undefined || models.data === undefined || tools.data === undefined) {
    return <BotViewSkeleton />;
  }
  return (
    <BotView
      bot={bot}
      bots={bots}
      rawSettings={settings.data}
      model={models.data.find((m) => m.id === bot.model_id)}
      tools={tools.data}
    />
  );
}

function BotView({
  bot,
  bots,
  rawSettings,
  model,
  tools,
}: {
  bot: BotRow;
  bots: BotRow[];
  rawSettings: GetSettingsResponse;
  // Undefined when the bot's model left the catalog.
  model: CatalogModel | undefined;
  tools: ListToolsResponse;
}) {
  const settings = formSettings(rawSettings);
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/bots/$slug" });
  const search = useSearch({ from: "/bots/$slug" });
  const tab: BotTab = search.tab ?? "profile";

  const server = editFormOf(bot, settings);
  const effective = (f: CreateForm) => effectiveTools(f, tools, model);
  // One form for both tabs; each tab has its own save bar, so each keeps the `row_version` its
  // edit started from. A save sends it, and the server refuses a save over a change made in
  // another place (409 `stale_write`) instead of overwriting it.
  const [form, setForm] = useState(server);
  const [saved, setSaved] = useState(server);
  const [base, setBase] = useState<Record<EditTab, number>>({
    profile: bot.row_version,
    model: bot.row_version,
  });
  const changed: Record<EditTab, EditField[]> = {
    profile: changedFields({ tab: "profile", form, saved, effective }),
    model: changedFields({ tab: "model", form, saved, effective }),
  };
  // The tab whose Save is on its way.
  const [saving, setSaving] = useState<EditTab | null>(null);
  // The form as it is now, for an answer that comes after more typing.
  const latestForm = useRef(form);
  const latestSaved = useRef(saved);
  const latestBase = useRef(base);
  useEffect(() => {
    latestForm.current = form;
    latestSaved.current = saved;
    latestBase.current = base;
  });
  // A newer `row_version` (a save here, another tab, a `bot.updated` event): a tab with no changes
  // takes the new values at once; a tab with changes keeps them and shows the conflict. The check
  // runs on every render, so a tab whose changes go (typed back to the saved text) takes the new
  // values then. A pin or the pinned order never raises `row_version`, so they never block an edit.
  // A tab whose Save is on its way waits for the answer: the event of that save can come first,
  // and text typed meanwhile is a change against what the save sent, not against the old values.
  const behind = EDIT_TABS.filter(
    (t) => t !== saving && base[t] < bot.row_version && changed[t].length === 0,
  );
  if (behind.length > 0) {
    let nextForm = form;
    let nextSaved = saved;
    const nextBase = { ...base };
    for (const t of behind) {
      nextForm = withTab({ into: nextForm, from: server, tab: t });
      nextSaved = withTab({ into: nextSaved, from: server, tab: t });
      nextBase[t] = bot.row_version;
    }
    setForm(nextForm);
    setSaved(nextSaved);
    setBase(nextBase);
  }
  // The `row_version` that a save of the tab was refused at (409 `stale_write`): the server is
  // newer than the page even when the refresh after it fails, so the conflict shows at once and
  // stays until Discard.
  const [staleAt, setStaleAt] = useState<Record<EditTab, number | null>>({
    profile: null,
    model: null,
  });
  const conflict = (t: EditTab) =>
    changed[t].length > 0 && (bot.row_version > base[t] || staleAt[t] === base[t]);

  const [serverProblems, setServerProblems] = useState<Problems>({});
  // Fields the owner left, and tabs where Save was pressed with errors: their errors show.
  const [left, setLeft] = useState<ReadonlySet<string>>(new Set());
  const [tried, setTried] = useState<ReadonlySet<EditTab>>(new Set());
  const [uploadError, setUploadError] = useState<string | null>(null);

  const ctx = { settings, otherNames: bots.filter((b) => b.id !== bot.id).map((b) => b.name) };
  const problems: Record<EditTab, Problems> = {
    profile: editProblems({ tab: "profile", form, changed: changed.profile, ctx }),
    model: editProblems({ tab: "model", form, changed: changed.model, ctx }),
  };
  const errorOf = (field: string): string | null => {
    const fromServer = serverProblems[field];
    if (fromServer !== undefined) return fromServer;
    const t = tabOfField(field);
    const local = problems[t][field];
    if (local === undefined) return null;
    // A size error shows at once; an empty field or a taken name after the owner leaves it.
    return isTooLong({ form, field, settings }) || left.has(field) || tried.has(t) ? local : null;
  };
  const shownErrors = (t: EditTab) =>
    new Set(
      [...Object.keys(problems[t]), ...Object.keys(serverProblems)].filter(
        (field) => tabOfField(field) === t && errorOf(field) !== null,
      ),
    ).size;

  const update = (change: (f: CreateForm) => CreateForm) => {
    const next = change(form);
    setForm(next);
    // A server error goes when the owner changes its field.
    setServerProblems((old) => keepUnchanged({ problems: old, before: form, after: next }));
  };

  const upload = useAvatarUpload({
    onUploaded: (avatar) => {
      setUploadError(null);
      update((f) => ({ ...f, avatar, avatar_style: "upload" }));
    },
    onError: setUploadError,
  });

  // How many times each tab was let go (Discard, Esc, leaving): a Save that was on its way then
  // must not bring back the edit the owner dropped.
  const letGoCount = useRef<Record<EditTab, number>>({ profile: 0, model: 0 });
  const letGo = (tabs: readonly EditTab[]) => {
    for (const t of tabs) letGoCount.current[t] += 1;
    let nextForm = form;
    let nextSaved = saved;
    for (const t of tabs) {
      nextForm = withTab({ into: nextForm, from: server, tab: t });
      nextSaved = withTab({ into: nextSaved, from: server, tab: t });
    }
    setForm(nextForm);
    setSaved(nextSaved);
    setBase((old) => {
      const next = { ...old };
      for (const t of tabs) next[t] = bot.row_version;
      return next;
    });
    setServerProblems((old) =>
      Object.fromEntries(
        Object.entries(old).filter(([field]) => !tabs.includes(tabOfField(field))),
      ),
    );
    setTried((old) => new Set([...old].filter((t) => !tabs.includes(t))));
    setUploadError(null);
    // A tab refused as stale loads the newest values again: the refresh after the refusal may
    // have failed.
    if (tabs.some((t) => staleAt[t] !== null)) {
      void queryClient.invalidateQueries({ predicate: PIN_QUERIES });
    }
    setStaleAt((old) => {
      const next = { ...old };
      for (const t of tabs) next[t] = null;
      return next;
    });
  };

  const dirtyFields = [...changed.profile, ...changed.model];
  const leave = useBotLeaveGuard({
    dirty: dirtyFields.length > 0,
    text: leaveText(dirtyFields),
    onLetGo: () => {
      letGo(EDIT_TABS);
    },
  });

  const { mutateAsync } = useMutation(updateBotMutation());
  const save = (t: EditTab) => {
    if (saving !== null || changed[t].length === 0 || conflict(t)) return;
    if (Object.keys(problems[t]).length > 0 || shownErrors(t) > 0) {
      setTried((old) => new Set(old).add(t));
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>("#bot-edit [aria-invalid='true']")?.focus();
      });
      return;
    }
    // What this request sends; typing goes on while it is pending and stays a change after it.
    const sent = form;
    const sentBase = base[t];
    const fields = changed[t];
    const sentLetGo = letGoCount.current[t];
    setSaving(t);
    mutateAsync({
      path: { id: bot.id },
      body: patchBody({ tab: t, form: sent, changed: fields, rowVersion: sentBase, effective }),
    })
      .then((result) => {
        // A newer list (an event or a refresh) may have come first: the answer never replaces it.
        // A Profile or Model save never changes a pin, and a pin change never raises
        // `row_version`, so the answer's pins may be older than the page's (an Always load
        // toggle after the save went out): the pins, and the counts made from them, stay.
        queryClient.setQueryData<BotRow[]>(listBotsQueryKey(), (old) =>
          old?.map((b) =>
            b.id === result.id && result.row_version > b.row_version
              ? {
                  ...b,
                  ...result,
                  pins: b.pins,
                  counts: {
                    ...result.counts,
                    skills: b.counts.skills,
                    skill_updates: b.counts.skill_updates,
                  },
                }
              : b,
          ),
        );
        // The answer sets the tab's values only while the tab is still based on `sentBase`. A
        // Discard that loaded a newer `row_version` (another tab saved after this save) already
        // shows values newer than the answer; they stay.
        if (latestBase.current[t] === sentBase) {
          // A tab the owner let go while Save waited shows the saved values, not the edit it
          // dropped; a field typed in after the Discard keeps its text, as a change.
          if (letGoCount.current[t] !== sentLetGo) {
            setForm(
              mergeTab({
                tab: t,
                base: latestSaved.current,
                mine: latestForm.current,
                theirs: sent,
                effective,
              }),
            );
          }
          setSaved((old) => withTab({ into: old, from: sent, tab: t }));
        }
        // The server took the save at `sentBase`, so nothing else changed in between: every tab
        // whose edit started there is now based on the new `row_version`.
        setBase((old) => ({
          profile: old.profile === sentBase ? result.row_version : old.profile,
          model: old.model === sentBase ? result.row_version : old.model,
        }));
        void queryClient.invalidateQueries({ predicate: PIN_QUERIES });
      })
      .catch((error: unknown) => {
        const api = readApiError(error);
        if (api?.code === "stale_write") {
          // The conflict shows at once; load the newest values now, and the edit stays.
          setStaleAt((old) => ({ ...old, [t]: sentBase }));
          void queryClient.invalidateQueries({ predicate: PIN_QUERIES });
          return;
        }
        // An error is about the value that was sent: a field the owner changed while Save waited
        // gets no error, so it never blocks the corrected text.
        const stillSent = (problems: Problems) =>
          keepUnchanged({ problems, before: sent, after: latestForm.current });
        if (api?.code === "name_taken") {
          const name = takenNameText({ name: sent.name, byServer: true });
          setServerProblems((old) => ({ ...old, ...stillSent({ name }) }));
          return;
        }
        if (api?.field !== undefined && tabOfField(api.field) === t) {
          const problem = { [api.field]: api.message };
          setServerProblems((old) => ({ ...old, ...stillSent(problem) }));
          return;
        }
        showToast(`Could not save ${bot.name}. Try again.`);
      })
      .finally(() => {
        setSaving(null);
      });
  };

  const barState = (t: EditTab): BotSaveBarState => {
    if (conflict(t)) return { kind: "conflict" };
    const errors = shownErrors(t);
    if (errors > 0) return { kind: "errors", count: errors };
    if (changed[t].length === 0) return { kind: "clean" };
    return {
      kind: "changes",
      count: changed[t].length,
      avatar: t === "profile" && avatarChanged(changed.profile),
    };
  };

  // Ctrl+S or ⌘S saves the tab on screen (bot-page.md §4.1).
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    if (tab !== "profile" && tab !== "model") return undefined;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveRef.current(tab);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [tab]);

  const setTab = (next: BotTab) => {
    void navigate({ search: { tab: next === "profile" ? undefined : next } });
  };
  const appearance = useRef<HTMLDivElement>(null);
  const toAppearance = () => {
    setTab("profile");
    requestAnimationFrame(() => {
      appearance.current?.focus();
    });
  };

  const remove = useDeleteBot({
    onDeleted: () => {
      leave.allowLeave();
      void navigate({ to: "/bots", replace: true });
    },
  });

  const stepProps: StepProps = {
    form,
    update,
    // Typing goes on while a Save is pending, and stays a change after it (bot-page.md §4.1).
    readOnly: false,
    errorOf,
    onLeaveField: (field) => {
      setLeft((old) => new Set(old).add(field));
    },
  };
  // Esc asks first, like Discard (bot-page.md §4.1). Only a key pressed on the tab itself: a
  // popover or a dialog closes on its own Esc.
  const escToDiscard = (t: EditTab) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
    if (changed[t].length === 0) return;
    leave.ask(() => undefined);
  };
  const discard = () => {
    leave.ask(() => undefined);
  };

  const modelGone =
    model === undefined
      ? `${bot.model_id} is no longer offered, so the tools cannot change. Clone the bot to use another model.`
      : null;

  return (
    <>
      <BotPageTop
        bot={bot}
        form={form}
        avatarUnsaved={avatarChanged(changed.profile)}
        onChangeAvatar={toAppearance}
        onStatus={() => {
          setTab("activity");
        }}
        onDelete={() => {
          remove.ask(bot);
        }}
      />
      <TabsRoot
        value={tab}
        onValueChange={(value) => {
          setTab(BOT_TABS.find((name) => name === value) ?? "profile");
        }}
        className="flex min-h-0 grow flex-col"
      >
        <TabsList className="mx-8 mt-4 shrink-0 border-b border-outline">
          <Tab value="profile">
            <UserRound aria-hidden className="size-4" />
            Profile
          </Tab>
          <Tab value="skills">
            <Puzzle aria-hidden className="size-4" />
            Skills
            <span className="text-sm text-on-surface-muted">{bot.counts.skills}</span>
            {bot.counts.skill_updates > 0 && (
              <span className="text-sm text-primary">
                ↑{bot.counts.skill_updates}
                <span className="sr-only"> skill updates</span>
              </span>
            )}
          </Tab>
          <Tab value="model">
            <Cpu aria-hidden className="size-4" />
            Model
          </Tab>
          <Tab value="activity">
            <Activity aria-hidden className="size-4" />
            Activity
            <span className="text-sm text-on-surface-muted">{bot.counts.conversations}</span>
          </Tab>
          <Tab value="usage">
            <ChartColumn aria-hidden className="size-4" />
            Usage
          </Tab>
        </TabsList>
        <TabsPanel value="profile" className="flex min-h-0 grow flex-col">
          <div
            id="bot-edit"
            onKeyDown={escToDiscard("profile")}
            className="min-h-0 grow overflow-y-auto px-8 py-5"
          >
            <div className="flex max-w-3xl flex-col gap-4">
              <div
                ref={appearance}
                tabIndex={-1}
                aria-label="Appearance"
                role="group"
                className="flex flex-col gap-4 rounded-card outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
              >
                <AppearanceFields
                  {...stepProps}
                  upload={upload.choose}
                  uploadError={uploadError}
                  colourHint="Pick a colour, mix your own with Custom, or let Random pick any colour."
                />
              </div>
              <hr className="border-outline" />
              <NameFields {...stepProps} limits={settings.limits} />
              <hr className="border-outline" />
              <PersonaField {...stepProps} limits={settings.limits} />
            </div>
          </div>
          <BotSaveBar
            botName={bot.name}
            state={barState("profile")}
            saving={saving === "profile"}
            onDiscard={discard}
            onSave={() => {
              save("profile");
            }}
          />
        </TabsPanel>
        <TabsPanel value="skills" className="min-h-0 grow overflow-y-auto">
          <BotSkillsTab bot={bot} />
        </TabsPanel>
        <TabsPanel value="model" className="flex min-h-0 grow flex-col">
          <div
            id="bot-edit"
            onKeyDown={escToDiscard("model")}
            className="min-h-0 grow overflow-y-auto px-8 py-5"
          >
            <div className="flex max-w-3xl flex-col gap-4">
              <ToolsSection
                {...stepProps}
                tools={tools}
                model={model}
                turnedOff={null}
                locked={modelGone}
              />
              <AdvancedSection {...stepProps} settings={settings} model={model} />
            </div>
          </div>
          <BotSaveBar
            botName={bot.name}
            state={barState("model")}
            saving={saving === "model"}
            onDiscard={discard}
            onSave={() => {
              save("model");
            }}
          />
        </TabsPanel>
        <TabsPanel value="activity" className="min-h-0 grow overflow-y-auto px-8 py-5">
          {/* M2 has no conversations (bot-page.md §8); M3 adds "Message BA to start one." */}
          <p className="mt-8 text-center text-on-surface-muted">
            {bot.name} is in no conversations yet.
          </p>
        </TabsPanel>
        <TabsPanel value="usage" className="min-h-0 grow overflow-y-auto px-8 py-5">
          {/* Until M3 there are no runs (bot-page.md §9.6). */}
          <p className="mt-8 text-center text-on-surface-muted">
            No runs yet. Usage shows here after {bot.name} replies in a conversation.
          </p>
        </TabsPanel>
      </TabsRoot>
      {upload.picker}
      {upload.card}
      {remove.dialog}
      {leave.dialog}
    </>
  );
}

function BotViewSkeleton() {
  return (
    <SkeletonArea label="Loading the bot">
      <div className="px-8 py-6">
        <Skeleton className="h-28 w-28 rounded-pill" />
        <Skeleton className="mt-4 h-7 w-48" />
        <Skeleton className="mt-6 h-64" />
      </div>
    </SkeletonArea>
  );
}

function BotPageSkeleton() {
  return (
    <div className="flex h-full min-h-0">
      <SkeletonArea label="Loading the bots">
        <div className="w-list-column shrink-0 border-r border-outline p-4">
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} className="mb-2 h-12" />
          ))}
        </div>
      </SkeletonArea>
      <section className="grow">
        <BotViewSkeleton />
      </section>
    </div>
  );
}
