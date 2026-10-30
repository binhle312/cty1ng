import { useEffect, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

// requirements/README.md, "Loading uses skeletons": grey shapes in the layout of the content,
// shown only when loading takes longer than 200 ms, marked aria-busy, and still when the OS
// asks for reduced motion.
export const SKELETON_DELAY_MS = 200;

function useDelayed(ms: number): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setShown(true);
    }, ms);
    return () => {
      clearTimeout(timer);
    };
  }, [ms]);
  return shown;
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("rounded-control bg-surface-raised motion-safe:animate-pulse", className)}
    />
  );
}

// A whole loading area: nothing for the first 200 ms, then the shapes.
export function SkeletonArea({ label, children }: { label: string; children: ReactNode }) {
  const shown = useDelayed(SKELETON_DELAY_MS);
  return (
    <div aria-busy="true" aria-label={label} role="status">
      {shown ? children : null}
    </div>
  );
}
