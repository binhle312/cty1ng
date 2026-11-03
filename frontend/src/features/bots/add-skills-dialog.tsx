import { Search } from "lucide-react";
import { type RefObject, useRef, useState } from "react";
import { Button } from "../../components/ui/button.tsx";
import { Checkbox } from "../../components/ui/checkbox.tsx";
import { Dialog, DialogButtons, DialogText } from "../../components/ui/dialog.tsx";
import type { ListSkillsResponse } from "../../lib/api/generated/types.gen.ts";
import { cn } from "../../lib/cn.ts";
import { VersionPill } from "../skills/pills.tsx";
import { SaveButton } from "../skills/save-bar.tsx";
import { toggled } from "../../lib/sets.ts";

type SkillRow = ListSkillsResponse[number];

// SK2 + Add (bot-page.md §7): the bot-list card pattern (buttons.md) with skills. Check boxes,
// a search, and the primary button at the far right. The rows are the skills the bot does not
// have and that are not deprecated, with the name, the description and the latest version. No
// box starts ticked; the button counts ("Add 2") and is at 40 % with none. Skip, Esc or a click
// outside closes it. Each added skill gets its latest version and Always load off. `skills` is
// undefined until the list comes, so the card never says "nothing to add" before it knows.
export function AddSkillsDialog({
  open,
  botName,
  skills,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  botName: string;
  skills: SkillRow[] | undefined;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (skillIds: string[]) => void;
}) {
  const skip = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={open} onClose={onClose} title={`Add skills to ${botName}`} defaultButton={skip}>
      <AddBody
        skills={skills}
        pending={pending}
        error={error}
        onClose={onClose}
        onConfirm={onConfirm}
        skip={skip}
      />
    </Dialog>
  );
}

function AddBody({
  skills,
  pending,
  error,
  onClose,
  onConfirm,
  skip,
}: {
  skills: SkillRow[] | undefined;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (skillIds: string[]) => void;
  skip: RefObject<HTMLButtonElement | null>;
}) {
  const [query, setQuery] = useState("");
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const loaded = skills ?? [];
  // A ticked skill can leave the list while the card is open (another tab added it or deprecated
  // it): only the ticked skills still in the list count and are sent.
  const chosen = loaded.filter((skill) => ticked.has(skill.id)).map((skill) => skill.id);
  const n = chosen.length;
  const needle = query.trim().toLocaleLowerCase();
  const shown = loaded.filter(
    (skill) =>
      needle === "" ||
      skill.name.toLocaleLowerCase().includes(needle) ||
      skill.latest_version.description.toLocaleLowerCase().includes(needle),
  );
  return (
    <>
      <DialogText>
        Tick the skills to add. Each gets its latest version, with Always load off.
      </DialogText>
      <label className="mt-3 flex h-control items-center gap-2 rounded-control border border-outline-strong px-2 focus-within:border-primary">
        <Search aria-hidden className="size-3.5 text-on-surface-muted" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="Search"
          aria-label="Search skills"
          className="min-w-0 grow bg-transparent outline-none placeholder:text-on-surface-muted"
        />
      </label>
      <ul
        aria-label="Skills to add"
        className="mt-3 flex max-h-64 flex-col gap-1.5 overflow-y-auto"
      >
        {shown.length === 0 && (skills !== undefined || error === null) && (
          <li className="px-2 py-3 text-on-surface-muted">
            {skills === undefined
              ? "Loading the skills."
              : skills.length === 0
                ? "No skills to add. The bot has every active skill."
                : `No skills match "${query.trim()}".`}
          </li>
        )}
        {shown.map((skill) => {
          const on = ticked.has(skill.id);
          return (
            <li key={skill.id}>
              <Checkbox
                checked={on}
                onChange={() => {
                  setTicked((current) => toggled(current, skill.id));
                }}
                className={cn(
                  "rounded-card border px-3 py-2",
                  on ? "border-primary bg-primary-tint" : "border-outline",
                )}
              >
                <span className="min-w-0 grow">
                  <span className="block truncate font-semibold">{skill.name}</span>
                  <span className="block truncate text-sm text-on-surface-muted">
                    {skill.latest_version.description}
                  </span>
                </span>
                <VersionPill version={skill.latest_version.version} />
              </Checkbox>
            </li>
          );
        })}
      </ul>
      {error !== null && <p className="mt-3 text-sm text-danger">{error}</p>}
      <p className="mt-3 text-sm text-on-surface-muted">
        A click outside this card is the same as Skip.
      </p>
      <DialogButtons>
        <Button ref={skip} onClick={onClose}>
          Skip
        </Button>
        <SaveButton
          label={n === 0 ? "Add" : `Add ${String(n)}`}
          busy={pending}
          disabledReason={pending ? "Adding the skills." : n === 0 ? "Tick a skill first." : null}
          onClick={() => {
            onConfirm(chosen);
          }}
        />
      </DialogButtons>
    </>
  );
}
