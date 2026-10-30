import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Joins class names, and lets a later Tailwind class win over an earlier one of the same kind.
// tailwind-merge must know our token names, or it would keep both `rounded-control` and
// `rounded-card`.
const merge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        "surface",
        "surface-container",
        "surface-raised",
        "surface-bubble",
        "on-surface",
        "on-surface-muted",
        "primary",
        "on-primary",
        "primary-container",
        "primary-tint",
        "outline",
        "outline-strong",
        "running",
        "waiting",
        "danger",
        "success",
      ],
      radius: ["control", "card", "pill"],
      spacing: [
        "rail",
        "bar-two",
        "header",
        "tile",
        "panel",
        "avatar",
        "button",
        "button-small",
        "control",
      ],
      text: ["xs", "sm", "base", "lg", "xl"],
    },
  },
});

export function cn(...classes: ClassValue[]): string {
  return merge(clsx(classes));
}
