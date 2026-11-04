import { Link, useNavigate } from "@tanstack/react-router";
import { Ellipsis, Lock } from "lucide-react";
import { Button } from "../../components/ui/button.tsx";
import {
  MenuItem,
  MenuPopup,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "../../components/ui/menu.tsx";
import { Pill } from "../skills/pills.tsx";
import { BotAvatar } from "./bot-avatar.tsx";
import { BotBand } from "./bot-band.tsx";
import { cannotRunText, modelLine, statusText } from "./bot-lines.ts";
import type { BotRow } from "./bot-queries.ts";
import type { CreateForm } from "./create-bot-form.ts";

// The top of the bot page (bot-page.md §2, PR1, HB): the band and the 116 px avatar follow the
// Profile tab's avatar and colour at once, before Save; "Not saved" says so. The name, the slug,
// the locked model badge and the status line are the saved bot. M2 has no Message (M3).
export function BotPageTop({
  bot,
  form,
  avatarUnsaved,
  onChangeAvatar,
  onStatus,
  onDelete,
}: {
  bot: BotRow;
  // The Profile tab's form: the avatar and the colour as the owner set them.
  form: CreateForm;
  avatarUnsaved: boolean;
  onChangeAvatar: () => void;
  onStatus: () => void;
  onDelete: () => void;
}) {
  const navigate = useNavigate();
  const avatar = {
    avatar_style: form.avatar_style,
    avatar_colour: form.avatar_colour,
    avatar_url: form.avatar_style === "upload" ? (form.avatar?.url ?? null) : null,
  };
  const cannotRun = bot.health?.level === "cannot_run";
  const clone = () => {
    void navigate({ to: "/bots/new", search: { from: bot.id } });
  };
  return (
    <>
      <header className="relative shrink-0 px-8 pt-4">
        <BotBand colour={form.avatar_colour} className="h-18" />
        <div className="relative flex items-start gap-5 pt-6">
          <button
            type="button"
            onClick={onChangeAvatar}
            aria-label={`Change the avatar of ${bot.name}`}
            className="group relative shrink-0 rounded-pill outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <BotAvatar bot={avatar} size="large" badge={cannotRun ? "cannot_run" : null} />
            <span
              aria-hidden
              className="absolute inset-0 flex items-center justify-center rounded-pill bg-surface/70 font-semibold opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              Change
            </span>
          </button>
          <div className="min-w-0 grow pt-8">
            <div className="flex items-center gap-2">
              <h1 className="min-w-0 truncate text-title font-semibold">{bot.name}</h1>
              <span className="font-mono text-sm text-on-surface-muted">{bot.slug}</span>
              {avatarUnsaved && <Pill tone="waiting">Not saved</Pill>}
              <span className="grow" />
              <BotPageMenu bot={bot} onClone={clone} onDelete={onDelete} />
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-on-surface-muted">
              <span className="inline-flex items-center gap-1 rounded-pill border border-outline-strong px-2 py-0.5">
                <Lock aria-hidden size={12} />
                {modelLine(bot)}
              </span>
              <span className="sr-only">Model and effort never change. Clone picks another.</span>
            </p>
            <button
              type="button"
              onClick={onStatus}
              className="mt-1.5 flex items-center gap-1.5 rounded-xs text-sm text-on-surface-muted hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span aria-hidden className="size-1.5 rounded-pill bg-on-surface-muted" />
              {statusText(bot, new Date())}
            </button>
          </div>
        </div>
      </header>
      {bot.unavailable_reason !== null && (
        <div
          role="status"
          className="mx-8 mt-4 flex shrink-0 items-center gap-4 rounded-card border border-danger px-4 py-3"
        >
          <div className="grow text-sm">
            <p className="font-semibold text-danger">{cannotRunText(bot.unavailable_reason)}</p>
            <p className="text-on-surface-muted">
              {bot.unavailable_reason === "no_api_key"
                ? "Set the API key and restart the app, or clone the bot with another model."
                : "The model left the catalog. Clone the bot to pick another model."}
            </p>
          </div>
          <Button size="small" kind="primary" onClick={clone}>
            Clone
          </Button>
        </div>
      )}
    </>
  );
}

// The ⋯ menu of the page top (bot-page.md §2): as on the grid, without Details. M3 adds Message.
function BotPageMenu({
  bot,
  onClone,
  onDelete,
}: {
  bot: BotRow;
  onClone: () => void;
  onDelete: () => void;
}) {
  return (
    <MenuRoot>
      <MenuTrigger
        aria-label={`${bot.name} actions`}
        className="flex size-button-small items-center justify-center rounded-card border border-outline-strong hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Ellipsis aria-hidden className="size-4" />
      </MenuTrigger>
      <MenuPopup side="bottom" align="end" sideOffset={6} label={`${bot.name} actions`}>
        <MenuItem onClick={onClone}>Clone</MenuItem>
        <MenuSeparator />
        <MenuItem danger onClick={onDelete}>
          Delete
        </MenuItem>
      </MenuPopup>
    </MenuRoot>
  );
}

// A slug that no live bot has (bot-page.md §1): unknown, or a bot in Trash.
export function BotNotFound() {
  return (
    <div role="alert" className="flex items-center gap-4 px-8 py-6">
      <p className="text-on-surface-muted">The app could not find this bot. It may be in Trash.</p>
      <Link to="/bots" className="text-primary hover:underline">
        ← Back
      </Link>
    </div>
  );
}
