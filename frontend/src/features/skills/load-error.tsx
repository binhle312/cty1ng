import { Button } from "../../components/ui/button.tsx";

// The error state of a list or detail view (requirements/README.md): what failed, and Try again.
export function LoadError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-4 px-8 py-6">
      <p className="text-on-surface-muted">{text}</p>
      <Button size="small" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
