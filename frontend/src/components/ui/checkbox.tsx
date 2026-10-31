import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

// The check box of buttons.md §5: ticked is a `primary` box with a ✓, so the state does not
// depend on colour only; disabled is a grey box at 50%. With `children`, the label is part of
// the control, so a click on the text ticks it too.
interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children?: ReactNode;
  label?: string;
  className?: string;
}

export function Checkbox({
  checked,
  onChange,
  disabled = false,
  children,
  label,
  className,
}: CheckboxProps) {
  const box = (
    <BaseCheckbox.Root
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onCheckedChange={(next) => {
        onChange(next);
      }}
      className={cn(
        "flex size-3.5 shrink-0 items-center justify-center rounded-xs border border-outline-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-checked:border-primary data-checked:bg-primary data-disabled:border-outline data-disabled:bg-surface-raised data-disabled:opacity-50",
        children === undefined && className,
      )}
    >
      <BaseCheckbox.Indicator className="text-on-primary">
        <Check aria-hidden className="size-3" strokeWidth={3} />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
  if (children === undefined) return box;
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 select-none",
        disabled && "cursor-not-allowed",
        className,
      )}
    >
      {box}
      {children}
    </label>
  );
}
