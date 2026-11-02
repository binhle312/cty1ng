import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Button } from "../../components/ui/button.tsx";
import { Slider } from "../../components/ui/slider.tsx";
import { PICKER_GRADIENTS } from "../../themes/bot-palette.ts";
import { BotAvatar } from "./bot-avatar.tsx";
import {
  type Hsv,
  hexToRgb,
  hsvToRgb,
  isHexColour,
  type Rgb,
  rgbToHex,
  rgbToHsv,
} from "./bot-colours.ts";

// The Custom colour card (bot-avatar.md §5, PR2): a saturation and value box, a hue bar, R, G, B
// and Hex fields that stay in step, a 36 px preview, then Cancel and Use. The state is HSV, so the
// hue stays when the colour turns grey. Our own component: the colour picker libraries add a
// `<style>` element, which the CSP blocks (M2 plan, P6). Esc or a click outside is Cancel (the
// popover).
export function CustomColourCard({
  colour,
  onCancel,
  onUse,
}: {
  colour: string;
  onCancel: () => void;
  onUse: (colour: string) => void;
}) {
  const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(hexToRgb(colour)));
  // The Hex field while it is typed: it may not be a colour yet.
  const [hexText, setHexText] = useState<string | null>(null);
  const rgb = hsvToRgb(hsv);
  const hex = rgbToHex(rgb);

  const setRgb = (next: Rgb) => {
    const nextHsv = rgbToHsv(next);
    // Grey has no hue: keep the one the owner chose.
    setHsv(nextHsv.s === 0 || nextHsv.v === 0 ? { ...nextHsv, h: hsv.h } : nextHsv);
  };

  return (
    <div className="flex w-72 flex-col gap-3">
      <SatValBox hsv={hsv} onChange={setHsv} />
      <Slider
        label="Hue"
        value={Math.round(hsv.h)}
        min={0}
        max={359}
        step={1}
        valueText={(h) => `Hue ${String(h)} degrees`}
        onChange={(h) => {
          setHsv({ ...hsv, h });
        }}
        trackStyle={{
          backgroundImage: PICKER_GRADIENTS.hue,
        }}
      />
      <div className="flex gap-2">
        {(["r", "g", "b"] as const).map((channel) => (
          <label key={channel} className="flex w-14 flex-col gap-1 text-xs text-on-surface-muted">
            {channel.toUpperCase()}
            <input
              type="number"
              min={0}
              max={255}
              value={rgb[channel]}
              onChange={(event) => {
                const n = Number.parseInt(event.target.value, 10);
                if (Number.isNaN(n)) return;
                setRgb({ ...rgb, [channel]: Math.max(0, Math.min(255, n)) });
              }}
              className="h-control rounded-control border border-outline-strong bg-surface px-1.5 text-base text-on-surface outline-none focus:border-primary"
            />
          </label>
        ))}
        <label className="flex min-w-0 grow flex-col gap-1 text-xs text-on-surface-muted">
          Hex
          <input
            value={hexText ?? hex}
            maxLength={7}
            onChange={(event) => {
              const text = event.target.value.trim();
              setHexText(text);
              const withHash = text.startsWith("#") ? text : `#${text}`;
              if (isHexColour(withHash)) setRgb(hexToRgb(withHash));
            }}
            onBlur={() => {
              setHexText(null);
            }}
            className="h-control rounded-control border border-outline-strong bg-surface px-1.5 font-mono text-base text-on-surface uppercase outline-none focus:border-primary"
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <BotAvatar bot={{ avatar_style: "flat", avatar_colour: hex, avatar_url: null }} />
        <div className="ml-auto flex gap-2">
          <Button size="small" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="small"
            kind="primary"
            onClick={() => {
              onUse(hex);
            }}
          >
            Use
          </Button>
        </div>
      </div>
    </div>
  );
}

// The saturation (left to right) and value (bottom to top) box for the hue. One slider for the
// keyboard: ← and → move the saturation, ↑ and ↓ the value, 5 % a step.
function SatValBox({ hsv, onChange }: { hsv: Hsv; onChange: (hsv: Hsv) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const moveTo = (event: PointerEvent<HTMLDivElement>) => {
    const rect = box.current?.getBoundingClientRect();
    if (rect === undefined || rect.width === 0 || rect.height === 0) return;
    const s = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const v = Math.max(0, Math.min(100, 100 - ((event.clientY - rect.top) / rect.height) * 100));
    onChange({ ...hsv, s, v });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = 5;
    const clamp = (n: number) => Math.max(0, Math.min(100, n));
    const next: Partial<Record<string, Hsv>> = {
      ArrowLeft: { ...hsv, s: clamp(hsv.s - step) },
      ArrowRight: { ...hsv, s: clamp(hsv.s + step) },
      ArrowUp: { ...hsv, v: clamp(hsv.v + step) },
      ArrowDown: { ...hsv, v: clamp(hsv.v - step) },
    };
    const moved = next[event.key];
    if (moved === undefined) return;
    event.preventDefault();
    onChange(moved);
  };
  const hue = rgbToHex(hsvToRgb({ h: hsv.h, s: 100, v: 100 }));
  return (
    <div
      ref={box}
      role="slider"
      tabIndex={0}
      aria-label="Saturation and brightness"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(hsv.s)}
      aria-valuetext={`Saturation ${String(Math.round(hsv.s))} %, brightness ${String(Math.round(hsv.v))} %`}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        moveTo(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) moveTo(event);
      }}
      className="relative h-36 w-full cursor-crosshair touch-none rounded-control outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      style={{
        backgroundColor: hue,
        backgroundImage: PICKER_GRADIENTS.satVal,
      }}
    >
      <span
        aria-hidden
        className="absolute size-3.5 -translate-x-1/2 translate-y-1/2 rounded-pill border-2 border-on-surface shadow"
        style={{ left: `${String(hsv.s)}%`, bottom: `${String(hsv.v)}%` }}
      />
    </div>
  );
}
