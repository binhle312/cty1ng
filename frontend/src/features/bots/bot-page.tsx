import type { CatalogModel } from "@cty1ng/shared/catalog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { Activity, ChartColumn, Cpu, Puzzle, UserRound } from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Skeleton, SkeletonArea } from "../../components/ui/skeleton.tsx";
import { Tab, TabsList, TabsPanel, TabsRoot } from "../../components/ui/tabs.tsx";
import { readApiError } from "../../lib/api/api-error.ts";
import {
  getSettingsOptions,
  listModelsOptions,
  listToolsOptions,
  updateBotMutation,
} from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import type { GetSettingsResponse, ListToolsResponse } from "../../lib/api/generated/types.gen.ts";
import { PIN_QUERIES } from "../../lib/api/operation-queries.ts";
import { LoadError } from "../skills/load-error.tsx";
import { avatarChanged, type EditTab, editFormOf, leaveText, patchBody } from "./bot-edit-form.ts";
import { EDIT_TABS, editView } from "./bot-edit-state.ts";
import { useEditStore } from "./bot-edit-store.ts";
import { writeSaveAnswer } from "./bot-list-store.ts";
import { useBotLeaveGuard } from "./bot-leave-guard.tsx";
import { BotNotFound, BotPageTop } from "./bot-page-top.tsx";
import { type BotRow, useBots } from "./bot-queries.ts";
import { BotSaveBar } from "./bot-save-bar.tsx";
import { BotSideList } from "./bot-side-list.tsx";
import { BOT_TABS, type BotTab } from "./bot-tabs.ts";
import { BotSkillsTab } from "./bot-skills-tab.tsx";
import { type CreateForm, effectiveTools, formSettings } from "./create-bot-form.ts";
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
  // The edit rules of the Profile and Model tabs live in `bot-edit-state.ts` (bot-page.md §4.2).
  const rules = useMemo(
    () => ({ effective: (f: CreateForm) => effectiveTools(f, tools, model) }),
    [tools, model],
  );
  const { state, store } = useEditStore({ rules, form: server, rowVersion: bot.row_version });
  const { form } = state;
  const ctx = { settings, otherNames: bots.filter((b) => b.id !== bot.id).map((b) => b.name) };
  const view = editView(state, { rules, ctx });
  const [uploadError, setUploadError] = useState<string | null>(null);

  const update = (change: (f: CreateForm) => CreateForm) => {
    store.dispatch({ type: "typed", change });
  };

  const upload = useAvatarUpload({
    onUploaded: (avatar) => {
      setUploadError(null);
      update((f) => ({ ...f, avatar, avatar_style: "upload" }));
    },
    onError: setUploadError,
  });

  const letGo = (tabs: readonly EditTab[]) => {
    // A tab refused as stale loads the newest values again: the refresh after the refusal may
    // have failed.
    if (tabs.some((t) => store.get().staleAt[t] !== null)) {
      void queryClient.invalidateQueries({ predicate: PIN_QUERIES });
    }
    store.dispatch({ type: "letGo", tabs });
    setUploadError(null);
  };

  const leave = useBotLeaveGuard({
    dirty: view.dirtyFields.length > 0,
    text: leaveText(view.dirtyFields),
    onLetGo: () => {
      letGo(EDIT_TABS);
    },
  });

  const { mutateAsync } = useMutation(updateBotMutation());
  const save = (t: EditTab) => {
    // The state now, not the one of this render: a second Ctrl+S before the next render sends
    // nothing.
    const now = store.get();
    const nowView = editView(now, { rules, ctx });
    const check = nowView.saveCheck(t);
    if (check === "off") return;
    if (check === "errors") {
      store.dispatch({ type: "saveTried", tab: t });
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>("#bot-edit [aria-invalid='true']")?.focus();
      });
      return;
    }
    // What this request sends; typing goes on while it is pending and stays a change after it.
    const sent = { tab: t, form: now.form, base: now.base[t], fields: nowView.changed[t] };
    const id = now.nextSave;
    if (store.dispatch({ type: "saveSent", ...sent }).onItsWay?.id !== id) return;
    mutateAsync({
      path: { id: bot.id },
      body: patchBody({
        tab: t,
        form: sent.form,
        changed: sent.fields,
        rowVersion: sent.base,
        effective: rules.effective,
      }),
    })
      .then((result) => {
        // A newer list (an event or a refresh) may have come first, and a pin change never raises
        // `row_version`: the answer writes only the fields a save owns.
        writeSaveAnswer(queryClient, result);
        void queryClient.invalidateQueries({ predicate: PIN_QUERIES });
        store.dispatch({
          type: "saveAnswered",
          id,
          rowVersion: result.row_version,
          form: editFormOf(result, settings),
        });
      })
      .catch((error: unknown) => {
        const api = readApiError(error);
        // A stale save loads the newest values now; the edit stays. A Save that failed on the way
        // may have reached the server, so the page loads the bot too (bot-page.md §4.2, Q4).
        if (api === null || api.code === "stale_write") {
          void queryClient.invalidateQueries({ predicate: PIN_QUERIES });
        }
        store.dispatch({ type: "saveFailed", id, error: api });
      });
  };

  // The other tab whose Save is on its way: this tab's Save waits for its answer (one Save at a
  // time, `bot-save-bar.tsx`), and its bar says so.
  const TAB_NAMES: Record<EditTab, string> = { profile: "Profile", model: "Model" };
  const waitingFor = (t: EditTab): string | null => {
    const other = view.waitingFor(t);
    return other === null ? null : TAB_NAMES[other];
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
    errorOf: view.errorOf,
    onLeaveField: (field) => {
      store.dispatch({ type: "fieldLeft", field });
    },
  };
  // Esc asks first, like Discard (bot-page.md §4.1). Only a key pressed on the tab itself: a
  // popover or a dialog closes on its own Esc. An Esc that ends an IME composition is the input
  // method's. The question opens before this key press ends, and a dialog closes on any Esc that
  // reaches `document`, so the press stops here (frontend-conventions.md §5).
  const escToDiscard = (t: EditTab) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || event.defaultPrevented || event.nativeEvent.isComposing) return;
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
    if (view.unsaved[t].length === 0) return;
    event.stopPropagation();
    leave.ask();
  };
  const discard = () => {
    leave.ask();
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
        avatarUnsaved={avatarChanged(view.changed.profile)}
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
            state={view.barState("profile")}
            saving={view.saving === "profile"}
            waitFor={waitingFor("profile")}
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
            state={view.barState("model")}
            saving={view.saving === "model"}
            waitFor={waitingFor("model")}
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
