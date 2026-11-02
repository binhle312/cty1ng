import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "../../components/ui/button.tsx";
import { Dialog, DialogButtons, DialogText } from "../../components/ui/dialog.tsx";
import { showToast } from "../../components/ui/toast.tsx";
import { apiErrorText } from "../../lib/api/api-error.ts";
import {
  deleteBotMutation,
  getSettingsOptions,
} from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import { PIN_QUERIES } from "../../lib/api/operation-queries.ts";
import { SaveButton } from "../skills/save-bar.tsx";
import type { BotRow } from "./bot-queries.ts";

// Delete asks first, then moves the bot to Trash (bots.md UI-4.3, D50): it leaves the header and
// the Bots page, and its messages stay, greyed. Cancel is the default (buttons.md §3). A move to
// Trash has no Undo (§6).
export function useDeleteBot({ onDeleted }: { onDeleted?: (bot: BotRow) => void } = {}) {
  const queryClient = useQueryClient();
  const settings = useQuery(getSettingsOptions());
  // A new object each time the dialog opens, so a late answer never writes into a newer dialog
  // (frontend-conventions.md §5).
  const [asked, setAsked] = useState<{ bot: BotRow } | null>(null);
  const shown = useRef<{ bot: BotRow } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { mutateAsync } = useMutation(deleteBotMutation());

  const close = () => {
    shown.current = null;
    setAsked(null);
    setError(null);
  };

  const confirm = () => {
    const request = asked;
    if (request === null) return;
    setPending(true);
    mutateAsync({ path: { id: request.bot.id } })
      .then(() => {
        void queryClient.invalidateQueries({ predicate: PIN_QUERIES });
        showToast(`${request.bot.name} is in Trash.`);
        if (shown.current === request) close();
        onDeleted?.(request.bot);
      })
      .catch((cause: unknown) => {
        if (shown.current === request) setError(apiErrorText(cause));
        else showToast(`${request.bot.name} was not deleted. ${apiErrorText(cause)}`);
      })
      .finally(() => {
        setPending(false);
      });
  };

  const ask = (bot: BotRow) => {
    const request = { bot };
    shown.current = request;
    setError(null);
    setAsked(request);
  };

  const trashDays = settings.data?.trash_days;
  const dialog = (
    <DeleteBotDialog
      bot={asked?.bot ?? null}
      trashDays={trashDays}
      pending={pending}
      error={error}
      onCancel={close}
      onConfirm={confirm}
    />
  );
  return { ask, dialog };
}

function DeleteBotDialog({
  bot,
  trashDays,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  bot: BotRow | null;
  trashDays: number | undefined;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  const name = bot?.name ?? "";
  const after =
    trashDays === undefined
      ? "After the Trash time, the app deletes it permanently."
      : `After ${String(trashDays)} ${trashDays === 1 ? "day" : "days"}, the app deletes it permanently.`;
  return (
    <Dialog
      kind="alert"
      open={bot !== null}
      onClose={onCancel}
      title={`Delete ${name}? 🧹`}
      defaultButton={cancel}
    >
      <DialogText>
        The bot goes to Trash. {after} Messages from {name} will stay, greyed.
      </DialogText>
      {error !== null && <p className="mt-3 text-sm text-danger">{error}</p>}
      <DialogButtons>
        <Button ref={cancel} onClick={onCancel}>
          Cancel
        </Button>
        <SaveButton
          kind="danger-fill"
          label="Delete bot"
          disabledReason={pending ? "Deleting the bot." : null}
          onClick={onConfirm}
        />
      </DialogButtons>
    </Dialog>
  );
}
