import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

// Tabs on Base UI: arrow keys move between tabs. The open tab has a 2 px `primary` underline
// (bot-page.md §3, skills-page.md §2).
export const TabsRoot = BaseTabs.Root;
export const TabsPanel = BaseTabs.Panel;

export function TabsList({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <BaseTabs.List className={cn("flex items-end gap-5", className)}>{children}</BaseTabs.List>
  );
}

export function Tab({ className, ...props }: ComponentProps<typeof BaseTabs.Tab>) {
  return (
    <BaseTabs.Tab
      {...props}
      className={cn(
        "-mb-px flex h-9 items-center gap-1.5 border-b-2 border-transparent text-on-surface-muted outline-none hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary data-active:border-primary data-active:font-semibold data-active:text-on-surface data-disabled:cursor-not-allowed data-disabled:opacity-40",
        className,
      )}
    />
  );
}
