import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { cn } from "../../lib/cn.ts";

// An on/off switch (the Always load switch, D16). On is a `primary` track, so the state does not
// rely on the thumb alone. Name it with `label`: it has no text of its own.
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <BaseSwitch.Root
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onCheckedChange={(next) => {
        onChange(next);
      }}
      className={cn(
        "relative flex h-5 w-9 shrink-0 items-center rounded-pill border border-outline-strong bg-surface-raised p-0.5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-checked:border-primary data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-40",
        className,
      )}
    >
      <BaseSwitch.Thumb className="size-3.5 rounded-pill bg-on-surface-muted transition-transform data-checked:translate-x-4 data-checked:bg-on-primary" />
    </BaseSwitch.Root>
  );
}
