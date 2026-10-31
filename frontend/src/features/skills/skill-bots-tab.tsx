import { Plus } from "lucide-react";
import { Button } from "../../components/ui/button.tsx";
import { Tooltip } from "../../components/ui/tooltip.tsx";

// The Bots tab (skills-page.md §2a, UI-7.5a). M1 has no bots: the empty line, and + Add is off
// with the tooltip "Create a bot first." M2 fills the table.
export function SkillBotsTab() {
  return (
    <div className="px-8 py-5">
      <div className="flex items-center justify-between">
        <p className="text-on-surface-muted">
          Changes save at once. Each bot uses them from its next run.
        </p>
        <Tooltip label="Create a bot first." side="left">
          <Button size="small" aria-disabled>
            <Plus aria-hidden className="size-3.5" />
            Add
          </Button>
        </Tooltip>
      </div>
      <p className="mt-8 text-center text-on-surface-muted">No bot uses this skill yet.</p>
    </div>
  );
}
