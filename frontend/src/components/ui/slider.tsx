import { Slider as BaseSlider } from "@base-ui/react/slider";
import type { CSSProperties } from "react";
import { cn } from "../../lib/cn.ts";

// A one-thumb slider on Base UI (the history share, the crop zoom): arrow keys move it one step,
// Page Up and Page Down ten. It sets the thumb place with React `style` (the CSSOM), which the
// CSP allows (M2 plan, P7).
export function Slider({
  value,
  onChange,
  min,
  max,
  step,
  label,
  valueText,
  disabled = false,
  trackStyle,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  label: string;
  // What a screen reader says for the value, for example "40 %".
  valueText?: (value: number) => string;
  disabled?: boolean;
  // A track drawn from data (the hue bar of the Custom colour card). With it, no fill shows.
  trackStyle?: CSSProperties;
  className?: string;
}) {
  return (
    <BaseSlider.Root
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onValueChange={(next) => {
        if (typeof next === "number") onChange(next);
      }}
      className={cn("w-full", className)}
    >
      <BaseSlider.Control className="flex h-5 w-full items-center data-disabled:opacity-40">
        <BaseSlider.Track
          className={cn(
            "w-full rounded-pill",
            trackStyle === undefined ? "h-1 bg-outline-strong" : "h-3",
          )}
          style={trackStyle}
        >
          {trackStyle === undefined && <BaseSlider.Indicator className="rounded-pill bg-primary" />}
          <BaseSlider.Thumb
            aria-label={label}
            getAriaValueText={valueText === undefined ? undefined : (_text, v) => valueText(v)}
            className="size-4 rounded-pill border-2 border-surface bg-primary outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
}
