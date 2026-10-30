import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn.ts";

// The four button kinds and two heights of components/buttons.md. Disabled is not a kind: the
// same button at 40% opacity, with a tooltip that says why (ui-rules B5).
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-card whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-disabled:cursor-not-allowed aria-disabled:opacity-40",
  {
    variants: {
      kind: {
        primary: "bg-primary font-semibold text-on-primary",
        secondary: "border border-outline-strong text-on-surface hover:bg-surface-raised",
        danger: "border border-danger text-danger",
        "danger-fill": "bg-danger font-semibold text-on-primary",
      },
      size: {
        page: "h-button px-3.5",
        small: "h-button-small px-3",
      },
    },
    defaultVariants: { kind: "secondary", size: "page" },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;

export function Button({
  kind,
  size,
  className,
  ...props
}: ComponentProps<"button"> & ButtonVariants) {
  return (
    <button type="button" {...props} className={cn(buttonVariants({ kind, size }), className)} />
  );
}
