import { Button } from "../../components/ui/button.tsx";
import { cn } from "../../lib/cn.ts";

// The error state of a list or detail view (requirements/README.md): what failed, and Try again.
export function LoadError({
  text,
  onRetry,
  className,
}: {
  text: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex items-center gap-4 px-8 py-6", className)}>
      <p className="text-on-surface-muted">{text}</p>
      <Button size="small" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
