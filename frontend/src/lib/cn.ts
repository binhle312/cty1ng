import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Joins class names, and lets a later Tailwind class win over an earlier one of the same kind.
// tailwind-merge must know our token names, or it would keep both `rounded-control` and
// `rounded-card`.
const merge = extendTailwindMerge<"dashed-slot" | "crop-mask" | "no-scrollbar">({
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
        "avatar-list",
        "avatar-large",
        "list-column",
        "preview",
        "dialog",
        "dialog-wide",
        "dialog-height",
        "button",
        "button-small",
        "control",
      ],
      text: ["badge", "xs", "sm", "base", "lg", "xl", "title"],
    },
    // Our own utilities (styles.css). Without a group of their own, tailwind-merge reads
    // `border-dashed-slot` as a border colour and drops it before `border-outline-strong`.
    classGroups: {
      "dashed-slot": ["border-dashed-slot"],
      "crop-mask": ["crop-mask"],
      "no-scrollbar": ["no-scrollbar"],
    },
  },
});

export function cn(...classes: ClassValue[]): string {
  return merge(clsx(classes));
}
