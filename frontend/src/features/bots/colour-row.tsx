import { Check, Palette, Shuffle } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/button.tsx";
import { Popover } from "../../components/ui/popover.tsx";
import { Tooltip } from "../../components/ui/tooltip.tsx";
import { cn } from "../../lib/cn.ts";
import { BOT_PALETTE, isPaletteColour, randomBotColour, readableOn } from "./bot-colours.ts";
import { CustomColourCard } from "./custom-colour-card.tsx";

// The colour row (bot-avatar.md §5): the 10 swatches of the theme, then, after a divider, the
// custom swatch (only when the colour is not a swatch, with no hex text), Custom and Random. Used
// colours are not marked. The colour comes from data, so each swatch is a `style`.
export function ColourRow({
  colour,
  onChange,
  disabled = false,
}: {
  colour: string;
  onChange: (colour: string) => void;
  disabled?: boolean;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const custom = !isPaletteColour(colour);
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Colour">
      {BOT_PALETTE.map((swatch, i) => (
        <Swatch
          key={swatch}
          colour={swatch}
          label={`Colour ${String(i + 1)}`}
          picked={swatch.toUpperCase() === colour.toUpperCase()}
          disabled={disabled}
          onClick={() => {
            onChange(swatch);
          }}
        />
      ))}
      <span aria-hidden className="mx-1 h-6 w-px bg-outline-strong" />
      {custom && <Swatch colour={colour} label="Custom colour" picked disabled={disabled} />}
      <Popover
        open={customOpen}
        onOpenChange={(open) => {
          if (!disabled) setCustomOpen(open);
        }}
        label="Custom colour"
        trigger={
          <Button size="small" aria-disabled={disabled}>
            <Palette aria-hidden size={14} />
            Custom
          </Button>
        }
      >
        <CustomColourCard
          colour={colour}
          onCancel={() => {
            setCustomOpen(false);
          }}
          onUse={(next) => {
            setCustomOpen(false);
            onChange(next);
          }}
        />
      </Popover>
      <Button
        size="small"
        aria-label="Random colour"
        aria-disabled={disabled}
        onClick={() => {
          if (!disabled) onChange(randomBotColour(Math.random));
        }}
      >
        <Shuffle aria-hidden size={14} />
        Random
      </Button>
    </div>
  );
}

function Swatch({
  colour,
  label,
  picked,
  disabled,
  onClick,
}: {
  colour: string;
  label: string;
  picked: boolean;
  disabled: boolean;
  // The custom swatch shows the colour only.
  onClick?: () => void;
}) {
  const look = cn(
    "flex size-7 items-center justify-center rounded-pill outline-none",
    picked && "ring-2 ring-on-surface ring-offset-2 ring-offset-surface-container",
  );
  const style = { backgroundColor: colour, color: readableOn(colour) };
  const tick = picked ? <Check aria-hidden size={14} strokeWidth={3} /> : null;
  if (onClick === undefined) {
    return (
      <span role="img" aria-label={`${label}, picked`} className={look} style={style}>
        {tick}
      </span>
    );
  }
  return (
    <Tooltip label={label} side="top">
      <button
        type="button"
        aria-label={label}
        aria-pressed={picked}
        aria-disabled={disabled}
        onClick={() => {
          if (!disabled) onClick();
        }}
        className={cn(
          look,
          "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary aria-disabled:cursor-not-allowed",
        )}
        style={style}
      >
        {tick}
      </button>
    </Tooltip>
  );
}
